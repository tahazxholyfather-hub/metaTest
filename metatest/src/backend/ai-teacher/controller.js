'use strict';

/**
 * Met — AI tutor HTTP controller.
 * Mounted at /api/ai-teacher (see routes.js).
 */

const db = require('../db');
const { CONTEXT_LIMITS, dailyRefillForPlan, FEATURES } = require('./config');
const { SUBJECT_LIST, isValidSubject, getSubject } = require('./subjects');
const coinWallet = require('./services/coinWallet');
const pricing = require('./services/pricing');
const aiProvider = require('./services/aiProvider');
const promptBuilder = require('./services/promptBuilder');
const memoryService = require('./services/memoryService');
const conversationService = require('./services/conversationService');
const ragService = require('./services/ragService');
const toolsService = require('./services/toolsService');
const imageService = require('./services/imageService');

const DATA_TOOL_TRIGGERS = /(نمره|امتیاز|عملکرد|فعالیت|پیشرفت|چطورم|چطور بودم|رتبه|activity|progress|score)/i;
const IMAGE_TOOL_TRIGGERS = /(تصویر|عکس|نقاشی|دیاگرام|نمودار|شکل بکش|رسم کن|بکش|diagram|illustrat|draw|image|picture|schematic)/i;

function publicMessage(row) {
    return {
        id: row.id,
        role: row.role,
        content: row.content,
        inputTokens: row.input_tokens || 0,
        outputTokens: row.output_tokens || 0,
        totalTokens: row.total_tokens || 0,
        coinCost: row.coin_cost || 0,
        model: row.model || null,
        attachments: conversationService.parseAttachments(row.attachments),
        isStarter: !!row.is_starter,
        createdAt: row.created_at,
    };
}

function publicConversation(row) {
    return {
        id: row.id,
        title: row.title,
        subjectKey: row.subject_key,
        messageCount: row.message_count,
        lastMessageAt: row.last_message_at,
        titleGenerated: !!row.title_generated,
    };
}

function publicSubject(row) {
    return {
        key: row.key,
        nameFa: row.nameFa || row.name_fa,
        nameEn: row.nameEn || row.name_en,
        icon: row.icon,
        color: row.color,
    };
}

async function loadUserRow(userId) {
    const [[user]] = await db.query(
        `SELECT id, first_name, last_name, current_plan, plan_expires_at,
                ai_met_intro_seen, ai_last_subject
         FROM tam24_users WHERE id = ?`,
        [userId]
    );
    return user || null;
}

async function ensureSettings(userId) {
    await db.query(`INSERT IGNORE INTO tam24_ai_user_settings (user_id) VALUES (?)`, [userId]);
    const [[settings]] = await db.query(`SELECT * FROM tam24_ai_user_settings WHERE user_id = ?`, [userId]);
    return settings;
}

function nextRefillAtIso() {
    const next = new Date();
    next.setHours(24, 0, 0, 0);
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

/** DB rows override code-authored subject text; fall back gracefully if the table isn't migrated yet. */
async function listSubjectsFromDb() {
    try {
        const [rows] = await db.query(
            `SELECT \`key\`, name_fa, name_en, icon, color, general_prompt, reference_instructions, model, max_output_tokens
             FROM tam24_ai_subjects WHERE is_active = 1 ORDER BY sort_order ASC`
        );
        if (rows.length) return rows;
    } catch { /* table missing — fall back to code config */ }
    return SUBJECT_LIST.map((s) => ({
        key: s.key, name_fa: s.nameFa, name_en: s.nameEn, icon: s.icon, color: s.color,
        general_prompt: null, reference_instructions: null, model: s.model, max_output_tokens: 700,
    }));
}

async function loadSubjectRow(subjectKey) {
    try {
        const [[row]] = await db.query(`SELECT * FROM tam24_ai_subjects WHERE \`key\` = ? LIMIT 1`, [subjectKey]);
        return row || null;
    } catch {
        return null;
    }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
const getBootstrap = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await loadUserRow(userId);
        if (!user) return res.status(404).json({ success: false, message: 'کاربر یافت نشد.' });

        const wallet = await getBalanceSnapshot(userId, user.current_plan);
        const subjectRows = await listSubjectsFromDb();
        const latestConversation = await conversationService.getLatestConversation(db, userId);

        return res.json({
            success: true,
            data: {
                introSeen: !!user.ai_met_intro_seen,
                user: {
                    id: user.id,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    currentPlan: user.current_plan,
                },
                subjects: subjectRows.map(publicSubject),
                lastSubject: user.ai_last_subject || null,
                wallet,
                latestConversation: latestConversation ? publicConversation(latestConversation) : null,
            },
        });
    } catch (err) {
        console.error('[ai-teacher] getBootstrap', err);
        return res.status(500).json({ success: false, message: 'خطا در بارگذاری Met.' });
    }
};

const markIntroSeen = async (req, res) => {
    try {
        await db.query(`UPDATE tam24_users SET ai_met_intro_seen = 1 WHERE id = ?`, [req.user.id]);
        return res.json({ success: true });
    } catch (err) {
        console.error('[ai-teacher] markIntroSeen', err);
        return res.status(500).json({ success: false, message: 'خطا در ذخیره وضعیت معرفی.' });
    }
};

const listSubjects = async (req, res) => {
    try {
        const rows = await listSubjectsFromDb();
        return res.json({ success: true, data: rows.map(publicSubject) });
    } catch (err) {
        console.error('[ai-teacher] listSubjects', err);
        return res.status(500).json({ success: false, message: 'خطا در دریافت درس‌ها.' });
    }
};

// ─── Conversations ────────────────────────────────────────────────────────────
const openSession = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await loadUserRow(userId);
        if (!user) return res.status(404).json({ success: false, message: 'کاربر یافت نشد.' });

        const wallet = await getBalanceSnapshot(userId, user.current_plan);
        const conversation = await conversationService.getLatestConversation(db, userId);
        if (!conversation) {
            return res.json({ success: true, data: { conversation: null, messages: [], wallet } });
        }

        const messages = await conversationService.getMessages(db, conversation.id, { limit: 50 });
        return res.json({
            success: true,
            data: { conversation: publicConversation(conversation), messages: messages.map(publicMessage), wallet },
        });
    } catch (err) {
        console.error('[ai-teacher] openSession', err);
        return res.status(500).json({ success: false, message: 'خطا در باز کردن گفتگو.' });
    }
};

const createConversation = async (req, res) => {
    try {
        const userId = req.user.id;
        const subjectKey = String(req.body?.subjectKey || '').toLowerCase();
        if (!isValidSubject(subjectKey)) {
            return res.status(400).json({ success: false, message: 'موضوع نامعتبر است.' });
        }
        const conversation = await conversationService.createConversation(db, { userId, subjectKey });
        return res.json({ success: true, data: { conversation: publicConversation({ ...conversation, message_count: 0 }) } });
    } catch (err) {
        console.error('[ai-teacher] createConversation', err);
        return res.status(500).json({ success: false, message: 'خطا در ایجاد گفتگوی جدید.' });
    }
};

const listConversations = async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = Math.min(50, Number(req.query.limit) || 30);
        const offset = Math.max(0, Number(req.query.offset) || 0);
        const rows = await conversationService.listConversations(db, userId, { limit, offset });
        return res.json({ success: true, data: rows.map(publicConversation) });
    } catch (err) {
        console.error('[ai-teacher] listConversations', err);
        return res.status(500).json({ success: false, message: 'خطا در دریافت تاریخچه.' });
    }
};

const getConversation = async (req, res) => {
    try {
        const userId = req.user.id;
        const conversationId = Number(req.params.id);
        const beforeId = req.query.beforeId ? Number(req.query.beforeId) : null;
        const limit = Math.min(100, Number(req.query.limit) || 50);

        const conversation = await conversationService.getConversationForUser(db, conversationId, userId);
        if (!conversation) return res.status(404).json({ success: false, message: 'گفتگو یافت نشد.' });

        const messages = await conversationService.getMessages(db, conversationId, { limit, beforeId });
        return res.json({
            success: true,
            data: { conversation: publicConversation(conversation), messages: messages.map(publicMessage) },
        });
    } catch (err) {
        console.error('[ai-teacher] getConversation', err);
        return res.status(500).json({ success: false, message: 'خطا در دریافت گفتگو.' });
    }
};

const renameConversation = async (req, res) => {
    try {
        const title = await conversationService.renameConversation(db, req.user.id, Number(req.params.id), req.body?.title);
        return res.json({ success: true, data: { title } });
    } catch (err) {
        const notFound = err.message === 'NOT_FOUND';
        return res.status(notFound ? 404 : 400).json({
            success: false,
            message: notFound ? 'گفتگو یافت نشد.' : 'عنوان نامعتبر است.',
        });
    }
};

const deleteConversation = async (req, res) => {
    try {
        await conversationService.deleteConversation(db, req.user.id, Number(req.params.id));
        return res.json({ success: true });
    } catch (err) {
        return res.status(404).json({ success: false, message: 'گفتگو یافت نشد.' });
    }
};

const getWallet = async (req, res) => {
    try {
        const user = await loadUserRow(req.user.id);
        const wallet = await getBalanceSnapshot(req.user.id, user?.current_plan);
        return res.json({ success: true, data: wallet });
    } catch (err) {
        console.error('[ai-teacher] getWallet', err);
        return res.status(500).json({ success: false, message: 'خطا در دریافت انرژی.' });
    }
};

// ─── Image upload (message-bar attach button) ────────────────────────────────
const uploadChatImage = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'فایلی ارسال نشده است.' });
    }
    return res.json({
        success: true,
        data: { url: imageService.publicUrlFor(req.file.filename), mimeType: req.file.mimetype },
    });
};

/**
 * SSE streaming chat endpoint.
 * Body: { conversationId?, subjectKey?, message, attachments?: [{type:'image', url}] }
 */
const streamChat = async (req, res) => {
    const userId = req.user.id;
    const message = String(req.body?.message || '').trim();
    const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments.slice(0, 3) : [];
    let conversationId = req.body?.conversationId ? Number(req.body.conversationId) : null;
    let requestedSubject = req.body?.subjectKey ? String(req.body.subjectKey).toLowerCase() : null;

    if (!message && !attachments.length) {
        return res.status(400).json({ success: false, message: 'پیام نمی‌تواند خالی باشد.' });
    }
    if (message.length > CONTEXT_LIMITS.maxUserMessageChars) {
        return res.status(400).json({ success: false, message: 'پیام بیش از حد طولانی است.' });
    }
    if (requestedSubject && !isValidSubject(requestedSubject)) {
        return res.status(400).json({ success: false, message: 'موضوع نامعتبر است.' });
    }

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

        let conversation = conversationId
            ? await conversationService.getConversationForUser(db, conversationId, userId)
            : null;

        if (conversationId && !conversation) {
            sendEvent('error', { code: 'CONVERSATION_NOT_FOUND', message: 'گفتگو یافت نشد.' });
            return res.end();
        }

        const subjectKey = requestedSubject || conversation?.subject_key || user.ai_last_subject || 'math';
        if (!isValidSubject(subjectKey)) {
            sendEvent('error', { code: 'INVALID_SUBJECT', message: 'موضوع نامعتبر است.' });
            return res.end();
        }

        if (!conversation) {
            const created = await conversationService.createConversation(db, { userId, subjectKey });
            conversation = { ...created, message_count: 0, subject_key: subjectKey, title_generated: 0 };
        } else if (requestedSubject && requestedSubject !== conversation.subject_key) {
            await conversationService.setConversationSubject(db, conversation.id, requestedSubject);
            conversation.subject_key = requestedSubject;
        }
        conversationId = conversation.id;
        await db.query(`UPDATE tam24_users SET ai_last_subject = ? WHERE id = ?`, [subjectKey, userId]);

        const subjectRow = await loadSubjectRow(subjectKey);
        const subject = promptBuilder.resolveSubjectPrompts(subjectKey, subjectRow);

        const settings = await ensureSettings(userId);
        const hasImageAttachment = attachments.some((a) => a?.type === 'image' && a?.url);

        const refill = await coinWallet.applyDailyRefill(db, userId, user.current_plan);
        // Fair-use auto guard: once daily energy runs low, quietly shrink replies
        // instead of abruptly cutting the student off mid-conversation.
        const dailyAllowance = dailyRefillForPlan(user.current_plan);
        const effectiveSettings = {
            ...settings,
            low_coin_mode: !!settings.low_coin_mode || refill.balance <= Math.max(15, dailyAllowance * 0.15),
        };

        const model = promptBuilder.resolveModel(effectiveSettings, subject, { hasImageAttachment });
        const maxTokens = promptBuilder.resolveMaxOutputTokens(subject, effectiveSettings);
        const typical = pricing.estimateTypicalEnergy({ model, maxOutputTokens: maxTokens });
        const maxEst = pricing.estimateMaxEnergy({ model, maxOutputTokens: maxTokens });

        if (refill.balance < typical.energy) {
            sendEvent('error', {
                code: 'INSUFFICIENT_COINS',
                message: 'موجودی انرژی کافی نیست.',
                balance: refill.balance,
                needed: typical.energy,
            });
            return res.end();
        }

        const reserveAmount = Math.max(typical.energy, Math.min(refill.balance, maxEst.energy));

        conn = await db.getConnection();
        await conn.beginTransaction();
        const reservation = await coinWallet.reserveCoins(conn, userId, reserveAmount, reservationRef);
        reserved = reservation.reserved;
        await conn.commit();
        conn.release();
        conn = null;

        sendEvent('status', { status: 'thinking', balance: reservation.balance });
        sendEvent('meta', { conversationId, subjectKey, reserved, typicalEnergy: typical.energy });

        const isFirstExchange = Number(conversation.message_count || 0) === 0;

        const [userMsgResult] = await db.query(
            `INSERT INTO tam24_ai_messages (conversation_id, role, content, attachments, subject_key)
             VALUES (?, 'user', ?, ?, ?)`,
            [conversationId, message, attachments.length ? JSON.stringify(attachments) : null, subjectKey]
        );
        const userMessageId = userMsgResult.insertId;
        sendEvent('user_message', { id: userMessageId, role: 'user', content: message, attachments, conversationId });

        const memories = await memoryService.getActiveMemories(db, userId);
        const summary = await memoryService.maybeSummarizeConversation(db, conversation);
        const recent = await conversationService.getRecentMessages(db, conversationId, CONTEXT_LIMITS.recentMessages);
        const recentWithoutCurrent = recent.filter((m) => m.id !== userMessageId);

        let ragContext = null;
        try {
            ragContext = await ragService.retrieveContext(db, { subjectKey, queryText: message });
        } catch (err) {
            console.error('[ai-teacher] rag retrieval failed (continuing without it):', err.message);
        }

        const { systemPrompt } = promptBuilder.buildMetPrompt({
            subjectKey,
            subjectRow,
            user,
            memories,
            settings: effectiveSettings,
            conversationSummary: summary,
            ragContext,
            hasImageAttachment,
        });

        let providerMessages = promptBuilder.toProviderMessages({
            systemPrompt,
            recentMessages: recentWithoutCurrent,
            currentUserMessage: message,
            currentAttachments: attachments,
        });

        const collectedAttachments = [];
        const wantsTools = FEATURES.tools
            && (DATA_TOOL_TRIGGERS.test(message) || IMAGE_TOOL_TRIGGERS.test(message));

        if (wantsTools) {
            try {
                const availableTools = toolsService.getAvailableTools();
                if (availableTools.length) {
                    sendEvent('status', { status: 'thinking' });
                    const toolPass = await aiProvider.generate({
                        messages: providerMessages,
                        model,
                        maxTokens: Math.min(maxTokens, 400),
                        temperature: 0.3,
                        tools: availableTools,
                    });

                    if (Array.isArray(toolPass.toolCalls) && toolPass.toolCalls.length) {
                        providerMessages = [
                            ...providerMessages,
                            { role: 'assistant', content: toolPass.content || null, tool_calls: toolPass.toolCalls },
                        ];
                        for (const call of toolPass.toolCalls.slice(0, 3)) {
                            const { content, attachment } = await toolsService.executeToolCall(call, { userId });
                            if (attachment) collectedAttachments.push(attachment);
                            providerMessages.push({
                                role: 'tool',
                                tool_call_id: call.id,
                                content: JSON.stringify(content ?? {}),
                            });
                        }
                    }
                }
            } catch (err) {
                console.error('[ai-teacher] tool round skipped (continuing without tools):', err.message);
            }
        }

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
            temperature: promptBuilder.resolveTemperature(effectiveSettings),
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

        if (!String(fullText).trim() && !collectedAttachments.length) {
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
            extraEnergy: collectedAttachments.some((a) => a.type === 'image') ? pricing.imageEnergyCost() : 0,
        });
        const finalCost = quote.energy;

        conn = await db.getConnection();
        await conn.beginTransaction();

        const charge = await coinWallet.finalizeCharge(conn, userId, {
            reserved,
            finalCost,
            referenceId: reservationRef,
            metadata: { conversationId, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, model: usedModel },
        });

        const [assistantMsgResult] = await conn.query(
            `INSERT INTO tam24_ai_messages
             (conversation_id, role, content, input_tokens, output_tokens, total_tokens, coin_cost, model, attachments, subject_key)
             VALUES (?, 'assistant', ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                conversationId,
                fullText,
                usage.inputTokens,
                usage.outputTokens,
                usage.totalTokens,
                charge.charged,
                usedModel,
                collectedAttachments.length ? JSON.stringify(collectedAttachments) : null,
                subjectKey,
            ]
        );
        const assistantMsgId = assistantMsgResult.insertId;

        await conn.query(
            `UPDATE tam24_ai_conversations
             SET message_count = message_count + 2, total_tokens = total_tokens + ?,
                 last_message_at = NOW(), updated_at = NOW()
             WHERE id = ?`,
            [usage.totalTokens, conversationId]
        );

        try {
            await conn.query(
                `INSERT INTO tam24_ai_usage_logs
                 (user_id, conversation_id, message_id, model, input_tokens, output_tokens, total_tokens,
                  coin_cost, request_duration_ms, success, energy_cost)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
                [userId, conversationId, assistantMsgId, usedModel, usage.inputTokens, usage.outputTokens,
                    usage.totalTokens, charge.charged, durationMs, charge.charged]
            );
        } catch (logErr) {
            console.error('[ai-teacher] usage log skipped', logErr.message);
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

        let generatedTitle = null;
        if (isFirstExchange) {
            try {
                generatedTitle = await conversationService.generateTitle(db, {
                    conversationId,
                    userMessage: message || 'تصویر ارسال شد',
                    assistantMessage: fullText,
                });
            } catch { /* fallback title already applied inside generateTitle */ }
        }

        sendEvent('done', {
            message: {
                id: assistantMsgId,
                role: 'assistant',
                content: fullText,
                coinCost: charge.charged,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                totalTokens: usage.totalTokens,
                model: usedModel,
                attachments: collectedAttachments,
                conversationId,
            },
            wallet: { balance: charge.balance, charged: charge.charged, refunded: charge.refunded },
            title: generatedTitle,
            subjectKey,
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
                    const refund = await coinWallet.refundReservation(refundConn, userId, reserved, reservationRef, 'بازگشت به دلیل خطای تولید پاسخ');
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
                `INSERT INTO tam24_ai_usage_logs (user_id, conversation_id, success, error_code) VALUES (?, ?, 0, ?)`,
                [userId, conversationId || null, err.code || 'AI_ERROR']
            );
        } catch { /* ignore */ }

        const code = err.code || 'AI_ERROR';
        const errMessage =
            code === 'INSUFFICIENT_COINS' ? 'موجودی انرژی کافی نیست.'
                : code === 'AI_NOT_CONFIGURED' ? 'سرویس فعلاً در دسترس نیست.'
                : code === 'EMPTY_RESPONSE' ? 'پاسخی دریافت نشد.'
                : 'در تولید پاسخ مشکلی پیش آمد.';

        sendEvent('error', { code, message: errMessage, balance: balanceAfterRefund, refunded: refundedAmount });
        return res.end();
    }
};

module.exports = {
    getBootstrap,
    markIntroSeen,
    listSubjects,
    openSession,
    createConversation,
    listConversations,
    getConversation,
    renameConversation,
    deleteConversation,
    getWallet,
    uploadChatImage,
    streamChat,
};
