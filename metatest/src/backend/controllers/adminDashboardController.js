'use strict';

const pool = require('../db');

async function safeQuery(sql, params = [], fallback = []) {
    try {
        const [rows] = await pool.query(sql, params);
        return rows;
    } catch (err) {
        console.warn('[admin-dashboard] query skipped:', err.message);
        return fallback;
    }
}

async function scalar(sql, params = [], fallback = 0) {
    const rows = await safeQuery(sql, params, [{ v: fallback }]);
    const v = rows[0] && (rows[0].v ?? rows[0].c ?? Object.values(rows[0])[0]);
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

const handleGetDashboard = async (req, res) => {
    try {
        const [
            usersTotal,
            usersActive,
            usersBanned,
            usersGuest,
            usersNew7,
            usersNew30,
            usersLogin24h,
            usersLogin7d,
            questionsTotal,
            questionsActive,
            questionsInactive,
            questionsNew7,
            questionsWithImages,
            answersTotal,
            answersCorrect,
            answersWrong,
            quizzesTotal,
            quizResults,
            reportsPending,
            reportsTotal,
            pdfsTotal,
            pdfDownloads,
            paymentsPaid,
            paymentsPending,
            revenue,
            visitors7,
            activitySeconds7,
            aiConversations,
            aiMessages,
            aiCoinsSpent,
            aiCostIrr,
            aiUsers,
        ] = await Promise.all([
            scalar(`SELECT COUNT(*) AS v FROM tam24_users`),
            scalar(`SELECT COUNT(*) AS v FROM tam24_users WHERE status = 'active'`),
            scalar(`SELECT COUNT(*) AS v FROM tam24_users WHERE status = 'banned'`),
            scalar(`SELECT COUNT(*) AS v FROM tam24_users WHERE role = 'guest'`),
            scalar(`SELECT COUNT(*) AS v FROM tam24_users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`),
            scalar(`SELECT COUNT(*) AS v FROM tam24_users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`),
            scalar(`SELECT COUNT(*) AS v FROM tam24_users WHERE last_login >= DATE_SUB(NOW(), INTERVAL 1 DAY)`),
            scalar(`SELECT COUNT(*) AS v FROM tam24_users WHERE last_login >= DATE_SUB(NOW(), INTERVAL 7 DAY)`),
            scalar(`SELECT COUNT(*) AS v FROM questions_tam24`),
            scalar(`SELECT COUNT(*) AS v FROM questions_tam24 WHERE status = 'فعال'`),
            scalar(`SELECT COUNT(*) AS v FROM questions_tam24 WHERE status = 'غیرفعال'`),
            scalar(`SELECT COUNT(*) AS v FROM questions_tam24 WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`),
            scalar(`SELECT COUNT(*) AS v FROM question_images_tam24`),
            scalar(`SELECT COUNT(*) AS v FROM tam24_user_answers`),
            scalar(`SELECT COUNT(*) AS v FROM tam24_user_answers WHERE status = 'correct'`),
            scalar(`SELECT COUNT(*) AS v FROM tam24_user_answers WHERE status = 'wrong'`),
            scalar(`SELECT COUNT(*) AS v FROM quizzes`),
            scalar(`SELECT COUNT(*) AS v FROM quiz_results`),
            scalar(`SELECT COUNT(*) AS v FROM reports_tam24 WHERE status = 'pending'`),
            scalar(`SELECT COUNT(*) AS v FROM reports_tam24`),
            scalar(`SELECT COUNT(*) AS v FROM pdf_library`),
            scalar(`SELECT COALESCE(SUM(download_count), 0) AS v FROM pdf_library`),
            scalar(`SELECT COUNT(*) AS v FROM payments WHERE status = 'paid'`),
            scalar(`SELECT COUNT(*) AS v FROM payments WHERE status = 'pending'`),
            scalar(`SELECT COALESCE(SUM(final_price), 0) AS v FROM payments WHERE status = 'paid'`),
            scalar(`SELECT COUNT(*) AS v FROM tam24_visitor_counts WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`),
            scalar(`SELECT COALESCE(SUM(time_spent_seconds), 0) AS v FROM tam24_user_activities WHERE activity_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`),
            scalar(`SELECT COUNT(*) AS v FROM tam24_ai_conversations`),
            scalar(`SELECT COUNT(*) AS v FROM tam24_ai_messages`),
            scalar(`SELECT COALESCE(SUM(lifetime_spent), 0) AS v FROM tam24_ai_wallets`),
            scalar(`SELECT COALESCE(SUM(cost_irr), 0) AS v FROM tam24_ai_usage_logs`),
            scalar(`SELECT COUNT(DISTINCT user_id) AS v FROM tam24_ai_conversations`),
        ]);

        const [
            usersByPlan,
            questionsBySubject,
            questionsByLevel,
            userGrowth,
            visitorTrend,
            activityTrend,
            paymentTrend,
            aiUsageTrend,
            recentUsers,
            recentPayments,
            recentReports,
        ] = await Promise.all([
            safeQuery(`
                SELECT COALESCE(current_plan, 'free') AS name, COUNT(*) AS count
                FROM tam24_users GROUP BY COALESCE(current_plan, 'free') ORDER BY count DESC
            `),
            safeQuery(`
                SELECT COALESCE(s.title, 'Unassigned') AS subject, COUNT(*) AS count
                FROM questions_tam24 q
                LEFT JOIN subjects_tam24 s ON s.id = q.subject_id
                GROUP BY q.subject_id, s.title
                ORDER BY count DESC
            `),
            safeQuery(`
                SELECT COALESCE(difficulty_level, 'متوسط') AS level, COUNT(*) AS count
                FROM questions_tam24 GROUP BY difficulty_level
            `),
            safeQuery(`
                SELECT DATE(created_at) AS day, COUNT(*) AS count
                FROM tam24_users
                WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
                GROUP BY DATE(created_at) ORDER BY day ASC
            `),
            safeQuery(`
                SELECT DATE(created_at) AS day, COUNT(*) AS count
                FROM tam24_visitor_counts
                WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
                GROUP BY DATE(created_at) ORDER BY day ASC
            `),
            safeQuery(`
                SELECT activity_date AS day,
                       SUM(time_spent_seconds) AS seconds,
                       SUM(questions_answered) AS questions,
                       SUM(correct_answers) AS correct
                FROM tam24_user_activities
                WHERE activity_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
                GROUP BY activity_date ORDER BY activity_date ASC
            `),
            safeQuery(`
                SELECT DATE(paid_at) AS day, COUNT(*) AS count, COALESCE(SUM(final_price), 0) AS revenue
                FROM payments
                WHERE status = 'paid' AND paid_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                GROUP BY DATE(paid_at) ORDER BY day ASC
            `),
            safeQuery(`
                SELECT DATE(created_at) AS day, COUNT(*) AS count,
                       COALESCE(SUM(coin_cost), 0) AS coins,
                       COALESCE(SUM(cost_irr), 0) AS irr
                FROM tam24_ai_usage_logs
                WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
                GROUP BY DATE(created_at) ORDER BY day ASC
            `),
            safeQuery(`
                SELECT id, username, first_name, last_name, role, status, current_plan, created_at, last_login
                FROM tam24_users ORDER BY id DESC LIMIT 8
            `),
            safeQuery(`
                SELECT p.id, p.user_id, p.plan_id, p.final_price, p.status, p.paid_at, u.username
                FROM payments p
                LEFT JOIN tam24_users u ON u.id = p.user_id
                ORDER BY p.id DESC LIMIT 8
            `),
            safeQuery(`
                SELECT id, question_id, issue, status, FROM_UNIXTIME(date/1000) AS reported_at
                FROM reports_tam24 ORDER BY id DESC LIMIT 8
            `),
        ]);

        const accuracy = answersTotal > 0 ? Math.round((answersCorrect / answersTotal) * 1000) / 10 : 0;

        return res.json({
            success: true,
            generatedAt: new Date().toISOString(),
            stats: {
                users: {
                    total: usersTotal,
                    active: usersActive,
                    banned: usersBanned,
                    guests: usersGuest,
                    new7d: usersNew7,
                    new30d: usersNew30,
                    login24h: usersLogin24h,
                    login7d: usersLogin7d,
                    byPlan: usersByPlan,
                },
                questions: {
                    total: questionsTotal,
                    active: questionsActive,
                    inactive: questionsInactive,
                    new7d: questionsNew7,
                    withImages: questionsWithImages,
                    bySubject: questionsBySubject,
                    byLevel: questionsByLevel,
                },
                learning: {
                    answers: answersTotal,
                    correct: answersCorrect,
                    wrong: answersWrong,
                    accuracy,
                    quizzes: quizzesTotal,
                    quizResults,
                    activitySeconds7d: activitySeconds7,
                },
                commerce: {
                    paid: paymentsPaid,
                    pending: paymentsPending,
                    revenue,
                },
                content: {
                    reportsPending,
                    reportsTotal,
                    pdfs: pdfsTotal,
                    pdfDownloads,
                    visitors7d: visitors7,
                },
                ai: {
                    conversations: aiConversations,
                    messages: aiMessages,
                    coinsSpent: aiCoinsSpent,
                    costIrr: aiCostIrr,
                    uniqueUsers: aiUsers,
                },
            },
            charts: {
                userGrowth: userGrowth.map(fillDay),
                visitors: visitorTrend.map(fillDay),
                activity: activityTrend.map((r) => ({
                    day: formatDay(r.day),
                    seconds: Number(r.seconds) || 0,
                    questions: Number(r.questions) || 0,
                    correct: Number(r.correct) || 0,
                })),
                payments: paymentTrend.map((r) => ({
                    day: formatDay(r.day),
                    count: Number(r.count) || 0,
                    revenue: Number(r.revenue) || 0,
                })),
                aiUsage: aiUsageTrend.map((r) => ({
                    day: formatDay(r.day),
                    count: Number(r.count) || 0,
                    coins: Number(r.coins) || 0,
                    irr: Number(r.irr) || 0,
                })),
            },
            recent: {
                users: recentUsers,
                payments: recentPayments,
                reports: recentReports,
            },
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load dashboard' });
    }
};

function formatDay(value) {
    if (!value) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
}

function fillDay(row) {
    return { day: formatDay(row.day), count: Number(row.count) || 0 };
}

module.exports = { handleGetDashboard };
