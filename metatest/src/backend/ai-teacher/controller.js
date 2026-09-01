'use strict';

/**
 * AI Teacher HTTP controller
 * Intended path: ai-teacher/controller.js (required by ai-teacher/routes.js)
 */

const db = require('../db');
const { CONTEXT_LIMITS, dailyRefillForPlan, planAllowsTeacher } = require('./config');
const coinWallet = require('./services/coinWallet');
const pricing = require('./services/pricing');
const aiProvider = require('./services/aiProvider');
const promptBuilder = require('./services/promptBuilder');
const memoryService = require('./services/memoryService');
const conversationService = require('./services/conversationService');

function publicTeacher(row, planKey) {
    if (!row) return null;
    return {
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        displayName: row.display_name,
        age: row.age,
        avatarUrl: row.avatar_url,
        subject: row.subject,
        specialty: row.specialty,
        description: row.description,
        personality: row.personality,
        teachingStyle: row.teaching_style,
        knowledgeLevel: row.knowledge_level,
        expertise: row.expertise,
        experience: row.experience,
        isFree: !!row.is_free,
        isActive: !!row.is_active,
        locked: !planAllowsTeacher(planKey, row),
        pricePerMessage: row.price_per_message,
        typicalEnergy: Number(row.price_per_message) || 0,
        stats: {
            students: row.students_count,
            questionsAnswered: row.questions_answered,
            conversations: row.conversations_count,
            averageRating: row.average_rating,
        },
    };
}

function publicMessage(row) {
    return {
        id: row.id,
        role: row.role,
        content: row.content,
        inputTokens: row.input_tokens || 0,
        outputTokens: row.output_tokens || 0,
        totalTokens: row.total_tokens || 0,
        coinCost: row.coin_cost || 0,
        costUsd: row.cost_usd != null ? Number(row.cost_usd) : undefined,
        costIrr: row.cost_irr != null ? Number(row.cost_irr) : undefined,
        model: row.model || null,
        isStarter: !!row.is_starter,
        createdAt: row.created_at,
    };
}

async function loadUserRow(userId) {
    const [[user]] = await db.query(
        `SELECT id, first_name, last_name, current_plan, plan_expires_at,
                ai_teacher_id, ai_teacher_onboarding_completed
         FROM tam24_users WHERE id = ?`,
        [userId]
    );
    return user || null;
}

async function loadTeacher(teacherId, { includeSecrets = false } = {}) {
    const [[row]] = await db.query(
        `SELECT * FROM tam24_ai_teachers WHERE id = ? LIMIT 1`,
        [teacherId]
    );
    if (!row) return null;
    if (!includeSecrets) return row;
    return row;
}

async function ensureSettings(userId) {
    await db.query(
        `INSERT IGNORE INTO tam24_ai_user_settings (user_id) VALUES (?)`,
        [userId]
    );
    const [[settings]] = await db.query(
        `SELECT * FROM tam24_ai_user_settings WHERE user_id = ?`,
        [userId]
    );
    return settings;
}

async function ensureProfile(userId) {
    const [[profile]] = await db.query(
        `SELECT * FROM tam24_ai_student_profiles WHERE user_id = ?`,
        [userId]
    );
    return profile || null;
}

function nextRefillAtIso() {
    const next = new Date();
    next.setHours(24, 0, 0, 0); // upcoming midnight (server time)
    return next.toISOString();
}

async function getBalanceSnapshot(userId, planKey) {
    const refill = await coinWallet.applyDailyRefill(db, userId, planKey);
    return {
        balance: refill.balance,
        refilled: refill.refilled,
        refillAmount: refill.amount,
        dailyAllowance: dailyRefillForPlan(planKey),
        nextRefillAt: nextRefillAtIso(),
    };
}

async function loadBook(bookId) {
    if (!bookId) return null;
    try {
        const [[book]] = await db.query(
            `SELECT id, title, subject, grade, publisher, pdf_url, content_text, content_summary
             FROM tam24_ai_books WHERE id = ? AND is_active = 1 LIMIT 1`,
            [bookId]
        );
        return book || null;
    } catch {
        return null; // books table may not exist yet
    }
}

// ─── Bootstrap / onboarding status ───────────────────────────────────────────
const getBootstrap = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await loadUserRow(userId);
        if (!user) return res.status(404).json({ success: false, message: 'کاربر یافت نشد.' });

        const wallet = await getBalanceSnapshot(userId, user.current_plan);
        const settings = await ensureSettings(userId);
        const profile = await ensureProfile(userId);

        let teacher = null;
        if (user.ai_teacher_id) {
            const t = await loadTeacher(user.ai_teacher_id);
            if (t && t.is_active) teacher = publicTeacher(t, user.current_plan);
        }

        let latestConversation = null;
        if (teacher) {
            const conv = await conversationService.getLatestConversation(db, userId, teacher.id);
            if (conv) {
                latestConversation = {
                    id: conv.id,
                    title: conv.title,
                    teacherId: conv.teacher_id,
                    lastMessageAt: conv.last_message_at,
                    messageCount: conv.message_count,
                };
            }
        }

        return res.json({
            success: true,
            data: {
                onboardingCompleted: !!user.ai_teacher_onboarding_completed,
                user: {
                    id: user.id,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    currentPlan: user.current_plan,
                },
                teacher,
                profile: profile ? {
                    schoolName: profile.school_name,
                    grade: profile.grade,
                    field: profile.field,
                    weaknesses: profile.weaknesses,
                    strengths: profile.strengths,
                    learningGoals: profile.learning_goals,
                    learningPreferences: profile.learning_preferences,
                    additionalNotes: profile.additional_notes,
                } : null,
                settings: {
                    lowCoinMode: !!settings.low_coin_mode,
                    alwaysExamples: !!settings.always_examples,
                    conciseResponses: !!settings.concise_responses,
                    stepByStep: !!settings.step_by_step,
                    parentReportsEnabled: !!settings.parent_reports_enabled,
                    selectedBookId: settings.selected_book_id || null,
                },
                wallet,
                latestConversation,
            },
        });
    } catch (err) {
        console.error('[ai-teacher] getBootstrap', err);
        return res.status(500).json({ success: false, message: 'خطا در بارگذاری معلم هوشمند.' });
    }
};

const saveStudentProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            schoolName, grade, field, weaknesses, strengths,
            learningGoals, learningPreferences, additionalNotes,
        } = req.body || {};

        await db.query(
            `INSERT INTO tam24_ai_student_profiles
             (user_id, school_name, grade, field, weaknesses, strengths, learning_goals, learning_preferences, additional_notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               school_name = VALUES(school_name),
               grade = VALUES(grade),
               field = VALUES(field),
               weaknesses = VALUES(weaknesses),
               strengths = VALUES(strengths),
               learning_goals = VALUES(learning_goals),
               learning_preferences = VALUES(learning_preferences),
               additional_notes = VALUES(additional_notes),
               updated_at = NOW()`,
            [
                userId,
                schoolName || null,
                grade || null,
                field || null,
                weaknesses || null,
                strengths || null,
                learningGoals || null,
                learningPreferences || null,
                additionalNotes || null,
            ]
        );

        // Seed initial memory from profile weaknesses/goals (no AI call)
        if (weaknesses) {
            await db.query(
                `INSERT INTO tam24_ai_student_memory (user_id, memory_type, content, importance, source)
                 VALUES (?, 'weakness', ?, 7, 'profile')`,
                [userId, String(weaknesses).slice(0, 500)]
            );
        }
        if (learningGoals) {
            await db.query(
                `INSERT INTO tam24_ai_student_memory (user_id, memory_type, content, importance, source)
                 VALUES (?, 'goal', ?, 6, 'profile')`,
                [userId, String(learningGoals).slice(0, 500)]
            );
        }

        return res.json({ success: true, message: 'پروفایل یادگیری ذخیره شد.' });
    } catch (err) {
        console.error('[ai-teacher] saveStudentProfile', err);
        return res.status(500).json({ success: false, message: 'خطا در ذخیره پروفایل.' });
    }
};

const listTeachers = async (req, res) => {
    try {
        const user = await loadUserRow(req.user.id);
        const planKey = user?.current_plan;
        const [rows] = await db.query(
            `SELECT id, first_name, last_name, display_name, age, avatar_url, subject, specialty,
                    description, personality, teaching_style, knowledge_level, expertise, experience,
                    is_free, is_active, price_per_message, students_count, questions_answered,
                    conversations_count, average_rating, sort_order
             FROM tam24_ai_teachers
             WHERE is_active = 1
             ORDER BY sort_order ASC, id ASC`
        );
        return res.json({ success: true, data: rows.map((row) => publicTeacher(row, planKey)) });
    } catch (err) {
        console.error('[ai-teacher] listTeachers', err);
        return res.status(500).json({ success: false, message: 'خطا در دریافت لیست معلمان.' });
    }
};

const selectTeacher = async (req, res) => {
    const userId = req.user.id;
    const teacherId = Number(req.body?.teacherId);

    if (!teacherId) {
        return res.status(400).json({ success: false, message: 'شناسه معلم الزامی است.' });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [[teacher]] = await conn.query(
            `SELECT * FROM tam24_ai_teachers WHERE id = ? FOR UPDATE`,
            [teacherId]
        );

        if (!teacher || !teacher.is_active) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'معلم در دسترس نیست.' });
        }

        const [[user]] = await conn.query(
            `SELECT id, first_name, last_name, current_plan FROM tam24_users WHERE id = ?`,
            [userId]
        );

        if (!planAllowsTeacher(user?.current_plan, teacher)) {
            await conn.rollback();
            return res.status(403).json({
                success: false,
                code: 'TEACHER_REQUIRES_PRO',
                message: 'این معلم فقط برای کاربران ویژه در دسترس است.',
            });
        }

        await conn.query(
            `UPDATE tam24_users
             SET ai_teacher_id = ?, ai_teacher_onboarding_completed = 1, updated_at = NOW()
             WHERE id = ?`,
            [teacherId, userId]
        );

        // Ensure wallet + settings exist
        await coinWallet.ensureWallet(conn, userId);
        await conn.query(`INSERT IGNORE INTO tam24_ai_user_settings (user_id) VALUES (?)`, [userId]);

        let conversation = await conversationService.getLatestConversation(conn, userId, teacherId);
        let starterMessage = null;

        if (!conversation) {
            const created = await conversationService.createConversationWithStarter(conn, {
                userId,
                teacherId,
                user,
            });
            conversation = created.conversation;
            starterMessage = created.starterMessage;
        }

        await conn.commit();

        // Daily refill outside main tx (has its own tx)
        const wallet = await getBalanceSnapshot(userId, user.current_plan);

        return res.json({
            success: true,
            data: {
                teacher: publicTeacher(teacher, user.current_plan),
                conversation: {
                    id: conversation.id || conversation.conversation?.id,
                    title: conversation.title || 'گفتگوی جدید',
                    teacherId,
                },
                starterMessage,
                wallet,
            },
        });
    } catch (err) {
        await conn.rollback();
        console.error('[ai-teacher] selectTeacher', err);
        return res.status(500).json({ success: false, message: 'خطا در انتخاب معلم.' });
    } finally {
        conn.release();
    }
};

const openSession = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await loadUserRow(userId);
        if (!user) return res.status(404).json({ success: false, message: 'کاربر یافت نشد.' });

        if (!user.ai_teacher_onboarding_completed || !user.ai_teacher_id) {
            return res.status(400).json({
                success: false,
                code: 'ONBOARDING_REQUIRED',
                message: 'ابتدا مراحل آشنایی با معلم هوشمند را کامل کنید.',
            });
        }

        const teacher = await loadTeacher(user.ai_teacher_id);
        if (!teacher || !teacher.is_active) {
            return res.status(404).json({
                success: false,
                code: 'TEACHER_UNAVAILABLE',
                message: 'معلم انتخابی در دسترس نیست. لطفاً معلم دیگری انتخاب کنید.',
            });
        }

        const wallet = await getBalanceSnapshot(userId, user.current_plan);
        let conversation = await conversationService.getLatestConversation(db, userId, teacher.id);
        let starterMessage = null;

        if (!conversation) {
            const created = await conversationService.createConversationWithStarter(db, {
                userId,
                teacherId: teacher.id,
                user,
            });
            conversation = {
                id: created.conversation.id,
                title: created.conversation.title,
                teacher_id: teacher.id,
                message_count: 1,
                last_message_at: new Date(),
            };
            starterMessage = created.starterMessage;
        }

        const messages = await conversationService.getMessages(db, conversation.id, { limit: 50 });

        return res.json({
            success: true,
            data: {
                teacher: publicTeacher(teacher, user.current_plan),
                conversation: {
                    id: conversation.id,
                    title: conversation.title,
                    teacherId: teacher.id,
                    messageCount: conversation.message_count,
                    lastMessageAt: conversation.last_message_at,
                },
                messages: messages.map(publicMessage),
                starterMessage,
                wallet,
            },
        });
    } catch (err) {
        console.error('[ai-teacher] openSession', err);
        return res.status(500).json({ success: false, message: 'خطا در باز کردن گفتگو.' });
    }
};

const getConversation = async (req, res) => {
    try {
        const userId = req.user.id;
        const conversationId = Number(req.params.id);
        const beforeId = req.query.beforeId ? Number(req.query.beforeId) : null;
        const limit = Math.min(100, Number(req.query.limit) || 50);

        const user = await loadUserRow(userId);
        const conversation = await conversationService.getConversationForUser(db, conversationId, userId);
        if (!conversation) {
            return res.status(404).json({ success: false, message: 'گفتگو یافت نشد.' });
        }

        const teacher = await loadTeacher(conversation.teacher_id);
        const messages = await conversationService.getMessages(db, conversationId, { limit, beforeId });

        return res.json({
            success: true,
            data: {
                conversation: {
                    id: conversation.id,
                    title: conversation.title,
                    teacherId: conversation.teacher_id,
                    messageCount: conversation.message_count,
                    lastMessageAt: conversation.last_message_at,
                },
                teacher: publicTeacher(teacher, user?.current_plan),
                messages: messages.map(publicMessage),
            },
        });
    } catch (err) {
        console.error('[ai-teacher] getConversation', err);
        return res.status(500).json({ success: false, message: 'خطا در دریافت گفتگو.' });
    }
};

const listConversations = async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = Math.min(50, Number(req.query.limit) || 20);
        const offset = Math.max(0, Number(req.query.offset) || 0);
        const rows = await conversationService.listConversations(db, userId, { limit, offset });

        return res.json({
            success: true,
            data: rows.map((r) => ({
                id: r.id,
                title: r.title,
                teacherId: r.teacher_id,
                teacherName: r.teacher_name,
                teacherAvatar: r.teacher_avatar,
                teacherSubject: r.teacher_subject,
                lastMessageAt: r.last_message_at,
                createdAt: r.created_at,
                messageCount: r.message_count,
            })),
        });
    } catch (err) {
        console.error('[ai-teacher] listConversations', err);
        return res.status(500).json({ success: false, message: 'خطا در دریافت تاریخچه.' });
    }
};

const updateSettings = async (req, res) => {
    try {
        const userId = req.user.id;
        await ensureSettings(userId);

        const {
            lowCoinMode,
            alwaysExamples,
            conciseResponses,
            stepByStep,
            selectedBookId,
        } = req.body || {};

        const sets = ['updated_at = NOW()'];
        const vals = [];
        if (typeof lowCoinMode === 'boolean') {
            sets.push('low_coin_mode = ?');
            vals.push(lowCoinMode ? 1 : 0);
        }
        if (typeof alwaysExamples === 'boolean') {
            sets.push('always_examples = ?');
            vals.push(alwaysExamples ? 1 : 0);
        }
        if (typeof conciseResponses === 'boolean') {
            sets.push('concise_responses = ?');
            vals.push(conciseResponses ? 1 : 0);
        }
        if (typeof stepByStep === 'boolean') {
            sets.push('step_by_step = ?');
            vals.push(stepByStep ? 1 : 0);
        }

        if (vals.length) {
            await db.query(
                `UPDATE tam24_ai_user_settings SET ${sets.join(', ')} WHERE user_id = ?`,
                [...vals, userId]
            );
        }

        // selectedBookId: number selects, null clears, undefined leaves as-is
        if (selectedBookId !== undefined) {
            const bookId = selectedBookId === null ? null : Number(selectedBookId) || null;
            if (bookId) {
                const book = await loadBook(bookId);
                if (!book) {
                    return res.status(400).json({ success: false, message: 'کتاب انتخابی معتبر نیست.' });
                }
            }
            try {
                await db.query(
                    `UPDATE tam24_ai_user_settings SET selected_book_id = ?, updated_at = NOW() WHERE user_id = ?`,
                    [bookId, userId]
                );
            } catch (bookErr) {
                // Column may not exist until 002_ai_books.sql is applied
                console.error('[ai-teacher] selected_book_id update skipped', bookErr?.code || bookErr);
            }
        }

        const settings = await ensureSettings(userId);
        return res.json({
            success: true,
            data: {
                lowCoinMode: !!settings.low_coin_mode,
                alwaysExamples: !!settings.always_examples,
                conciseResponses: !!settings.concise_responses,
                stepByStep: !!settings.step_by_step,
                parentReportsEnabled: !!settings.parent_reports_enabled,
                selectedBookId: settings.selected_book_id || null,
            },
        });
    } catch (err) {
        console.error('[ai-teacher] updateSettings', err);
        return res.status(500).json({ success: false, message: 'خطا در ذخیره تنظیمات.' });
    }
};

const listBooks = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, title, subject, grade, publisher
             FROM tam24_ai_books
             WHERE is_active = 1
             ORDER BY sort_order ASC, id ASC`
        );
        return res.json({
            success: true,
            data: rows.map((b) => ({
                id: b.id,
                title: b.title,
                subject: b.subject,
                grade: b.grade,
                publisher: b.publisher,
            })),
        });
    } catch (err) {
        // Table may not exist yet — return empty list instead of failing the UI
        return res.json({ success: true, data: [] });
    }
};

const getWallet = async (req, res) => {
    try {
        const user = await loadUserRow(req.user.id);
        const wallet = await getBalanceSnapshot(req.user.id, user?.current_plan);
        return res.json({ success: true, data: wallet });
    } catch (err) {
        console.error('[ai-teacher] getWallet', err);
        return res.status(500).json({ success: false, message: 'خطا در دریافت کیف سکه.' });
    }
};

const createConversation = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await loadUserRow(userId);
        if (!user?.ai_teacher_id) {
            return res.status(400).json({ success: false, message: 'ابتدا معلم را انتخاب کنید.' });
        }
        const teacher = await loadTeacher(user.ai_teacher_id);
        if (!teacher?.is_active) {
            return res.status(404).json({ success: false, message: 'معلم در دسترس نیست.' });
        }

        const created = await conversationService.createConversationWithStarter(db, {
            userId,
            teacherId: teacher.id,
            user,
        });

        return res.json({
            success: true,
            data: {
                conversation: created.conversation,
                starterMessage: created.starterMessage,
                teacher: publicTeacher(teacher, user.current_plan),
            },
        });
    } catch (err) {
        console.error('[ai-teacher] createConversation', err);
        return res.status(500).json({ success: false, message: 'خطا در ایجاد گفتگو.' });
    }
};

/**
 * SSE streaming chat endpoint.
 * Body: { conversationId?, message }
 */
const streamChat = async (req, res) => {
    const userId = req.user.id;
    const message = String(req.body?.message || '').trim();
    let conversationId = req.body?.conversationId ? Number(req.body.conversationId) : null;

    if (!message) {
        return res.status(400).json({ success: false, message: 'پیام نمی‌تواند خالی باشد.' });
    }
    if (message.length > CONTEXT_LIMITS.maxUserMessageChars) {
        return res.status(400).json({ success: false, message: 'پیام بیش از حد طولانی است.' });
    }

    // Prepare SSE
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const sendEvent = (event, data) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const reservationRef = `msg-${userId}-${Date.now()}`;
    let reserved = 0;
    let conn = null;

    try {
        const user = await loadUserRow(userId);
        if (!user) {
            sendEvent('error', { code: 'USER_NOT_FOUND', message: 'کاربر یافت نشد.' });
            return res.end();
        }

        let conversation = null;
        if (conversationId) {
            conversation = await conversationService.getConversationForUser(db, conversationId, userId);
            if (!conversation) {
                sendEvent('error', { code: 'CONVERSATION_NOT_FOUND', message: 'گفتگو یافت نشد.' });
                return res.end();
            }
        } else {
            if (!user.ai_teacher_id) {
                sendEvent('error', { code: 'NO_TEACHER', message: 'معلمی انتخاب نشده است.' });
                return res.end();
            }
            conversation = await conversationService.getLatestConversation(db, userId, user.ai_teacher_id);
            if (!conversation) {
                const created = await conversationService.createConversationWithStarter(db, {
                    userId,
                    teacherId: user.ai_teacher_id,
                    user,
                });
                conversation = {
                    id: created.conversation.id,
                    user_id: userId,
                    teacher_id: user.ai_teacher_id,
                    title: 'گفتگوی جدید',
                    summary: null,
                    message_count: 1,
                };
                sendEvent('starter', created.starterMessage);
            }
            conversationId = conversation.id;
        }

        const teacher = await loadTeacher(conversation.teacher_id, { includeSecrets: true });
        if (!teacher || !teacher.is_active) {
            sendEvent('error', { code: 'TEACHER_UNAVAILABLE', message: 'معلم در دسترس نیست.' });
            return res.end();
        }

        if (!planAllowsTeacher(user.current_plan, teacher)) {
            sendEvent('error', {
                code: 'TEACHER_REQUIRES_PRO',
                message: 'این معلم فقط برای کاربران ویژه در دسترس است.',
            });
            return res.end();
        }

        const settings = await ensureSettings(userId);
        const model = promptBuilder.resolveModel(settings, teacher);
        const maxTokens = promptBuilder.resolveMaxOutputTokens(teacher, settings);
        const typical = pricing.estimateTypicalEnergy({
            model,
            maxOutputTokens: maxTokens,
            teacherMultiplier: teacher.teacher_multiplier,
        });
        const maxEst = pricing.estimateMaxEnergy({
            model,
            maxOutputTokens: maxTokens,
            teacherMultiplier: teacher.teacher_multiplier,
        });

        const refill = await coinWallet.applyDailyRefill(db, userId, user.current_plan);
        if (refill.balance < typical.energy) {
            sendEvent('error', {
                code: 'INSUFFICIENT_COINS',
                message: 'موجودی انرژی کافی نیست.',
                balance: refill.balance,
                needed: typical.energy,
            });
            return res.end();
        }

        const reserveAmount = Math.max(
            typical.energy,
            Math.min(refill.balance, maxEst.energy)
        );

        conn = await db.getConnection();
        await conn.beginTransaction();
        const reservation = await coinWallet.reserveCoins(
            conn,
            userId,
            reserveAmount,
            reservationRef
        );
        reserved = reservation.reserved;
        await conn.commit();
        conn.release();
        conn = null;

        sendEvent('status', { status: 'thinking', balance: reservation.balance });
        sendEvent('meta', {
            conversationId,
            reserved,
            teacherId: teacher.id,
            typicalEnergy: typical.energy,
        });

        // Persist user message
        const isFirstUserMessage = Number(conversation.message_count || 0) <= 1;
        const [userMsgResult] = await db.query(
            `INSERT INTO tam24_ai_messages (conversation_id, role, content)
             VALUES (?, 'user', ?)`,
            [conversationId, message]
        );
        const userMessageId = userMsgResult.insertId;

        if (isFirstUserMessage || conversation.title === 'گفتگوی جدید') {
            const title = conversationService.titleFromUserMessage(message);
            await db.query(
                `UPDATE tam24_ai_conversations SET title = ? WHERE id = ? AND user_id = ?`,
                [title, conversationId, userId]
            );
        }

        sendEvent('user_message', {
            id: userMessageId,
            role: 'user',
            content: message,
            conversationId,
        });

        const profile = await ensureProfile(userId);
        const memories = await memoryService.getActiveMemories(db, userId);
        const summary = await memoryService.maybeSummarizeConversation(db, conversation);
        const book = await loadBook(settings.selected_book_id);
        const recent = await conversationService.getRecentMessages(db, conversationId, CONTEXT_LIMITS.recentMessages);
        const recentWithoutCurrent = recent.filter((m) => m.id !== userMessageId);

        const systemPrompt = promptBuilder.buildTeacherPrompt({
            teacher,
            user,
            profile,
            memories,
            settings,
            conversationSummary: summary,
            book,
        });

        const providerMessages = promptBuilder.toProviderMessages({
            systemPrompt,
            recentMessages: recentWithoutCurrent,
            currentUserMessage: message,
        });

        sendEvent('status', { status: 'generating' });
        sendEvent('assistant_start', { conversationId });

        const startedAt = Date.now();
        let fullText = '';
        let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, cachedTokens: 0 };
        let usedModel = model;

        for await (const chunk of aiProvider.stream({
            messages: providerMessages,
            model,
            maxTokens,
            temperature: promptBuilder.resolveTemperature(teacher, settings),
        })) {
            if (chunk.type === 'delta') {
                fullText += chunk.text;
                sendEvent('delta', { text: chunk.text });
            } else if (chunk.type === 'done') {
                fullText = chunk.content || fullText;
                usage = chunk.usage || usage;
                usedModel = chunk.model || model;
            }
        }

        if (!String(fullText).trim()) {
            const emptyErr = new Error('empty response');
            emptyErr.code = 'EMPTY_RESPONSE';
            throw emptyErr;
        }

        const durationMs = Date.now() - startedAt;
        const quote = coinWallet.quoteMessageCost({
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            cachedTokens: usage.cachedTokens || 0,
            model: usedModel,
            teacherMultiplier: teacher.teacher_multiplier,
        });
        const finalCost = quote.energy;

        conn = await db.getConnection();
        await conn.beginTransaction();

        const charge = await coinWallet.finalizeCharge(conn, userId, {
            reserved,
            finalCost,
            referenceId: reservationRef,
            metadata: {
                conversationId,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                cachedTokens: usage.cachedTokens || 0,
                model: usedModel,
                costUsd: quote.usd,
                costIrr: quote.irr,
                exchangeRateIrr: quote.exchangeRateIrr,
            },
        });

        let assistantMsgId;
        try {
            const [assistantMsgResult] = await conn.query(
                `INSERT INTO tam24_ai_messages
                 (conversation_id, role, content, input_tokens, output_tokens, total_tokens,
                  coin_cost, model, cost_usd, cost_irr, cached_tokens, exchange_rate_irr)
                 VALUES (?, 'assistant', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    conversationId,
                    fullText,
                    usage.inputTokens,
                    usage.outputTokens,
                    usage.totalTokens,
                    charge.charged,
                    usedModel,
                    quote.usd,
                    quote.irr,
                    usage.cachedTokens || 0,
                    quote.exchangeRateIrr,
                ]
            );
            assistantMsgId = assistantMsgResult.insertId;
        } catch (insertErr) {
            if (!/Unknown column|ER_BAD_FIELD_ERROR/i.test(insertErr.message || '') && insertErr.code !== 'ER_BAD_FIELD_ERROR') {
                throw insertErr;
            }
            const [assistantMsgResult] = await conn.query(
                `INSERT INTO tam24_ai_messages
                 (conversation_id, role, content, input_tokens, output_tokens, total_tokens, coin_cost, model)
                 VALUES (?, 'assistant', ?, ?, ?, ?, ?, ?)`,
                [
                    conversationId,
                    fullText,
                    usage.inputTokens,
                    usage.outputTokens,
                    usage.totalTokens,
                    charge.charged,
                    usedModel,
                ]
            );
            assistantMsgId = assistantMsgResult.insertId;
        }

        await conn.query(
            `UPDATE tam24_ai_conversations
             SET message_count = message_count + 2,
                 total_tokens = total_tokens + ?,
                 last_message_at = NOW(),
                 updated_at = NOW()
             WHERE id = ?`,
            [usage.totalTokens, conversationId]
        );

        await conn.query(
            `UPDATE tam24_ai_teachers
             SET questions_answered = questions_answered + 1
             WHERE id = ?`,
            [teacher.id]
        );

        try {
            await conn.query(
                `INSERT INTO tam24_ai_usage_logs
                 (user_id, teacher_id, conversation_id, message_id, model,
                  input_tokens, output_tokens, total_tokens, coin_cost, request_duration_ms, success,
                  cost_usd, cost_irr, cached_tokens, energy_cost, exchange_rate_irr)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
                [
                    userId,
                    teacher.id,
                    conversationId,
                    assistantMsgId,
                    usedModel,
                    usage.inputTokens,
                    usage.outputTokens,
                    usage.totalTokens,
                    charge.charged,
                    durationMs,
                    quote.usd,
                    quote.irr,
                    usage.cachedTokens || 0,
                    charge.charged,
                    quote.exchangeRateIrr,
                ]
            );
        } catch (logErr) {
            if (!/Unknown column|ER_BAD_FIELD_ERROR/i.test(logErr.message || '') && logErr.code !== 'ER_BAD_FIELD_ERROR') {
                throw logErr;
            }
            await conn.query(
                `INSERT INTO tam24_ai_usage_logs
                 (user_id, teacher_id, conversation_id, message_id, model,
                  input_tokens, output_tokens, total_tokens, coin_cost, request_duration_ms, success)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                [
                    userId,
                    teacher.id,
                    conversationId,
                    assistantMsgId,
                    usedModel,
                    usage.inputTokens,
                    usage.outputTokens,
                    usage.totalTokens,
                    charge.charged,
                    durationMs,
                ]
            );
        }

        await conn.commit();
        conn.release();
        conn = null;
        reserved = 0;

        memoryService.maybeUpdateMemory(db, {
            userId,
            conversationId,
            messageCount: (conversation.message_count || 0) + 2,
            userMessage: message,
            assistantMessage: fullText,
        }).catch(() => {});

        sendEvent('done', {
            message: {
                id: assistantMsgId,
                role: 'assistant',
                content: fullText,
                coinCost: charge.charged,
                costUsd: quote.usd,
                costIrr: quote.irr,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                totalTokens: usage.totalTokens,
                model: usedModel,
                conversationId,
            },
            wallet: {
                balance: charge.balance,
                charged: charge.charged,
                refunded: charge.refunded,
                costUsd: quote.usd,
                costIrr: quote.irr,
            },
            durationMs,
        });
        sendEvent('status', { status: 'ready', balance: charge.balance });
        return res.end();
    } catch (err) {
        console.error('[ai-teacher] streamChat', err);

        let refundedAmount = 0;
        let balanceAfterRefund = err.balance;

        if (reserved > 0) {
            try {
                const refundConn = await db.getConnection();
                try {
                    await refundConn.beginTransaction();
                    const refund = await coinWallet.refundReservation(
                        refundConn,
                        userId,
                        reserved,
                        reservationRef,
                        'بازگشت به دلیل خطای تولید پاسخ'
                    );
                    await refundConn.commit();
                    refundedAmount = refund.refunded;
                    balanceAfterRefund = refund.balance;
                } catch (refundErr) {
                    await refundConn.rollback();
                    console.error('[ai-teacher] refund failed', refundErr);
                } finally {
                    refundConn.release();
                }
            } catch (e) {
                console.error('[ai-teacher] refund connection failed', e);
            }
        }

        if (conn) {
            try { await conn.rollback(); } catch { /* ignore */ }
            try { conn.release(); } catch { /* ignore */ }
        }

        try {
            await db.query(
                `INSERT INTO tam24_ai_usage_logs
                 (user_id, teacher_id, conversation_id, success, error_code)
                 VALUES (?, NULL, ?, 0, ?)`,
                [userId, conversationId || null, err.code || 'AI_ERROR']
            );
        } catch { /* ignore */ }

        const code = err.code || 'AI_ERROR';
        const message =
            code === 'INSUFFICIENT_COINS'
                ? 'موجودی انرژی کافی نیست.'
                : code === 'TEACHER_REQUIRES_PRO'
                    ? 'این معلم فقط برای کاربران ویژه در دسترس است.'
                : code === 'AI_NOT_CONFIGURED'
                    ? 'سرویس فعلاً در دسترس نیست.'
                    : code === 'EMPTY_RESPONSE'
                        ? 'پاسخی دریافت نشد.'
                        : 'در تولید پاسخ مشکلی پیش آمد.';

        sendEvent('error', {
            code,
            message,
            balance: balanceAfterRefund,
            refunded: refundedAmount,
        });
        return res.end();
    }
};

module.exports = {
    getBootstrap,
    saveStudentProfile,
    listTeachers,
    selectTeacher,
    openSession,
    getConversation,
    listConversations,
    updateSettings,
    listBooks,
    getWallet,
    createConversation,
    streamChat,
};
