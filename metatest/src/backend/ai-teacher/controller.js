'use strict';

/**
 * Met — AI tutor HTTP controller (everything except the streaming chat turn,
 * which lives in chatController.js). Mounted at /api/ai-teacher.
 */

const { MODELS, featureStatus } = require('./config');
const { isValidSubject } = require('./subjects');
const {
    db, publicMessage, publicConversation, publicSubject, publicFeatures,
    loadUserRow, ensureSettings, walletSnapshot, walletFromBuckets,
    listSubjectsFromDb, userMessageForError,
} = require('./shared');
const coinWallet = require('./services/coinWallet');
const pricing = require('./services/pricing');
const aiProvider = require('./services/aiProvider');
const memoryService = require('./services/memoryService');
const conversationService = require('./services/conversationService');
const fileStorage = require('./services/fileStorage');
const suggestionsService = require('./services/suggestionsService');
const referencesService = require('./services/referencesService');
const { logUsage } = require('./services/usageLogger');
const questionContext = require('./services/questionContext');

const fail = (res, status, code, message) => res.status(status).json({ success: false, code, message: message || userMessageForError(code) });
const idParam = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };

// ─── Bootstrap ────────────────────────────────────────────────────────────────
const getBootstrap = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await loadUserRow(userId);
        if (!user) return fail(res, 404, 'NOT_FOUND', 'کاربر یافت نشد.');

        const [wallet, subjectRows, settings, latestConversation] = await Promise.all([
            walletSnapshot(userId, user.current_plan),
            listSubjectsFromDb(),
            ensureSettings(userId),
            conversationService.getLatestConversation(db, userId),
        ]);
        pricing.loadPricingTable(db).catch(() => {});

        return res.json({
            success: true,
            data: {
                features: publicFeatures(),
                user: { id: user.id, firstName: user.first_name, lastName: user.last_name, currentPlan: user.current_plan },
                subjects: subjectRows.map(publicSubject),
                lastSubject: user.ai_last_subject || null,
                settings,
                wallet,
                latestConversation: latestConversation ? publicConversation(latestConversation) : null,
            },
        });
    } catch (err) {
        console.error('[met] getBootstrap', err);
        return fail(res, 500, 'SERVER_ERROR', 'خطا در بارگذاری مِت.');
    }
};

const listSubjects = async (req, res) => {
    try {
        const rows = await listSubjectsFromDb();
        return res.json({ success: true, data: rows.map(publicSubject) });
    } catch (err) {
        console.error('[met] listSubjects', err);
        return fail(res, 500, 'SERVER_ERROR', 'خطا در دریافت درس‌ها.');
    }
};

const getSuggestions = async (req, res) => {
    try {
        const subjectKey = String(req.query.subject || req.query.subjectKey || 'general').toLowerCase();
        if (!isValidSubject(subjectKey)) return fail(res, 400, 'INVALID_SUBJECT', 'موضوع نامعتبر است.');
        const items = await suggestionsService.getSuggestions(db, subjectKey);
        return res.json({ success: true, data: items });
    } catch (err) {
        console.error('[met] getSuggestions', err);
        return res.json({ success: true, data: [] });
    }
};

const useSuggestion = async (req, res) => {
    const id = idParam(req.params.id);
    if (id) suggestionsService.markUsed(db, id).catch(() => {});
    return res.json({ success: true });
};

// ─── Conversations ────────────────────────────────────────────────────────────
const openSession = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await loadUserRow(userId);
        if (!user) return fail(res, 404, 'NOT_FOUND', 'کاربر یافت نشد.');
        const wallet = await walletSnapshot(userId, user.current_plan);
        const conversation = await conversationService.getLatestConversation(db, userId);
        if (!conversation) return res.json({ success: true, data: { conversation: null, messages: [], hasMore: false, wallet } });
        const messages = await conversationService.getMessages(db, conversation.id, { limit: 50 });
        return res.json({
            success: true,
            data: { conversation: publicConversation(conversation), messages: messages.map(publicMessage), hasMore: messages.hasMore, wallet },
        });
    } catch (err) {
        console.error('[met] openSession', err);
        return fail(res, 500, 'SERVER_ERROR', 'خطا در باز کردن گفتگو.');
    }
};

const createConversation = async (req, res) => {
    try {
        const subjectKey = String(req.body?.subjectKey || 'general').toLowerCase();
        if (!isValidSubject(subjectKey)) return fail(res, 400, 'INVALID_SUBJECT', 'موضوع نامعتبر است.');
        const conversation = await conversationService.createConversation(db, { userId: req.user.id, subjectKey });
        return res.json({ success: true, data: { conversation: publicConversation(conversation) } });
    } catch (err) {
        console.error('[met] createConversation', err);
        return fail(res, 500, 'SERVER_ERROR', 'خطا در ایجاد گفتگوی جدید.');
    }
};

const listConversations = async (req, res) => {
    try {
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 30));
        const offset = Math.max(0, Number(req.query.offset) || 0);
        const subjectKey = req.query.subject ? String(req.query.subject).toLowerCase() : null;
        if (subjectKey && !isValidSubject(subjectKey)) return fail(res, 400, 'INVALID_SUBJECT', 'موضوع نامعتبر است.');
        const rows = await conversationService.listConversations(db, req.user.id, {
            limit, offset, subjectKey, search: req.query.q ? String(req.query.q).slice(0, 80) : null,
        });
        return res.json({ success: true, data: rows.map(publicConversation), hasMore: rows.length === limit });
    } catch (err) {
        console.error('[met] listConversations', err);
        return fail(res, 500, 'SERVER_ERROR', 'خطا در دریافت تاریخچه.');
    }
};

const getConversation = async (req, res) => {
    try {
        const conversationId = idParam(req.params.id);
        if (!conversationId) return fail(res, 404, 'NOT_FOUND', 'گفتگو یافت نشد.');
        const beforeId = idParam(req.query.beforeId);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));

        const conversation = await conversationService.getConversationForUser(db, conversationId, req.user.id);
        if (!conversation) return fail(res, 404, 'NOT_FOUND', 'گفتگو یافت نشد.');

        const [messages, references] = await Promise.all([
            conversationService.getMessages(db, conversationId, { limit, beforeId }),
            featureStatus().pdfReferences ? referencesService.listReferences(db, conversationId, req.user.id).catch(() => []) : [],
        ]);
        return res.json({
            success: true,
            data: { conversation: publicConversation(conversation), messages: messages.map(publicMessage), hasMore: messages.hasMore, references },
        });
    } catch (err) {
        console.error('[met] getConversation', err);
        return fail(res, 500, 'SERVER_ERROR', 'خطا در دریافت گفتگو.');
    }
};

const renameConversation = async (req, res) => {
    try {
        const title = await conversationService.renameConversation(db, req.user.id, idParam(req.params.id), req.body?.title);
        return res.json({ success: true, data: { title } });
    } catch (err) {
        const notFound = err.message === 'NOT_FOUND';
        return fail(res, notFound ? 404 : 400, notFound ? 'NOT_FOUND' : 'INVALID_TITLE', notFound ? 'گفتگو یافت نشد.' : 'عنوان نامعتبر است.');
    }
};

const deleteConversation = async (req, res) => {
    try {
        await conversationService.deleteConversation(db, req.user.id, idParam(req.params.id));
        return res.json({ success: true });
    } catch {
        return fail(res, 404, 'NOT_FOUND', 'گفتگو یافت نشد.');
    }
};

// ─── Wallet / ledger ──────────────────────────────────────────────────────────
const getWallet = async (req, res) => {
    try {
        const user = await loadUserRow(req.user.id);
        const wallet = await walletSnapshot(req.user.id, user?.current_plan);
        return res.json({ success: true, data: wallet });
    } catch (err) {
        console.error('[met] getWallet', err);
        return fail(res, 500, 'SERVER_ERROR', 'خطا در دریافت سکه‌ها.');
    }
};

const getLedger = async (req, res) => {
    try {
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
        const offset = Math.max(0, Number(req.query.offset) || 0);
        const rows = await coinWallet.listLedger(db, req.user.id, { limit, offset });
        return res.json({
            success: true,
            data: rows.map((r) => ({
                id: r.id, type: r.type, amount: r.amount, dailyDelta: r.daily_delta, purchasedDelta: r.purchased_delta,
                balanceBefore: r.balance_before, balanceAfter: r.balance_after, reason: r.reason,
                operationType: r.operation_type, conversationId: r.conversation_id, messageId: r.message_id, createdAt: r.created_at,
            })),
            hasMore: rows.length === limit,
        });
    } catch (err) {
        console.error('[met] getLedger', err);
        return fail(res, 500, 'SERVER_ERROR', 'خطا در دریافت تراکنش‌ها.');
    }
};

// ─── Settings ─────────────────────────────────────────────────────────────────
const SETTING_WRITERS = {
    tone: (v) => (['friendly', 'formal', 'playful'].includes(v) ? ['tone', v] : null),
    reasoningLevel: (v) => (['fast', 'balanced', 'deep'].includes(v) ? ['reasoning_level', v] : null),
    verbosity: (v) => (['short', 'normal', 'detailed'].includes(v) ? ['verbosity', v] : null),
    creativity: (v) => (Number.isFinite(Number(v)) ? ['creativity', Math.round(Math.min(100, Math.max(0, Number(v))))] : null),
    conciseMode: (v) => (typeof v === 'boolean' ? ['concise_responses', v ? 1 : 0] : null),
    efficientMode: (v) => (typeof v === 'boolean' ? ['low_coin_mode', v ? 1 : 0] : null),
    alwaysExamples: (v) => (typeof v === 'boolean' ? ['always_examples', v ? 1 : 0] : null),
    stepByStep: (v) => (typeof v === 'boolean' ? ['step_by_step', v ? 1 : 0] : null),
    voiceReplies: (v) => (typeof v === 'boolean' ? ['voice_replies', v ? 1 : 0] : null),
    memoryEnabled: (v) => (typeof v === 'boolean' ? ['memory_enabled', v ? 1 : 0] : null),
    knowledgeEnabled: (v) => (typeof v === 'boolean' ? ['knowledge_enabled', v ? 1 : 0] : null),
    pdfReferencesEnabled: (v) => (typeof v === 'boolean' ? ['pdf_references_enabled', v ? 1 : 0] : null),
};

const getSettings = async (req, res) => {
    try {
        return res.json({ success: true, data: await ensureSettings(req.user.id) });
    } catch (err) {
        console.error('[met] getSettings', err);
        return fail(res, 500, 'SERVER_ERROR', 'خطا در دریافت تنظیمات.');
    }
};

const updateSettings = async (req, res) => {
    try {
        const userId = req.user.id;
        await ensureSettings(userId);
        const sets = [];
        const vals = [];
        for (const [field, write] of Object.entries(SETTING_WRITERS)) {
            if (req.body?.[field] === undefined) continue;
            const pair = write(req.body[field]);
            if (!pair) return fail(res, 400, 'INVALID_SETTING', `مقدار «${field}» نامعتبر است.`);
            sets.push(`${pair[0]} = ?`);
            vals.push(pair[1]);
        }
        if (sets.length) {
            await db.query(`UPDATE tam24_ai_user_settings SET ${sets.join(', ')}, updated_at = NOW() WHERE user_id = ?`, [...vals, userId]);
        }
        return res.json({ success: true, data: await ensureSettings(userId) });
    } catch (err) {
        console.error('[met] updateSettings', err);
        return fail(res, 500, 'SERVER_ERROR', 'خطا در ذخیره تنظیمات.');
    }
};

// ─── Memory (auditable by the student) ───────────────────────────────────────
const listMemory = async (req, res) => {
    try {
        const rows = await memoryService.listMemories(db, req.user.id);
        return res.json({
            success: true,
            data: rows.map((m) => ({
                id: m.id, type: m.memory_type, content: m.content, importance: m.importance, confidence: m.confidence,
                subjectKey: m.subject_key, createdAt: m.created_at, updatedAt: m.updated_at,
            })),
        });
    } catch (err) {
        console.error('[met] listMemory', err);
        return fail(res, 500, 'SERVER_ERROR', 'خطا در دریافت حافظه.');
    }
};

const forgetMemory = async (req, res) => {
    try {
        const ok = await memoryService.forgetMemory(db, req.user.id, idParam(req.params.id));
        return ok ? res.json({ success: true }) : fail(res, 404, 'NOT_FOUND');
    } catch (err) {
        console.error('[met] forgetMemory', err);
        return fail(res, 500, 'SERVER_ERROR');
    }
};

const clearMemory = async (req, res) => {
    try {
        const count = await memoryService.clearMemories(db, req.user.id);
        return res.json({ success: true, data: { cleared: count } });
    } catch (err) {
        console.error('[met] clearMemory', err);
        return fail(res, 500, 'SERVER_ERROR');
    }
};

// ─── References (PDFs per conversation) ──────────────────────────────────────
async function ownedConversation(req, res) {
    const conversationId = idParam(req.params.id);
    const conversation = conversationId ? await conversationService.getConversationForUser(db, conversationId, req.user.id) : null;
    if (!conversation) { fail(res, 404, 'NOT_FOUND', 'گفتگو یافت نشد.'); return null; }
    return conversation;
}

const listReferences = async (req, res) => {
    try {
        const conversation = await ownedConversation(req, res);
        if (!conversation) return;
        return res.json({ success: true, data: await referencesService.listReferences(db, conversation.id, req.user.id) });
    } catch (err) {
        console.error('[met] listReferences', err);
        return fail(res, 500, 'SERVER_ERROR', 'خطا در دریافت منابع.');
    }
};

const addReference = async (req, res) => {
    try {
        const conversation = await ownedConversation(req, res);
        if (!conversation) return;
        if (!req.file?.buffer?.length) return fail(res, 400, 'NO_FILE', 'فایل PDF دریافت نشد.');
        const reference = await referencesService.addReference(db, {
            userId: req.user.id, conversationId: conversation.id, buffer: req.file.buffer,
            originalName: req.file.originalname, mimeType: req.file.mimetype,
        });
        return res.json({ success: true, data: reference });
    } catch (err) {
        console.error('[met] addReference', err);
        return fail(res, err.status || 500, err.code || 'SERVER_ERROR', err.code ? undefined : 'آپلود منبع ناموفق بود.');
    }
};

const removeReference = async (req, res) => {
    try {
        const conversation = await ownedConversation(req, res);
        if (!conversation) return;
        await referencesService.removeReference(db, { userId: req.user.id, conversationId: conversation.id, referenceId: idParam(req.params.refId) });
        return res.json({ success: true });
    } catch (err) {
        return fail(res, err.status || 500, err.code || 'SERVER_ERROR');
    }
};

// ─── Uploads: image for vision ───────────────────────────────────────────────
const uploadChatImage = async (req, res) => {
    try {
        if (!req.file?.buffer?.length) return fail(res, 400, 'NO_FILE', 'فایلی ارسال نشده است.');
        const stored = await fileStorage.saveBuffer('image', req.file.buffer, { mime: req.file.mimetype, originalName: req.file.originalname });
        const conversationId = idParam(req.body?.conversationId);
        const fileId = await fileStorage.recordFile(db, { userId: req.user.id, conversationId, kind: 'image', stored });
        return res.json({
            success: true,
            data: { fileId, type: 'image', url: stored.publicUrl, mimeType: stored.mimeType, width: stored.width, height: stored.height, sizeBytes: stored.sizeBytes },
        });
    } catch (err) {
        console.error('[met] uploadChatImage', err);
        return fail(res, err.code === 'UNSUPPORTED_FILE_TYPE' ? 400 : 500, err.code || 'UPLOAD_FAILED', err.code ? undefined : 'آپلود تصویر ناموفق بود.');
    }
};

// ─── Voice: speech-to-text ───────────────────────────────────────────────────
const voiceTranscribe = async (req, res) => {
    const started = Date.now();
    const userId = req.user.id;
    try {
        if (!req.file?.buffer?.length) return fail(res, 400, 'NO_FILE', 'فایل صوتی دریافت نشد.');
        const user = await loadUserRow(userId);
        const wallet = await walletSnapshot(userId, user?.current_plan);
        const cost = pricing.flatCoinCost('stt', MODELS.stt);
        if (wallet.total < cost) return res.status(402).json({ success: false, code: 'INSUFFICIENT_COINS', message: userMessageForError('INSUFFICIENT_COINS'), wallet });

        const durationSeconds = Math.max(0, Math.min(600, Number(req.body?.durationSeconds) || 0)) || null;
        const conversationId = idParam(req.body?.conversationId);

        const stored = await fileStorage.saveBuffer('audio', req.file.buffer, { mime: req.file.mimetype, originalName: req.file.originalname || 'voice.webm' });
        const text = await aiProvider.transcribe({
            audio: req.file.buffer, filename: req.file.originalname || `voice.${stored.mimeType.split('/')[1] || 'webm'}`,
            mimeType: stored.mimeType, language: 'fa',
        });

        if (!text) {
            await fileStorage.deleteStored('audio', stored.storedName);
            return fail(res, 422, 'NO_SPEECH', 'صدایی تشخیص داده نشد. دوباره تلاش کن.');
        }

        const fileId = await fileStorage.recordFile(db, {
            userId, conversationId, kind: 'audio', stored, durationSeconds, transcript: text.slice(0, 4000), model: MODELS.stt, coinCost: cost,
        });
        const charge = await coinWallet.chargeFlat(db, userId, cost, {
            reason: 'تبدیل گفتار به متن', referenceType: 'ai_voice_stt', referenceId: `stt-${fileId}`, operationType: 'stt', conversationId,
        });
        const unit = pricing.quoteUnits({ model: MODELS.stt, operationType: 'stt', units: durationSeconds || Math.round(req.file.size / 16000) });
        await logUsage(db, {
            userId, conversationId, operationType: 'stt', model: MODELS.stt, units: unit.units, coinCost: charge.charged,
            costUsd: unit.usd, costIrr: unit.irr, exchangeRateIrr: unit.exchangeRateIrr, durationMs: Date.now() - started, attachedFiles: [fileId],
        });

        return res.json({
            success: true,
            data: {
                text,
                file: { fileId, type: 'audio', url: stored.publicUrl, mimeType: stored.mimeType, durationSeconds },
                charged: charge.charged,
                wallet: walletFromBuckets(charge.wallet, user?.current_plan),
            },
        });
    } catch (err) {
        console.error('[met] voiceTranscribe', err);
        await logUsage(db, { userId, operationType: 'stt', model: MODELS.stt, status: 'error', errorCode: err.code || 'STT_FAILED', errorMessage: err.message, durationMs: Date.now() - started });
        const status = err.code === 'INSUFFICIENT_COINS' ? 402 : err.code === 'UNSUPPORTED_FILE_TYPE' ? 400 : 500;
        return fail(res, status, err.code || 'STT_FAILED', err.code ? undefined : 'خطا در پردازش صدا.');
    }
};

/** Strip markdown/LaTeX so TTS reads clean prose, not raw formulas. */
function sanitizeForSpeech(text) {
    return String(text || '')
        .replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+\$/g, ' (فرمول) ')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/`{1,3}[^`]*`{1,3}/g, ' ')
        .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '')
        .replace(/^[ \t]*[-*•]\s+/gm, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// ─── Voice: text-to-speech for an assistant message ──────────────────────────
const voiceSpeak = async (req, res) => {
    const started = Date.now();
    const userId = req.user.id;
    try {
        const messageId = idParam(req.body?.messageId);
        if (!messageId) return fail(res, 400, 'INVALID_MESSAGE', 'شناسه پیام الزامی است.');

        const row = await conversationService.getMessageForUser(db, messageId, userId);
        if (!row || row.role !== 'assistant') return fail(res, 404, 'NOT_FOUND', 'پیام یافت نشد.');

        // Replays are free — reuse the audio synthesized the first time.
        const existing = row.attachments.find((a) => a.type === 'audio' && a.url);
        if (existing) return res.json({ success: true, data: { url: existing.url, charged: 0, cached: true } });

        const user = await loadUserRow(userId);
        const wallet = await walletSnapshot(userId, user?.current_plan);
        const cost = pricing.flatCoinCost('tts', MODELS.tts);
        if (wallet.total < cost) return res.status(402).json({ success: false, code: 'INSUFFICIENT_COINS', message: userMessageForError('INSUFFICIENT_COINS'), wallet });

        const speech = sanitizeForSpeech(row.content);
        if (!speech) return fail(res, 422, 'NO_TEXT', 'متنی برای خواندن وجود ندارد.');

        const audioBuffer = await aiProvider.speak({ text: speech });
        const stored = await fileStorage.saveBuffer('tts_audio', audioBuffer, { mime: 'audio/mpeg', originalName: `met-${messageId}.mp3` });
        const fileId = await fileStorage.recordFile(db, {
            userId, conversationId: row.conversation_id, messageId, kind: 'tts_audio', stored, model: MODELS.tts, coinCost: cost,
            metadata: { characters: speech.length },
        });

        const nextAttachments = [...row.attachments, { type: 'audio', url: stored.publicUrl, mimeType: 'audio/mpeg', fileId }];
        await db.query(`UPDATE tam24_ai_messages SET attachments = ? WHERE id = ?`, [JSON.stringify(nextAttachments), messageId]);

        const charge = await coinWallet.chargeFlat(db, userId, cost, {
            reason: 'تولید پاسخ صوتی', referenceType: 'ai_voice_tts', referenceId: `tts-${messageId}`,
            operationType: 'tts', conversationId: row.conversation_id, messageId,
        });
        const unit = pricing.quoteUnits({ model: MODELS.tts, operationType: 'tts', units: speech.length });
        await logUsage(db, {
            userId, conversationId: row.conversation_id, messageId, operationType: 'tts', model: MODELS.tts, units: speech.length,
            coinCost: charge.charged, costUsd: unit.usd, costIrr: unit.irr, exchangeRateIrr: unit.exchangeRateIrr,
            durationMs: Date.now() - started, attachedFiles: [fileId],
        });

        return res.json({
            success: true,
            data: { url: stored.publicUrl, fileId, charged: charge.charged, cached: false, wallet: walletFromBuckets(charge.wallet, user?.current_plan) },
        });
    } catch (err) {
        console.error('[met] voiceSpeak', err);
        await logUsage(db, { userId, operationType: 'tts', model: MODELS.tts, status: 'error', errorCode: err.code || 'TTS_FAILED', errorMessage: err.message, durationMs: Date.now() - started });
        return fail(res, err.code === 'INSUFFICIENT_COINS' ? 402 : 500, err.code || 'TTS_FAILED', err.code ? undefined : 'خطا در تولید صدا.');
    }
};

const getQuestionSession = async (req, res) => {
    try {
        const questionId = idParam(req.params.questionId);
        if (!questionId) return fail(res, 400, 'INVALID_QUESTION', 'شناسه سوال نامعتبر است.');
        const userId = req.user.id;

        const ctx = await questionContext.loadQuestionContext(db, { userId, questionId });
        if (!ctx) return fail(res, 403, 'QUESTION_NOT_ANSWERED');

        const conversation = await conversationService.getOrCreateQuizConversation(db, {
            userId,
            questionId,
            subjectKey: ctx.subjectKey || 'general',
            title: questionContext.conversationTitle(ctx),
            snapshot: questionContext.publicContext(ctx),
        });
        const messages = await conversationService.getMessages(db, conversation.id, { limit: 80 });
        const user = await loadUserRow(userId);
        const wallet = await walletSnapshot(userId, user?.current_plan);

        return res.json({
            success: true,
            data: {
                conversation: publicConversation(conversation),
                messages: messages.map(publicMessage),
                hasMore: messages.hasMore,
                context: questionContext.publicContext(ctx),
                intents: Object.entries(questionContext.QUICK_INTENTS).map(([key, v]) => ({ key, label: v.label })),
                wallet,
            },
        });
    } catch (err) {
        console.error('[met] getQuestionSession', err);
        return fail(res, 500, 'SERVER_ERROR', 'خطا در باز کردن گفتگوی سوال.');
    }
};

module.exports = {
    getBootstrap,
    listSubjects,
    getSuggestions,
    useSuggestion,
    openSession,
    createConversation,
    listConversations,
    getConversation,
    renameConversation,
    deleteConversation,
    getWallet,
    getLedger,
    getSettings,
    updateSettings,
    listMemory,
    forgetMemory,
    clearMemory,
    listReferences,
    addReference,
    removeReference,
    uploadChatImage,
    voiceTranscribe,
    voiceSpeak,
    sanitizeForSpeech,
    getQuestionSession,
};
