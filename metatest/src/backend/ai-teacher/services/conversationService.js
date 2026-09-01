'use strict';

const { CONTEXT_LIMITS, MODELS } = require('../config');
const { getSubject } = require('../subjects');
const aiProvider = require('./aiProvider');

function personalizeStarter(template, user) {
    const first = user?.first_name || 'دوست من';
    return String(template || '')
        .replace(/\{\{first_name\}\}/g, first)
        .replace(/\{\{name\}\}/g, [user?.first_name, user?.last_name].filter(Boolean).join(' ') || first);
}

function fallbackTitle(text) {
    const cleaned = String(text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^[؟?!.،,]+/, '');
    if (!cleaned) return 'گفتگوی جدید';
    return cleaned.slice(0, CONTEXT_LIMITS.titleMaxChars);
}

function parseAttachments(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function createConversation(db, { userId, subjectKey }) {
    const subject = getSubject(subjectKey);
    if (!subject) throw new Error('INVALID_SUBJECT');

    const [result] = await db.query(
        `INSERT INTO tam24_ai_conversations
         (user_id, subject_key, title, message_count, last_message_at)
         VALUES (?, ?, 'گفتگوی جدید', 0, NOW())`,
        [userId, subjectKey]
    );

    await db.query(`UPDATE tam24_users SET ai_last_subject = ? WHERE id = ?`, [subjectKey, userId]);

    return {
        id: result.insertId,
        userId,
        subjectKey,
        title: 'گفتگوی جدید',
        messageCount: 0,
    };
}

async function getLatestConversation(db, userId, subjectKey = null) {
    const params = [userId];
    let sql = `
        SELECT id, user_id, subject_key, title, summary, summary_updated_at, title_generated,
               message_count, total_tokens, last_message_at, created_at, updated_at
        FROM tam24_ai_conversations
        WHERE user_id = ? AND archived_at IS NULL
    `;
    if (subjectKey) {
        sql += ' AND subject_key = ?';
        params.push(subjectKey);
    }
    sql += ' ORDER BY COALESCE(last_message_at, created_at) DESC LIMIT 1';

    const [rows] = await db.query(sql, params);
    return rows[0] || null;
}

async function getConversationForUser(db, conversationId, userId) {
    const [rows] = await db.query(
        `SELECT id, user_id, subject_key, title, summary, summary_updated_at, title_generated,
                message_count, total_tokens, last_message_at, created_at, updated_at
         FROM tam24_ai_conversations
         WHERE id = ? AND user_id = ? AND archived_at IS NULL
         LIMIT 1`,
        [conversationId, userId]
    );
    return rows[0] || null;
}

async function setConversationSubject(db, conversationId, subjectKey) {
    await db.query(`UPDATE tam24_ai_conversations SET subject_key = ? WHERE id = ?`, [subjectKey, conversationId]);
}

async function listConversations(db, userId, { limit = 30, offset = 0 } = {}) {
    const [rows] = await db.query(
        `SELECT id, subject_key, title, last_message_at, created_at, message_count
         FROM tam24_ai_conversations
         WHERE user_id = ? AND archived_at IS NULL
         ORDER BY COALESCE(last_message_at, created_at) DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, offset]
    );
    return rows;
}

async function renameConversation(db, userId, conversationId, title) {
    const clean = String(title || '').trim().slice(0, CONTEXT_LIMITS.titleMaxChars);
    if (!clean) throw new Error('EMPTY_TITLE');
    const [result] = await db.query(
        `UPDATE tam24_ai_conversations SET title = ?, title_generated = 1 WHERE id = ? AND user_id = ?`,
        [clean, conversationId, userId]
    );
    if (!result.affectedRows) throw new Error('NOT_FOUND');
    return clean;
}

async function deleteConversation(db, userId, conversationId) {
    const [result] = await db.query(
        `UPDATE tam24_ai_conversations SET archived_at = NOW() WHERE id = ? AND user_id = ? AND archived_at IS NULL`,
        [conversationId, userId]
    );
    if (!result.affectedRows) throw new Error('NOT_FOUND');
}

async function getMessages(db, conversationId, { limit = 50, beforeId = null } = {}) {
    const params = [conversationId];
    let sql = `
        SELECT id, role, content, input_tokens, output_tokens, total_tokens,
               coin_cost, model, is_starter, attachments, created_at
        FROM tam24_ai_messages
        WHERE conversation_id = ?
    `;
    if (beforeId) {
        sql += ' AND id < ?';
        params.push(beforeId);
    }
    sql += ' ORDER BY id DESC LIMIT ?';
    params.push(limit);

    const [rows] = await db.query(sql, params);
    return rows.reverse().map((r) => ({ ...r, attachments: parseAttachments(r.attachments) }));
}

async function getRecentMessages(db, conversationId, limit = CONTEXT_LIMITS.recentMessages) {
    const [rows] = await db.query(
        `SELECT id, role, content, is_starter, created_at
         FROM tam24_ai_messages
         WHERE conversation_id = ?
         ORDER BY id DESC
         LIMIT ?`,
        [conversationId, limit]
    );
    return rows.reverse();
}

/**
 * AI-generated conversation title — cheap model, tiny prompt, only once per
 * conversation. Falls back to a truncated user message on any failure.
 */
async function generateTitle(db, { conversationId, userMessage, assistantMessage }) {
    let title = fallbackTitle(userMessage);
    try {
        const result = await aiProvider.generate({
            model: MODELS.memory,
            maxTokens: 24,
            temperature: 0.3,
            messages: [
                {
                    role: 'system',
                    content:
                        'یک عنوان کوتاه (حداکثر ۶ کلمه)، طبیعی و فارسی برای این گفتگوی آموزشی بنویس. فقط عنوان را برگردان، بدون گیومه یا نقطه پایانی.',
                },
                {
                    role: 'user',
                    content: `پیام دانش‌آموز: ${String(userMessage).slice(0, 400)}\nپاسخ: ${String(assistantMessage).slice(0, 400)}`,
                },
            ],
        });
        const clean = String(result.content || '').replace(/^["'«]+|["'»]+$/g, '').trim();
        if (clean) title = clean.slice(0, CONTEXT_LIMITS.titleMaxChars);
    } catch (err) {
        console.error('[ai-teacher] title generation fallback used:', err.message);
    }

    await db.query(
        `UPDATE tam24_ai_conversations SET title = ?, title_generated = 1 WHERE id = ?`,
        [title, conversationId]
    );
    return title;
}

module.exports = {
    personalizeStarter,
    fallbackTitle,
    parseAttachments,
    createConversation,
    getLatestConversation,
    getConversationForUser,
    setConversationSubject,
    listConversations,
    renameConversation,
    deleteConversation,
    getMessages,
    getRecentMessages,
    generateTitle,
};
