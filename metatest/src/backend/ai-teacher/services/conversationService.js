'use strict';

const { CONTEXT_LIMITS } = require('../config');

function personalizeStarter(template, user) {
    const first = user?.first_name || 'دوست من';
    return String(template)
        .replace(/\{\{first_name\}\}/g, first)
        .replace(/\{\{last_name\}\}/g, user?.last_name || '')
        .replace(/\{\{name\}\}/g, [user?.first_name, user?.last_name].filter(Boolean).join(' ') || first);
}

function titleFromUserMessage(text) {
    const cleaned = String(text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^[؟?!.،,]+/, '');
    if (!cleaned) return 'گفتگوی جدید';
    return cleaned.slice(0, CONTEXT_LIMITS.titleMaxChars);
}

async function pickStarterMessage(db, teacherId) {
    const [rows] = await db.query(
        `SELECT id, message, type FROM tam24_ai_teacher_starter_messages
         WHERE teacher_id = ? AND is_active = 1
         ORDER BY sort_order ASC, id ASC`,
        [teacherId]
    );
    if (!rows.length) {
        return {
            id: null,
            message: 'سلام! من معلم خصوصی تو هستم. امروز دوست داری روی چی کار کنیم؟',
            type: 'greeting',
        };
    }
    const idx = Math.floor(Math.random() * rows.length);
    return rows[idx];
}

async function createConversationWithStarter(db, { userId, teacherId, user }) {
    const starter = await pickStarterMessage(db, teacherId);
    const content = personalizeStarter(starter.message, user);

    const [result] = await db.query(
        `INSERT INTO tam24_ai_conversations
         (user_id, teacher_id, title, message_count, last_message_at)
         VALUES (?, ?, ?, 1, NOW())`,
        [userId, teacherId, 'گفتگوی جدید']
    );

    const conversationId = result.insertId;

    const [msgResult] = await db.query(
        `INSERT INTO tam24_ai_messages
         (conversation_id, role, content, is_starter, coin_cost)
         VALUES (?, 'assistant', ?, 1, 0)`,
        [conversationId, content]
    );

    await db.query(
        `UPDATE tam24_ai_teachers
         SET conversations_count = conversations_count + 1, students_count = students_count + 1
         WHERE id = ?`,
        [teacherId]
    );

    return {
        conversation: {
            id: conversationId,
            userId,
            teacherId,
            title: 'گفتگوی جدید',
            messageCount: 1,
        },
        starterMessage: {
            id: msgResult.insertId,
            role: 'assistant',
            content,
            isStarter: true,
            coinCost: 0,
            createdAt: new Date().toISOString(),
        },
    };
}

async function getLatestConversation(db, userId, teacherId) {
    const [rows] = await db.query(
        `SELECT id, user_id, teacher_id, title, summary, summary_updated_at,
                message_count, total_tokens, last_message_at, created_at, updated_at
         FROM tam24_ai_conversations
         WHERE user_id = ? AND teacher_id = ? AND archived_at IS NULL
         ORDER BY COALESCE(last_message_at, created_at) DESC
         LIMIT 1`,
        [userId, teacherId]
    );
    return rows[0] || null;
}

async function getConversationForUser(db, conversationId, userId) {
    const [rows] = await db.query(
        `SELECT id, user_id, teacher_id, title, summary, summary_updated_at,
                message_count, total_tokens, last_message_at, created_at, updated_at
         FROM tam24_ai_conversations
         WHERE id = ? AND user_id = ?
         LIMIT 1`,
        [conversationId, userId]
    );
    return rows[0] || null;
}

async function listConversations(db, userId, { limit = 20, offset = 0 } = {}) {
    const [rows] = await db.query(
        `SELECT c.id, c.teacher_id, c.title, c.last_message_at, c.created_at, c.message_count,
                t.display_name AS teacher_name, t.avatar_url AS teacher_avatar, t.subject AS teacher_subject
         FROM tam24_ai_conversations c
         JOIN tam24_ai_teachers t ON t.id = c.teacher_id
         WHERE c.user_id = ? AND c.archived_at IS NULL
         ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, offset]
    );
    return rows;
}

async function getMessages(db, conversationId, { limit = 50, beforeId = null } = {}) {
    const params = [conversationId];
    let sql = `
        SELECT id, role, content, input_tokens, output_tokens, total_tokens,
               coin_cost, model, is_starter, created_at
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
    return rows.reverse();
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

module.exports = {
    personalizeStarter,
    titleFromUserMessage,
    pickStarterMessage,
    createConversationWithStarter,
    getLatestConversation,
    getConversationForUser,
    listConversations,
    getMessages,
    getRecentMessages,
};
