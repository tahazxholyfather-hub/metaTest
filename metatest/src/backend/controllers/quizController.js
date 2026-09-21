const pool = require('../db');
const { ensureQuestionTagTables, joinOnTag, matchTagIn } = require('../utils/questionTags');




const REWARD_LEVEL_CONFIG = {
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

const normalizeDifficulty = (difficultyLevel) => {
    const value = String(difficultyLevel || '').trim();
    if (REWARD_LEVEL_CONFIG[value]) return value;

    const lower = value.toLowerCase();
    if (['easy', 'آسان'].includes(lower)) return 'آسان';
    if (['normal', 'medium', 'متوسط'].includes(lower)) return 'متوسط';
    if (['hard', 'سخت'].includes(lower)) return 'سخت';

    return 'متوسط';
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

const calculateRewardCore = ({ difficulty, currentStatus, previousStatus, trophies }) => {
    const config = REWARD_LEVEL_CONFIG[normalizeDifficulty(difficulty)] || REWARD_LEVEL_CONFIG['متوسط'];

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
            reward = 0;
            xp = 0;
            reason = 'already_correct_no_reward';
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
            reward = 0;
            xp = 0;
            reason = 'already_wrong_no_penalty';
        }
    }

    return { reward, xp, reason, config };
};














// ==========================================
// CONFIGURATION
// Change this to 10 for production. Keep at 1 for local testing
// so your menus don't disappear if you only have a few test questions!
// ==========================================
const MIN_QUESTIONS = 1;

// Helper function to enforce required fields and catch string "null"s
const requirePost = (req, res, key) => {
    const val = req.body[key];
    if (val === undefined || val === null || val === 'null' || val === 'undefined' || String(val).trim() === '') {
        res.json({ success: false, message: `Missing or invalid parameter: ${key}` });
        return null;
    }
    return val;
};

const handleGetSubjects = async (req, res) => {
    try {
        const userId = req.user?.id || req.body.user_id || null;

        const sql = `
            SELECT 
                s.id, 
                s.title, 
                s.icon,
                COUNT(q.id) AS question_count,

                COUNT(CASE WHEN ua.status = 'correct' THEN 1 END) AS correct_count,

                COUNT(CASE WHEN ua.status IN ('correct', 'wrong') THEN 1 END) AS answered_count,


                CAST(
                        ROUND(
                                COALESCE(
                                                COUNT(CASE WHEN ua.status = 'correct' THEN 1 END) * 100.0 / NULLIF(COUNT(q.id), 0),
                                                0
                                    )
                            ) AS UNSIGNED
                    ) AS progress_percentage


            FROM questions_tam24 q
            JOIN subjects_tam24 s 
                ON q.subject_id = s.id

            LEFT JOIN tam24_user_answers ua
                ON ua.question_id = q.id
               AND ua.user_id = ?

            WHERE q.status = 'فعال'

            GROUP BY s.id, s.title, s.icon

            HAVING COUNT(q.id) >= ?

            ORDER BY s.id ASC
        `;

        const [rows] = await pool.query(sql, [userId ? Number(userId) : null, MIN_QUESTIONS]);

        res.json({ success: true, subjects: rows });
    } catch (error) {
        console.error("❌ SQL Error in handleGetSubjects:", error);
        res.json({ success: false, message: "Database error fetching subjects" });
    }
};


const handleGetGradesBySubject = async (req, res) => {
    try {
        await ensureQuestionTagTables();
        const subjectId = requirePost(req, res, 'subject_id');
        if (subjectId === null) return;

        const userId = req.user?.id || req.body.user_id || null;

        const sql = `
            SELECT 
                g.id, 
                g.title, 
                COUNT(q.id) AS question_count,

                COUNT(CASE WHEN ua.status = 'correct' THEN 1 END) AS correct_count,

                COUNT(CASE WHEN ua.status IN ('correct', 'wrong') THEN 1 END) AS answered_count,

                CAST(
                        ROUND(
                                COALESCE(
                                                COUNT(CASE WHEN ua.status = 'correct' THEN 1 END) * 100.0 / NULLIF(COUNT(q.id), 0),
                                                0
                                    )
                            ) AS UNSIGNED
                    ) AS progress_percentage


            FROM questions_tam24 q
            INNER JOIN grades_tam24 g 
                ON ${joinOnTag('q', 'g', 'grade')}

            LEFT JOIN tam24_user_answers ua
                ON ua.question_id = q.id
               AND ua.user_id = ?

            WHERE q.subject_id = ?
              AND q.status = 'فعال'

            GROUP BY g.id, g.title

            HAVING COUNT(q.id) >= ?

            ORDER BY g.id ASC
        `;

        const [rows] = await pool.query(sql, [
            userId ? Number(userId) : null,
            Number(subjectId),
            MIN_QUESTIONS
        ]);

        res.json({ success: true, grades: rows });
    } catch (error) {
        console.error("❌ SQL Error in handleGetGradesBySubject:", error);
        res.json({ success: false, message: "Database error fetching grades" });
    }
};



const handleGetChaptersBySubject = async (req, res) => {
    try {
        await ensureQuestionTagTables();
        const subjectId = requirePost(req, res, 'subject_id');
        if (subjectId === null) return;

        const userId = req.user?.id || req.body.user_id || null;
        const gradeId = req.body.grade_id;

        let sql = `
            SELECT 
                t.id, 
                t.title,
                COUNT(q.id) AS question_count,

                COUNT(CASE WHEN ua.status = 'correct' THEN 1 END) AS correct_count,

                COUNT(CASE WHEN ua.status IN ('correct', 'wrong') THEN 1 END) AS answered_count,

                CAST(
                        ROUND(
                                COALESCE(
                                                COUNT(CASE WHEN ua.status = 'correct' THEN 1 END) * 100.0 / NULLIF(COUNT(q.id), 0),
                                                0
                                    )
                            ) AS UNSIGNED
                    ) AS progress_percentage


            FROM questions_tam24 q
            JOIN topics_tam24 t 
                ON ${joinOnTag('q', 't', 'topic')}

            LEFT JOIN tam24_user_answers ua
                ON ua.question_id = q.id
               AND ua.user_id = ?

            WHERE q.subject_id = ?
              AND q.status = 'فعال'
        `;

        const params = [
            userId ? Number(userId) : null,
            Number(subjectId)
        ];

        if (
            gradeId &&
            gradeId !== 'null' &&
            gradeId !== 'undefined' &&
            String(gradeId).trim() !== ''
        ) {
            const gradeMatch = matchTagIn('q', 'grade', gradeId);
            sql += ` AND ${gradeMatch.sql}`;
            params.push(...gradeMatch.params);
        }

        sql += `
            GROUP BY t.id, t.title

            HAVING COUNT(q.id) >= ?

            ORDER BY t.id ASC
        `;

        params.push(MIN_QUESTIONS);

        const [rows] = await pool.query(sql, params);

        res.json({ success: true, chapters: rows });
    } catch (error) {
        console.error("❌ SQL Error in handleGetChaptersBySubject:", error);
        res.json({ success: false, message: "Database error fetching chapters" });
    }
};



const handleGetMabahesByChapter = async (req, res) => {
    try {
        await ensureQuestionTagTables();
        const topicId = requirePost(req, res, 'topic_id');
        if (topicId === null) return;

        const userId = req.user?.id || req.body.user_id || null;

        const topicMatch = matchTagIn('q', 'topic', topicId);

        const sql = `
            SELECT 
                c.id, 
                c.title,
                COUNT(q.id) AS question_count,

                COUNT(CASE WHEN ua.status = 'correct' THEN 1 END) AS correct_count,

                COUNT(CASE WHEN ua.status IN ('correct', 'wrong') THEN 1 END) AS answered_count,

                CAST(
                        ROUND(
                                COALESCE(
                                                COUNT(CASE WHEN ua.status = 'correct' THEN 1 END) * 100.0 / NULLIF(COUNT(q.id), 0),
                                                0
                                    )
                            ) AS UNSIGNED
                    ) AS progress_percentage


            FROM questions_tam24 q
            JOIN chapters_tam24 c 
                ON ${joinOnTag('q', 'c', 'mabhas')}

            LEFT JOIN tam24_user_answers ua
                ON ua.question_id = q.id
               AND ua.user_id = ?

            WHERE ${topicMatch.sql || '1=1'}
              AND q.status = 'فعال'

            GROUP BY c.id, c.title

            HAVING COUNT(q.id) >= ?

            ORDER BY c.id ASC
        `;

        const [rows] = await pool.query(sql, [
            userId ? Number(userId) : null,
            ...topicMatch.params,
            MIN_QUESTIONS
        ]);

        res.json({ success: true, mabahes: rows });
    } catch (error) {
        console.error("❌ SQL Error in handleGetMabahesByChapter:", error);
        res.json({ success: false, message: "Database error fetching mabahes" });
    }
};


const handleGetQuizTypes = (req, res) => {
    res.json({
        success: true,
        types: [
            { key: 'comprehensive', title: 'آزمون کلی' },
            { key: 'topical',      title: 'آزمون موضوعی' },
        ],
    });
};

const handleStartSession = async (req, res) => {
    try {
        const [result] = await pool.query("INSERT INTO quiz_sessions_tam24 (status) VALUES ('active')");
        res.json({ success: true, session_id: result.insertId });
    } catch (error) {
        console.error("❌ SQL Error in handleStartSession:", error);
        res.json({ success: false, message: "Failed to start session" });
    }
};

// Internal helpers for handleGetPracticeQuestion
const buildQuestionFilters = (body) => {
    const filters = [];
    const params = [];

    const mapping = {
        grade_id:        'q.grade_id',
        subject_id:      'q.subject_id',
        topic_id:        'q.topic_id',
        chapter_id:      'q.chapter_id',
        major_id:        'q.major_id',
        academic_year:   'q.academic_year',
        difficulty_level:'q.difficulty_level',
    };

    for (const [postKey, column] of Object.entries(mapping)) {
        const value = body[postKey];
        if (value !== undefined && value !== null && value !== 'null' && value !== 'undefined' && String(value).trim() !== '') {
            if (postKey === 'grade_id') {
                const matched = matchTagIn('q', 'grade', value);
                if (matched.sql) { filters.push(matched.sql); params.push(...matched.params); }
            } else if (postKey === 'topic_id') {
                const matched = matchTagIn('q', 'topic', value);
                if (matched.sql) { filters.push(matched.sql); params.push(...matched.params); }
            } else if (postKey === 'chapter_id') {
                const matched = matchTagIn('q', 'mabhas', value);
                if (matched.sql) { filters.push(matched.sql); params.push(...matched.params); }
            } else {
                filters.push(`${column} = ?`);
                params.push(value);
            }
        }
    }

    return { filters, params };
};

const fetchQuestionOptions = async (questionId) => {
    const [rows] = await pool.query(
        "SELECT id, option_text FROM options_tam24 WHERE question_id = ? ORDER BY id ASC",
        [questionId]
    );
    return rows.map(opt => ({ id: Number(opt.id), text: opt.option_text }));
};

const fetchQuestionImages = async (questionId) => {
    const [rows] = await pool.query(
        "SELECT image_name FROM question_images_tam24 WHERE question_id = ? ORDER BY id ASC",
        [questionId]
    );
    return rows.map(img => img.image_name);
};

const handleGetPracticeQuestion = async (req, res) => {
    try {
        // ==========================================
        // TOGGLE THIS VARIABLE:
        // true  = Generate realistic fake statistics
        // false = Use real database statistics from tam24_user_answers
        // ==========================================
        const USE_MOCK_PERCENTAGES = true;

        const sessionId = Number(req.body.session_id) || 0;
        const userId = Number(req.body.user_id) || (req.user && req.user.id) || 0;
        if (sessionId <= 0) {
            return res.json({ success: false, message: 'Invalid session' });
        }

        const { filters, params } = buildQuestionFilters(req.body);
        await ensureQuestionTagTables();
        const whereClause = filters.length > 0 ? ' AND ' + filters.join(' AND ') : '';

        // 1. Get TOTAL questions count matching the active filters
        const countSql = `
            SELECT COUNT(q.id) AS total
            FROM questions_tam24 q
            WHERE q.status = 'فعال'
           
                ${whereClause}
        `;
        const [countRows] = await pool.query(countSql, params);
        const totalQuestions = countRows[0] ? Number(countRows[0].total) : 0;

        // 2. Fetch the random question
        const sql = `
            SELECT
                q.id,
                q.question_text,
                q.academic_year,
                q.difficulty_level,
                q.grade_id,
                q.subject_id,
                q.topic_id,
                q.chapter_id,
                q.major_id,
                s.title AS subject_title,
                t.title AS topic_title,
                c.title AS chapter_title,
                g.title AS grade_title
            FROM questions_tam24 q
                     LEFT JOIN subjects_tam24 s ON q.subject_id = s.id
                     LEFT JOIN topics_tam24 t ON q.topic_id = t.id
                     LEFT JOIN chapters_tam24 c ON q.chapter_id = c.id
                     LEFT JOIN grades_tam24 g ON q.grade_id = g.id
                     LEFT JOIN quiz_session_questions_tam24 sq
                               ON sq.question_id = q.id AND sq.session_id = ?
            WHERE q.status = 'فعال'
          
              AND sq.question_id IS NULL
                ${whereClause}
            ORDER BY RAND()
                LIMIT 1
        `;

        const [questions] = await pool.query(sql, [sessionId, ...params]);
        const question = questions[0];

        if (!question) {
            return res.json({
                success: true,
                question: null,
                total_questions: totalQuestions,
                current_question_count: totalQuestions // If no questions are left, current = total
            });
        }

        const questionId = Number(question.id);

        let previousStatus = false;

        if (userId > 0) {
            const [prevRows] = await pool.query(
                `SELECT status
         FROM tam24_user_answers
         WHERE user_id = ? AND question_id = ?
         ORDER BY id DESC
         LIMIT 1`,
                [userId, questionId]
            );

            previousStatus = prevRows.length > 0 ? prevRows[0].status : false;
        }



        // Insert the question into the current session
        await pool.query(
            "INSERT IGNORE INTO quiz_session_questions_tam24 (session_id, question_id) VALUES (?, ?)",
            [sessionId, questionId]
        );

        // 3. Get CURRENT question count for this active session
        const [sessionRows] = await pool.query(
            "SELECT COUNT(*) AS current_count FROM quiz_session_questions_tam24 WHERE session_id = ?",
            [sessionId]
        );
        const currentQuestionCount = sessionRows[0] ? Number(sessionRows[0].current_count) : 0;

        const options = await fetchQuestionOptions(questionId);
        const images  = await fetchQuestionImages(questionId);

        // --- CALCULATE QUESTION STATS (correct, wrong, unanswered) ---
        let stats = { correct_percent: 0, wrong_percent: 0, unanswered_percent: 0 };

        if (USE_MOCK_PERCENTAGES) {
            // Generate realistic mock percentages summing to 100
            const cWeight = 30 + Math.random() * 40;
            const wWeight = 20 + Math.random() * 30;
            const uWeight = 5 + Math.random() * 15;

            const totalW = cWeight + wWeight + uWeight;
            let cPct = Math.round((cWeight / totalW) * 100);
            let wPct = Math.round((wWeight / totalW) * 100);
            let uPct = 100 - cPct - wPct;

            stats = { correct_percent: cPct, wrong_percent: wPct, unanswered_percent: uPct };
        } else {
            // Fetch real statistics from database
            const [statRows] = await pool.query(
                "SELECT status, COUNT(*) as count FROM tam24_user_answers WHERE question_id = ? GROUP BY status",
                [questionId]
            );

            let cCount = 0, wCount = 0, uCount = 0;
            statRows.forEach(row => {
                if (row.status === 'correct') cCount = Number(row.count);
                if (row.status === 'wrong') wCount = Number(row.count);
                if (row.status === 'unanswered') uCount = Number(row.count);
            });

            const totalAnswers = cCount + wCount + uCount;
            if (totalAnswers > 0) {
                let cPct = Math.round((cCount / totalAnswers) * 100);
                let wPct = Math.round((wCount / totalAnswers) * 100);
                let uPct = Math.round((uCount / totalAnswers) * 100);

                const diff = 100 - (cPct + wPct + uPct);
                if (diff !== 0) {
                    if (cPct >= wPct && cPct >= uPct) cPct += diff;
                    else if (wPct >= cPct && wPct >= uPct) wPct += diff;
                    else uPct += diff;
                }

                stats = { correct_percent: cPct, wrong_percent: wPct, unanswered_percent: uPct };
            }
        }

        res.json({
            success: true,
            total_questions: totalQuestions,               // Added for UI Counters
            current_question_count: currentQuestionCount,  // Added for UI Counters
            question: {
                id: questionId,
                text: question.question_text,
                options: options,
                has_image: images.length > 0,
                images: images,
                previous_status: previousStatus,
                grade_id: question.grade_id,
                subject_id: question.subject_id,
                topic_id: question.topic_id,
                chapter_id: question.chapter_id,
                major_id: question.major_id,

                grade: question.grade_title,
                subject: question.subject_title,
                topic: question.topic_title,
                chapter: question.chapter_title,
                academic_year: question.academic_year,
                difficulty_level: question.difficulty_level,

                stats: stats
            },
        });
    } catch (error) {
        console.error("❌ SQL Error in handleGetPracticeQuestion:", error);
        res.json({ success: false, message: "Database error fetching question" });
    }
};

const handleCheckAnswer = async (req, res) => {
    let conn;

    try {
        // ==========================================
        // TOGGLE THIS VARIABLE:
        // true  = Generate realistic fake percentages (summing exactly to 100)
        // false = Use real database statistics from actual user answers
        // ==========================================
        const USE_MOCK_PERCENTAGES = true;

        const questionId = Number(req.body.question_id) || 0;
        const optionId   = Number(req.body.option_id)   || 0;
        const userId     = Number(req.body.user_id) || (req.user && req.user.id);

        if (questionId <= 0 || optionId <= 0) {
            return res.json({ success: false, message: 'Invalid parameters' });
        }

        // Bulletproof helper to parse is_correct regardless of what type mysql2 returns
        const parseIsCorrect = (val) => {
            if (Buffer.isBuffer(val)) return val[0] === 1;
            return Number(val) === 1 || val === true || val === '1';
        };

        conn = await pool.getConnection();
        await conn.beginTransaction();

        const [optionRow] = await conn.query(
            "SELECT COALESCE(CAST(is_correct AS UNSIGNED), 0) AS is_correct FROM options_tam24 WHERE id = ? AND question_id = ? LIMIT 1",
            [optionId, questionId]
        );

        if (!optionRow || optionRow.length === 0) {
            await conn.rollback();
            return res.json({ success: false, message: 'Option not found for this question' });
        }

        const isCorrect = parseIsCorrect(optionRow[0].is_correct);

        const [correctRows] = await conn.query(
            "SELECT id FROM options_tam24 WHERE question_id = ? AND is_correct = 1 LIMIT 1",
            [questionId]
        );

        const correctOptionId = correctRows.length > 0 ? Number(correctRows[0].id) : null;

        // ==================================================
        // TROPHY / XP SYSTEM
        // ==================================================
        let rewardData = null;

        if (userId) {
            // 1) Get user trophies + xp
            const [userRows] = await conn.query(
                `SELECT id, trophies, xp_points, xp_level
                 FROM tam24_users
                 WHERE id = ?
                     LIMIT 1
     FOR UPDATE`,
                [userId]
            );


            if (userRows.length > 0) {
                const user = userRows[0];

                // 2) Get question difficulty
                const [questionRows] = await conn.query(
                    `SELECT difficulty_level
                     FROM questions_tam24
                     WHERE id = ?
                     LIMIT 1`,
                    [questionId]
                );

                const difficultyLevel = questionRows.length > 0
                    ? questionRows[0].difficulty_level
                    : 'متوسط';

                // 3) Check previous answer status for this user/question
// FOR UPDATE prevents race conditions while reward/update is being calculated
                const [prevRows] = await conn.query(
                    `SELECT status, created_at, updated_at
                     FROM tam24_user_answers
                     WHERE user_id = ? AND question_id = ?
                         LIMIT 1
     FOR UPDATE`,
                    [userId, questionId]
                );

                const previousStatus = prevRows.length > 0 ? prevRows[0].status : false;


                // 4) Calculate reward
                const core = calculateRewardCore({
                    difficulty: difficultyLevel,
                    currentStatus: isCorrect ? 'correct' : 'wrong',
                    previousStatus,
                    trophies: Number(user.trophies || 0),
                });

                let trophyDelta = core.reward;
                let xpDelta = core.xp;
                let bonus = 0;

                // Bonus only for correct answers
                if (isCorrect) {
                    const config = REWARD_LEVEL_CONFIG[normalizeDifficulty(difficultyLevel)] || REWARD_LEVEL_CONFIG['متوسط'];

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

                trophyDelta += bonus;

                // Safety: trophies cannot go below zero
                if (Number(user.trophies || 0) + trophyDelta < 0) {
                    trophyDelta = -Number(user.trophies || 0);
                }


                // 5) Save/update user's answer
                const answerStatus = isCorrect ? 'correct' : 'wrong';

                await conn.query(
                    `INSERT INTO tam24_user_answers (user_id, question_id, option_id, status)
                     VALUES (?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE
                                              option_id = VALUES(option_id),
                                              status = VALUES(status),
                                              updated_at = CURRENT_TIMESTAMP`,
                    [userId, questionId, optionId, answerStatus]
                );




                const currentXp = Number(user.xp_points || 0);
                const newTotalXp = Math.max(0, currentXp + xpDelta);


                // Professional scaling formula: easy early, harder later
                const newXpLevel = Math.floor(0.1 * Math.sqrt(newTotalXp)) + 1;
                const oldXpLevel = Number(user.xp_level ?? 1);
                const hasLeveledUp = newXpLevel > oldXpLevel;

                // 6) Update trophies + XP + XP Level
                await conn.query(
                    `UPDATE tam24_users
                     SET trophies = GREATEST(0, COALESCE(trophies, 0) + ?),
                         xp_points = ?,
                         xp_level = ?
                     WHERE id = ?`,
                    [trophyDelta, newTotalXp, newXpLevel, userId]
                );


                // 7) Add to review later if wrong
                if (!isCorrect) {
                    await conn.query(
                        `INSERT IGNORE INTO review_later_tam24 (user_id, question_id) VALUES (?, ?)`,
                        [userId, questionId]
                    );
                }

                rewardData = {
                    previous_status: previousStatus,
                    current_status: answerStatus,
                    reason: core.reason,
                    current_trophies:Number(user.trophies || 0),
                    current_xp:newTotalXp,
                    added_xp: xpDelta,
                    current_level: newXpLevel,
                    leveled_up: hasLeveledUp,
                    added_trophies: trophyDelta,
                    bonus_awarded: bonus > 0,
                    bonus_value: bonus,

                };
            }
        }

        // Always fetch options to get their text and correct status
        const [statsRows] = await conn.query(
            `SELECT
                 opt.id,
                 opt.option_text,
                 COALESCE(CAST(opt.is_correct AS UNSIGNED), 0) AS is_correct,
                 COALESCE(qst.select_count, 0) AS select_count
             FROM options_tam24 opt
                      LEFT JOIN question_option_stats_tam24 qst
                                ON opt.id = qst.option_id AND qst.question_id = ?
             WHERE opt.question_id = ?
             ORDER BY opt.id ASC`,
            [questionId, questionId]
        );

        let option_stats = [];

        if (USE_MOCK_PERCENTAGES && statsRows.length > 0) {
            const weights = statsRows.map(row => {
                const isOptionCorrect = parseIsCorrect(row.is_correct);
                return (isOptionCorrect ? 40 : 10) + Math.random() * 50;
            });

            const totalWeight = weights.reduce((sum, w) => sum + w, 0);
            const percents = weights.map(w => Math.round((w / totalWeight) * 100));

            const currentSum = percents.reduce((sum, p) => sum + p, 0);
            const diff = 100 - currentSum;
            percents[0] += diff;

            option_stats = statsRows.map((row, index) => ({
                id: Number(row.id),
                text: row.option_text,
                is_correct: parseIsCorrect(row.is_correct),
                percent: percents[index]
            }));

        } else {
            const totalSelections = statsRows.reduce((sum, row) => sum + Number(row.select_count), 0);

            option_stats = statsRows.map(row => ({
                id: Number(row.id),
                text: row.option_text,
                is_correct: parseIsCorrect(row.is_correct),
                percent: totalSelections > 0 ? Math.round((Number(row.select_count) / totalSelections) * 100) : 0
            }));
        }

        const [descRows] = await conn.query(
            "SELECT answer_text FROM descriptive_answers_tam24 WHERE question_id = ? LIMIT 1",
            [questionId]
        );

        await conn.commit();

        res.json({
            success: true,
            is_correct: isCorrect,
            correct_option_id: correctOptionId,
            descriptive_answer: descRows.length > 0 ? descRows[0].answer_text : null,
            option_stats,
            reward_data: rewardData,
        });
    } catch (error) {
        if (conn) await conn.rollback();
        console.error("❌ SQL Error in handleCheckAnswer:", error);
        res.json({ success: false, message: "Database error checking answer" });
    } finally {
        if (conn) conn.release();
    }
};


const handleFinishQuiz = async (req, res) => {
    try {
        const userId = Number(req.body.user_id) || (req.user && req.user.id);
        const practiceSeconds = Number(req.body.practice_seconds) || 0;
        const questionsAnswered = Number(req.body.questions_answered) || 0;
        const correctAnswers = Number(req.body.correct_answers) || 0;

        if (!userId) {
            return res.json({ success: false, message: 'Invalid user ID' });
        }

        await pool.query(
            `INSERT INTO tam24_user_activity
             (user_id, activity_date, practice_seconds, questions_answered, correct_answers)
             VALUES (?, CURDATE(), ?, ?, ?)`,
            [userId, practiceSeconds, questionsAnswered, correctAnswers]
        );

        res.json({ success: true, message: "Quiz activity saved successfully" });
    } catch (error) {
        console.error("❌ SQL Error in handleFinishQuiz:", error);
        res.json({ success: false, message: "Failed to save quiz activity" });
    }
};

const handleGetSpecificQuestion = async (req, res) => {
    try {
        const questionId = Number(req.body.question_id) || 0;

        if (questionId <= 0) {
            return res.json({ success: false, message: 'Invalid question ID' });
        }

        const sql = `
            SELECT
                q.id,
                q.question_text,
                q.academic_year,
                q.difficulty_level,
                q.grade_id,
                q.subject_id,
                q.topic_id,
                q.chapter_id,
                q.major_id,
                s.title AS subject_title,
                t.title AS topic_title,
                c.title AS chapter_title,
                g.title AS grade_title
            FROM questions_tam24 q
                     LEFT JOIN subjects_tam24 s ON q.subject_id = s.id
                     LEFT JOIN topics_tam24 t ON q.topic_id = t.id
                     LEFT JOIN chapters_tam24 c ON q.chapter_id = c.id
                     LEFT JOIN grades_tam24 g ON q.grade_id = g.id
            WHERE q.id = ?
        `;

        const [questions] = await pool.query(sql, [questionId]);
        const question = questions[0];

        if (!question) {
            return res.json({ success: false, message: "Question not found" });
        }

        const options = await fetchQuestionOptions(questionId);
        const images  = await fetchQuestionImages(questionId);

        res.json({
            success: true,
            previous_question_id: null, // Removed breaking query, returning null cleanly
            question: {
                id: questionId,
                text: question.question_text,
                options: options,
                has_image: images.length > 0,
                images: images,
                grade: question.grade_title,
                subject: question.subject_title,
                topic: question.topic_title,
                chapter: question.chapter_title,
                grade_id: question.grade_id,
                subject_id: question.subject_id,
                topic_id: question.topic_id,
                chapter_id: question.chapter_id,
                major_id: question.major_id,
                academic_year: question.academic_year,
                difficulty_level: question.difficulty_level,
            },
        });
    } catch (error) {
        console.error("❌ SQL Error in handleGetSpecificQuestion:", error);
        res.json({ success: false, message: "Database error fetching specific question" });
    }
};

module.exports = {
    handleGetSubjects,
    handleGetGradesBySubject,
    handleGetChaptersBySubject,
    handleGetMabahesByChapter,
    handleGetQuizTypes,
    handleStartSession,
    handleGetPracticeQuestion,
    handleCheckAnswer,
    handleGetSpecificQuestion,
    handleFinishQuiz
};
