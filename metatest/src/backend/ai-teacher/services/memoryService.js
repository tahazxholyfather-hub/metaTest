'use strict';

const { CONTEXT_LIMITS, MODELS } = require('../config');
const aiProvider = require('./aiProvider');

/**
 * Selective memory — avoid expensive updates on every message.
 */

async function getActiveMemories(db, userId, limit = CONTEXT_LIMITS.maxMemoryItems) {
    const [rows] = await db.query(
        `SELECT id, memory_type, content, importance, source, created_at
         FROM tam24_ai_student_memory
         WHERE user_id = ? AND is_active = 1
         ORDER BY importance DESC, updated_at DESC
         LIMIT ?`,
        [userId, limit]
    );
    return rows;
}

async function upsertProfileMemorySummary(db, userId, summary) {
    await db.query(
        `UPDATE tam24_ai_student_profiles
         SET memory_summary = ?, updated_at = NOW()
         WHERE user_id = ?`,
        [summary, userId]
    );
}

/**
 * Heuristic: update memory every N user messages, or when keywords appear.
 */
function shouldUpdateMemory({ messageCount, userMessage }) {
    if (messageCount > 0 && messageCount % 6 === 0) return true;
    const text = String(userMessage || '');
    const triggers = ['نمی‌فهمم', 'برام سخته', 'ضعف', 'هدفم', 'میخوام', 'می‌خوام', 'تمرین'];
    return triggers.some((t) => text.includes(t));
}

async function maybeUpdateMemory(db, {
    userId,
    conversationId,
    messageCount,
    userMessage,
    assistantMessage,
}) {
    if (!shouldUpdateMemory({ messageCount, userMessage })) {
        return { updated: false };
    }

    // Cheap extraction prompt — skipped if provider not configured
    try {
        const result = await aiProvider.generate({
            model: MODELS.memory,
            maxTokens: 180,
            temperature: 0.2,
            messages: [
                {
                    role: 'system',
                    content:
                        'از گفتگوی آموزشی، حداکثر ۳ نکته حافظه مفید استخراج کن. فقط JSON آرایه‌ای برگردان: [{"type":"weakness|strength|preference|goal|progress|important_fact","content":"...","importance":1-10}]. اگر چیزی نبود [] برگردان.',
                },
                {
                    role: 'user',
                    content: `پیام دانش‌آموز:\n${String(userMessage).slice(0, 800)}\n\nپاسخ معلم:\n${String(assistantMessage).slice(0, 800)}`,
                },
            ],
        });

        let items = [];
        try {
            const match = result.content.match(/\[[\s\S]*\]/);
            items = match ? JSON.parse(match[0]) : [];
        } catch {
            items = [];
        }

        if (!Array.isArray(items) || items.length === 0) {
            return { updated: false };
        }

        for (const item of items.slice(0, 3)) {
            const type = String(item.type || 'important_fact');
            const allowed = new Set([
                'weakness', 'strength', 'preference', 'goal',
                'learning_behavior', 'important_fact', 'progress',
            ]);
            if (!allowed.has(type) || !item.content) continue;

            await db.query(
                `INSERT INTO tam24_ai_student_memory
                 (user_id, memory_type, content, importance, source)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    userId,
                    type,
                    String(item.content).slice(0, 500),
                    Math.min(10, Math.max(1, Number(item.importance) || 5)),
                    `conversation:${conversationId}`,
                ]
            );
        }

        const memories = await getActiveMemories(db, userId, 10);
        const summary = memories.map((m) => `• ${m.content}`).join('\n').slice(0, 800);
        if (summary) await upsertProfileMemorySummary(db, userId, summary);

        return { updated: true, count: items.length };
    } catch (err) {
        console.error('[ai-teacher] memory update skipped:', err.message);
        return { updated: false, error: err.message };
    }
}

/**
 * Summarize older conversation when it grows long (token optimization).
 */
async function maybeSummarizeConversation(db, conversation) {
    if ((conversation.message_count || 0) < CONTEXT_LIMITS.summarizeAfterMessages) {
        return conversation.summary || null;
    }

    // Only re-summarize every +12 messages
    if (conversation.summary && conversation.summary_updated_at) {
        const since = conversation.message_count % 12;
        if (since !== 0) return conversation.summary;
    }

    try {
        const [oldMessages] = await db.query(
            `SELECT role, content FROM tam24_ai_messages
             WHERE conversation_id = ? AND is_starter = 0
             ORDER BY id ASC
             LIMIT 40`,
            [conversation.id]
        );

        const transcript = oldMessages
            .map((m) => `${m.role}: ${String(m.content).slice(0, 300)}`)
            .join('\n')
            .slice(0, 6000);

        const result = await aiProvider.generate({
            model: MODELS.memory,
            maxTokens: 220,
            temperature: 0.2,
            messages: [
                {
                    role: 'system',
                    content: 'گفتگوی آموزشی را در حداکثر ۸ جمله فارسی خلاصه کن. نکات یادگیری، ضعف‌ها و موضوع فعلی را حفظ کن.',
                },
                { role: 'user', content: transcript },
            ],
        });

        const summary = String(result.content || '').slice(0, 1200);
        await db.query(
            `UPDATE tam24_ai_conversations
             SET summary = ?, summary_updated_at = NOW()
             WHERE id = ?`,
            [summary, conversation.id]
        );
        return summary;
    } catch (err) {
        console.error('[ai-teacher] conversation summarize skipped:', err.message);
        return conversation.summary || null;
    }
}

module.exports = {
    getActiveMemories,
    shouldUpdateMemory,
    maybeUpdateMemory,
    maybeSummarizeConversation,
};
