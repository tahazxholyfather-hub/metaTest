'use strict';

const db = require('../../db');
const { FEATURES } = require('../config');
const imageService = require('./imageService');

/**
 * Accountability tools — Met can look at the platform's own data instead of
 * only trusting what the student types. Every tool is read-only and scoped
 * to the current authenticated user; nothing here can touch another user's
 * data or mutate anything.
 */

const TOOL_DEFINITIONS = [
    {
        type: 'function',
        function: {
            name: 'get_student_snapshot',
            description:
                'Get this student\'s account basics: display name, subscription plan, level/XP, and how many minutes they studied recently. Use this to personalize tone (e.g. greet by name) or to notice if the student has been inactive — never to reveal system/account internals verbatim.',
            parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_recent_quiz_activity',
            description:
                'Get the student\'s most recent quiz attempts (title, subject/type, accuracy, score, when). Use this to tailor a lesson to what they actually struggled with recently, or to congratulate real progress. Do not invent quizzes that are not returned here.',
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
            name: 'get_subject_score_summary',
            description:
                'Get aggregate performance for a specific subject (or all subjects if omitted): quizzes taken, average accuracy, best and weakest areas by score. Use before deciding whether to review basics or move to advanced material.',
            parameters: {
                type: 'object',
                properties: {
                    subject: {
                        type: 'string',
                        description: 'Optional subject filter in Persian or English, e.g. "ریاضی" or "math".',
                    },
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
                'Generate an educational illustration/diagram and show it to the student — e.g. a labeled diagram of a cell, a force diagram, a graph sketch, a molecule structure. Use only when a visual genuinely helps understanding, not for every message. Write the image prompt in clear English describing exactly what should be drawn, style "clean educational textbook diagram, labeled, simple colors".',
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

function limitClamp(n, def = 5, max = 15) {
    const v = Math.floor(Number(n) || def);
    return Math.max(1, Math.min(max, v));
}

async function getStudentSnapshot({ userId }) {
    const [[user]] = await db.query(
        `SELECT first_name, last_name, current_plan, xp_level, xp_points, trophies
         FROM tam24_users WHERE id = ? LIMIT 1`,
        [userId]
    );
    const [[activity]] = await db.query(
        `SELECT COALESCE(SUM(time_spent_seconds), 0) AS seconds
         FROM tam24_user_activities
         WHERE user_id = ? AND activity_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`,
        [userId]
    );
    return {
        name: [user?.first_name, user?.last_name].filter(Boolean).join(' ') || null,
        plan: user?.current_plan || 'free',
        level: user?.xp_level ?? null,
        xp: user?.xp_points ?? null,
        trophies: user?.trophies ?? null,
        minutesStudiedLast7Days: Math.round((Number(activity?.seconds) || 0) / 60),
    };
}

async function getRecentQuizActivity({ userId, limit }) {
    const [rows] = await db.query(
        `SELECT q.title, q.quiz_type, q.difficulty, r.accuracy_rate, r.correct_count,
                r.incorrect_count, r.total_score, r.created_at
         FROM quiz_results r
         JOIN quizzes q ON r.quiz_id = q.id
         WHERE r.user_id = ?
         ORDER BY r.created_at DESC
         LIMIT ?`,
        [userId, limitClamp(limit)]
    );

    return {
        count: rows.length,
        quizzes: rows.map((r) => ({
            title: r.title,
            type: r.quiz_type,
            difficulty: r.difficulty,
            accuracyPercent: r.accuracy_rate != null ? Number(r.accuracy_rate) : null,
            correct: r.correct_count,
            incorrect: r.incorrect_count,
            score: r.total_score,
            when: r.created_at,
        })),
    };
}

async function getSubjectScoreSummary({ userId, subject }) {
    const params = [userId];
    let sql = `
        SELECT q.title, q.quiz_type, r.accuracy_rate, r.total_score, r.created_at
        FROM quiz_results r
        JOIN quizzes q ON r.quiz_id = q.id
        WHERE r.user_id = ?
    `;
    if (subject) {
        sql += ` AND (q.title LIKE ? OR q.quiz_type LIKE ?)`;
        const like = `%${String(subject).trim()}%`;
        params.push(like, like);
    }
    sql += ' ORDER BY r.created_at DESC LIMIT 100';

    const [rows] = await db.query(sql, params);
    if (!rows.length) {
        return { subject: subject || 'all', quizCount: 0, averageAccuracy: null, note: 'No quiz history found.' };
    }

    const accuracies = rows.map((r) => Number(r.accuracy_rate) || 0);
    const avg = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
    const best = rows[accuracies.indexOf(Math.max(...accuracies))];
    const worst = rows[accuracies.indexOf(Math.min(...accuracies))];

    return {
        subject: subject || 'all',
        quizCount: rows.length,
        averageAccuracy: Math.round(avg * 10) / 10,
        bestQuiz: best ? { title: best.title, accuracyPercent: Number(best.accuracy_rate) } : null,
        weakestQuiz: worst ? { title: worst.title, accuracyPercent: Number(worst.accuracy_rate) } : null,
    };
}

async function generateImageTool({ prompt }) {
    const image = await imageService.generateAndStoreImage({ prompt });
    return { success: true, url: image.url, promptUsed: image.promptUsed, __attachment: image };
}

const EXECUTORS = {
    get_student_snapshot: getStudentSnapshot,
    get_recent_quiz_activity: getRecentQuizActivity,
    get_subject_score_summary: getSubjectScoreSummary,
    generate_image: generateImageTool,
};

/** Tools currently enabled, respecting feature toggles (fail closed, not open). */
function getAvailableTools() {
    if (!FEATURES.tools) return [];
    return TOOL_DEFINITIONS.filter((t) => FEATURES.imageGeneration || t.function.name !== 'generate_image');
}

/**
 * Executes one tool call. Returns { content, attachment? } — `content` is
 * JSON-serializable data fed back to the model as the tool result; the
 * optional `attachment` (only for generate_image) is surfaced by the caller
 * onto the final assistant message shown in the UI.
 */
async function executeToolCall(toolCall, context) {
    const name = toolCall?.function?.name;
    const executor = EXECUTORS[name];
    if (!executor) {
        return { content: { error: `Unknown tool: ${name}` } };
    }
    let args = {};
    try {
        args = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
    } catch {
        args = {};
    }
    try {
        const result = await executor({ ...context, ...args });
        if (result && result.__attachment) {
            const { __attachment, ...content } = result;
            return { content, attachment: { type: 'image', ...__attachment } };
        }
        return { content: result };
    } catch (err) {
        console.error(`[ai-teacher] tool ${name} failed:`, err.message);
        return { content: { error: 'Tool temporarily unavailable.' } };
    }
}

module.exports = {
    TOOL_DEFINITIONS,
    getAvailableTools,
    executeToolCall,
};
