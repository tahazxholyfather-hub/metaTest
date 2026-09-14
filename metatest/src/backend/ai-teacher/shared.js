'use strict';

const db = require('../db');
const { dailyCoinsForPlan, featureStatus, unavailableReason, FILE_LIMITS, CONTEXT_LIMITS } = require('./config');
const { SUBJECT_LIST } = require('./subjects');
const coinWallet = require('./services/coinWallet');
const conversationService = require('./services/conversationService');
const promptBuilder = require('./services/promptBuilder');

/** Shared shaping + loaders used by both controllers. */

function publicMessage(row) {
    return {
        id: row.id,
        conversationId: row.conversation_id,
        role: row.role,
        content: row.content,
        inputTokens: row.input_tokens || 0,
        outputTokens: row.output_tokens || 0,
        totalTokens: row.total_tokens || 0,
        coinCost: row.coin_cost || 0,
        model: row.model || null,
        attachments: conversationService.parseAttachments(row.attachments),
        status: row.status || 'complete',
        latencyMs: row.latency_ms ?? null,
        regeneratedFrom: row.regenerated_from ?? null,
        createdAt: row.created_at,
    };
}

function publicConversation(row) {
    return {
        id: row.id,
        title: row.title,
        subjectKey: row.subject_key,
        messageCount: row.message_count ?? 0,
        lastMessageAt: row.last_message_at ?? null,
        createdAt: row.created_at ?? null,
        titleGenerated: !!row.title_generated,
        sourceType: row.source_type || 'chat',
        questionId: row.question_id ?? null,
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

/** What the frontend needs to adapt the UI — never raw env values or keys. */
function publicFeatures() {
    const f = featureStatus();
    return {
        available: f.aiAvailable,
        unavailableReason: f.aiAvailable ? null : unavailableReason(),
        chat: f.chat,
        vision: f.vision,
        imageGeneration: f.imageGeneration,
        stt: f.stt,
        tts: f.tts,
        pdfReferences: f.pdfReferences,
        memory: f.memory,
        knowledgeBase: f.knowledgeBase,
        tools: f.tools,
        suggestions: f.suggestions,
        limits: {
            maxImageMb: FILE_LIMITS.imageMb,
            maxAudioMb: FILE_LIMITS.audioMb,
            maxPdfMb: FILE_LIMITS.pdfMb,
            maxPdfsPerConversation: FILE_LIMITS.maxPdfsPerConversation,
            maxAttachmentsPerMessage: CONTEXT_LIMITS.maxAttachmentsPerMessage,
            maxMessageChars: CONTEXT_LIMITS.maxUserMessageChars,
        },
    };
}

async function loadUserRow(userId) {
    const [[user]] = await db.query(
        `SELECT id, first_name, last_name, current_plan, plan_expires_at, ai_last_subject FROM tam24_users WHERE id = ?`,
        [userId]
    );
    return user || null;
}

async function ensureSettings(userId) {
    await db.query(`INSERT IGNORE INTO tam24_ai_user_settings (user_id) VALUES (?)`, [userId]);
    const [[settings]] = await db.query(`SELECT * FROM tam24_ai_user_settings WHERE user_id = ?`, [userId]);
    return promptBuilder.normalizeSettings(settings);
}

function nextResetAtIso() {
    const next = new Date();
    next.setHours(24, 0, 0, 0);
    return next.toISOString();
}

/** Apply the idempotent daily grant and return the wallet as the UI sees it. */
async function walletSnapshot(userId, planKey) {
    const grant = await coinWallet.applyDailyGrant(db, userId, planKey);
    const w = grant.wallet;
    return {
        daily: w.daily,
        purchased: w.purchased,
        total: w.total,
        balance: w.total,
        dailyQuota: dailyCoinsForPlan(planKey),
        grantedToday: grant.granted,
        grantAmount: grant.amount,
        nextResetAt: nextResetAtIso(),
    };
}

function walletFromBuckets(w, planKey) {
    return {
        daily: w.daily, purchased: w.purchased, total: w.total, balance: w.total,
        dailyQuota: dailyCoinsForPlan(planKey), nextResetAt: nextResetAtIso(),
    };
}

/** DB rows override code-authored subject text; fall back gracefully if the table isn't migrated yet. */
async function listSubjectsFromDb() {
    try {
        const [rows] = await db.query(
            `SELECT \`key\`, name_fa, name_en, icon, color, general_prompt, reference_instructions, model, max_output_tokens
             FROM tam24_ai_subjects WHERE is_active = 1 ORDER BY sort_order ASC`
        );
        if (rows.length) {
            // Make sure the general room exists even before migration 008 seeds it.
            if (!rows.some((r) => r.key === 'general')) {
                const g = SUBJECT_LIST.find((s) => s.key === 'general');
                rows.push({ key: g.key, name_fa: g.nameFa, name_en: g.nameEn, icon: g.icon, color: g.color, general_prompt: null, reference_instructions: null, model: g.model, max_output_tokens: 700 });
            }
            return rows;
        }
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

/** Map internal error codes to safe Persian UI messages. */
function userMessageForError(code, fallback = 'در پردازش درخواست مشکلی پیش آمد.') {
    switch (code) {
        case 'INSUFFICIENT_COINS': return 'سکه‌ی کافی نداری. فردا سکه‌ی روزانه شارژ می‌شود یا می‌توانی سکه بخری.';
        case 'AI_NOT_CONFIGURED':
        case 'AI_DISABLED':
        case 'AI_UNAVAILABLE': return 'مِت فعلاً در دسترس نیست.';
        case 'AI_TIMEOUT': return 'پاسخ خیلی طول کشید. دوباره تلاش کن.';
        case 'AI_NETWORK':
        case 'AI_PROVIDER_ERROR': return 'ارتباط با سرویس هوش مصنوعی برقرار نشد. کمی بعد دوباره تلاش کن.';
        case 'AI_STOPPED': return 'تولید پاسخ متوقف شد.';
        case 'EMPTY_RESPONSE': return 'پاسخی دریافت نشد. دوباره تلاش کن.';
        case 'FEATURE_DISABLED': return 'این قابلیت فعلاً غیرفعال است.';
        case 'VISION_UNAVAILABLE': return 'خواندن تصویر فعلاً غیرفعال است؛ سوالت را متنی بپرس.';
        case 'FILE_TOO_LARGE': return 'حجم فایل بیش از حد مجاز است.';
        case 'UNSUPPORTED_FILE_TYPE': return 'نوع فایل پشتیبانی نمی‌شود.';
        case 'RATE_LIMITED': return 'درخواست‌ها زیاد شد؛ چند لحظه صبر کن.';
        case 'REFERENCE_LIMIT': return 'حداکثر تعداد منبع برای این گفتگو پر شده است.';
        case 'PDF_NO_TEXT': return 'متنی از این PDF استخراج نشد (احتمالاً اسکن تصویری است).';
        case 'NOT_FOUND': return 'موردی یافت نشد.';
        case 'QUESTION_NOT_ANSWERED': return 'اول پاسخ این سوال را ثبت کن، بعد از مِت بپرس.';
        default: return fallback;
    }
}

module.exports = {
    db,
    publicMessage,
    publicConversation,
    publicSubject,
    publicFeatures,
    loadUserRow,
    ensureSettings,
    walletSnapshot,
    walletFromBuckets,
    nextResetAtIso,
    listSubjectsFromDb,
    loadSubjectRow,
    userMessageForError,
};
