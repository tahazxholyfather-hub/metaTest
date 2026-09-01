// handlers/dashboardHandler.js
const db = require('../db');
const {
    syncUserTasksProgress,
    computeTaskProgress,
} = require('../controllers/taskController');

const MANUAL_TASK_IDS = [8, 9, 10];

/**
 * Helper to dynamically issue discount codes inside transaction
 */
const issueRewardCode = async (conn, userId, taskId) => {
    const [codes] = await conn.query(`
        SELECT dc.id, dc.code
        FROM discount_codes dc
        LEFT JOIN tam24_user_discount_codes udc
            ON udc.discount_code_id = dc.id
           AND udc.user_id = ?
           AND udc.task_id = ?
        WHERE dc.active = 1
          AND (dc.expires_at IS NULL OR dc.expires_at > NOW())
          AND (dc.max_uses IS NULL OR dc.used_count < dc.max_uses)
          AND udc.id IS NULL
        LIMIT 1
        FOR UPDATE
    `, [userId, taskId]);

    if (codes.length === 0) {
        return null;
    }

    const { id: codeId, code } = codes[0];

    await conn.query(`
        INSERT INTO tam24_user_discount_codes (user_id, task_id, discount_code_id)
        VALUES (?, ?, ?)
    `, [userId, taskId, codeId]);

    await conn.query(`
        UPDATE discount_codes SET used_count = used_count + 1 WHERE id = ?
    `, [codeId]);

    return code;
};

/**
 * Fetch complete dashboard data
 */
const handleGetDashboardData = async (req, res) => {
    const userId = req.user.id;

    try {
        // 1. User basics
        const [users] = await db.query(
            'SELECT username, phone, xp_points, trophies, referrer_code_submitted FROM tam24_users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const user = users[0];

        // 2. Answer stats
        const [answerStats] = await db.query(`
            SELECT 
                COUNT(*) as total_questions,
                SUM(CASE WHEN status = 'correct' THEN 1 ELSE 0 END) as correct_answers,
                SUM(CASE WHEN status = 'wrong' THEN 1 ELSE 0 END) as wrong_answers
            FROM tam24_user_answers 
            WHERE user_id = ?
        `, [userId]);

        const stats = answerStats[0];
        const correct = Number(stats.correct_answers) || 0;
        const totalAnswered = correct + (Number(stats.wrong_answers) || 0);
        const accuracyRate = totalAnswered > 0 ? Math.round((correct / totalAnswered) * 100) : 0;

        const practiceMinutes = (Number(stats.total_questions) || 0) * 2;
        const practiceHours = Math.floor(practiceMinutes / 60);
        const practiceDisplay = practiceHours > 0
            ? `${practiceHours} ساعت`
            : (practiceMinutes > 0 ? `${practiceMinutes} دقیقه` : "۰ ساعت");

        // 3. User Activity
        const [activities] = await db.query(`
            SELECT DATE_FORMAT(activity_date, '%Y-%m-%d') as date, time_spent_seconds 
            FROM tam24_user_activities 
            WHERE user_id = ? AND activity_date >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
            ORDER BY activity_date ASC
        `, [userId]);

        const activityData = { '7d': [], '1m': [], '1y': [] };
        const nowTs = Date.now();
        const days7  = nowTs - (7  * 24 * 60 * 60 * 1000);
        const days30 = nowTs - (30 * 24 * 60 * 60 * 1000);

        activities.forEach(row => {
            const ts = new Date(row.date).getTime();
            const pt = { date: row.date, time: row.time_spent_seconds };
            activityData['1y'].push(pt);
            if (ts >= days30) activityData['1m'].push(pt);
            if (ts >= days7)  activityData['7d'].push(pt);
        });

        // 4. Tasks — sync live progress first so claimable state is accurate
        try {
            await syncUserTasksProgress(userId);
        } catch (syncErr) {
            console.error('Dashboard task sync warning:', syncErr);
        }

        const [rawTasks] = await db.query(`
            SELECT 
                t.id, t.title, t.task_type, t.target_value, t.reward_xp, t.reward_badge, t.reward_trophy, t.icon_name, t.expires_at,
                COALESCE(ut.current_progress, 0) as current_progress,
                COALESCE(ut.completed, 0) as completed,
                COALESCE(ut.reward_claimed, 0) as reward_claimed
            FROM tam24_tasks t
            LEFT JOIN tam24_user_tasks ut ON t.id = ut.task_id AND ut.user_id = ?
            WHERE t.expires_at IS NULL OR t.expires_at > NOW()
            ORDER BY t.created_at DESC
        `, [userId]);

        const tasks = { permanent: [], temporary: [] };
        rawTasks.forEach(t => {
            const taskObj = {
                id: t.id,
                title: t.title,
                rewardXp: t.reward_xp,
                rewardBadge: t.reward_badge,
                rewardTrophy: t.reward_trophy || 0,
                current: t.current_progress,
                target: t.target_value,
                icon: t.icon_name,
                isCompleted: !!t.completed,
                rewardClaimed: !!t.reward_claimed,
                expiresAt: t.expires_at
            };

            if (t.task_type === 'permanent') {
                tasks.permanent.push(taskObj);
            } else {
                if (t.expires_at) {
                    const diffMs = new Date(t.expires_at) - new Date();
                    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                    taskObj.expiresIn = diffHours > 0 ? `${diffHours} ساعت` : 'انقضا یافته';
                }
                tasks.temporary.push(taskObj);
            }
        });

        // 5. Topic Mastery
        const [masteryData] = await db.query(`
            SELECT
                s.title as subject,
                COUNT(ua.id) as total_attempts,
                SUM(CASE WHEN ua.status = 'correct' THEN 1 ELSE 0 END) as correct_attempts
            FROM tam24_user_answers ua
            JOIN questions_tam24 q ON ua.question_id = q.id
            LEFT JOIN subjects_tam24 s ON q.subject_id = s.id
            WHERE ua.user_id = ?
            GROUP BY q.subject_id, s.title
            ORDER BY correct_attempts DESC
            LIMIT 4
        `, [userId]);

        const topicMastery = masteryData.map(m => ({
            subject: m.subject || 'درس',
            score: m.total_attempts > 0 ? Math.round((m.correct_attempts / m.total_attempts) * 100) : 0,
            fullMark: 100
        }));

        // 6. TRACING INVITES DIRECTLY FROM TAM24_USERS
        const [invitesRaw] = await db.query(`
            SELECT 
                id, 
                CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) as name, 
                phone as invited_phone, 
                status, 
                created_at
            FROM tam24_users
            WHERE referrer_code_submitted = ? OR referrer_code_submitted = ?
            ORDER BY created_at DESC
        `, [user.phone, user.username]);

        const invitesData = {
            totalInvited: invitesRaw.length,
            activeInvites: invitesRaw.filter(i => i.status === 'active').length,
            list: invitesRaw
        };

        // 7. Calculate Daily Streak
        const [streaks] = await db.query(`
            SELECT DATE(activity_date) as activity_day, SUM(time_spent_seconds) as total_time
            FROM tam24_user_activities
            WHERE user_id = ?
            GROUP BY DATE(activity_date)
            HAVING total_time > 0
            ORDER BY activity_day DESC
        `, [userId]);

        let currentStreak = 0;
        let longestStreak = 0;
        if (streaks.length > 0) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const mostRecentDate = new Date(streaks[0].activity_day);
            mostRecentDate.setHours(0, 0, 0, 0);
            const daysSinceLastActivity = Math.floor((today.getTime() - mostRecentDate.getTime()) / (1000 * 60 * 60 * 24));

            if (daysSinceLastActivity <= 1) {
                for (let i = 0; i < streaks.length; i++) {
                    const streakDate = new Date(streaks[i].activity_day);
                    streakDate.setHours(0, 0, 0, 0);
                    const expectedDate = new Date(mostRecentDate);
                    expectedDate.setDate(expectedDate.getDate() - i);
                    if (streakDate.getTime() === expectedDate.getTime()) {
                        currentStreak++;
                    } else break;
                }
            }

            let tempStreak = 1;
            for (let i = 1; i < streaks.length; i++) {
                const prevDate = new Date(streaks[i - 1].activity_day);
                const currDate = new Date(streaks[i].activity_day);
                prevDate.setHours(0, 0, 0, 0);
                currDate.setHours(0, 0, 0, 0);
                const daysDiff = Math.floor((prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24));
                if (daysDiff === 1) tempStreak++;
                else {
                    longestStreak = Math.max(longestStreak, tempStreak);
                    tempStreak = 1;
                }
            }
            longestStreak = Math.max(longestStreak, tempStreak);
        }

        // 8. Referrer Info
        const referrerCodeSubmitted = user.referrer_code_submitted || null;
        let referrerName = null;

        if (referrerCodeSubmitted) {
            const [referrerRows] = await db.query(
                'SELECT first_name, last_name, username, phone FROM tam24_users WHERE phone = ? OR username = ? LIMIT 1',
                [referrerCodeSubmitted, referrerCodeSubmitted]
            );
            if (referrerRows.length > 0) {
                const ref = referrerRows[0];
                referrerName = [ref.first_name, ref.last_name].filter(Boolean).join(' ') || ref.username || ref.phone;
            }
        }

        // 9. Fetch Real Reward History
        const [rewardHistory] = await db.query(`
            SELECT 
                h.id, 
                t.title as taskTitle, 
                h.reward_xp as rewardXp, 
                h.reward_code as rewardCode, 
                h.reward_trophy as rewardTrophy,
                DATE_FORMAT(h.rewarded_at, '%Y-%m-%d') as date
            FROM tam24_user_reward_history h
            JOIN tam24_tasks t ON h.task_id = t.id
            WHERE h.user_id = ?
            ORDER BY h.rewarded_at DESC
        `, [userId]);

        // 10. Fetch Real In-App Messages
        const [messages] = await db.query(`
            SELECT id, title, body, is_read as isRead, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') as date
            FROM tam24_in_app_messages
            WHERE user_id = ?
            ORDER BY created_at DESC
        `, [userId]);

        // Matches the key the frontend uses with startTour('dashboard', ...)
        const tourKey = req.query.tourKey || 'dashboard';
        const [tourRows] = await db.query('SELECT 1 FROM user_tours WHERE user_id = ? AND tour_key = ? LIMIT 1', [userId, tourKey]);
        const shouldShowTour = tourRows.length === 0;

        // payload
        const dashboardData = {
            stats: {
                xp: user.xp_points || 0,
                trophies: user.trophies || 0,
                accuracy: accuracyRate > 0 ? `${accuracyRate}٪` : "۰٪",
                rank: "🔒 به زودی",
                practiceTime: practiceDisplay
            },
            tasks,
            invites: invitesData,
            topicMastery,
            activity: activityData,
            streak: {
                current: currentStreak,
                longest: longestStreak
            },
            referrerCode: referrerCodeSubmitted,
            referrerName,
            shouldShowTour,
            rewardHistory,
            messages
        };

        return res.status(200).json({ success: true, data: dashboardData });

    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error while fetching dashboard.' });
    }
};

/**
 * Claim task reward — Atomic transactional manual award
 */
const handleClaimTaskReward = async (req, res) => {
    const userId = req.user.id;
    const taskId = Number(req.body?.taskId?.taskId || req.body?.taskId);

    if (!taskId) {
        return res.status(400).json({ success: false, message: 'taskId is required' });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Avoid LEFT JOIN + FOR UPDATE (MySQL can drop rows). Lock task & user_task separately.
        const [[taskMeta]] = await conn.query(
            `SELECT id, target_value, reward_xp, reward_badge, reward_trophy, title
             FROM tam24_tasks
             WHERE id = ?
             FOR UPDATE`,
            [taskId]
        );

        if (!taskMeta) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

        const [[userTask]] = await conn.query(
            `SELECT current_progress, completed, reward_claimed
             FROM tam24_user_tasks
             WHERE user_id = ? AND task_id = ?
             FOR UPDATE`,
            [userId, taskId]
        );

        if (userTask?.reward_claimed === 1) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: 'این پاداش قبلاً دریافت شده است.' });
        }

        // Prefer live progress so claim works even if sync lagged
        let progress = Number(userTask?.current_progress) || 0;
        let target = Number(taskMeta.target_value) || 0;
        let isComplete = userTask?.completed === 1;

        try {
            const live = await computeTaskProgress(userId, taskId);
            if (live) {
                progress = Number(live.current) || 0;
                target = Number(live.target) || target;
                isComplete = progress >= target || isComplete;
            }
        } catch (liveErr) {
            console.error('Live progress check warning:', liveErr);
        }

        if (!isComplete && progress < target) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: 'ماموریت هنوز تکمیل نشده است.' });
        }

        // 1. Mark as claimed
        await conn.query(
            `INSERT INTO tam24_user_tasks (user_id, task_id, current_progress, completed, reward_claimed)
             VALUES (?, ?, ?, 1, 1)
             ON DUPLICATE KEY UPDATE
                current_progress = GREATEST(current_progress, VALUES(current_progress)),
                completed = 1,
                reward_claimed = 1`,
            [userId, taskId, Math.max(progress, target)]
        );

        // 2. Award XP & Trophies
        const xpToAward = Number(taskMeta.reward_xp) || 0;
        const trophiesToAward = Number(taskMeta.reward_trophy) || 0;
        const task = taskMeta;

        await conn.query(
            'UPDATE tam24_users SET xp_points = xp_points + ?, trophies = trophies + ? WHERE id = ?',
            [xpToAward, trophiesToAward, userId]
        );

        // 3. Issue Discount Code if needed (e.g. badge is set to 'discount' or Task 5)
        let issuedCode = null;
        if (task.reward_badge === 'discount' || taskId === 5) {
            issuedCode = await issueRewardCode(conn, userId, taskId);
        }

        // 4. Record Reward History Entry
        await conn.query(`
            INSERT INTO tam24_user_reward_history (user_id, task_id, reward_xp, reward_code, reward_trophy)
            VALUES (?, ?, ?, ?, ?)
        `, [userId, taskId, xpToAward, issuedCode, trophiesToAward]);

        // Level Up Assessment
        const [updatedUser] = await conn.query('SELECT xp_points, xp_level FROM tam24_users WHERE id = ?', [userId]);
        const currentPoints = updatedUser[0].xp_points;
        const expectedLevel = Math.floor(currentPoints / 1000) + 1;

        if (expectedLevel > updatedUser[0].xp_level) {
            await conn.query('UPDATE tam24_users SET xp_level = ? WHERE id = ?', [expectedLevel, userId]);
            // Optional: Issue automated level-up message
            await conn.query(`
                INSERT INTO tam24_in_app_messages (user_id, title, body)
                VALUES (?, ?, ?)
            `, [userId, 'افزایش سطح کاربری!', `تبریک! شما به سطح ${expectedLevel} ارتقا یافتید.`]);
        }

        await conn.commit();

        return res.status(200).json({
            success: true,
            message: 'پاداش با موفقیت دریافت شد',
            data: {
                xpGained: xpToAward,
                trophyGained: trophiesToAward,
                discountCode: issuedCode
            }
        });

    } catch (error) {
        await conn.rollback();
        console.error('Error claiming reward:', error);
        return res.status(500).json({ success: false, message: 'خطا در ثبت و دریافت پاداش.' });
    } finally {
        conn.release();
    }
};

/**
 * Submit referrer code - using phone/username search
 */
const handleSubmitReferrerCode = async (req, res) => {
    const userId = req.user.id;
    const { referrerCode } = req.body;

    if (!referrerCode || typeof referrerCode !== 'string' || referrerCode.trim() === '') {
        return res.status(400).json({ success: false, message: 'کد معرف الزامی است.' });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [userRecord] = await conn.query(
            'SELECT phone, username, referrer_code_submitted FROM tam24_users WHERE id = ? FOR UPDATE',
            [userId]
        );

        if (userRecord.length === 0) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (userRecord[0].referrer_code_submitted) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: 'شما قبلاً کد معرف ثبت کرده‌اید.' });
        }

        // Search the referrer in user records
        const [referrer] = await conn.query(
            'SELECT id, first_name, last_name, username, phone FROM tam24_users WHERE phone = ? OR username = ? LIMIT 1',
            [referrerCode.trim(), referrerCode.trim()]
        );

        if (referrer.length === 0) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'کاربری با این شماره همراه یافت نشد.' });
        }

        const referrerId = referrer[0].id;
        if (referrerId === userId) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: 'شما نمی‌توانید شماره خودتان را به عنوان معرف ثبت کنید.' });
        }

        // Submit the referrer code to target user record
        await conn.query(
            'UPDATE tam24_users SET referrer_code_submitted = ? WHERE id = ?',
            [referrerCode.trim(), userId]
        );

        // Award default referral bonuses (Referrer gets 100 XP, invitee gets 50 XP)
        const referrerBonusXp = 100;
        const refereeBonusXp = 50;

        await conn.query('UPDATE tam24_users SET xp_points = xp_points + ? WHERE id = ?', [referrerBonusXp, referrerId]);
        await conn.query('UPDATE tam24_users SET xp_points = xp_points + ? WHERE id = ?', [refereeBonusXp, userId]);

        // Send confirmation in-app messages to both parties
        await conn.query(`
            INSERT INTO tam24_in_app_messages (user_id, title, body)
            VALUES (?, 'دعوت موفقیت‌آمیز', 'یک کاربر جدید با شماره شما به عنوان معرف ثبت‌نام کرد. پاداش ۱۰۰ امتیاز به حساب شما اضافه شد.')
        `, [referrerId]);

        await conn.query(`
            INSERT INTO tam24_in_app_messages (user_id, title, body)
            VALUES (?, 'ثبت معرف', 'کد معرف شما با موفقیت ثبت شد و ۵۰ امتیاز دریافت کردید.')
        `, [userId]);

        await conn.commit();

        const referrerName = [referrer[0].first_name, referrer[0].last_name].filter(Boolean).join(' ')
            || referrer[0].username
            || referrer[0].phone;

        return res.status(200).json({
            success: true,
            message: 'کد دعوت با موفقیت ثبت شد',
            data: { referrerName }
        });

    } catch (error) {
        await conn.rollback();
        console.error('Error submitting referrer code:', error);
        return res.status(500).json({ success: false, message: 'خطا در ثبت کد معرف.' });
    } finally {
        conn.release();
    }
};

const handleGetTourStatus = async (req, res) => {
    const userId = req.user.id;
    const { tourKey } = req.query;
    if (!tourKey) return res.status(400).json({ success: false, message: 'tourKey is required' });
    try {
        const [rows] = await db.query('SELECT 1 FROM user_tours WHERE user_id = ? AND tour_key = ? LIMIT 1', [userId, tourKey]);
        return res.status(200).json({ success: true, completed: rows.length > 0 });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Database error' });
    }
};

const handleMarkTourAsViewed = async (req, res) => {
    const userId = req.user.id;
    const { tourKey } = req.body;
    if (!tourKey) return res.status(400).json({ success: false, message: 'tourKey is required' });
    try {
        await db.query(`INSERT INTO user_tours (user_id, tour_key) VALUES (?, ?) ON DUPLICATE KEY UPDATE completed_at = CURRENT_TIMESTAMP()`, [userId, tourKey]);
        return res.status(200).json({ success: true, message: 'Tour marked as viewed' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error marking tour' });
    }
};

const handleUpdateTaskProgress = async (req, res) => {
    const userId = req.user.id;
    const { taskId, progressIncrement } = req.body;
    if (!taskId) return res.status(400).json({ success: false, message: 'taskId is required' });
    if (!MANUAL_TASK_IDS.includes(Number(taskId))) return res.status(403).json({ success: false, message: 'Only manual task updates allowed' });
    try {
        const [existingTask] = await db.query('SELECT current_progress FROM tam24_user_tasks WHERE user_id = ? AND task_id = ?', [userId, taskId]);
        const increment = Math.max(1, Number(progressIncrement) || 1);
        const newProgress = (existingTask.length > 0 ? Number(existingTask[0].current_progress) : 0) + increment;
        if (existingTask.length > 0) {
            await db.query('UPDATE tam24_user_tasks SET current_progress = ? WHERE user_id = ? AND task_id = ?', [newProgress, userId, taskId]);
        } else {
            await db.query('INSERT INTO tam24_user_tasks (user_id, task_id, current_progress) VALUES (?, ?, ?)', [userId, taskId, newProgress]);
        }
        return res.status(200).json({ success: true, data: { newProgress } });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error updating task progress' });
    }
};

module.exports = {
    handleGetDashboardData,
    handleClaimTaskReward,
    handleSubmitReferrerCode,
    handleGetTourStatus,
    handleMarkTourAsViewed,
    handleUpdateTaskProgress
};