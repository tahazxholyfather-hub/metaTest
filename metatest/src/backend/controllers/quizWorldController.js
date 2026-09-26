//quizWorldController
const pool = require('../db');
const crypto = require('crypto');
const {
    encodeQuizId,
    decodeQuizId,
    encodeShareCode,
    decodeShareCode,
    encodeResultId,
    decodeResultId
} = require('../utils/hash');
const entitlements = require('../subscription/entitlements');
const usage = require('../subscription/usage');


// ==========================================
// CONFIGURATION
// ==========================================
const MIN_QUESTIONS = 1;

// Helper to ensure we always get an array of IDs from the request
const parseArrayParam = (val) => {
    if (!val || val === 'null' || val === 'undefined' || String(val).trim() === '') {
        return [];
    }
    if (Array.isArray(val)) {
        return val.map(Number).filter(n => !isNaN(n));
    }
    if (typeof val === 'string') {
        try {
            // In case it's a JSON array string "[1, 2]"
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) return parsed.map(Number).filter(n => !isNaN(n));
        } catch (e) {
            // In case it's comma separated "1,2,3"
            return val.split(',').map(v => Number(v.trim())).filter(n => !isNaN(n));
        }
    }
    const num = Number(val);
    return isNaN(num) ? [] : [num];
};

function getDifficultyDistribution(level, total) {
    const numericLevel = Number(level);

    let ratios;
    if (numericLevel === 1) {
        // Easy quiz: 80% easy, 20% normal
        ratios = {
            'آسان': 0.8,
            'متوسط': 0.2,
            'سخت': 0
        };
    } else if (numericLevel === 2) {
        // Normal quiz: 20% easy, 70% normal, 10% hard
        ratios = {
            'آسان': 0.2,
            'متوسط': 0.7,
            'سخت': 0.1
        };
    } else if (numericLevel === 3) {
        // Hard quiz: 15% easy, 25% normal, 60% hard
        ratios = {
            'آسان': 0.15,
            'متوسط': 0.25,
            'سخت': 0.6
        };
    } else {
        // Fallback: normal
        ratios = {
            'آسان': 0.2,
            'متوسط': 0.7,
            'سخت': 0.1
        };
    }

    const levels = ['آسان', 'متوسط', 'سخت'];
    const counts = {};
    let assigned = 0;

    for (let i = 0; i < levels.length; i++) {
        const diff = levels[i];
        if (i < levels.length - 1) {
            counts[diff] = Math.floor(total * ratios[diff]);
            assigned += counts[diff];
        } else {
            counts[diff] = total - assigned;
        }
    }

    return counts;
}

function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

async function fetchQuestionIdsByDifficulty({
                                                pool,
                                                lessons,
                                                grades,
                                                targetColumn,
                                                itemId,
                                                limit,
                                                difficultySetting
                                            }) {
    const distribution = getDifficultyDistribution(difficultySetting, limit);

    const selectedIds = [];
    const selectedSet = new Set();

    const baseWhere = `
        FROM questions_tam24
        WHERE status = 'فعال'
          AND edit_status = 'done'
          AND subject_id IN (?)
          AND grade_id IN (?)
          AND ${targetColumn} = ?
    `;

    async function fetchBucket(difficultyLevel, bucketLimit) {
        if (bucketLimit <= 0) return [];

        const sql = `
            SELECT id
            ${baseWhere}
              AND difficulty_level = ?
            ORDER BY RAND()
            LIMIT ?
        `;

        const [rows] = await pool.query(sql, [
            lessons,
            grades,
            itemId,
            difficultyLevel,
            bucketLimit
        ]);

        return rows.map(row => row.id);
    }

    async function fetchFallback(excludeIds, needed) {
        if (needed <= 0) return [];

        let sql = `
            SELECT id
            ${baseWhere}
        `;

        const params = [lessons, grades, itemId];

        if (excludeIds.length > 0) {
            sql += ` AND id NOT IN (?) `;
            params.push(excludeIds);
        }

        sql += `
            ORDER BY RAND()
            LIMIT ?
        `;
        params.push(needed);

        const [rows] = await pool.query(sql, params);
        return rows.map(row => row.id);
    }

    const difficultyOrder = ['آسان', 'متوسط', 'سخت'];

    // First pass: fetch based on target distribution
    for (const difficultyLevel of difficultyOrder) {
        const bucketLimit = distribution[difficultyLevel];
        const ids = await fetchBucket(difficultyLevel, bucketLimit);

        for (const id of ids) {
            if (!selectedSet.has(id)) {
                selectedSet.add(id);
                selectedIds.push(id);
            }
        }
    }

    // Second pass: if some difficulty bucket had fewer questions than needed,
    // fill from any available difficulty in same filters
    const shortage = limit - selectedIds.length;
    if (shortage > 0) {
        const fallbackIds = await fetchFallback(selectedIds, shortage);

        for (const id of fallbackIds) {
            if (!selectedSet.has(id)) {
                selectedSet.add(id);
                selectedIds.push(id);
            }
        }
    }

    return shuffleArray(selectedIds);
}




const generateCode = async (req, res) => {
    try {
        // FIXED: Multiply by 900000 instead of 999999
        const numericCode = Math.floor(100000 + Math.random() * 900000);
        const hashedCode = encodeShareCode(numericCode);

        return res.json({
            success: true,
            data: {
                code: hashedCode,
            },
        });
    } catch (error) {
        return res.json({
            success: false,
            message: 'Error in code generation',
        });
    }
};




const handleGetSubjects = async (req, res) => {
    try {
        const sql = `
            SELECT s.id, s.title, s.icon , COUNT(q.id) AS question_count
            FROM questions_tam24 q
            JOIN subjects_tam24 s ON q.subject_id = s.id
            WHERE q.status = 'فعال' AND q.edit_status = 'done'
            GROUP BY s.id, s.title, s.icon
            HAVING COUNT(q.id) >= ?
            ORDER BY s.id ASC
        `;
        const [rows] = await pool.query(sql, [MIN_QUESTIONS]);
        res.json({ success: true, subjects: rows });
    } catch (error) {
        console.error("❌ SQL Error in handleGetSubjects:", error);
        res.json({ success: false, message: "Database error fetching subjects" });
    }
};

const handleGetGradesBySubjects = async (req, res) => {
    try {
        const subjectIds = parseArrayParam(req.body.subject_ids || req.body.subjects);
        if (subjectIds.length === 0) {
            return res.json({ success: false, message: "Missing or invalid parameter: subject_ids array" });
        }

        const sql = `
            SELECT g.id, g.title, COUNT(q.id) AS question_count
            FROM questions_tam24 q
            INNER JOIN grades_tam24 g ON q.grade_id = g.id
            WHERE q.subject_id IN (?)
               AND q.status = 'فعال'
               AND q.edit_status = 'done'
               AND q.grade_id IS NOT NULL
            GROUP BY g.id, g.title
            HAVING COUNT(q.id) >= ?
            ORDER BY g.id ASC
        `;
        const [rows] = await pool.query(sql, [subjectIds, MIN_QUESTIONS]);
        res.json({ success: true, grades: rows });
    } catch (error) {
        console.error("❌ SQL Error in handleGetGradesBySubjects:", error);
        res.json({ success: false, message: "Database error fetching grades" });
    }
};

const handleGetChaptersBySubjects = async (req, res) => {
    try {
        const subjectIds = parseArrayParam(req.body.subject_ids || req.body.subjects);
        if (subjectIds.length === 0) {
            return res.json({ success: false, message: "Missing or invalid parameter: subject_ids array" });
        }

        const gradeIds = parseArrayParam(req.body.grade_ids || req.body.grades);

        // Explicitly selecting q.grade_id so the frontend can associate chapters with their respective grades
        let sql = `
            SELECT t.id, t.title, COUNT(q.id) AS question_count, q.subject_id, q.grade_id
            FROM questions_tam24 q
            JOIN topics_tam24 t ON q.topic_id = t.id
            WHERE q.subject_id IN (?)
               AND q.status = 'فعال'
               AND q.edit_status = 'done'
        `;
        const params = [subjectIds];
        if (gradeIds.length > 0) {
            sql += " AND q.grade_id IN (?)";
            params.push(gradeIds);
        }

        sql += `
            GROUP BY t.id, t.title, q.subject_id, q.grade_id
            HAVING COUNT(q.id) >= ? 
            ORDER BY q.subject_id ASC, t.id ASC
        `;
        params.push(MIN_QUESTIONS);
        const [rows] = await pool.query(sql, params);
        res.json({ success: true, chapters: rows });
    } catch (error) {
        console.error("❌ SQL Error in handleGetChaptersBySubjects:", error);
        res.json({ success: false, message: "Database error fetching chapters" });
    }
};

const handleGetMabahesByChapters = async (req, res) => {
    try {
        const topicIds = parseArrayParam(req.body.topic_ids || req.body.chapters);
        if (topicIds.length === 0) {
            return res.json({ success: false, message: "Missing or invalid parameter: topic_ids array" });
        }

        // Added q.grade_id and q.subject_id directly to the selection to enable direct filtering
        const sql = `
            SELECT c.id, c.title, COUNT(q.id) AS question_count, q.topic_id AS chapter_id, q.grade_id, q.subject_id
            FROM questions_tam24 q
            JOIN chapters_tam24 c ON q.chapter_id = c.id
            WHERE q.topic_id IN (?)
               AND q.status = 'فعال'
               AND q.edit_status = 'done'
            GROUP BY c.id, c.title, q.topic_id, q.grade_id, q.subject_id
            HAVING COUNT(q.id) >= ?
            ORDER BY q.topic_id ASC, c.id ASC
        `;
        const [rows] = await pool.query(sql, [topicIds, MIN_QUESTIONS]);
        res.json({ success: true, mabahes: rows });
    } catch (error) {
        console.error("❌ SQL Error in handleGetMabahesByChapters:", error);
        res.json({ success: false, message: "Database error fetching mabahes" });
    }
};

const buildQuestionFiltersMultiple = (body) => {
    const filters = [];
    const params = [];

    const mapping = {
        grade_ids:        'q.grade_id',
        subject_ids:      'q.subject_id',
        topic_ids:        'q.topic_id',
        chapter_ids:      'q.chapter_id',
    };

    // Array logic
    for (const [postKey, column] of Object.entries(mapping)) {
        const arr = parseArrayParam(body[postKey] || body[postKey.replace('_ids', 's')]);
        if (arr.length > 0) {
            filters.push(`${column} IN (?)`);
            params.push(arr);
        }
    }

    // Single value logic for others like academic_year, difficulty_level
    const singleMapping = {
        academic_year:   'q.academic_year',
        difficulty_level:'q.difficulty_level',
    };

    for (const [postKey, column] of Object.entries(singleMapping)) {
        const value = body[postKey];
        if (value !== undefined && value !== null && value !== 'null' && value !== 'undefined' && String(value).trim() !== '') {
            filters.push(`${column} = ?`);
            params.push(value);
        }
    }

    return { filters, params };
};

const generateShareCode = () => {
    return crypto.randomBytes(3).toString('hex').toUpperCase(); // e.g., 'A1B2C3'
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

const handleCreateQuiz = async (req, res) => {
    const creatorId = req.user?.id || 1;
    let examClaim = null;

    const {
        quizType, // 'chapter' or 'mabhas'
        settings,
        lessonNames,
        gradeNames,
        chapterNames,
        mabhasNames
    } = req.body;

    const lessons = parseArrayParam(req.body.lessons);
    const grades = parseArrayParam(req.body.grades);
    const chapters = parseArrayParam(req.body.chapters);
    const mabhas = parseArrayParam(req.body.mabhas);
    const shareCode = decodeShareCode(req.body.shareCode);

    if (!quizType || !settings || !settings.questionCounts) {
        return res.json({ success: false, message: "اطلاعات ارسالی ناقص است." });
    }

    let allSelectedQuestionIds = [];
    const questionCounts = settings.questionCounts;
    const targetItems = quizType === 'chapter' ? chapters : mabhas;
    const targetColumn = quizType === 'chapter' ? 'topic_id' : 'chapter_id';

    if (lessons.length === 0 || grades.length === 0) {
        return res.json({ success: false, message: "پایه یا درس انتخاب نشده است." });
    }

    try {
        for (const itemId of targetItems) {
            const limit = parseInt(questionCounts[itemId]) || 0;
            if (limit <= 0) continue;

            const fetchedIds = await fetchQuestionIdsByDifficulty({
                pool,
                lessons,
                grades,
                targetColumn,
                itemId,
                limit,
                difficultySetting: settings.difficulty
            });

            allSelectedQuestionIds.push(...fetchedIds);
        }

        if (allSelectedQuestionIds.length === 0) {
            return res.json({ success: false, message: "هیچ سوالی با این مشخصات یافت نشد." });
        }

        allSelectedQuestionIds = allSelectedQuestionIds.sort(() => Math.random() - 0.5);

        const title =
            settings.quizName && settings.quizName.trim() !== ''
                ? settings.quizName
                : 'آزمون سفارشی';

        const enrichedSettings = {
            ...settings,
            selectionNames: {
                lessonNames: lessonNames || {},
                gradeNames: gradeNames || {},
                chapterNames: chapterNames || {},
                mabhasNames: mabhasNames || {}
            }
        };

        /**
         * If quiz is private, it should start immediately.
         * Public quizzes can stay pending/waiting until lobby starts.
         */
        const quizStatus = settings.visibility === 'private'
            ? 'in_progress'
            : 'waiting';

        examClaim = await entitlements.prepareExamCreate(creatorId, settings.visibility);
        if (!examClaim.ok) {
            return res.json({
                success: false,
                code: examClaim.code,
                message: examClaim.message,
                nextAllowedAt: examClaim.nextAllowedAt || null,
            });
        }

        const insertQuizSql = `
            INSERT INTO quizzes 
            (
                share_code,
                creator_id,
                title,
                quiz_type,
                difficulty,
                time_limit,
                visibility,
                member_limit,
                status,
                question_ids,
                settings
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [quizResult] = await pool.query(insertQuizSql, [
            shareCode,
            creatorId,
            title,
            quizType,
            settings.difficulty,
            settings.time,
            settings.visibility,
            settings.memberLimit,
            quizStatus,
            JSON.stringify(allSelectedQuestionIds),
            JSON.stringify(enrichedSettings)
        ]);

        const newQuizId = quizResult.insertId;

        if (examClaim?.usageId) {
            await usage.bindResource(examClaim.usageId, newQuizId);
            examClaim = null;
        }


        return res.json({
            success: true,
            quiz: {
                id: encodeQuizId(newQuizId),
                shareCode: encodeShareCode(shareCode),
                title: title,
                totalQuestions: allSelectedQuestionIds.length,
                timeLimit: settings.time,
                visibility: settings.visibility,
                status: quizStatus
            }
        });

    } catch (error) {
        if (examClaim?.usageId) await usage.releaseUsage(examClaim.usageId);
        console.error("❌ SQL Error in handleCreateQuiz:", error);
        return res.json({ success: false, message: "خطا در ساخت آزمون در پایگاه داده" });
    }
};


const handleAddQuizMember = async (req, res) => {
    /**
     * quizId can come from params.
     * Example:
     * POST /internal/quizzes/:quizId/members
     */
    const incomingQuizId = req.params.quizId || req.body.quizId;

    const {
        userId,
        role
    } = req.body;

    if (!incomingQuizId || !userId || !role) {
        return res.status(400).json({
            success: false,
            message: "اطلاعات ارسالی ناقص است."
        });
    }

    if (!['creator', 'member'].includes(role)) {
        return res.status(400).json({
            success: false,
            message: "نقش کاربر معتبر نیست."
        });
    }

    /**
     * If quiz id comes encoded/hash from socket service,
     * decode it before inserting into DB.
     *
     * If your internal endpoint receives raw numeric id,
     * you can replace this with:
     *
     * const quizId = Number(incomingQuizId);
     */
    let quizId;

    try {
        quizId = decodeQuizId(incomingQuizId);
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: "شناسه آزمون معتبر نیست."
        });
    }

    if (!quizId || Number.isNaN(Number(quizId))) {
        return res.status(400).json({
            success: false,
            message: "شناسه آزمون معتبر نیست."
        });
    }

    if (role === 'member' && await entitlements.multiplayerBlocked(userId)) {
        const conn = await pool.getConnection();
        try {
            const [rows] = await conn.query(
                `SELECT visibility FROM quizzes WHERE id = ? LIMIT 1`,
                [quizId]
            );
            if (rows[0]?.visibility === 'public') {
                return res.status(403).json({
                    success: false,
                    code: 'MULTIPLAYER_LOCKED',
                    message: 'ورود به آزمون آنلاین با اشتراک ویژه ممکن است.',
                });
            }
        } finally {
            conn.release();
        }
    }

    try {
        /**
         * Optional: make sure quiz exists.
         */
        const [quizRows] = await pool.query(
            `
            SELECT id, creator_id
            FROM quizzes
            WHERE id = ?
            LIMIT 1
            `,
            [quizId]
        );

        if (quizRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "آزمون یافت نشد."
            });
        }

        const quiz = quizRows[0];

        /**
         * If requested role is member but this user is actually the quiz creator,
         * treat them as creator.
         */
        const finalRole =
            Number(quiz.creator_id) === Number(userId)
                ? 'creator'
                : role;

        /**
         * Insert member if not exists.
         *
         * Important:
         * - If the row already exists as creator, keep creator.
         * - If the row already exists as member and now role is creator, upgrade to creator.
         * - If the row already exists as creator and now role is member, do not downgrade.
         */
        const insertMemberSql = `
            INSERT INTO quiz_members
            (
                quiz_id,
                user_id,
                role
            )
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE
                role = CASE
                    WHEN role = 'creator' THEN 'creator'
                    WHEN VALUES(role) = 'creator' THEN 'creator'
                    ELSE role
                END
        `;

        await pool.query(insertMemberSql, [
            quizId,
            userId,
            finalRole
        ]);

        return res.json({
            success: true,
            data: {
                quizId,
                userId,
                role: finalRole
            }
        });

    } catch (error) {
        console.error("❌ SQL Error in handleAddQuizMember:", error);

        return res.status(500).json({
            success: false,
            message: "خطا در ثبت عضو آزمون در پایگاه داده"
        });
    }
};



const handleCheckUserMember = async (req, res) => {
    try {
        const { userId, quizId } = req.body;

        if (!userId || !quizId) {
            return res.status(400).json({
                success: false,
                message: "userId and quizId are required",
                isMember: false,
            });
        }

        let decodedQuizId;

        try {
            decodedQuizId = decodeQuizId(quizId);
        } catch (decodeError) {
            return res.status(400).json({
                success: false,
                message: "Invalid quizId",
                isMember: false,
            });
        }

        const [rows] = await pool.execute(
            `
            SELECT id
            FROM quiz_members
            WHERE user_id = ?
              AND quiz_id = ?
            LIMIT 1
            `,
            [userId, decodedQuizId]
        );

        return res.status(200).json({
            success: true,
            isMember: rows.length > 0,
        });
    } catch (error) {
        console.error("handleCheckUserMember error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            isMember: false,
        });
    }
};



const handleGetQuizByShareCode = async (req, res) => {
    try {
        const { shareCode } = req.body;

        if (!shareCode) {
            return res.json({ success: false, message: "کد اشتراک‌گذاری ارسال نشده است" });
        }

        const decodedShareCode = decodeShareCode(shareCode);

        if (!decodedShareCode) {
            return res.json({ success: false, message: "کد اشتراک‌گذاری نامعتبر است" });
        }

        const sql = `
            SELECT id, share_code, title, quiz_type, difficulty, time_limit, visibility, member_limit, settings
            FROM quizzes
            WHERE share_code = ?
            LIMIT 1
        `;

        const [rows] = await pool.query(sql, [decodedShareCode]);

        if (rows.length === 0) {
            return res.json({ success: false, message: "آزمون یافت نشد یا کد نامعتبر است" });
        }

        const quiz = rows[0];

        let parsedSettings = {};
        if (quiz.settings) {
            parsedSettings = typeof quiz.settings === 'string' ? JSON.parse(quiz.settings) : quiz.settings;
        }

        const selectionNames = parsedSettings.selectionNames || {};
        const seenIds = new Set();

        const formatSelections = (namesObj = {}) => {
            const result = [];
            for (const [id, title] of Object.entries(namesObj)) {
                if (!seenIds.has(id)) {
                    seenIds.add(id);
                    result.push({
                        id: Number(id) || id,
                        title: title
                    });
                }
            }
            return result;
        };

        return res.json({
            success: true,
            id: encodeQuizId(quiz.id),
            shareCode: encodeShareCode(quiz.share_code),
            quizName: quiz.title,
            quizType: quiz.quiz_type,
            settings: parsedSettings,
            lessons: formatSelections(selectionNames.lessonNames),
            grades: formatSelections(selectionNames.gradeNames),
            chapters: formatSelections(selectionNames.chapterNames),
            mabhas: formatSelections(selectionNames.mabhasNames)
        });

    } catch (error) {
        console.error("❌ SQL Error in handleGetQuizByShareCode:", error);
        return res.json({ success: false, message: "خطا در دریافت اطلاعات اتاق انتظار" });
    }
};




const handleGetQuizMetadata = async (req, res) => {
    try {
        const quizId = decodeQuizId(req.params.quizId);

        if (!quizId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_QUIZ_ID',
                    message: 'Invalid quiz id'
                }
            });
        }

        const sql = `
            SELECT
                id,
                share_code,
                creator_id,
                title,
                quiz_type,
                difficulty,
                time_limit,
                visibility,
                member_limit,
                question_ids,
                settings
            FROM quizzes
            WHERE id = ?
                LIMIT 1
        `;

        const [rows] = await pool.query(sql, [quizId]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'QUIZ_NOT_FOUND',
                    message: 'Quiz not found'
                }
            });
        }

        const quiz = rows[0];

        let questionIds = [];
        if (quiz.question_ids) {
            try {
                questionIds =
                    typeof quiz.question_ids === 'string'
                        ? JSON.parse(quiz.question_ids)
                        : quiz.question_ids;

                if (!Array.isArray(questionIds)) {
                    questionIds = [];
                }
            } catch (e) {
                questionIds = [];
            }
        }

        let parsedSettings = {};
        if (quiz.settings) {
            try {
                parsedSettings =
                    typeof quiz.settings === 'string'
                        ? JSON.parse(quiz.settings)
                        : quiz.settings;
            } catch (e) {
                parsedSettings = {};
            }
        }

        const timeLimitRaw = quiz.time_limit ?? parsedSettings.time ?? null;
        const timeLimitNumber = Number(timeLimitRaw);

        const durationSeconds =
            Number.isFinite(timeLimitNumber) && timeLimitNumber > 0
                ? timeLimitNumber
                : null;

        const metadata = {
            id: encodeQuizId(quiz.id),
            quizId: encodeQuizId(quiz.id),
            shareCode: encodeShareCode(quiz.share_code),
            title: quiz.title,
            ownerId: quiz.creator_id,
            creatorId: quiz.creator_id,
            quizType: quiz.quiz_type,
            difficulty: quiz.difficulty,
            visibility: quiz.visibility,
            memberLimit: quiz.member_limit,
            questionCount: questionIds.length,
            totalQuestions: questionIds.length,
            durationSeconds,
            timeLimit: quiz.time_limit,
            playable: questionIds.length > 0
        };

        return res.json({
            success: true,
            data: metadata
        });
    } catch (error) {
        console.error('❌ SQL Error in handleGetQuizMetadata:', error);

        return res.status(500).json({
            success: false,
            error: {
                code: 'QUIZ_METADATA_FAILED',
                message: 'Failed to fetch quiz metadata'
            }
        });
    }
};


const handleGetQuizPreviewState = async (req, res) => {
    try {
        const quizId = req.body.quizId;

        if (!quizId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_QUIZ_ID',
                    message: 'شناسه آزمون نامعتبر است'
                }
            });
        }
        const unhashedQuizId = decodeQuizId(quizId);

        // کوئری سبک: فقط فیلدهای ضروری برای منطق QuizPage دریافت می‌شوند
        const sql = `
            SELECT
                share_code,
                creator_id,
                status,
                time_limit,
                visibility
            FROM quizzes
            WHERE id = ?
            LIMIT 1
        `;

        const [rows] = await pool.query(sql, [unhashedQuizId]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'QUIZ_NOT_FOUND',
                    message: 'آزمون یافت نشد'
                }
            });
        }

        const quiz = rows[0];

        // شیء خروجی شامل دقیقاً همان کلیدهایی است که فرانت‌اند نیاز دارد
        const previewState = {
            code: encodeShareCode(quiz.share_code),
            creator_id: quiz.creator_id,
            status: quiz.status,
            visibility: quiz.visibility,
            time_limit: quiz.time_limit
        };

        return res.json({
            success: true,
            data: previewState
        });

    } catch (error) {
        console.error('❌ Error in handleGetQuizPreviewState:', error);

        return res.status(500).json({
            success: false,
            error: {
                code: 'PREVIEW_STATE_FAILED',
                message: 'خطا در دریافت وضعیت آزمون'
            }
        });
    }
};


const handleGetQuizQuestions = async (req, res) => {
    let connection;

    try {
        const { quizId } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'کاربر احراز هویت نشده است'
            });
        }

        if (!quizId || typeof quizId !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'شناسه آزمون نامعتبر است'
            });
        }

        const decodedQuizId = decodeQuizId(quizId);

        if (!Number.isInteger(decodedQuizId) || decodedQuizId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'شناسه آزمون نامعتبر است'
            });
        }

        connection = await pool.getConnection();

        /**
         * First check if this user already has a result for this quiz.
         * If yes, return resultId instead of questions.
         */
        const existingResult = await getExistingQuizResult(
            connection,
            decodedQuizId,
            userId
        );

        if (existingResult) {
            return res.status(200).json({
                success: true,
                resultId: encodeResultId(existingResult.id)
            });
        }

        await connection.beginTransaction();

        // 1. دریافت اطلاعات آزمون
        const [quizRows] = await connection.query(
            `SELECT id, question_ids, status
             FROM quizzes
             WHERE id = ?
             LIMIT 1`,
            [decodedQuizId]
        );

        if (quizRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'آزمون یافت نشد'
            });
        }

        const quiz = quizRows[0];

        let questionIds = [];

        try {
            questionIds =
                typeof quiz.question_ids === 'string'
                    ? JSON.parse(quiz.question_ids)
                    : quiz.question_ids;
        } catch (e) {
            questionIds = [];
        }

        // 2. آپدیت وضعیت آزمون
        await connection.query(
            `UPDATE quizzes
             SET status = 'in_progress'
             WHERE id = ? AND (status IS NULL OR status <> 'in_progress')`,
            [decodedQuizId]
        );

        await connection.commit();

        if (!Array.isArray(questionIds) || questionIds.length === 0) {
            return res.json({
                success: true,
                questions: []
            });
        }

        // 3. دریافت سوالات
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
            WHERE q.id IN (?)
            ORDER BY FIELD(q.id, ${questionIds.join(',')})
        `;

        const [questions] = await pool.query(sql, [questionIds]);

        // 4. ساخت خروجی نهایی
        const formattedQuestions = await Promise.all(
            questions.map(async (q) => {
                const rawOptions = await fetchQuestionOptions(q.id);
                const images = await fetchQuestionImages(q.id);

                const options = rawOptions.map((opt) => ({
                    id: opt.id,
                    text: opt.text || opt.option_text
                }));

                return {
                    id: q.id,
                    text: q.question_text,
                    options,
                    has_image: images.length > 0,
                    images,
                    grade: q.grade_title,
                    subject: q.subject_title,
                    topic: q.topic_title,
                    chapter: q.chapter_title,
                    grade_id: q.grade_id,
                    subject_id: q.subject_id,
                    topic_id: q.topic_id,
                    chapter_id: q.chapter_id,
                    major_id: q.major_id,
                    academic_year: q.academic_year,
                    difficulty_level: q.difficulty_level
                };
            })
        );

        return res.json({
            success: true,
            questions: formattedQuestions
        });

    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (_) {}
        }

        console.error('❌ SQL Error in handleGetQuizQuestions:', error);

        return res.status(500).json({
            success: false,
            message: 'Database error fetching quiz questions'
        });
    } finally {
        if (connection) connection.release();
    }
};


async function handleSubmitQuizAnswers(req, res) {
    const userId = req.user?.id;

    const {
        quizId,
        answers,
        questionIds: submittedQuestionIds,
        timeSpent,
        questionTimes,
        selectionLog
    } = req.body || {};

    const isPlainObject = (value) =>
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value);

    const toPositiveInt = (value) => {
        const num = Number(value);
        return Number.isInteger(num) && num > 0 ? num : null;
    };

    const toNonNegativeInt = (value) => {
        const num = Number(value);
        return Number.isFinite(num) && num >= 0 ? Math.floor(num) : null;
    };

    if (!userId || !quizId || typeof quizId !== "string" || !isPlainObject(answers)) {
        return res.status(400).json({
            success: false,
            error: "Invalid payload. Need authenticated user, quizId, and answers object."
        });
    }

    if (submittedQuestionIds !== undefined && !Array.isArray(submittedQuestionIds)) {
        return res.status(400).json({
            success: false,
            error: "Invalid questionIds."
        });
    }

    if (timeSpent !== undefined && toNonNegativeInt(timeSpent) === null) {
        return res.status(400).json({
            success: false,
            error: "Invalid timeSpent."
        });
    }

    if (questionTimes !== undefined && !isPlainObject(questionTimes)) {
        return res.status(400).json({
            success: false,
            error: "Invalid questionTimes."
        });
    }

    if (selectionLog !== undefined && !Array.isArray(selectionLog)) {
        return res.status(400).json({
            success: false,
            error: "Invalid selectionLog."
        });
    }

    const decodedQuizId = decodeQuizId(quizId);

    if (!Number.isInteger(decodedQuizId) || decodedQuizId <= 0) {
        return res.status(400).json({
            success: false,
            error: "Invalid quizId."
        });
    }

    const sanitizedAnswers = {};
    for (const [questionIdRaw, optionIdRaw] of Object.entries(answers)) {
        const questionId = toPositiveInt(questionIdRaw);
        const optionId = toPositiveInt(optionIdRaw);

        if (questionId && optionId) {
            sanitizedAnswers[String(questionId)] = optionId;
        }
    }

    const sanitizedSubmittedQuestionIds = Array.isArray(submittedQuestionIds)
        ? submittedQuestionIds
            .map((id) => toPositiveInt(id))
            .filter((id) => id !== null)
        : [];

    const sanitizedQuestionTimes = {};
    if (isPlainObject(questionTimes)) {
        for (const [questionIdRaw, timeRaw] of Object.entries(questionTimes)) {
            const questionId = toPositiveInt(questionIdRaw);
            const timeValue = toNonNegativeInt(timeRaw);

            if (questionId && timeValue !== null) {
                sanitizedQuestionTimes[String(questionId)] = timeValue;
            }
        }
    }

    const sanitizedSelectionLog = Array.isArray(selectionLog)
        ? selectionLog
            .filter((entry) => isPlainObject(entry))
            .map((entry) => {
                const questionId = toPositiveInt(entry.questionId);
                const optionId = toPositiveInt(entry.optionId);
                const timeSpentMs = toNonNegativeInt(entry.timeSpentMs);
                const timestamp = toNonNegativeInt(entry.timestamp);

                if (!questionId || !optionId || timeSpentMs === null || timestamp === null) {
                    return null;
                }

                return {
                    questionId,
                    optionId,
                    timeSpentMs,
                    timestamp
                };
            })
            .filter(Boolean)
        : [];

    const sanitizedTotalTimeSpent = toNonNegativeInt(timeSpent) ?? 0;

    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const quiz = await getQuizById(connection, decodedQuizId);

        if (!quiz) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                error: "Quiz not found."
            });
        }

        const questionIds = parseQuestionIds(quiz.question_ids);

        if (questionIds.length === 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                error: "Quiz has no valid questions."
            });
        }

        const validQuestionIdSet = new Set(questionIds);

        const filteredAnswers = {};
        for (const [questionIdStr, optionId] of Object.entries(sanitizedAnswers)) {
            const questionId = Number(questionIdStr);
            if (validQuestionIdSet.has(questionId)) {
                filteredAnswers[questionIdStr] = optionId;
            }
        }

        const filteredSubmittedQuestionIds = sanitizedSubmittedQuestionIds.filter((id) =>
            validQuestionIdSet.has(id)
        );

        const filteredQuestionTimes = {};
        for (const [questionIdStr, timeValue] of Object.entries(sanitizedQuestionTimes)) {
            const questionId = Number(questionIdStr);
            if (validQuestionIdSet.has(questionId)) {
                filteredQuestionTimes[questionIdStr] = timeValue;
            }
        }

        const filteredSelectionLog = sanitizedSelectionLog.filter((entry) =>
            validQuestionIdSet.has(entry.questionId)
        );

        const existingResult = await getExistingQuizResult(
            connection,
            decodedQuizId,
            userId
        );

        if (existingResult) {
            await connection.rollback();

            return res.status(200).json({
                success: true,
                resultId: encodeResultId(existingResult.id)
            });
        }

        const user = await getUserXpInfo(connection, userId);

        if (!user) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                error: "User not found."
            });
        }

        const metadata = await getQuizEvaluationMetadata(
            connection,
            questionIds,
            userId
        );

        const evaluation = evaluateQuizSubmission({
            questionIds,
            submittedAnswers: filteredAnswers,
            correctOptionsMap: metadata.correctOptionsMap,
            descriptiveMap: metadata.descriptiveMap,
            questionMetaMap: metadata.questionMetaMap
        });

        const enrichedEvaluation = {};

        if (evaluation.resultData && typeof evaluation.resultData === "object") {
            for (const questionId of questionIds) {
                const key = String(questionId);
                const item = evaluation.resultData[key];

                if (!item || typeof item !== "object") {
                    continue;
                }

                enrichedEvaluation[key] = {
                    ...item,
                    selected_option_id: filteredAnswers[key] ?? null,
                    is_answered: Object.prototype.hasOwnProperty.call(filteredAnswers, key)
                };
            }
        }

        const answerMutations = buildUserAnswerMutations({
            userId,
            questionIds,
            resultData: evaluation.resultData,
            existingAnswersMap: metadata.existingAnswersMap
        });

        const xpResult = applyXpProgression({
            currentXpPoints: Number(user.xp_points || 0),
            currentXpLevel: Number(user.xp_level || 1),
            gainedXp: evaluation.totalXpGain
        });

        const resultDataToStore = {
            evaluation: enrichedEvaluation,
            submission: {
                submittedAnswers: filteredAnswers,
                submittedQuestionIds: filteredSubmittedQuestionIds,
                totalTimeSpent: sanitizedTotalTimeSpent,
                questionTimes: filteredQuestionTimes,
                selectionLog: filteredSelectionLog
            }
        };

        const numericResultId = await insertQuizResult(connection, {
            quizId: decodedQuizId,
            userId,
            correctCount: evaluation.summary.correct_count,
            incorrectCount: evaluation.summary.incorrect_count,
            unansweredCount: evaluation.summary.unanswered_count,
            accuracyRate: evaluation.summary.accuracy_rate,
            score: evaluation.summary.score,
            totalTimeSpent: sanitizedTotalTimeSpent,
            summary: evaluation.summary,
            resultData: resultDataToStore
        });

        await persistUserAnswerMutations(connection, answerMutations);

        await updateUserXp(connection, {
            userId,
            xpPoints: xpResult.updatedXpPoints,
            xpLevel: xpResult.updatedXpLevel
        });

        await connection.commit();

        return res.status(200).json({
            success: true,
            resultId: encodeResultId(numericResultId)
        });
    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (_) {}
        }

        console.error("Error in handleSubmitQuizAnswers:", error);

        if (error && (error.code === "ER_DUP_ENTRY" || error.errno === 1062)) {
            let fallbackConnection;

            try {
                fallbackConnection = await pool.getConnection();

                const existingResult = await getExistingQuizResult(
                    fallbackConnection,
                    decodedQuizId,
                    userId
                );

                if (existingResult) {
                    return res.status(200).json({
                        success: true,
                        resultId: encodeResultId(existingResult.id)
                    });
                }
            } catch (fallbackError) {
                console.error("Fallback duplicate-result fetch failed:", fallbackError);
            } finally {
                if (fallbackConnection) {
                    fallbackConnection.release();
                }
            }
        }

        return res.status(500).json({
            success: false,
            error: "Internal server error."
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
}


async function getQuizById(connection, quizId) {
    const [rows] = await connection.query(`
        SELECT id, question_ids, status
        FROM quizzes
        WHERE id = ?
        LIMIT 1
    `, [quizId]);

    return rows.length ? rows[0] : null;
}

async function isQuizPublic(connection, quizId) {
    const [rows] = await connection.query(`
        SELECT visibility
        FROM quizzes
        WHERE id = ?
        LIMIT 1
    `, [quizId]);

    return rows.length > 0 && rows[0].visibility === 'public';
}


function parseQuestionIds(rawQuestionIds) {
    let parsed = rawQuestionIds;

    try {
        if (typeof rawQuestionIds === "string") {
            parsed = JSON.parse(rawQuestionIds);
        }
    } catch (error) {
        return [];
    }

    if (!Array.isArray(parsed)) {
        return [];
    }

    return [...new Set(
        parsed
            .map(Number)
            .filter(id => Number.isInteger(id) && id > 0)
    )];
}

async function getExistingQuizResult(connection, quizId, userId) {
    const [rows] = await connection.query(`
        SELECT 
            id,
            quiz_id,
            user_id,
            correct_count,
            incorrect_count,
            unanswered_count,
            accuracy_rate,
            total_score,
            summary_json,
            result_data_json
        FROM quiz_results
        WHERE quiz_id = ? AND user_id = ?
        LIMIT 1
    `, [quizId, userId]);

    return rows.length ? rows[0] : null;
}

async function getUserXpInfo(connection, userId) {
    const [rows] = await connection.query(`
        SELECT id, xp_points, xp_level
        FROM tam24_users
        WHERE id = ?
        LIMIT 1
    `, [userId]);

    return rows.length ? rows[0] : null;
}


function generateScoreExplanation(evalResult) {
    const {
        finalScore,
        totalCorrect,
        totalWrong,
        totalUnanswered,
        weightedScore,
        weightedNegative,
        totalWeight
    } = evalResult;

    // 1. Determine the tone/prefix based on the score range
    let rangeNote = "";
    if (finalScore >= 90) {
        rangeNote = "عملکرد فوق‌العاده‌ای داشتید!";
    } else if (finalScore >= 70) {
        rangeNote = "خسته نباشید! شما تسلط خوبی بر مباحث دارید.";
    } else if (finalScore >= 50) {
        rangeNote = "شما قبول شدید، اما هنوز جای پیشرفت وجود دارد.";
    } else if (finalScore > 0) {
        rangeNote = "به تمرین ادامه دهید. برای بهبود نمره، پاسخ‌های اشتباه خود را مرور کنید.";
    } else {
        rangeNote = "متاسفانه به دلیل نمره منفی یا سوالات بی‌پاسخ، نمره شما صفر شد.";
    }

    // 2. Build the exact mathematical explanation in Persian
    const mathExplanation = `شما به ${totalCorrect} سوال پاسخ صحیح و به ${totalWrong} سوال پاسخ غلط دادید و ${totalUnanswered} سوال را بی‌پاسخ گذاشتید. ` +
        `بابت پاسخ‌های صحیح ${weightedScore.toFixed(2)} امتیاز کسب کردید. ` +
        `با توجه به اینکه هر پاسخ غلط دارای $1/3$ نمره منفی است، ${weightedNegative.toFixed(2)} امتیاز از شما کسر شد. ` +
        `نمره خام شما از مجموع حداکثر ${totalWeight} امتیاز ممکن محاسبه گردید که در نهایت نمره تراز شده ${finalScore} از $100$ برای شما منظور شد.`;

    // 3. Combine into a final paragraph
    return `${rangeNote} ${mathExplanation}`;
}





async function getQuizEvaluationMetadata(connection, questionIds, userId) {
    const placeholders = questionIds.map(() => "?").join(",");

    const [optionsRows] = await connection.query(`
        SELECT question_id, id AS correct_option_id
        FROM options_tam24
        WHERE question_id IN (${placeholders}) AND is_correct = 1
    `, questionIds);

    const [descriptiveRows] = await connection.query(`
        SELECT question_id, answer_text
        FROM descriptive_answers_tam24
        WHERE question_id IN (${placeholders})
    `, questionIds);

    const [questionsRows] = await connection.query(`
        SELECT 
            q.id AS question_id,
            q.difficulty_level AS level,
            q.topic_id,
            t.title AS topic_title
        FROM questions_tam24 q
        LEFT JOIN topics_tam24 t ON q.topic_id = t.id
        WHERE q.id IN (${placeholders})
    `, questionIds);

    const [existingAnswersRows] = await connection.query(`
        SELECT question_id, status
        FROM tam24_user_answers
        WHERE user_id = ? AND question_id IN (${placeholders})
    `, [userId, ...questionIds]);

    const correctOptionsMap = {};
    for (const row of optionsRows) {
        correctOptionsMap[row.question_id] = row.correct_option_id;
    }

    const descriptiveMap = {};
    for (const row of descriptiveRows) {
        descriptiveMap[row.question_id] = row.answer_text;
    }

    const questionMetaMap = {};
    for (const row of questionsRows) {
        questionMetaMap[row.question_id] = {
            level: row.level || "متوسط",
            topic_id: row.topic_id || null,
            topic_title: row.topic_title || "نامشخص"
        };
    }

    const existingAnswersMap = {};
    for (const row of existingAnswersRows) {
        existingAnswersMap[row.question_id] = row.status;
    }

    return {
        correctOptionsMap,
        descriptiveMap,
        questionMetaMap,
        existingAnswersMap
    };
}

function getQuestionWeight(level) {
    if (level === "آسان" || level === "easy") return 1;
    if (level === "سخت" || level === "hard") return 3;
    return 2;
}

function getXpForQuestionStatus(status, weight) {
    if (status === "correct") {
        if (weight === 1) return 8;
        if (weight === 3) return 18;
        return 12;
    }

    if (status === "wrong") {
        return 1;
    }

    return 2;
}

function calculateCompetitiveScore({
                                       weightedPositive,
                                       weightedNegative,
                                       weightedMaxPossible
                                   }) {
    if (!weightedMaxPossible || weightedMaxPossible <= 0) {
        return 0;
    }

    const rawScore = ((weightedPositive - weightedNegative) / weightedMaxPossible) * 100;
    const rounded = Math.round(rawScore);

    if (rounded < 0) return 0;
    if (rounded > 100) return 100;
    return rounded;
}

function calculateAccuracyRate({
                                   correctCount,
                                   totalQuestions
                               }) {
    if (!totalQuestions || totalQuestions <= 0) {
        return 0;
    }

    const rawAccuracy = (Number(correctCount || 0) / Number(totalQuestions)) * 100;
    return Number(rawAccuracy.toFixed(2));
}

function getQuizCompletionBonusXp(score) {
    let bonusXp = 5;

    if (score >= 90) bonusXp += 20;
    else if (score >= 75) bonusXp += 12;
    else if (score >= 60) bonusXp += 8;

    return bonusXp;
}

function evaluateQuizSubmission({
                                    questionIds,
                                    submittedAnswers,
                                    correctOptionsMap,
                                    descriptiveMap,
                                    questionMetaMap
                                }) {
    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;

    let weightedPositive = 0;
    let weightedNegative = 0;
    let weightedMaxPossible = 0;

    let totalXpGain = 0;

    const mabhasStats = {};
    const resultData = {};

    const ensureMabhasStats = (mabhas) => {
        if (!mabhasStats[mabhas]) {
            mabhasStats[mabhas] = {
                correct: 0,
                incorrect: 0,
                unanswered: 0,
                total: 0
            };
        }
    };

    for (const qId of questionIds) {
        const hasAnswer = Object.prototype.hasOwnProperty.call(submittedAnswers, qId);
        const submittedAnswer = hasAnswer ? submittedAnswers[qId] : undefined;

        const correctOptionId = correctOptionsMap[qId] || null;
        const meta = questionMetaMap[qId] || {};
        const level = meta.level || "متوسط";
        const mabhas = meta.topic_title || "نامشخص";
        const weight = getQuestionWeight(level);

        ensureMabhasStats(mabhas);

        weightedMaxPossible += weight;

        let status = "unanswered";

        if (
            submittedAnswer === undefined ||
            submittedAnswer === null ||
            submittedAnswer === ""
        ) {
            status = "unanswered";
            unansweredCount += 1;
            mabhasStats[mabhas].unanswered += 1;
        } else if (String(submittedAnswer) === String(correctOptionId) && correctOptionId !== null) {
            status = "correct";
            correctCount += 1;
            weightedPositive += weight;
            mabhasStats[mabhas].correct += 1;
        } else {
            status = "wrong";
            incorrectCount += 1;
            weightedNegative += (weight / 3);
            mabhasStats[mabhas].incorrect += 1;
        }

        mabhasStats[mabhas].total += 1;

        const earnedXp = getXpForQuestionStatus(status, weight);
        totalXpGain += earnedXp;

        resultData[qId] = {
            correct_option_id: correctOptionId,
            descriptive_answer: {
                text: descriptiveMap[qId] || null
            },
            status,
            level,
            mabhas
        };
    }

    const score = calculateCompetitiveScore({
        weightedPositive,
        weightedNegative,
        weightedMaxPossible
    });
    const scoreExplanation = generateScoreExplanation({
        finalScore: score,
        totalCorrect: correctCount,
        totalWrong: incorrectCount,
        totalUnanswered: unansweredCount,
        weightedScore: weightedPositive,
        weightedNegative: weightedNegative,
        totalWeight: weightedMaxPossible
    });

    const accuracyRate = calculateAccuracyRate({
        correctCount,
        totalQuestions: questionIds.length
    });

    totalXpGain += getQuizCompletionBonusXp(score);

    return {
        totalXpGain,
        resultData,
        summary: {
            total_questions: questionIds.length,
            correct_count: correctCount,
            incorrect_count: incorrectCount,
            unanswered_count: unansweredCount,
            accuracy_rate: accuracyRate,
            score,
            mabhas_stats: mabhasStats
        }
    };
}

function buildUserAnswerMutations({
                                      userId,
                                      questionIds,
                                      resultData,
                                      existingAnswersMap
                                  }) {
    const inserts = [];
    const updates = [];

    for (const qId of questionIds) {
        const newStatus = resultData[qId]?.status || "unanswered";
        const existingStatus = existingAnswersMap[qId];

        if (!existingStatus) {
            inserts.push([userId, qId, newStatus]);
        } else if (existingStatus !== newStatus) {
            updates.push([newStatus, userId, qId]);
        }
    }

    return { inserts, updates };
}

function applyXpProgression({
                                currentXpPoints,
                                currentXpLevel,
                                gainedXp
                            }) {
    let updatedXpPoints = Number(currentXpPoints || 0);
    let updatedXpLevel = Number(currentXpLevel || 1);

    updatedXpPoints += Number(gainedXp || 0);

    while (true) {
        const requiredXpForNextLevel = 100 + ((updatedXpLevel - 1) * 25);

        if (updatedXpPoints >= requiredXpForNextLevel) {
            updatedXpPoints -= requiredXpForNextLevel;
            updatedXpLevel += 1;
        } else {
            break;
        }
    }

    return {
        updatedXpPoints,
        updatedXpLevel
    };
}

async function insertQuizResult(connection, {
    quizId,
    userId,
    correctCount,
    incorrectCount,
    unansweredCount,
    accuracyRate,
    score,
    totalTimeSpent,
    summary,
    resultData
}) {
    const [result] = await connection.query(`
        INSERT INTO quiz_results
        (
            quiz_id,
            user_id,
            correct_count,
            incorrect_count,
            unanswered_count,
            accuracy_rate,
            total_score,
            total_time_spent,
            summary_json,
            result_data_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        quizId,
        userId,
        correctCount,
        incorrectCount,
        unansweredCount,
        accuracyRate,
        score,
        totalTimeSpent,
        JSON.stringify(summary ?? {}),
        JSON.stringify(resultData ?? {})
    ]);

    return result.insertId;
}

async function persistUserAnswerMutations(connection, { inserts, updates }) {
    if (inserts.length > 0) {
        await connection.query(`
            INSERT INTO tam24_user_answers (user_id, question_id, status)
            VALUES ?
        `, [inserts]);
    }

    for (const params of updates) {
        await connection.query(`
            UPDATE tam24_user_answers
            SET status = ?
            WHERE user_id = ? AND question_id = ?
        `, params);
    }
}

async function updateUserXp(connection, { userId, xpPoints, xpLevel }) {
    await connection.query(`
        UPDATE tam24_users
        SET xp_points = ?, xp_level = ?
        WHERE id = ?
    `, [xpPoints, xpLevel, userId]);
}

function safeJsonParse(value, fallback = null) {
    if (value == null) return fallback;
    if (typeof value === "object") return value;

    try {
        return JSON.parse(value);
    } catch (error) {
        return fallback;
    }
}

async function handleInternalGradeQuiz(req, res) {
    const { quizId } = req.params;
    // اضافه شدن دریافت فیلدهای جدید زمان و لاگ
    const { userId, answers, timeSpent, questionTimes, selectionLog } = req.body;

    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
        return res.status(400).json({ error: "Invalid payload. Expected answers to be an object map." });
    }

    const decodedQuizId = decodeQuizId(quizId);
    let connection;

    try {
        connection = await pool.getConnection();
        const quiz = await getQuizById(connection, decodedQuizId);

        if (!quiz) {
            return res.status(404).json({ error: "Quiz not found." });
        }

        const questionIds = parseQuestionIds(quiz.question_ids);
        const formattedAnswers = answers;

        const metadata = await getQuizEvaluationMetadata(connection, questionIds, userId);

        const evaluation = evaluateQuizSubmission({
            questionIds,
            submittedAnswers: formattedAnswers,
            correctOptionsMap: metadata.correctOptionsMap,
            descriptiveMap: metadata.descriptiveMap,
            questionMetaMap: metadata.questionMetaMap
        });

        // The lobby service expects exactly this shape:
        return res.status(200).json({
            score: evaluation.summary.score,
            total: questionIds.length,
            correctCount: evaluation.summary.correct_count,
            wrongCount: evaluation.summary.incorrect_count,
            // Include extra data for the next saving step
            evaluationData: evaluation,
            formattedAnswers,

            // پاس دادن مقادیر جدید به مرحله ذخیره‌سازی
            timeSpent: timeSpent || 0,
            questionTimes: questionTimes || {},
            selectionLog: selectionLog || []
        });

    } catch (error) {
        console.error("Error in handleInternalGradeQuiz:", error);
        return res.status(500).json({ error: "Internal server error." });
    } finally {
        if (connection) connection.release();
    }
}





// Saves the result, applies XP, and saves individual answers
async function handleInternalSaveQuizResult(req, res) {
    const { quizId, userId, lobbyCode, result } = req.body;

    if (!userId || !quizId || !result) {
        return res.status(400).json({ error: "Invalid payload." });
    }

    const decodedQuizId = decodeQuizId(quizId);

    const toPositiveInt = (v) => {
        const n = Number(v);
        return Number.isInteger(n) && n > 0 ? n : null;
    };

    const toNonNegativeInt = (v) => {
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
    };

    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const quiz = await getQuizById(connection, decodedQuizId);
        const user = await getUserXpInfo(connection, userId);

        if (!quiz || !user) {
            await connection.rollback();
            return res.status(404).json({ error: "Quiz or User not found." });
        }

        const questionIds = parseQuestionIds(quiz.question_ids);

        const evaluation = result.evaluationData;
        const formattedAnswers = result.formattedAnswers || {};

        const timeSpent = toNonNegativeInt(result.timeSpent) ?? 0;

        const sanitizedQuestionTimes = {};
        if (result.questionTimes && typeof result.questionTimes === "object") {
            for (const [qid, time] of Object.entries(result.questionTimes)) {
                const questionId = toPositiveInt(qid);
                const value = toNonNegativeInt(time);

                if (questionId && value !== null) {
                    sanitizedQuestionTimes[String(questionId)] = value;
                }
            }
        }

        const sanitizedSelectionLog = Array.isArray(result.selectionLog)
            ? result.selectionLog
                .map((entry) => {
                    const questionId = toPositiveInt(entry?.questionId);
                    const optionId = toPositiveInt(entry?.optionId);
                    const timeSpentMs = toNonNegativeInt(entry?.timeSpentMs);
                    const timestamp = toNonNegativeInt(entry?.timestamp);

                    if (!questionId || !optionId || timeSpentMs === null || timestamp === null) {
                        return null;
                    }

                    return {
                        questionId,
                        optionId,
                        timeSpentMs,
                        timestamp
                    };
                })
                .filter(Boolean)
            : [];

        const metadata = await getQuizEvaluationMetadata(connection, questionIds, userId);

        const answerMutations = buildUserAnswerMutations({
            userId,
            questionIds,
            resultData: evaluation.resultData,
            existingAnswersMap: metadata.existingAnswersMap
        });

        const xpResult = applyXpProgression({
            currentXpPoints: Number(user.xp_points || 0),
            currentXpLevel: Number(user.xp_level || 1),
            gainedXp: evaluation.totalXpGain
        });

        const enrichedEvaluation = {};

        if (evaluation.resultData && typeof evaluation.resultData === "object") {
            for (const qid of questionIds) {
                const key = String(qid);
                const item = evaluation.resultData[key];

                if (!item) continue;

                enrichedEvaluation[key] = {
                    ...item,
                    selected_option_id: formattedAnswers[key] ?? null,
                    is_answered: Object.prototype.hasOwnProperty.call(formattedAnswers, key)
                };
            }
        }

        const resultDataToStore = {
            evaluation: enrichedEvaluation,
            submission: {
                submittedAnswers: formattedAnswers,
                totalTimeSpent: timeSpent,
                questionTimes: sanitizedQuestionTimes,
                selectionLog: sanitizedSelectionLog,
                lobbyCode: lobbyCode || null
            }
        };

        const savedResultId = await insertQuizResult(connection, {
            quizId: decodedQuizId,
            userId,
            correctCount: evaluation.summary.correct_count,
            incorrectCount: evaluation.summary.incorrect_count,
            unansweredCount: evaluation.summary.unanswered_count,
            accuracyRate: evaluation.summary.accuracy_rate,
            score: evaluation.summary.score,
            totalTimeSpent: timeSpent,
            summary: evaluation.summary,
            resultData: resultDataToStore
        });

        await persistUserAnswerMutations(connection, answerMutations);

        await updateUserXp(connection, {
            userId,
            xpPoints: xpResult.updatedXpPoints,
            xpLevel: xpResult.updatedXpLevel
        });

        await connection.commit();

        return res.status(200).json({
            success: true,
            resultId: savedResultId
        });

    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (_) {}
        }

        if (error && (error.code === "ER_DUP_ENTRY" || error.errno === 1062)) {
            return res.status(200).json({
                success: true,
                note: "Already saved"
            });
        }

        console.error("Error in handleInternalSaveQuizResult:", error);

        return res.status(500).json({
            error: "Internal server error."
        });

    } finally {
        if (connection) connection.release();
    }
}


function safeJsonParse(value, fallback = null) {
    if (value == null) return fallback;

    if (typeof value === "object") {
        return value;
    }

    try {
        return JSON.parse(value);
    } catch (_) {
        return fallback;
    }
}

async function getQuizResultById(connection, {
    resultId,
    userId
}) {
    const [rows] = await connection.query(`
        SELECT
            id,
            quiz_id,
            user_id,
            correct_count,
            incorrect_count,
            unanswered_count,
            accuracy_rate,
            total_score,
            summary_json,
            result_data_json,
            created_at
        FROM quiz_results
        WHERE id = ?
          AND user_id = ?
        LIMIT 1
    `, [
        resultId,
        userId
    ]);

    if (!rows.length) {
        return null;
    }

    const row = rows[0];

    return {
        id: row.id,
        quizId: row.quiz_id,
        userId: row.user_id,
        correctCount: row.correct_count,
        incorrectCount: row.incorrect_count,
        unansweredCount: row.unanswered_count,
        accuracyRate: row.accuracy_rate,
        score: row.total_score,
        summary: safeJsonParse(row.summary_json, {}),
        resultData: safeJsonParse(row.result_data_json, []),
        createdAt: row.created_at
    };
}


async function handleGetQuizResult(req, res) {
    let connection;

    try {
        const { resultId } = req.body;
        const userId = req.user?.id;

        const decodedResultId = decodeResultId(resultId);

        if (!decodedResultId) {
            return res.status(400).json({ error: "شناسه نتیجه نامعتبر است." });
        }

        connection = await pool.getConnection();

        const result = await getQuizResultById(connection, {
            resultId: decodedResultId,
            userId,
        });

        if (!result) {
            return res.status(404).json({ error: "نتیجه‌ای یافت نشد." });
        }

        const rawResultData = result.resultData || {};
        const evaluation = rawResultData.evaluation && typeof rawResultData.evaluation === 'object'
            ? rawResultData.evaluation
            : {};
        const submission = rawResultData.submission && typeof rawResultData.submission === 'object'
            ? rawResultData.submission
            : {};

        const submittedAnswers =
            submission.submittedAnswers && typeof submission.submittedAnswers === 'object'
                ? submission.submittedAnswers
                : {};

        const questionTimes =
            submission.questionTimes && typeof submission.questionTimes === 'object'
                ? submission.questionTimes
                : {};

        const selectionLog = Array.isArray(submission.selectionLog)
            ? submission.selectionLog
            : [];

        const questionIds = Object.keys(evaluation).filter((key) => /^\d+$/.test(key));

        if (questionIds.length > 0) {
            const placeholders = questionIds.map(() => '?').join(',');

            const [questions] = await connection.query(
                `
                SELECT 
                    q.id AS question_id,
                    q.question_text,
                    o.id AS option_id,
                    o.option_text
                FROM questions_tam24 q
                LEFT JOIN options_tam24 o ON q.id = o.question_id
                WHERE q.id IN (${placeholders})
                `,
                questionIds
            );

            const questionDetailsMap = {};

            for (const row of questions) {
                if (!questionDetailsMap[row.question_id]) {
                    questionDetailsMap[row.question_id] = {
                        question_text: row.question_text || "متن سوال یافت نشد",
                        options: [],
                    };
                }

                if (row.option_id) {
                    questionDetailsMap[row.question_id].options.push({
                        id: row.option_id,
                        text: row.option_text,
                    });
                }
            }

            for (const qId of questionIds) {
                const details = questionDetailsMap[qId] || {
                    question_text: "متن سوال یافت نشد",
                    options: [],
                };

                evaluation[qId] = {
                    ...evaluation[qId],
                    question_text: details.question_text,
                    options: details.options,
                    selected_option_id:
                        evaluation[qId]?.selected_option_id ??
                        submittedAnswers[qId] ??
                        null,
                    is_answered:
                        typeof evaluation[qId]?.is_answered === 'boolean'
                            ? evaluation[qId].is_answered
                            : submittedAnswers[qId] != null,
                    time_spent_ms:
                        Number.isFinite(Number(questionTimes[qId]))
                            ? Number(questionTimes[qId])
                            : 0,
                };
            }
        }
        const is_public = await isQuizPublic(connection, result.quizId);
        const formattedResult = {
            id: encodeResultId(result.id),
            quizId: encodeQuizId(result.quizId),
            is_public: is_public,
            userId: result.userId,
            success: result.success,
            correctCount: result.correctCount,
            incorrectCount: result.incorrectCount,
            unansweredCount: result.unansweredCount || 0,
            accuracyRate: result.accuracyRate,
            score: result.score,
            total_time_spent:
                Number.isFinite(Number(result.total_time_spent)) && Number(result.total_time_spent) > 0
                    ? Number(result.total_time_spent)
                    : Number(submission.totalTimeSpent) || 0,
            summary: result.summary,
            resultData: {
                evaluation,
                submission: {
                    ...submission,
                    totalTimeSpent: Number(submission.totalTimeSpent) || 0,
                    questionTimes,
                    selectionLog,
                    submittedAnswers,
                },
            },
        };

        return res.status(200).json(formattedResult);
    } catch (error) {
        console.error("Error in handleGetQuizResult:", error);
        return res.status(500).json({ error: "خطای سرور در دریافت نتیجه آزمون." });
    } finally {
        if (connection) connection.release();
    }
}




// Get all members of a specific quiz (used to populate the avatar list on public quizzes)
const handleGetQuizMembers = async (req, res) => {
    const quizId = req.body.quizId || req.params.quizId;

    if (!quizId) {
        return res.status(400).json({ success: false, message: "شناسه آزمون ارسال نشده است" });
    }

    let decodedQuizId;
    try {
        decodedQuizId = decodeQuizId(quizId);
    } catch (err) {
        return res.status(400).json({ success: false, message: "شناسه آزمون نامعتبر است" });
    }

    let connection;
    try {
        connection = await pool.getConnection();

        // Join quiz_members with tam24_users to retrieve name and avatar
        // Left join with quiz_results to calculate score and order rank
        const sql = `
            SELECT 
                u.id, 
                u.first_name, 
                u.last_name, 
                u.avatar_url,
                qm.role,
                qr.total_score AS score
            FROM quiz_members qm
            JOIN tam24_users u ON qm.user_id = u.id
            LEFT JOIN quiz_results qr ON qm.quiz_id = qr.quiz_id AND qm.user_id = qr.user_id
            WHERE qm.quiz_id = ?
        `;

        const [rows] = await connection.query(sql, [decodedQuizId]);

        // Sort members by score descending (users without a finished result get fallback score of -1)
        const sorted = rows.sort((a, b) => {
            const scoreA = a.score !== null ? Number(a.score) : -1;
            const scoreB = b.score !== null ? Number(b.score) : -1;
            return scoreB - scoreA;
        });

        const currentUserId = req.user?.id;

        const members = sorted.map((m, index) => ({
            id: m.id,
            userId: m.id,
            fullName: m.first_name + '' + m.last_name || "کاربر ناشناس",
            avatar: m.avatar_url || null,
            role: m.role,
            score: m.score,
            rank: m.score !== null ? index + 1 : null,
            isSelf: currentUserId ? (Number(m.id) === Number(currentUserId)) : false
        }));

        return res.json({ success: true, result: members });
    } catch (error) {
        console.error("❌ SQL Error in handleGetQuizMembers:", error);
        return res.status(500).json({ success: false, message: "خطا در دریافت اعضای آزمون" });
    } finally {
        if (connection) connection.release();
    }
};

// Get the result of a specific user for a specific quiz (used when clicking dynamic avatars)
const handleGetQuizResultByUserAndQuiz = async (req, res) => {
    let connection;
    try {
        const { userId, quizId } = req.body;

        if (!userId || !quizId) {
            return res.status(400).json({ error: "اطلاعات ارسالی ناقص است." });
        }

        const decodedQuizId = decodeQuizId(quizId);
        const targetUserId = Number(userId);

        if (!decodedQuizId || isNaN(targetUserId)) {
            return res.status(400).json({ error: "اطلاعات ارسالی نامعتبر است." });
        }

        connection = await pool.getConnection();

        // Retrieve quiz result record by quiz and user
        const [rows] = await connection.query(`
            SELECT
                id,
                quiz_id,
                user_id,
                correct_count,
                incorrect_count,
                unanswered_count,
                accuracy_rate,
                total_score,
                total_time_spent,
                summary_json,
                result_data_json,
                created_at
            FROM quiz_results
            WHERE quiz_id = ?
              AND user_id = ?
            LIMIT 1
        `, [decodedQuizId, targetUserId]);

        if (rows.length === 0) {
            return res.status(404).json({ error: "کاربر هنوز این آزمون را تمام نکرده است." });
        }

        const row = rows[0];
        const result = {
            id: row.id,
            quizId: row.quiz_id,
            userId: row.user_id,
            correctCount: row.correct_count,
            incorrectCount: row.incorrect_count,
            unansweredCount: row.unanswered_count,
            accuracyRate: row.accuracy_rate,
            score: row.total_score,
            total_time_spent: row.total_time_spent,
            summary: safeJsonParse(row.summary_json, {}),
            resultData: safeJsonParse(row.result_data_json, []),
            createdAt: row.created_at
        };

        const rawResultData = result.resultData || {};
        const evaluation = rawResultData.evaluation && typeof rawResultData.evaluation === 'object'
            ? rawResultData.evaluation
            : {};
        const submission = rawResultData.submission && typeof rawResultData.submission === 'object'
            ? rawResultData.submission
            : {};

        const submittedAnswers =
            submission.submittedAnswers && typeof submission.submittedAnswers === 'object'
                ? submission.submittedAnswers
                : {};

        const questionTimes =
            submission.questionTimes && typeof submission.questionTimes === 'object'
                ? submission.questionTimes
                : {};

        const selectionLog = Array.isArray(submission.selectionLog)
            ? submission.selectionLog
            : [];

        const questionIds = Object.keys(evaluation).filter((key) => /^\d+$/.test(key));

        // Hydrate questions details (texts and options)
        if (questionIds.length > 0) {
            const placeholders = questionIds.map(() => '?').join(',');

            const [questions] = await connection.query(
                `
                SELECT 
                    q.id AS question_id,
                    q.question_text,
                    o.id AS option_id,
                    o.option_text
                FROM questions_tam24 q
                LEFT JOIN options_tam24 o ON q.id = o.question_id
                WHERE q.id IN (${placeholders})
                `,
                questionIds
            );

            const questionDetailsMap = {};

            for (const row of questions) {
                if (!questionDetailsMap[row.question_id]) {
                    questionDetailsMap[row.question_id] = {
                        question_text: row.question_text || "متن سوال یافت نشد",
                        options: [],
                    };
                }

                if (row.option_id) {
                    questionDetailsMap[row.question_id].options.push({
                        id: row.option_id,
                        text: row.option_text,
                    });
                }
            }

            for (const qId of questionIds) {
                const details = questionDetailsMap[qId] || {
                    question_text: "متن سوال یافت نشد",
                    options: [],
                };

                evaluation[qId] = {
                    ...evaluation[qId],
                    question_text: details.question_text,
                    options: details.options,
                    selected_option_id:
                        evaluation[qId]?.selected_option_id ??
                        submittedAnswers[qId] ??
                        null,
                    is_answered:
                        typeof evaluation[qId]?.is_answered === 'boolean'
                            ? evaluation[qId].is_answered
                            : submittedAnswers[qId] != null,
                    time_spent_ms:
                        Number.isFinite(Number(questionTimes[qId]))
                            ? Number(questionTimes[qId])
                            : 0,
                };
            }
        }

        const formattedResult = {
            id: encodeResultId(result.id),
            quizId: encodeQuizId(result.quizId),
            userId: result.userId,
            correctCount: result.correctCount,
            incorrectCount: result.incorrectCount,
            unansweredCount: result.unansweredCount || 0,
            accuracyRate: result.accuracyRate,
            score: result.score,
            total_time_spent:
                Number.isFinite(Number(result.total_time_spent)) && Number(result.total_time_spent) > 0
                    ? Number(result.total_time_spent)
                    : Number(submission.totalTimeSpent) || 0,
            summary: result.summary,
            resultData: {
                evaluation,
                submission: {
                    ...submission,
                    totalTimeSpent: Number(submission.totalTimeSpent) || 0,
                    questionTimes,
                    selectionLog,
                    submittedAnswers,
                },
            },
        };

        return res.status(200).json(formattedResult);
    } catch (error) {
        console.error("Error in handleGetQuizResultByUserAndQuiz:", error);
        return res.status(500).json({ error: "خطای سرور در دریافت نتیجه آزمون کاربر." });
    } finally {
        if (connection) connection.release();
    }
};

async function handleInternalFinishQuiz(req, res) {
    const { quizId } = req.params;

    const decodedQuizId = decodeQuizId(quizId);
    let connection;

    try {
        connection = await pool.getConnection();

        const [result] = await connection.execute(
            `UPDATE quizzes SET status = 'completed' WHERE id = ?`,
            [decodedQuizId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Quiz not found.' });
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Error in handleInternalFinishQuiz:', error);
        return res.status(500).json({ error: 'Internal server error.' });
    } finally {
        if (connection) connection.release();
    }
}


async function handleFinishQuiz(req, res) {
    const { quizId } = req.body;

    const decodedQuizId = decodeQuizId(quizId);
    let connection;

    try {
        connection = await pool.getConnection();

        const [result] = await connection.execute(
            `UPDATE quizzes SET status = 'completed' WHERE id = ?`,
            [decodedQuizId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Quiz not found.' });
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Error in handleInternalFinishQuiz:', error);
        return res.status(500).json({ error: 'Internal server error.' });
    } finally {
        if (connection) connection.release();
    }
}



module.exports = {
    generateCode,
    handleGetSubjects,
    handleGetGradesBySubjects,     // به روز شده
    handleGetChaptersBySubjects,   // به روز شده
    handleGetMabahesByChapters,    // به روز شده
    handleCreateQuiz,
    handleGetQuizByShareCode,
    handleGetQuizMetadata,
    handleGetQuizQuestions,
    handleCheckUserMember,
    handleSubmitQuizAnswers,
    handleGetQuizPreviewState,
    handleAddQuizMember,
    handleInternalGradeQuiz,
    handleInternalFinishQuiz,
    handleGetQuizResult,
    handleFinishQuiz,
    getQuizResultById,
    handleGetQuizMembers,
    handleGetQuizResultByUserAndQuiz,
    handleInternalSaveQuizResult

};
