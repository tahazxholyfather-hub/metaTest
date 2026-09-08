'use strict';

const db = require('../../db');
const { CONTEXT_LIMITS, MODELS, featureStatus } = require('../config');
const { subjectKeyFromText, getSubject } = require('../subjects');
const aiProvider = require('./aiProvider');
const fileStorage = require('./fileStorage');
const pricing = require('./pricing');
const { logToolCall, logUsage } = require('./usageLogger');

/**
 * Controlled tool layer — the only way the model touches MetaTest data.
 *
 *  - Every tool has a strict schema; arguments are validated/clamped here,
 *    never trusted from the model.
 *  - Every tool is scoped to the authenticated student (userId from the JWT),
 *    read-only against platform tables, and parameterised SQL only.
 *  - Every invocation is logged to tam24_ai_tool_calls.
 *  - Tools fail closed: a disabled feature removes the tool from the list
 *    the model sees, and runtime errors return a neutral message.
 */

const MAX_QUESTIONS = 6;
const MAX_TOOL_ARG_CHARS = 400;

const TOOL_DEFINITIONS = [
    {
        type: 'function',
        function: {
            name: 'search_questions',
            description:
                'Search MetaTest\'s real exam-question bank by subject, optional grade (10/11/12), optional chapter/topic keywords and free-text keywords. Returns actual questions with their options and the correct answer. ALWAYS use this instead of inventing practice questions when the student asks for exercises, tests, "سوال بده", "تمرین", or similar. Present returned questions in Persian; never reveal the correct answer before the student attempts unless they ask for the solution.',
            parameters: {
                type: 'object',
                properties: {
                    subject: { type: 'string', description: 'Subject in Persian or English: ریاضی/math, فیزیک/physics, شیمی/chemistry, زیست/biology.' },
                    grade: { type: 'integer', description: 'Optional school grade: 10, 11 or 12.' },
                    chapter: { type: 'string', description: 'Optional chapter or topic keywords in Persian (e.g. "مشتق", "حرکت‌شناسی").' },
                    keywords: { type: 'string', description: 'Optional free-text keywords to match inside the question text.' },
                    difficulty: { type: 'string', enum: ['آسان', 'متوسط', 'سخت'], description: 'Optional difficulty filter.' },
                    limit: { type: 'integer', description: `How many questions to return (1-${MAX_QUESTIONS}, default 3).` },
                },
                required: ['subject'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_user_learning_profile',
            description:
                'Get this student\'s learning profile from real platform data: name, plan, level/XP, study minutes in the last 7 days, per-subject accuracy from answered questions, and the topics they most often get wrong. Use when tailoring difficulty, answering "how am I doing?", or planning a study path. Never fabricate numbers if the profile is empty.',
            parameters: {
                type: 'object',
                properties: {
                    subject: { type: 'string', description: 'Optional subject filter (Persian or English) to narrow weak topics.' },
                },
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_recent_quiz_activity',
            description:
                'Get the student\'s most recent quiz attempts (title, type, accuracy, score, when). Use to reference what they actually practised recently or to congratulate real progress. Do not invent quizzes that are not returned.',
            parameters: {
                type: 'object',
                properties: {
                    limit: { type: 'integer', description: 'How many recent quizzes to return, default 5, max 15.' },
                },
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'generate_image',
            description:
                'Generate an educational illustration/diagram and show it to the student — a labeled cell, a free-body diagram, a graph sketch, a molecule. Use only when a visual genuinely helps, not for every message. Write the prompt in clear English describing exactly what to draw; style "clean educational textbook diagram, labeled, simple colors, white background".',
            parameters: {
                type: 'object',
                properties: {
                    prompt: { type: 'string', description: 'Detailed English description of the diagram/illustration to generate.' },
                },
                required: ['prompt'],
                additionalProperties: false,
            },
        },
    },
];

// ─── validation helpers ──────────────────────────────────────────────────────
const clampInt = (n, def, min, max) => {
    const v = Math.floor(Number(n));
    if (!Number.isFinite(v)) return def;
    return Math.max(min, Math.min(max, v));
};
const cleanText = (v, max = MAX_TOOL_ARG_CHARS) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const likeEscape = (s) => s.replace(/[%_\\]/g, (m) => `\\${m}`);

/** Map our subject key → subjects_tam24.id via its Persian title (cached). */
let subjectIdCache = { at: 0, map: null };
async function subjectIdsByKey() {
    if (subjectIdCache.map && Date.now() - subjectIdCache.at < 10 * 60 * 1000) return subjectIdCache.map;
    const map = {};
    try {
        const [rows] = await db.query(`SELECT id, title FROM subjects_tam24`);
        for (const r of rows) {
            const key = subjectKeyFromText(r.title);
            if (key && !map[key]) map[key] = r.id;
        }
    } catch (err) {
        console.error('[met] subjects_tam24 lookup failed:', err.message);
    }
    subjectIdCache = { at: Date.now(), map };
    return map;
}

async function gradeIdFor(grade) {
    if (!grade) return null;
    try {
        const [rows] = await db.query(`SELECT id, title FROM grades_tam24`);
        const hit = rows.find((r) => String(r.title).replace(/[^\d]/g, '') === String(grade));
        return hit ? hit.id : null;
    } catch {
        return null;
    }
}

// ─── tools ───────────────────────────────────────────────────────────────────
async function searchQuestions({ userId, subject, grade, chapter, keywords, difficulty, limit }) {
    const subjectKey = subjectKeyFromText(subject) || (getSubject(subject) ? String(subject).toLowerCase() : null);
    if (!subjectKey || subjectKey === 'general') {
        return { questions: [], note: 'Subject must be one of: math, physics, chemistry, biology.' };
    }
    const ids = await subjectIdsByKey();
    const subjectId = ids[subjectKey];
    if (!subjectId) return { questions: [], note: 'No question bank is linked to this subject yet.' };

    const params = [subjectId];
    let sql = `
        SELECT q.id, q.question_text, q.difficulty_level, q.chapter, q.book, q.academic_year,
               g.title AS grade_title, t.title AS topic_title, c.title AS chapter_title
        FROM questions_tam24 q
        LEFT JOIN grades_tam24 g ON g.id = q.grade_id
        LEFT JOIN topics_tam24 t ON t.id = q.topic_id
        LEFT JOIN chapters_tam24 c ON c.id = q.chapter_id
        WHERE q.status = 'فعال' AND q.subject_id = ?`;

    const gradeId = await gradeIdFor(clampInt(grade, null, 1, 12));
    if (gradeId) { sql += ' AND q.grade_id = ?'; params.push(gradeId); }

    const diff = ['آسان', 'متوسط', 'سخت'].includes(difficulty) ? difficulty : null;
    if (diff) { sql += ' AND q.difficulty_level = ?'; params.push(diff); }

    const chapterText = cleanText(chapter, 120);
    if (chapterText) {
        const like = `%${likeEscape(chapterText)}%`;
        sql += ' AND (q.chapter LIKE ? OR t.title LIKE ? OR c.title LIKE ?)';
        params.push(like, like, like);
    }
    const kw = cleanText(keywords, 160);
    if (kw) {
        const tokens = kw.split(' ').filter((w) => w.length >= 2).slice(0, 4);
        for (const tok of tokens) { sql += ' AND q.question_text LIKE ?'; params.push(`%${likeEscape(tok)}%`); }
    }

    const n = clampInt(limit, 3, 1, MAX_QUESTIONS);
    // ORDER BY RAND() over a filtered, indexed subset is fine at this scale (≈13k rows).
    sql += ' ORDER BY RAND() LIMIT ?';
    params.push(n);

    const [rows] = await db.query(sql, params);
    if (!rows.length) return { questions: [], note: 'No questions matched these filters. Try fewer filters.' };

    const qIds = rows.map((r) => r.id);
    const [options] = await db.query(
        `SELECT question_id, id, option_text, is_correct FROM options_tam24 WHERE question_id IN (${qIds.map(() => '?').join(',')}) ORDER BY id ASC`,
        qIds
    );
    const [answers] = await db.query(
        `SELECT question_id, answer_text FROM descriptive_answers_tam24 WHERE question_id IN (${qIds.map(() => '?').join(',')})`,
        qIds
    );
    let mine = [];
    if (userId) {
        [mine] = await db.query(
            `SELECT question_id, status FROM tam24_user_answers WHERE user_id = ? AND question_id IN (${qIds.map(() => '?').join(',')})`,
            [userId, ...qIds]
        );
    }
    const optionsBy = new Map();
    for (const o of options) {
        if (!optionsBy.has(o.question_id)) optionsBy.set(o.question_id, []);
        optionsBy.get(o.question_id).push(o);
    }
    const answerBy = new Map(answers.map((a) => [a.question_id, a.answer_text]));
    const mineBy = new Map(mine.map((m) => [m.question_id, m.status]));

    return {
        subject: subjectKey,
        count: rows.length,
        questionIds: qIds,
        questions: rows.map((r) => {
            const opts = optionsBy.get(r.id) || [];
            const correct = opts.find((o) => o.is_correct);
            return {
                id: r.id,
                text: r.question_text,
                difficulty: r.difficulty_level,
                grade: r.grade_title || null,
                topic: r.topic_title || null,
                chapter: r.chapter_title || r.chapter || null,
                source: r.book || r.source || null,
                year: r.academic_year || null,
                options: opts.map((o, i) => ({ index: i + 1, text: o.option_text })),
                correctOptionIndex: correct ? opts.indexOf(correct) + 1 : null,
                solution: answerBy.get(r.id) || null,
                studentPreviously: mineBy.get(r.id) || null,
            };
        }),
    };
}

async function getUserLearningProfile({ userId, subject }) {
    const [[user]] = await db.query(
        `SELECT first_name, last_name, current_plan, xp_level, xp_points, trophies FROM tam24_users WHERE id = ? LIMIT 1`,
        [userId]
    );
    const [[activity]] = await db.query(
        `SELECT COALESCE(SUM(time_spent_seconds), 0) AS seconds
         FROM tam24_user_activities WHERE user_id = ? AND activity_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`,
        [userId]
    ).catch(() => [[{ seconds: 0 }]]);

    const subjectKey = subjectKeyFromText(subject);
    const ids = await subjectIdsByKey();
    const keyById = Object.fromEntries(Object.entries(ids).map(([k, v]) => [v, k]));

    const params = [userId];
    let filter = '';
    if (subjectKey && ids[subjectKey]) { filter = ' AND q.subject_id = ?'; params.push(ids[subjectKey]); }

    const [bySubject] = await db.query(
        `SELECT q.subject_id, COUNT(*) AS answered,
                SUM(a.status = 'correct') AS correct, SUM(a.status = 'wrong') AS wrong
         FROM tam24_user_answers a JOIN questions_tam24 q ON q.id = a.question_id
         WHERE a.user_id = ? AND a.status IN ('correct','wrong')${filter}
         GROUP BY q.subject_id`,
        params
    ).catch(() => [[]]);

    const [weakTopics] = await db.query(
        `SELECT q.subject_id, t.title AS topic, COUNT(*) AS wrong
         FROM tam24_user_answers a
         JOIN questions_tam24 q ON q.id = a.question_id
         LEFT JOIN topics_tam24 t ON t.id = q.topic_id
         WHERE a.user_id = ? AND a.status = 'wrong'${filter} AND t.title IS NOT NULL
         GROUP BY q.subject_id, t.title ORDER BY wrong DESC LIMIT 6`,
        params
    ).catch(() => [[]]);

    return {
        name: [user?.first_name, user?.last_name].filter(Boolean).join(' ') || null,
        plan: user?.current_plan || 'free',
        level: user?.xp_level ?? null,
        xp: user?.xp_points ?? null,
        trophies: user?.trophies ?? null,
        minutesStudiedLast7Days: Math.round((Number(activity?.seconds) || 0) / 60),
        subjects: bySubject.map((r) => ({
            subject: keyById[r.subject_id] || 'other',
            answered: Number(r.answered) || 0,
            accuracyPercent: r.answered ? Math.round((Number(r.correct) / Number(r.answered)) * 100) : null,
        })),
        weakTopics: weakTopics.map((r) => ({ subject: keyById[r.subject_id] || 'other', topic: r.topic, wrongCount: Number(r.wrong) })),
        note: bySubject.length ? undefined : 'No answered questions yet — treat as a fresh start.',
    };
}

async function getRecentQuizActivity({ userId, limit }) {
    const [rows] = await db.query(
        `SELECT q.title, q.quiz_type, q.difficulty, r.accuracy_rate, r.correct_count, r.incorrect_count, r.total_score, r.created_at
         FROM quiz_results r JOIN quizzes q ON r.quiz_id = q.id
         WHERE r.user_id = ? ORDER BY r.created_at DESC LIMIT ?`,
        [userId, clampInt(limit, 5, 1, 15)]
    ).catch(() => [[]]);
    return {
        count: rows.length,
        quizzes: rows.map((r) => ({
            title: r.title, type: r.quiz_type, difficulty: r.difficulty,
            accuracyPercent: r.accuracy_rate != null ? Number(r.accuracy_rate) : null,
            correct: r.correct_count, incorrect: r.incorrect_count, score: r.total_score, when: r.created_at,
        })),
    };
}

/**
 * Image generation: provider → optimise → /uploads/ai/generated → tam24_ai_files.
 * The coin surcharge is applied by the chat turn that owns this tool call
 * (so it rides on the same reservation); here we only record provider cost.
 */
async function generateImageTool({ userId, conversationId, prompt }) {
    const clean = cleanText(prompt, 1000);
    if (!clean) return { error: 'Prompt is required.' };
    const started = Date.now();
    const result = await aiProvider.generateImage({ prompt: clean, model: MODELS.image });

    let buffer = null;
    if (result.b64) buffer = Buffer.from(result.b64, 'base64');
    else if (result.url) {
        const resp = await fetch(result.url);
        if (!resp.ok) throw new Error('IMAGE_DOWNLOAD_FAILED');
        buffer = Buffer.from(await resp.arrayBuffer());
    }
    if (!buffer?.length) throw new Error('EMPTY_IMAGE_RESULT');

    const stored = await fileStorage.saveBuffer('generated_image', buffer, { mime: 'image/png', originalName: 'generated.png' });
    const coinCost = pricing.flatCoinCost('image_generation', MODELS.image);
    const unit = pricing.quoteUnits({ model: MODELS.image, operationType: 'image_generation', units: 1 });
    const fileId = await fileStorage.recordFile(db, {
        userId, conversationId, kind: 'generated_image', stored,
        promptUsed: result.revisedPrompt || clean, model: MODELS.image, coinCost,
    });
    await logUsage(db, {
        userId, conversationId, operationType: 'image_generation', model: MODELS.image,
        units: 1, coinCost, costUsd: unit.usd, costIrr: unit.irr, exchangeRateIrr: unit.exchangeRateIrr,
        durationMs: Date.now() - started, attachedFiles: [fileId],
    });

    return {
        success: true,
        url: stored.publicUrl,
        promptUsed: result.revisedPrompt || clean,
        __attachment: {
            type: 'image', url: stored.publicUrl, mimeType: stored.mimeType, fileId,
            width: stored.width, height: stored.height, promptUsed: result.revisedPrompt || clean, source: 'generated',
        },
        __coinSurcharge: coinCost,
    };
}

const EXECUTORS = {
    search_questions: searchQuestions,
    get_user_learning_profile: getUserLearningProfile,
    get_recent_quiz_activity: getRecentQuizActivity,
    generate_image: generateImageTool,
};

/** Tools currently enabled, respecting feature toggles (fail closed, not open). */
function getAvailableTools() {
    const f = featureStatus();
    if (!f.tools) return [];
    return TOOL_DEFINITIONS.filter((t) => f.imageGeneration || t.function.name !== 'generate_image');
}

function parseArgs(raw) {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

/**
 * Executes one tool call for the authenticated student.
 * Returns { content, attachment?, coinSurcharge, questionIds? }.
 */
async function executeToolCall(toolCall, context) {
    const name = toolCall?.function?.name;
    const executor = EXECUTORS[name];
    const { userId, conversationId = null, messageId = null } = context || {};
    if (!executor || !getAvailableTools().some((t) => t.function.name === name)) {
        return { content: { error: `Unknown or disabled tool: ${name}` }, coinSurcharge: 0 };
    }
    const args = parseArgs(toolCall.function.arguments);
    const started = Date.now();
    try {
        const result = await executor({ userId, conversationId, ...args });
        const { __attachment, __coinSurcharge, ...content } = result || {};
        const summary = name === 'search_questions'
            ? `${content.count || 0} questions`
            : name === 'generate_image' ? 'image generated' : 'ok';
        await logToolCall(db, { userId, conversationId, messageId, toolName: name, args, resultSummary: summary, success: true, durationMs: Date.now() - started });
        return {
            content,
            attachment: __attachment || null,
            coinSurcharge: Number(__coinSurcharge) || 0,
            questionIds: Array.isArray(content.questionIds) ? content.questionIds : null,
        };
    } catch (err) {
        console.error(`[met] tool ${name} failed:`, err.message);
        await logToolCall(db, { userId, conversationId, messageId, toolName: name, args, success: false, errorMessage: err.message, durationMs: Date.now() - started });
        return { content: { error: 'Tool temporarily unavailable.' }, coinSurcharge: 0 };
    }
}

module.exports = {
    TOOL_DEFINITIONS,
    MAX_TOOL_CALLS: CONTEXT_LIMITS.maxToolCallsPerTurn,
    getAvailableTools,
    executeToolCall,
    searchQuestions,
    getUserLearningProfile,
};
