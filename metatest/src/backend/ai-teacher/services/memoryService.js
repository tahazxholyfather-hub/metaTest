'use strict';

const { CONTEXT_LIMITS, MODELS, featureStatus } = require('../config');
const aiProvider = require('./aiProvider');
const { logUsage } = require('./usageLogger');

/**
 * Memory:
 *  - short-term = the recent messages of the conversation (+ a rolling
 *    summary once it grows long) — see maybeSummarizeConversation.
 *  - long-term  = small, typed facts extracted from turns and stored in
 *    tam24_ai_student_memory with importance/confidence/subject, so the
 *    student can audit and delete them.
 *
 * Extraction is selective (every N turns or on trigger words) to keep cost
 * predictable, and only runs when the memory feature is enabled for both
 * the deployment and the student.
 */

const MEMORY_TYPES = new Set([
    'weakness', 'strength', 'preference', 'goal', 'learning_behavior', 'important_fact', 'progress',
]);

async function getActiveMemories(db, userId, limit = CONTEXT_LIMITS.maxMemoryItems, { subjectKey = null } = {}) {
    // Subject-specific memories first, then general ones; both by importance.
    const [rows] = await db.query(
        `SELECT id, memory_type, content, importance, confidence, subject_key, source, created_at, updated_at
         FROM tam24_ai_student_memory
         WHERE user_id = ? AND is_active = 1
         ORDER BY (subject_key = ?) DESC, importance DESC, updated_at DESC
         LIMIT ?`,
        [userId, subjectKey || '', limit]
    );
    return rows;
}

async function listMemories(db, userId, { limit = 50 } = {}) {
    const [rows] = await db.query(
        `SELECT id, memory_type, content, importance, confidence, subject_key, source, created_at, updated_at
         FROM tam24_ai_student_memory
         WHERE user_id = ? AND is_active = 1
         ORDER BY updated_at DESC LIMIT ?`,
        [userId, Math.min(200, Math.max(1, Number(limit) || 50))]
    );
    return rows;
}

async function forgetMemory(db, userId, memoryId) {
    const [res] = await db.query(
        `UPDATE tam24_ai_student_memory SET is_active = 0 WHERE id = ? AND user_id = ? AND is_active = 1`,
        [memoryId, userId]
    );
    return res.affectedRows > 0;
}

async function clearMemories(db, userId) {
    const [res] = await db.query(`UPDATE tam24_ai_student_memory SET is_active = 0 WHERE user_id = ? AND is_active = 1`, [userId]);
    return res.affectedRows;
}

/** Heuristic: update memory every N user messages, or when keywords appear. */
function shouldUpdateMemory({ messageCount, userMessage }) {
    if (messageCount > 0 && messageCount % 6 === 0) return true;
    const text = String(userMessage || '');
    const triggers = ['نمی‌فهمم', 'نمیفهمم', 'برام سخته', 'ضعف', 'هدفم', 'میخوام', 'می‌خوام', 'تمرین', 'کنکور', 'امتحان دارم', 'همیشه'];
    return triggers.some((t) => text.includes(t));
}

async function maybeUpdateMemory(db, {
    userId, conversationId, messageCount, userMessage, assistantMessage,
    subjectKey = null, sourceMessageId = null, enabled = true,
}) {
    if (!enabled || !featureStatus().memory) return { updated: false, reason: 'disabled' };
    if (!shouldUpdateMemory({ messageCount, userMessage })) return { updated: false };

    const started = Date.now();
    try {
        const existing = await getActiveMemories(db, userId, 12, { subjectKey });
        const known = existing.map((m) => `- (${m.memory_type}) ${m.content}`).join('\n').slice(0, 1200);

        const result = await aiProvider.generate({
            model: MODELS.utility,
            maxTokens: 220,
            temperature: 0.2,
            messages: [
                {
                    role: 'system',
                    content: [
                        'از این تبادل آموزشی، حداکثر ۳ نکته‌ی حافظه‌ی پایدار و مفید برای معلم استخراج کن (ضعف، قوت، هدف، ترجیح، رفتار یادگیری، پیشرفت، واقعیت مهم).',
                        'نکاتی که در فهرست «حافظه‌ی فعلی» هست را تکرار نکن. چیزهای گذرا یا جزئیات یک سوال خاص را ننویس.',
                        'فقط JSON آرایه‌ای برگردان: [{"type":"weakness|strength|preference|goal|learning_behavior|important_fact|progress","content":"...","importance":1-10,"confidence":0-100}]. اگر چیزی نبود [] برگردان.',
                    ].join('\n'),
                },
                {
                    role: 'user',
                    content: `حافظه‌ی فعلی:\n${known || '(خالی)'}\n\nپیام دانش‌آموز:\n${String(userMessage).slice(0, 800)}\n\nپاسخ معلم:\n${String(assistantMessage).slice(0, 800)}`,
                },
            ],
        });

        let items = [];
        try {
            const match = String(result.content || '').match(/\[[\s\S]*\]/);
            items = match ? JSON.parse(match[0]) : [];
        } catch {
            items = [];
        }

        let saved = 0;
        for (const item of (Array.isArray(items) ? items : []).slice(0, 3)) {
            const type = String(item?.type || 'important_fact');
            const content = String(item?.content || '').trim();
            if (!MEMORY_TYPES.has(type) || content.length < 4) continue;
            await db.query(
                `INSERT INTO tam24_ai_student_memory
                 (user_id, memory_type, content, importance, confidence, subject_key, source, source_message_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId, type, content.slice(0, 500),
                    Math.min(10, Math.max(1, Number(item.importance) || 5)),
                    Math.min(100, Math.max(0, Number(item.confidence) || 70)),
                    subjectKey, `conversation:${conversationId}`, sourceMessageId,
                ]
            );
            saved += 1;
        }

        const usage = result.usage || {};
        await logUsage(db, {
            userId, conversationId, messageId: sourceMessageId, operationType: 'memory', subjectKey,
            model: result.model || MODELS.utility, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
            cachedTokens: usage.cachedTokens, units: saved, durationMs: Date.now() - started,
        });
        return { updated: saved > 0, count: saved };
    } catch (err) {
        console.error('[met] memory update skipped:', err.message);
        await logUsage(db, {
            userId, conversationId, operationType: 'memory', subjectKey, model: MODELS.utility,
            status: 'error', errorCode: err.code || 'MEMORY_FAILED', errorMessage: err.message, durationMs: Date.now() - started,
        });
        return { updated: false, error: err.message };
    }
}

/** Rolling summary of older turns once the conversation grows long (short-term memory compression). */
async function maybeSummarizeConversation(db, conversation, { userId = null } = {}) {
    if ((conversation.message_count || 0) < CONTEXT_LIMITS.summarizeAfterMessages) {
        return conversation.summary || null;
    }
    if (conversation.summary && conversation.summary_updated_at && conversation.message_count % 12 !== 0) {
        return conversation.summary;
    }

    const started = Date.now();
    try {
        const [oldMessages] = await db.query(
            `SELECT role, content FROM tam24_ai_messages
             WHERE conversation_id = ? AND is_starter = 0 AND role IN ('user','assistant')
             ORDER BY id ASC LIMIT 40`,
            [conversation.id]
        );
        const transcript = oldMessages
            .map((m) => `${m.role === 'assistant' ? 'معلم' : 'دانش‌آموز'}: ${String(m.content).slice(0, 300)}`)
            .join('\n')
            .slice(0, 6000);

        const result = await aiProvider.generate({
            model: MODELS.utility,
            maxTokens: 240,
            temperature: 0.2,
            messages: [
                { role: 'system', content: 'گفتگوی آموزشی را در حداکثر ۸ جمله‌ی فارسی خلاصه کن. مباحث پوشش‌داده‌شده، اشکال‌های دانش‌آموز و موضوع فعلی را حفظ کن. فقط خلاصه را بنویس.' },
                { role: 'user', content: transcript },
            ],
        });

        const summary = String(result.content || '').trim().slice(0, 1200);
        if (summary) {
            await db.query(
                `UPDATE tam24_ai_conversations SET summary = ?, summary_updated_at = NOW() WHERE id = ?`,
                [summary, conversation.id]
            );
        }
        const usage = result.usage || {};
        await logUsage(db, {
            userId: userId ?? conversation.user_id, conversationId: conversation.id, operationType: 'summary',
            subjectKey: conversation.subject_key || null, model: result.model || MODELS.utility,
            inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, durationMs: Date.now() - started,
        });
        return summary || conversation.summary || null;
    } catch (err) {
        console.error('[met] conversation summarize skipped:', err.message);
        return conversation.summary || null;
    }
}

module.exports = {
    MEMORY_TYPES,
    getActiveMemories,
    listMemories,
    forgetMemory,
    clearMemories,
    shouldUpdateMemory,
    maybeUpdateMemory,
    maybeSummarizeConversation,
};
