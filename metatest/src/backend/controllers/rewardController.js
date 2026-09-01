const pool = require('../db');

// ==========================================
// CONFIGURATION
// ==========================================
const MIN_QUESTIONS = 1;

const MAX_TOTAL_ATTEMPTS_PER_DAY_PER_QUESTION = 12;
const MAX_REWARDED_ATTEMPTS_PER_DAY_PER_QUESTION = 3;
const REPEAT_REWARD_COOLDOWN_MINUTES = 10;
const MIN_ANSWER_TIME_MS = 1500;

const LEVEL_CONFIG = {
    'آسان': {
        fullReward: 10,
        repeatCorrectReward: 2,
        improveReward: 7,
        punishWrongAfterCorrect: -2,
        punishWrongAfterWrong: -3,
        firstWrongPunish: -2,
        bonusChance: 0.02,
        bonusValue: 1,
        xp: {
            newCorrect: 12,
            newWrong: 4,
            repeatCorrectAfterCorrect: 3,
            wrongAfterCorrect: 2,
            correctAfterWrong: 9,
            wrongAfterWrong: 3,
        },
    },
    'متوسط': {
        fullReward: 15,
        repeatCorrectReward: 3,
        improveReward: 11,
        punishWrongAfterCorrect: -3,
        punishWrongAfterWrong: -4,
        firstWrongPunish: -3,
        bonusChance: 0.03,
        bonusValue: 2,
        xp: {
            newCorrect: 18,
            newWrong: 5,
            repeatCorrectAfterCorrect: 4,
            wrongAfterCorrect: 3,
            correctAfterWrong: 13,
            wrongAfterWrong: 4,
        },
    },
    'سخت': {
        fullReward: 20,
        repeatCorrectReward: 4,
        improveReward: 15,
        punishWrongAfterCorrect: -4,
        punishWrongAfterWrong: -5,
        firstWrongPunish: -4,
        bonusChance: 0.05,
        bonusValue: 3,
        xp: {
            newCorrect: 25,
            newWrong: 6,
            repeatCorrectAfterCorrect: 5,
            wrongAfterCorrect: 4,
            correctAfterWrong: 17,
            wrongAfterWrong: 5,
        },
    },
};

// ==========================================
// HELPERS
// ==========================================
const requirePost = (req, res, key) => {
    const val = req.body[key];
    if (
        val === undefined ||
        val === null ||
        val === 'null' ||
        val === 'undefined' ||
        String(val).trim() === ''
    ) {
        res.json({ success: false, message: `Missing or invalid parameter: ${key}` });
        return null;
    }
    return val;
};

const normalizeDifficulty = (difficultyLevel) => {
    const value = String(difficultyLevel || '').trim();
    if (LEVEL_CONFIG[value]) return value;

    const lower = value.toLowerCase();
    if (['easy', 'easy level', 'آسان'].includes(lower)) return 'آسان';
    if (['normal', 'medium', 'متوسط'].includes(lower)) return 'متوسط';
    if (['hard', 'سخت'].includes(lower)) return 'سخت';

    return 'متوسط';
};

const startOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
};

const diffInMinutes = (date1, date2) => {
    return Math.floor(Math.abs(new Date(date1) - new Date(date2)) / 60000);
};

const parseIsCorrect = (val) => {
    if (Buffer.isBuffer(val)) return val[0] === 1;
    return Number(val) === 1 || val === true || val === '1';
};

const getPunishmentMultiplier = (trophies) => {
    if (trophies < 100) return 0;
    if (trophies < 250) return 1;
    if (trophies < 500) return 1.2;
    return 1.4;
};

const applyPunishmentScale = (basePunishment, trophies) => {
    const multiplier = getPunishmentMultiplier(trophies);
    if (multiplier === 0) return 0;
    return Math.round(basePunishment * multiplier);
};

const rollBonus = (chance) => Math.random() < chance;

const buildSuspicionFlags = ({ answerTimeMs, userAgent, ip }) => {
    const flags = [];

    if (typeof answerTimeMs === 'number' && answerTimeMs > 0 && answerTimeMs < MIN_ANSWER_TIME_MS) {
        flags.push('too_fast_answer');
    }

    if (!userAgent || String(userAgent).trim().length < 6) {
        flags.push('missing_or_short_user_agent');
    }

    if (!ip) {
        flags.push('missing_ip');
    }

    return flags;
};

const calculateRewardCore = ({ difficulty, currentStatus, previousStatus, trophies }) => {
    const config = LEVEL_CONFIG[normalizeDifficulty(difficulty)] || LEVEL_CONFIG['متوسط'];

    let reward = 0;
    let xp = 0;
    let reason = '';

    if (previousStatus === false) {
        if (currentStatus === 'correct') {
            reward = config.fullReward;
            xp = config.xp.newCorrect;
            reason = 'first_time_correct';
        } else {
            reward = applyPunishmentScale(config.firstWrongPunish, trophies);
            xp = config.xp.newWrong;
            reason = 'first_time_wrong';
        }
    } else if (previousStatus === 'correct') {
        if (currentStatus === 'correct') {
            reward = config.repeatCorrectReward;
            xp = config.xp.repeatCorrectAfterCorrect;
            reason = 'repeat_correct_after_correct';
        } else {
            reward = applyPunishmentScale(config.punishWrongAfterCorrect, trophies);
            xp = config.xp.wrongAfterCorrect;
            reason = 'wrong_after_correct';
        }
    } else if (previousStatus === 'wrong') {
        if (currentStatus === 'correct') {
            reward = config.improveReward;
            xp = config.xp.correctAfterWrong;
            reason = 'correct_after_wrong';
        } else {
            reward = applyPunishmentScale(config.punishWrongAfterWrong, trophies);
            xp = config.xp.wrongAfterWrong;
            reason = 'wrong_after_wrong';
        }
    }

    return { reward, xp, reason, config };
};

const applyAttemptDecay = ({ reward, xp, attemptsToday, currentStatus, previousStatus }) => {
    let finalReward = reward;
    let finalXp = xp;

    if (attemptsToday >= 3) {
        finalReward = 0;
        finalXp = 1;
    } else if (attemptsToday === 2) {
        finalReward = Math.round(finalReward * 0.5);
        finalXp = Math.max(1, Math.round(finalXp * 0.5));
    } else if (attemptsToday === 1) {
        finalReward = Math.round(finalReward * 0.7);
        finalXp = Math.max(1, Math.round(finalXp * 0.8));
    }

    // extra soft cap for repeat-correct farming
    if (previousStatus === 'correct' && currentStatus === 'correct') {
        if (attemptsToday >= 1) {
            finalReward = Math.min(finalReward, 1);
            finalXp = Math.max(1, Math.min(finalXp, 2));
        }
        if (attemptsToday >= 2) {
            finalReward = 0;
            finalXp = 1;
        }
    }

    return { reward: finalReward, xp: finalXp };
};

// ==========================================
// DB HELPERS
// ==========================================
const getUserById = async (conn, userId) => {
    const [rows] = await conn.query(
        `
        SELECT id, xp_points, trophies
        FROM tam24_users
        WHERE id = ?
        LIMIT 1
        `,
        [userId]
    );
    return rows[0] || null;
};

const getQuestionById = async (conn, questionId) => {
    const [rows] = await conn.query(
        `
        SELECT id, question_text, difficulty_level
        FROM questions_tam24
        WHERE id = ?
        LIMIT 1
        `,
        [questionId]
    );
    return rows[0] || null;
};

const getLatestUserAnswer = async (conn, userId, questionId) => {
    const [rows] = await conn.query(
        `
        SELECT id, status, created_at
        FROM tam24_user_answers
        WHERE user_id = ? AND question_id = ?
        ORDER BY id DESC
        LIMIT 1
        `,
        [userId, questionId]
    );
    return rows[0] || null;
};

const countTodayAttempts = async (conn, userId, questionId) => {
    const [rows] = await conn.query(
        `
        SELECT
            COUNT(*) AS total_attempts_today,
            MAX(created_at) AS last_attempt_at
        FROM tam24_user_answers
        WHERE user_id = ?
          AND question_id = ?
          AND created_at >= ?
        `,
        [userId, questionId, startOfToday()]
    );

    return {
        totalAttemptsToday: Number(rows[0]?.total_attempts_today || 0),
        lastAttemptAt: rows[0]?.last_attempt_at || null,
    };
};

const getOptionById = async (conn, questionId, optionId) => {
    const [rows] = await conn.query(
        `
        SELECT id, option_text, COALESCE(CAST(is_correct AS UNSIGNED), 0) AS is_correct
        FROM options_tam24
        WHERE id = ? AND question_id = ?
        LIMIT 1
        `,
        [optionId, questionId]
    );
    return rows[0] || null;
};

const getCorrectOption = async (conn, questionId) => {
    const [rows] = await conn.query(
        `
        SELECT id
        FROM options_tam24
        WHERE question_id = ? AND is_correct = 1
        LIMIT 1
        `,
        [questionId]
    );
    return rows[0] || null;
};

const insertUserAnswer = async (conn, userId, questionId, status) => {
    await conn.query(
        `
        INSERT INTO tam24_user_answers (user_id, question_id, status)
        VALUES (?, ?, ?)
        `,
        [userId, questionId, status]
    );
};

const updateUserStats = async (conn, userId, trophyDelta, xpDelta) => {
    await conn.query(
        `
        UPDATE tam24_users
        SET
            trophies = GREATEST(0, trophies + ?),
            xp_points = xp_points + ?
        WHERE id = ?
        `,
        [trophyDelta, xpDelta, userId]
    );
};

// ==========================================
// CONTROLLERS
// ==========================================

/**
 * Check latest answer status for a user/question
 * output:
 * false -> never answered
 * 'correct' -> last answer correct
 * 'wrong' -> last answer wrong
 */
const handleCheckUserQuestionStatus = async (req, res) => {
    try {
        const userId = Number(req.body.user_id) || (req.user && req.user.id) || 0;
        const questionId = Number(req.body.question_id) || 0;

        if (userId <= 0 || questionId <= 0) {
            return res.json({ success: false, message: 'Invalid parameters' });
        }

        const [rows] = await pool.query(
            `
            SELECT status, created_at
            FROM tam24_user_answers
            WHERE user_id = ? AND question_id = ?
            ORDER BY id DESC
            LIMIT 1
            `,
            [userId, questionId]
        );

        if (!rows || rows.length === 0) {
            return res.json({
                success: true,
                answered_before: false,
                previous_status: false,
            });
        }

        return res.json({
            success: true,
            answered_before: true,
            previous_status: rows[0].status, // 'correct' or 'wrong'
            last_answered_at: rows[0].created_at,
        });
    } catch (error) {
        console.error("❌ SQL Error in handleCheckUserQuestionStatus:", error);
        res.json({ success: false, message: "Database error checking user question status" });
    }
};

/**
 * Submit answer + reward logic
 * body:
 * {
 *   user_id,
 *   question_id,
 *   option_id,
 *   answer_time_ms
 * }
 */
const handleSubmitAnswerWithReward = async (req, res) => {
    let conn;

    try {
        const userId = Number(req.body.user_id) || (req.user && req.user.id) || 0;
        const questionId = Number(req.body.question_id) || 0;
        const optionId = Number(req.body.option_id) || 0;
        const answerTimeMs = req.body.answer_time_ms !== undefined ? Number(req.body.answer_time_ms) : null;

        if (userId <= 0 || questionId <= 0 || optionId <= 0) {
            return res.json({ success: false, message: 'Invalid parameters' });
        }

        conn = await pool.getConnection();
        await conn.beginTransaction();

        const user = await getUserById(conn, userId);
        if (!user) {
            await conn.rollback();
            return res.json({ success: false, message: 'User not found' });
        }

        const question = await getQuestionById(conn, questionId);
        if (!question) {
            await conn.rollback();
            return res.json({ success: false, message: 'Question not found' });
        }

        const selectedOption = await getOptionById(conn, questionId, optionId);
        if (!selectedOption) {
            await conn.rollback();
            return res.json({ success: false, message: 'Option not found for this question' });
        }

        const correctOption = await getCorrectOption(conn, questionId);
        const isCorrect = parseIsCorrect(selectedOption.is_correct);
        const currentStatus = isCorrect ? 'correct' : 'wrong';

        const previousAnswer = await getLatestUserAnswer(conn, userId, questionId);
        const previousStatus = !previousAnswer ? false : previousAnswer.status;

        const attemptStats = await countTodayAttempts(conn, userId, questionId);
        const suspicionFlags = buildSuspicionFlags({
            answerTimeMs,
            userAgent: req.headers['user-agent'] || '',
            ip: req.ip,
        });

        const underCooldown =
            attemptStats.lastAttemptAt &&
            diffInMinutes(new Date(), attemptStats.lastAttemptAt) < REPEAT_REWARD_COOLDOWN_MINUTES;

        const antiCheatBlocked =
            attemptStats.totalAttemptsToday >= MAX_TOTAL_ATTEMPTS_PER_DAY_PER_QUESTION ||
            suspicionFlags.includes('too_fast_answer');

        const core = calculateRewardCore({
            difficulty: question.difficulty_level,
            currentStatus,
            previousStatus,
            trophies: Number(user.trophies || 0),
        });

        let reward = core.reward;
        let xp = core.xp;
        let bonus = 0;
        let rewardEligible = true;
        let antiCheatReason = null;

        if (antiCheatBlocked) {
            rewardEligible = false;
            reward = 0;
            bonus = 0;
            xp = 1;
            antiCheatReason = suspicionFlags.includes('too_fast_answer')
                ? 'suspicious_fast_answer'
                : 'daily_attempt_limit_reached';
        }

        if (!antiCheatBlocked && underCooldown && previousStatus !== false) {
            rewardEligible = false;
            reward = 0;
            bonus = 0;
            xp = Math.max(1, Math.round(xp * 0.4));
            antiCheatReason = 'cooldown_active';
        }

        if (!antiCheatBlocked && attemptStats.totalAttemptsToday >= MAX_REWARDED_ATTEMPTS_PER_DAY_PER_QUESTION) {
            rewardEligible = false;
            reward = 0;
            bonus = 0;
            xp = Math.max(1, Math.round(xp * 0.3));
            antiCheatReason = 'reward_cap_reached';
        }

        if (rewardEligible) {
            const decayed = applyAttemptDecay({
                reward,
                xp,
                attemptsToday: attemptStats.totalAttemptsToday,
                currentStatus,
                previousStatus,
            });

            reward = decayed.reward;
            xp = decayed.xp;

            // bonus only for correct answers
            if (currentStatus === 'correct' && !underCooldown && !antiCheatBlocked) {
                const config = LEVEL_CONFIG[normalizeDifficulty(question.difficulty_level)] || LEVEL_CONFIG['متوسط'];

                let chance = 0;
                let value = 0;

                if (previousStatus === false) {
                    chance = config.bonusChance;
                    value = config.bonusValue;
                } else if (previousStatus === 'wrong') {
                    chance = config.bonusChance * 1.2;
                    value = config.bonusValue;
                }

                if (chance > 0 && rollBonus(chance)) {
                    bonus = value;
                }
            }
        }

        let finalReward = reward + bonus;

        // Keep trophies from going below zero
        if (Number(user.trophies || 0) + finalReward < 0) {
            finalReward = -Number(user.trophies || 0);
        }

        await insertUserAnswer(conn, userId, questionId, currentStatus);
        await updateUserStats(conn, userId, finalReward, xp);

        const [updatedRows] = await conn.query(
            `
            SELECT id, xp_points, trophies
            FROM tam24_users
            WHERE id = ?
            LIMIT 1
            `,
            [userId]
        );

        await conn.commit();

        return res.json({
            success: true,
            message: 'Answer submitted successfully',
            data: {
                user_id: userId,
                question_id: questionId,
                selected_option_id: optionId,
                correct_option_id: correctOption ? Number(correctOption.id) : null,
                previous_status: previousStatus,
                current_status: currentStatus,
                is_correct: isCorrect,
                reason: core.reason,
                reward: reward,
                bonus: bonus,
                final_reward: finalReward,
                xp: xp,
                reward_eligible: rewardEligible,
                anti_cheat_blocked: antiCheatBlocked,
                anti_cheat_reason: antiCheatReason,
                suspicion_flags: suspicionFlags,
                attempts_today: attemptStats.totalAttemptsToday,
                user_stats: {
                    trophies: Number(updatedRows[0]?.trophies || 0),
                    xp_points: Number(updatedRows[0]?.xp_points || 0),
                },
            },
        });
    } catch (error) {
        if (conn) await conn.rollback();
        console.error("❌ SQL Error in handleSubmitAnswerWithReward:", error);
        res.json({ success: false, message: "Database error submitting answer and reward" });
    } finally {
        if (conn) conn.release();
    }
};

/**
 * Get simple reward stats for a user
 */
const handleGetUserRewardStats = async (req, res) => {
    try {
        const userId = Number(req.body.user_id) || (req.user && req.user.id) || 0;

        if (userId <= 0) {
            return res.json({ success: false, message: 'Invalid user ID' });
        }

        const [userRows] = await pool.query(
            `
            SELECT id, xp_points, trophies
            FROM tam24_users
            WHERE id = ?
            LIMIT 1
            `,
            [userId]
        );

        if (!userRows || userRows.length === 0) {
            return res.json({ success: false, message: 'User not found' });
        }

        const [summaryRows] = await pool.query(
            `
            SELECT
                COUNT(*) AS total_answers,
                SUM(CASE WHEN status = 'correct' THEN 1 ELSE 0 END) AS correct_answers,
                SUM(CASE WHEN status = 'wrong' THEN 1 ELSE 0 END) AS wrong_answers
            FROM tam24_user_answers
            WHERE user_id = ?
            `,
            [userId]
        );

        const [recentRows] = await pool.query(
            `
            SELECT
                ua.id,
                ua.question_id,
                ua.status,
                ua.created_at,
                q.question_text,
                q.difficulty_level
            FROM tam24_user_answers ua
            JOIN questions_tam24 q ON q.id = ua.question_id
            WHERE ua.user_id = ?
            ORDER BY ua.id DESC
            LIMIT 20
            `,
            [userId]
        );

        const [todayRows] = await pool.query(
            `
            SELECT
                COUNT(*) AS today_answers,
                SUM(CASE WHEN status = 'correct' THEN 1 ELSE 0 END) AS today_correct,
                SUM(CASE WHEN status = 'wrong' THEN 1 ELSE 0 END) AS today_wrong
            FROM tam24_user_answers
            WHERE user_id = ?
              AND created_at >= ?
            `,
            [userId, startOfToday()]
        );

        return res.json({
            success: true,
            data: {
                user_id: userId,
                trophies: Number(userRows[0].trophies || 0),
                xp_points: Number(userRows[0].xp_points || 0),
                summary: {
                    total_answers: Number(summaryRows[0]?.total_answers || 0),
                    correct_answers: Number(summaryRows[0]?.correct_answers || 0),
                    wrong_answers: Number(summaryRows[0]?.wrong_answers || 0),
                },
                today: {
                    total_answers: Number(todayRows[0]?.today_answers || 0),
                    correct_answers: Number(todayRows[0]?.today_correct || 0),
                    wrong_answers: Number(todayRows[0]?.today_wrong || 0),
                },
                recent_answers: recentRows,
            },
        });
    } catch (error) {
        console.error("❌ SQL Error in handleGetUserRewardStats:", error);
        res.json({ success: false, message: "Database error fetching reward stats" });
    }
};

module.exports = {
    handleCheckUserQuestionStatus,
    handleSubmitAnswerWithReward,
    handleGetUserRewardStats,
};
