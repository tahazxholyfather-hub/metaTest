// controllers/taskController.js
'use strict';

const db = require('../db');

// ─── Streak helper ────────────────────────────────────────────────────────────
const calculateDailyStreak = async (userId) => {
    try {
        const [streaks] = await db.query(`
            SELECT
                DATE(activity_date) AS activity_day,
                SUM(time_spent_seconds) AS total_time
            FROM tam24_user_activities
            WHERE user_id = ?
            GROUP BY DATE(activity_date)
            ORDER BY activity_day DESC
        `, [userId]);

        if (streaks.length === 0) return { currentStreak: 0, longestStreak: 0 };

        let currentStreak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < streaks.length; i++) {
            const streakDate = new Date(streaks[i].activity_day);
            streakDate.setHours(0, 0, 0, 0);
            const expectedDate = new Date(today);
            expectedDate.setDate(expectedDate.getDate() - i);
            if (streakDate.getTime() === expectedDate.getTime() && streaks[i].total_time > 0) {
                currentStreak++;
            } else break;
        }

        let longestStreak = 0, tempStreak = 0, prevDate = null;
        for (const record of streaks) {
            const currDate = new Date(record.activity_day);
            currDate.setHours(0, 0, 0, 0);
            if (prevDate === null) {
                tempStreak = 1;
            } else {
                const daysDiff = Math.floor(
                    (prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24)
                );
                if (daysDiff === 1 && record.total_time > 0) {
                    tempStreak++;
                } else {
                    longestStreak = Math.max(longestStreak, tempStreak);
                    tempStreak = 1;
                }
            }
            prevDate = currDate;
        }
        longestStreak = Math.max(longestStreak, tempStreak);

        return { currentStreak, longestStreak };
    } catch (error) {
        console.error('Error calculating streak:', error);
        return { currentStreak: 0, longestStreak: 0 };
    }
};

// ─── Per-task progress calculators ───────────────────────────────────────────
const getCorrectPracticeCount = async (userId) => {
    const [[row]] = await db.query(`
        SELECT COUNT(*) AS cnt
        FROM tam24_user_answers
        WHERE user_id = ? AND status = 'correct'
    `, [userId]);
    return { current: row.cnt, target: 10 };
};

const getInviteCount = async (userId) => {
    // Tracing invites directly from tam24_users using referrer_code_submitted
    const [[userRow]] = await db.query('SELECT phone, username FROM tam24_users WHERE id = ?', [userId]);
    const phone = userRow?.phone || '';
    const username = userRow?.username || '';

    const [[row]] = await db.query(`
        SELECT COUNT(*) AS cnt
        FROM tam24_users
        WHERE referrer_code_submitted = ? OR referrer_code_submitted = ?
    `, [phone, username]);
    return { current: row.cnt, target: 3 };
};

const getCompletedQuizCount = async (userId) => {
    const [[row]] = await db.query(`
        SELECT COUNT(*) AS cnt
        FROM quiz_results
        WHERE user_id = ?
    `, [userId]);
    return { current: row.cnt, target: 1 };
};

const getHighScoreQuizCount = async (userId) => {
    const [[row]] = await db.query(`
        SELECT COUNT(*) AS cnt
        FROM quiz_results
        WHERE user_id = ? AND accuracy_rate >= 70
    `, [userId]);
    return { current: row.cnt, target: 1 };
};

const getManualTaskStatus = async (userId, taskId) => {
    const [[row]] = await db.query(`
        SELECT completed FROM tam24_user_tasks
        WHERE user_id = ? AND task_id = ?
    `, [userId, taskId]);
    return { current: row?.completed === 1 ? 1 : 0, target: 1 };
};

const getStreakProgress = async (userId) => {
    const { currentStreak } = await calculateDailyStreak(userId);
    return { current: currentStreak, target: 7 };
};

/**
 * Live progress for a single known task id.
 * Returns null when the task id has no calculator (unknown / inactive).
 */
const computeTaskProgress = async (userId, taskId) => {
    const id = Number(taskId);
    switch (id) {
        case 4:  return getCorrectPracticeCount(userId);
        case 5:  return getInviteCount(userId);
        case 6:  return getCompletedQuizCount(userId);
        case 7:  return getHighScoreQuizCount(userId);
        case 8:  return getManualTaskStatus(userId, 8);
        case 9:  return getManualTaskStatus(userId, 9);
        case 10: return getManualTaskStatus(userId, 10);
        case 11: return getStreakProgress(userId);
        default: return null;
    }
};

/**
 * Sync all tracked tasks for a user (no HTTP). Safe to call from dashboard / claim.
 */
const syncUserTasksProgress = async (userId) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [tasks] = await conn.query(`
            SELECT id, title, description, reward_xp, reward_badge, reward_trophy, target_value
            FROM tam24_tasks
            ORDER BY id
        `);

        const results = [];

        for (const task of tasks) {
            const progress = await computeTaskProgress(userId, task.id);
            if (!progress) continue;

            const isNowCompleted = progress.current >= progress.target;

            const [[existing]] = await conn.query(`
                SELECT id, completed, reward_claimed
                FROM tam24_user_tasks
                WHERE user_id = ? AND task_id = ?
                FOR UPDATE
            `, [userId, task.id]);

            // Do NOT auto-award XP or set reward_claimed — manual claim only.
            if (existing) {
                await conn.query(`
                    UPDATE tam24_user_tasks
                    SET
                        current_progress = ?,
                        completed        = ?,
                        updated_at       = NOW()
                    WHERE user_id = ? AND task_id = ?
                `, [
                    progress.current,
                    isNowCompleted ? 1 : 0,
                    userId,
                    task.id,
                ]);
            } else {
                await conn.query(`
                    INSERT INTO tam24_user_tasks
                        (user_id, task_id, current_progress, completed, reward_claimed)
                    VALUES (?, ?, ?, ?, 0)
                `, [
                    userId,
                    task.id,
                    progress.current,
                    isNowCompleted ? 1 : 0,
                ]);
            }

            results.push({
                taskId:       task.id,
                title:        task.title,
                description:  task.description,
                badge:        task.reward_badge,
                rewardXp:     task.reward_xp,
                rewardTrophy: task.reward_trophy || 0,
                current:      progress.current,
                target:       progress.target,
                isCompleted:  isNowCompleted,
                rewardClaimed: existing ? existing.reward_claimed === 1 : false
            });
        }

        await conn.commit();
        return results;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

// ─── HTTP wrapper ────────────────────────────────────────────────────────────
const syncTaskProgress = async (req, res) => {
    const userId = req.user?.id || req.body?.userId;
    if (!userId) return res.status(400).json({ success: false, message: 'userId required' });

    try {
        const results = await syncUserTasksProgress(userId);
        return res.json({ success: true, tasks: results });
    } catch (err) {
        console.error('syncTaskProgress error:', err);
        return res.status(500).json({ success: false, message: 'خطای سرور در همگام‌سازی ماموریت‌ها' });
    }
};

// ─── Manual trigger ─────────────────────────────────────────────────────────
const markManualTask = async (userId, taskId) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [[existing]] = await conn.query(`
            SELECT id, completed, reward_claimed
            FROM tam24_user_tasks
            WHERE user_id = ? AND task_id = ?
            FOR UPDATE
        `, [userId, taskId]);

        // Keep reward_claimed as 0 so they can claim it manually from the Dashboard
        if (existing) {
            await conn.query(`
                UPDATE tam24_user_tasks
                SET current_progress = 1,
                    completed        = 1,
                    updated_at       = NOW()
                WHERE user_id = ? AND task_id = ?
            `, [userId, taskId]);
        } else {
            await conn.query(`
                INSERT INTO tam24_user_tasks
                    (user_id, task_id, current_progress, completed, reward_claimed)
                VALUES (?, ?, 1, 1, 0)
            `, [userId, taskId]);
        }

        await conn.commit();

    } catch (err) {
        await conn.rollback();
        console.error('markManualTask error:', err);
        throw err;
    } finally {
        conn.release();
    }
};

module.exports = {
    syncTaskProgress,
    syncUserTasksProgress,
    computeTaskProgress,
    markManualTask,
    calculateDailyStreak,
};