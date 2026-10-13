'use strict';

function getPool() {
    return require('../db');
}

function decodeText(text) {
    return String(text || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;|&#160;/gi, ' ')
        .replace(/&amp;|&#38;/gi, '&')
        .replace(/&lt;|&#60;/gi, '<')
        .replace(/&gt;|&#62;/gi, '>')
        .replace(/&quot;|&#34;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'");
}

function tokens(text) {
    const found = decodeText(text).match(/[\p{L}\p{N}\u200c]+/gu) || [];
    return found
        .map((word) => word.replace(/\u200c/g, '').toLowerCase())
        .filter((word) => word.length > 0);
}

function countWords(text) {
    return tokens(text).length;
}

function wordDelta(before, after) {
    const left = new Map();
    const right = new Map();
    for (const word of tokens(before)) left.set(word, (left.get(word) || 0) + 1);
    for (const word of tokens(after)) right.set(word, (right.get(word) || 0) + 1);
    let delta = 0;
    const keys = new Set([...left.keys(), ...right.keys()]);
    for (const key of keys) {
        delta += Math.abs((left.get(key) || 0) - (right.get(key) || 0));
    }
    return delta;
}

async function recordWordEvent({ adminId, action, questionId, wordCount, source = 'live' }) {
    const words = Number(wordCount) || 0;
    const id = Number(adminId);
    if (!Number.isInteger(id) || id <= 0 || words <= 0) return;
    if (action !== 'insert' && action !== 'edit') return;
    try {
        await getPool().query(
            `INSERT INTO tam24_admin_word_events (admin_id, action, question_id, word_count, source)
             VALUES (?, ?, ?, ?, ?)`,
            [id, action, questionId ? Number(questionId) : null, words, source === 'backfill' ? 'backfill' : 'live']
        );
    } catch (err) {
        console.error('word event log failed:', err.message);
    }
}

async function measureEditDelta(questionId, next = {}) {
    const id = Number(questionId);
    if (!Number.isInteger(id) || id <= 0) return 0;
    let delta = 0;

    if (next.text !== undefined) {
        const [[row]] = await getPool().query(
            `SELECT question_text FROM questions_tam24 WHERE id = ? LIMIT 1`,
            [id]
        );
        delta += wordDelta(row?.question_text, next.text);
    }

    if (next.descriptiveAnswer !== undefined) {
        const [[row]] = await getPool().query(
            `SELECT answer_text FROM descriptive_answers_tam24 WHERE question_id = ? LIMIT 1`,
            [id]
        );
        delta += wordDelta(row?.answer_text, next.descriptiveAnswer);
    }

    if (Array.isArray(next.options)) {
        const [rows] = await getPool().query(
            `SELECT id, option_text FROM options_tam24 WHERE question_id = ?`,
            [id]
        );
        const byId = new Map(rows.map((row) => [Number(row.id), row.option_text]));
        for (const opt of next.options) {
            delta += wordDelta(byId.get(Number(opt.id)) || '', opt.text);
        }
    }

    return delta;
}

const BACKFILL_BATCH = 500;
const BACKFILL_MAX_BATCHES = 8;

async function backfillBatch(query, limit) {
    const [questions] = await query(
        `SELECT q.id, q.admin_id, q.question_text
         FROM questions_tam24 q
         WHERE NOT EXISTS (
             SELECT 1 FROM tam24_admin_word_events e
             WHERE e.question_id = q.id AND e.action = 'insert'
         )
         ORDER BY q.id ASC
         LIMIT ?`,
        [limit]
    );
    if (!questions.length) return { scanned: 0, logged: 0 };

    const ids = questions.map((question) => question.id);
    const [options] = await query(
        `SELECT question_id, option_text FROM options_tam24 WHERE question_id IN (?)`,
        [ids]
    );
    const [answers] = await query(
        `SELECT question_id, answer_text FROM descriptive_answers_tam24 WHERE question_id IN (?)`,
        [ids]
    );

    const optionWords = new Map();
    for (const row of options) {
        const key = Number(row.question_id);
        optionWords.set(key, (optionWords.get(key) || 0) + countWords(row.option_text));
    }
    const answerWords = new Map();
    for (const row of answers) {
        const key = Number(row.question_id);
        answerWords.set(key, (answerWords.get(key) || 0) + countWords(row.answer_text));
    }

    const placeholders = [];
    const params = [];
    for (const question of questions) {
        const words = countWords(question.question_text)
            + (optionWords.get(Number(question.id)) || 0)
            + (answerWords.get(Number(question.id)) || 0);
        const adminId = Number(question.admin_id);
        const owner = Number.isInteger(adminId) && adminId > 0 ? adminId : 1;
        const storedWords = owner === adminId ? words : 0;
        placeholders.push('(?, ?, ?, ?, ?)');
        params.push(owner, 'insert', question.id, storedWords, 'backfill');
    }

    if (placeholders.length) {
        await query(
            `INSERT INTO tam24_admin_word_events (admin_id, action, question_id, word_count, source)
             VALUES ${placeholders.join(', ')}`,
            params
        );
    }

    return { scanned: questions.length, logged: placeholders.length };
}

async function backfillInsertedWords() {
    const connection = await getPool().getConnection();
    let scanned = 0;
    let logged = 0;
    let complete = false;
    let locked = false;
    try {
        const [[lock]] = await connection.query(`SELECT GET_LOCK('tam24_word_backfill', 0) AS locked`);
        locked = Number(lock?.locked) === 1;
        if (!locked) return { complete: false, scanned: 0, logged: 0 };

        const query = (sql, params) => connection.query(sql, params);
        for (let batch = 0; batch < BACKFILL_MAX_BATCHES; batch += 1) {
            const result = await backfillBatch(query, BACKFILL_BATCH);
            scanned += result.scanned;
            logged += result.logged;
            if (result.scanned < BACKFILL_BATCH) {
                complete = true;
                break;
            }
        }
        return { complete, scanned, logged };
    } finally {
        if (locked) {
            try { await connection.query(`SELECT RELEASE_LOCK('tam24_word_backfill')`); } catch { /* lock drops with the connection */ }
        }
        connection.release();
    }
}

module.exports = {
    tokens,
    countWords,
    wordDelta,
    recordWordEvent,
    measureEditDelta,
    backfillInsertedWords,
};
