'use strict';

const { CONTEXT_LIMITS, MODELS } = require('../config');
const { getSubject } = require('../subjects');
const aiProvider = require('./aiProvider');
const { logUsage } = require('./usageLogger');

const NEW_TITLE = 'گفتگوی جدید';

function fallbackTitle(text) {
    const cleaned = String(text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^[؟?!.،,]+/, '');
    if (!cleaned) return NEW_TITLE;
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

async function createConversation(db, { userId, subjectKey, sourceType = 'chat', questionId = null, title = NEW_TITLE, snapshot = null }) {
    const subject = getSubject(subjectKey);
    if (!subject) throw new Error('INVALID_SUBJECT');
    const source = sourceType === 'quiz_question' ? 'quiz_question' : 'chat';

    const [result] = await db.query(
        `INSERT INTO tam24_ai_conversations
            (user_id, subject_key, title, message_count, last_message_at, source_type, question_id, question_snapshot)
         VALUES (?, ?, ?, 0, NOW(), ?, ?, ?)`,
        [userId, subjectKey, title || NEW_TITLE, source, source === 'quiz_question' ? questionId : null, snapshot ? JSON.stringify(snapshot) : null]
    );
    if (source === 'chat') {
        await db.query(`UPDATE tam24_users SET ai_last_subject = ? WHERE id = ?`, [subjectKey, userId]);
    }

    return {
        id: result.insertId, user_id: userId, subject_key: subjectKey, title: title || NEW_TITLE,
        message_count: 0, title_generated: source === 'quiz_question' ? 1 : 0,
        source_type: source, question_id: source === 'quiz_question' ? questionId : null,
    };
}

const CONVERSATION_COLUMNS = `id, user_id, subject_key, title, summary, summary_updated_at, title_generated,
        message_count, total_tokens, last_message_at, created_at, updated_at, source_type, question_id`;

async function getLatestConversation(db, userId, subjectKey = null) {
    const params = [userId];
    let sql = `SELECT ${CONVERSATION_COLUMNS} FROM tam24_ai_conversations
               WHERE user_id = ? AND archived_at IS NULL AND COALESCE(source_type, 'chat') = 'chat'`;
    if (subjectKey) { sql += ' AND subject_key = ?'; params.push(subjectKey); }
    sql += ' ORDER BY COALESCE(last_message_at, created_at) DESC LIMIT 1';
    const [rows] = await db.query(sql, params);
    return rows[0] || null;
}

async function getQuizConversation(db, userId, questionId) {
    const [rows] = await db.query(
        `SELECT ${CONVERSATION_COLUMNS} FROM tam24_ai_conversations
         WHERE user_id = ? AND question_id = ? AND source_type = 'quiz_question'
         ORDER BY id DESC LIMIT 1`,
        [userId, questionId]
    );
    return rows[0] || null;
}

async function getOrCreateQuizConversation(db, { userId, questionId, subjectKey, title, snapshot }) {
    const existing = await getQuizConversation(db, userId, questionId);
    if (existing) {
        if (existing.archived_at) {
            await db.query(`UPDATE tam24_ai_conversations SET archived_at = NULL WHERE id = ?`, [existing.id]);
            existing.archived_at = null;
        }
        return existing;
    }
    try {
        return await createConversation(db, {
            userId, subjectKey, sourceType: 'quiz_question', questionId, title, snapshot,
        });
    } catch (err) {
        const again = await getQuizConversation(db, userId, questionId);
        if (again) return again;
        throw err;
    }
}

async function getConversationForUser(db, conversationId, userId) {
    const [rows] = await db.query(
        `SELECT ${CONVERSATION_COLUMNS} FROM tam24_ai_conversations WHERE id = ? AND user_id = ? AND archived_at IS NULL LIMIT 1`,
        [conversationId, userId]
    );
    return rows[0] || null;
}

async function setConversationSubject(db, conversationId, subjectKey) {
    await db.query(`UPDATE tam24_ai_conversations SET subject_key = ? WHERE id = ?`, [subjectKey, conversationId]);
}

async function listConversations(db, userId, { limit = 30, offset = 0, subjectKey = null, search = null } = {}) {
    const params = [userId];
    let sql = `SELECT id, subject_key, title, last_message_at, created_at, message_count, source_type, question_id
               FROM tam24_ai_conversations WHERE user_id = ? AND archived_at IS NULL AND COALESCE(source_type, 'chat') = 'chat'`;
    if (subjectKey) { sql += ' AND subject_key = ?'; params.push(subjectKey); }
    const q = String(search || '').trim();
    if (q) { sql += ' AND title LIKE ?'; params.push(`%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`); }
    sql += ' ORDER BY COALESCE(last_message_at, created_at) DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const [rows] = await db.query(sql, params);
    return rows;
}

async function renameConversation(db, userId, conversationId, title) {
    const clean = String(title || '').trim().slice(0, CONTEXT_LIMITS.titleMaxChars);
    if (!clean) throw new Error('EMPTY_TITLE');
    const [result] = await db.query(
        `UPDATE tam24_ai_conversations SET title = ?, title_generated = 1 WHERE id = ? AND user_id = ? AND archived_at IS NULL`,
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

const MESSAGE_COLUMNS = `id, conversation_id, role, content, input_tokens, output_tokens, total_tokens,
        coin_cost, model, is_starter, attachments, status, latency_ms, regenerated_from, created_at`;

/** Replies that were regenerated stay in the DB for audit but are hidden from the transcript. */
const NOT_SUPERSEDED = `AND id NOT IN (
        SELECT regenerated_from FROM (SELECT regenerated_from FROM tam24_ai_messages WHERE conversation_id = ? AND regenerated_from IS NOT NULL) s
    )`;

/** Paginated newest-first fetch, returned oldest-first (with a `hasMore` flag). */
async function getMessages(db, conversationId, { limit = 50, beforeId = null } = {}) {
    const params = [conversationId, conversationId];
    let sql = `SELECT ${MESSAGE_COLUMNS} FROM tam24_ai_messages WHERE conversation_id = ? ${NOT_SUPERSEDED}`;
    if (beforeId) { sql += ' AND id < ?'; params.push(beforeId); }
    sql += ' ORDER BY id DESC LIMIT ?';
    params.push(limit + 1);

    const [rows] = await db.query(sql, params);
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).reverse().map((r) => ({ ...r, attachments: parseAttachments(r.attachments) }));
    return Object.assign(page, { hasMore });
}

async function getRecentMessages(db, conversationId, limit = CONTEXT_LIMITS.recentMessages) {
    const [rows] = await db.query(
        `SELECT id, role, content, attachments, is_starter, status, created_at
         FROM tam24_ai_messages
         WHERE conversation_id = ? AND role IN ('user','assistant') AND status <> 'error' ${NOT_SUPERSEDED}
         ORDER BY id DESC LIMIT ?`,
        [conversationId, conversationId, limit]
    );
    return rows.reverse().map((r) => ({ ...r, attachments: parseAttachments(r.attachments) }));
}

async function getMessageForUser(db, messageId, userId) {
    const [[row]] = await db.query(
        `SELECT m.id, m.conversation_id, m.role, m.content, m.input_tokens, m.output_tokens, m.total_tokens,
                m.coin_cost, m.model, m.is_starter, m.attachments, m.status, m.latency_ms, m.regenerated_from, m.created_at,
                c.user_id, c.subject_key AS conversation_subject
         FROM tam24_ai_messages m JOIN tam24_ai_conversations c ON c.id = m.conversation_id
         WHERE m.id = ? AND c.user_id = ? AND c.archived_at IS NULL LIMIT 1`,
        [messageId, userId]
    );
    if (!row) return null;
    return { ...row, attachments: parseAttachments(row.attachments) };
}

/**
 * For "regenerate": find the user message that produced an assistant reply
 * (the closest earlier user turn in the same conversation).
 */
async function getUserTurnBefore(db, conversationId, assistantMessageId) {
    const [[row]] = await db.query(
        `SELECT id, content, attachments FROM tam24_ai_messages
         WHERE conversation_id = ? AND id < ? AND role = 'user' ORDER BY id DESC LIMIT 1`,
        [conversationId, assistantMessageId]
    );
    return row ? { ...row, attachments: parseAttachments(row.attachments) } : null;
}

async function touchConversation(dbOrConn, conversationId, { messagesAdded = 0, tokens = 0 } = {}) {
    await dbOrConn.query(
        `UPDATE tam24_ai_conversations
            SET message_count = message_count + ?, total_tokens = total_tokens + ?, last_message_at = NOW(), updated_at = NOW()
          WHERE id = ?`,
        [messagesAdded, tokens, conversationId]
    );
}

/**
 * AI-generated Persian title — utility model, tiny prompt, once per
 * conversation (or when the first real exchange happens after a rename to
 * the default). Falls back to a truncated user message on any failure.
 */
async function generateTitle(db, { conversationId, userId = null, subjectKey = null, userMessage, assistantMessage }) {
    let title = fallbackTitle(userMessage);
    const started = Date.now();
    try {
        const result = await aiProvider.generate({
            model: MODELS.utility,
            maxTokens: 24,
            temperature: 0.3,
            messages: [
                {
                    role: 'system',
                    content: 'برای این گفتگوی آموزشی یک عنوان کوتاه فارسی (۲ تا ۶ کلمه) بنویس که موضوع اصلی را نشان دهد؛ مثل «حل معادله‌ی درجه دو» یا «چرخه‌ی کربس». فقط عنوان را برگردان، بدون گیومه، نقطه یا ایموجی.',
                },
                {
                    role: 'user',
                    content: `پیام دانش‌آموز: ${String(userMessage || '').slice(0, 400)}\nپاسخ: ${String(assistantMessage || '').slice(0, 400)}`,
                },
            ],
        });
        const clean = String(result.content || '').split('\n')[0].replace(/^["'«]+|["'».]+$/g, '').trim();
        if (clean) title = clean.slice(0, CONTEXT_LIMITS.titleMaxChars);
        const usage = result.usage || {};
        await logUsage(db, {
            userId, conversationId, operationType: 'title', subjectKey, model: result.model || MODELS.utility,
            inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, durationMs: Date.now() - started,
        });
    } catch (err) {
        console.error('[met] title generation fallback used:', err.message);
    }

    await db.query(`UPDATE tam24_ai_conversations SET title = ?, title_generated = 1 WHERE id = ?`, [title, conversationId]);
    return title;
}

module.exports = {
    NEW_TITLE,
    fallbackTitle,
    parseAttachments,
    createConversation,
    getLatestConversation,
    getQuizConversation,
    getOrCreateQuizConversation,
    getConversationForUser,
    setConversationSubject,
    listConversations,
    renameConversation,
    deleteConversation,
    getMessages,
    getRecentMessages,
    getMessageForUser,
    getUserTurnBefore,
    touchConversation,
    generateTitle,
};
