const pool = require('../db');
const cookie = require('cookie');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const {
    ensureQuestionTagTables,
    saveQuestionTags,
    getQuestionTags,
    joinOnTag,
    matchTagIn,
    toPositiveIds,
} = require('../utils/questionTags');

// --- PDF Library upload configuration ---
// Defaults to the same web root used for avatar uploads in server.js
// (path.resolve(serverRoot, '../../public')). Adjust via env vars if needed.
const PDF_UPLOAD_DIR = process.env.PDF_UPLOAD_DIR || path.resolve(__dirname, '..', '..', '..', 'public', 'files', 'pdfs');
const PDF_PUBLIC_PATH = process.env.PDF_PUBLIC_PATH || 'files/pdfs/';

// Helper: Extract the logged-in admin id from the HttpOnly cookie token (ADMIN-<id>-<timestamp>)
const getAdminIdFromRequest = (req) => {
    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies.admin_token;
    if (!token) return null;
    const parts = token.split('-');
    if (parts[0] === 'ADMIN' && parts[1]) {
        const adminId = parseInt(parts[1], 10);
        return Number.isNaN(adminId) ? null : adminId;
    }
    return null;
};

// Helper: Only admin with id 1 is allowed to delete records
const requireSuperAdmin = (req, res) => {
    const adminId = getAdminIdFromRequest(req);
    if (adminId !== 1) {
        res.json({ success: false, message: "Only the main admin (id 1) can delete records." });
        return null;
    }
    return adminId;
};
// Helper: Strict POST validation
const requirePost = (req, res, key) => {
    const val = req.body[key];
    if (val === undefined || val === null || val === 'null' || val === 'undefined' || String(val).trim() === '') {
        res.json({ success: false, message: `Missing or invalid parameter: ${key}` });
        return null;
    }
    return val;
};

// ===============================================
// GET SINGLE QUESTION FOR EDIT
// ===============================================
const handleGetQuestionForEdit = async (req, res) => {
    try {
        await ensureQuestionTagTables();
        const { question_id, direction, current_id, filters } = req.body;

        // Base SQL query
        let sql = `
            SELECT q.id, q.question_text, q.subject_id, q.topic_id, q.chapter_id, q.grade_id, q.difficulty_level, q.status,
                   s.title AS subject_title, t.title AS topic_title,
                   c.title AS chapter_title, g.title AS grade_title
            FROM questions_tam24 q
                     LEFT JOIN subjects_tam24 s ON q.subject_id = s.id
                     LEFT JOIN topics_tam24 t ON q.topic_id = t.id
                     LEFT JOIN chapters_tam24 c ON q.chapter_id = c.id
                     LEFT JOIN grades_tam24 g ON q.grade_id = g.id
            WHERE 1=1
        `;

        let params = [];

        // --- Dynamically add filter conditions (skipped for direct ID lookups) ---
        if (filters && !question_id) {
            // Note the mapping from frontend filters to DB columns
            if (filters.subject_id) {
                sql += ` AND q.subject_id = ?`;
                params.push(filters.subject_id);
            }
            const gradeMatch = matchTagIn('q', 'grade', filters.grade_id);
            if (gradeMatch.sql) { sql += ` AND ${gradeMatch.sql}`; params.push(...gradeMatch.params); }
            const topicMatch = matchTagIn('q', 'topic', filters.topic_id);
            if (topicMatch.sql) { sql += ` AND ${topicMatch.sql}`; params.push(...topicMatch.params); }
            const mabhasMatch = matchTagIn('q', 'mabhas', filters.chapter_id);
            if (mabhasMatch.sql) { sql += ` AND ${mabhasMatch.sql}`; params.push(...mabhasMatch.params); }

            // Filter by status (فعال / غیرفعال)
            if (filters.status) {
                sql += ` AND q.status = ?`;
                params.push(filters.status);
            }

            // Filter by presence/absence of images
            if (filters.has_image === 'with') {
                sql += ` AND EXISTS (SELECT 1 FROM question_images_tam24 qi WHERE qi.question_id = q.id)`;
            } else if (filters.has_image === 'without') {
                sql += ` AND NOT EXISTS (SELECT 1 FROM question_images_tam24 qi WHERE qi.question_id = q.id)`;
            }

            // Free-text search within the question text
            if (filters.search_text && String(filters.search_text).trim() !== '') {
                sql += ` AND q.question_text LIKE ?`;
                params.push(`%${String(filters.search_text).trim()}%`);
            }
        }

        // --- Logic for Search, Next, Previous, or Random ---
        if (question_id) {
            // Highest priority: Fetch a specific question by ID
            // This ignores direction and other filters for a direct lookup.
            sql += ` AND q.id = ?`;
            params.push(question_id);
        } else if (direction === 'next' && current_id) {
            sql += ` AND q.id > ? ORDER BY q.id ASC LIMIT 1`;
            params.push(current_id);
        } else if (direction === 'prev' && current_id) {
            sql += ` AND q.id < ? ORDER BY q.id DESC LIMIT 1`;
            params.push(current_id);
        } else {
            // Default case: No ID or direction provided. Fetch a RANDOM question
            // that matches the applied filters (if any).
            sql += ` ORDER BY RAND() LIMIT 1`;
        }


        const [questions] = await pool.query(sql, params);

        if (questions.length === 0) {
            return res.json({ success: false, message: 'No question found matching the criteria.' });
        }

        const q = questions[0];
        const tags = await getQuestionTags(q.id);
        const gradeIds = tags.grade_ids.length ? tags.grade_ids : (q.grade_id ? [Number(q.grade_id)] : []);
        const topicIds = tags.topic_ids.length ? tags.topic_ids : (q.topic_id ? [Number(q.topic_id)] : []);
        const chapterIds = tags.chapter_ids.length ? tags.chapter_ids : (q.chapter_id ? [Number(q.chapter_id)] : []);
        const gradeTitles = tags.grade_titles.length ? tags.grade_titles : (q.grade_title ? [q.grade_title] : []);
        const topicTitles = tags.topic_titles.length ? tags.topic_titles : (q.topic_title ? [q.topic_title] : []);
        const chapterTitles = tags.chapter_titles.length ? tags.chapter_titles : (q.chapter_title ? [q.chapter_title] : []);

        // Fetch Options
        const [options] = await pool.query(
            "SELECT id, option_text, COALESCE(CAST(is_correct AS UNSIGNED), 0) AS is_correct FROM options_tam24 WHERE question_id = ? ORDER BY id ASC",
            [q.id]
        );

        // Fetch Descriptive Answer
        const [desc] = await pool.query(
            "SELECT answer_text FROM descriptive_answers_tam24 WHERE question_id = ?",
            [q.id]
        );

        // Fetch Images
        const [images] = await pool.query(
            "SELECT image_name FROM question_images_tam24 WHERE question_id = ?",
            [q.id]
        );

        res.json({
            success: true,
            question: {
                id: q.id,
                text: q.question_text,
                options: options.map(o => ({ id: o.id, text: o.option_text, is_correct: o.is_correct == 1 })),
                descriptiveAnswer: desc.length > 0 ? desc[0].answer_text : "",
                images: images.map(i => i.image_name),

                subject: q.subject_id,
                subject_title: q.subject_title || '----',

                grade: gradeIds[0] || q.grade_id,
                grade_title: gradeTitles[0] || q.grade_title || '----',
                grade_ids: gradeIds,
                grade_titles: gradeTitles,

                chapter: topicIds[0] || q.topic_id, // topic in DB = chapter in UI
                chapter_title: topicTitles[0] || q.topic_title || '----',
                chapter_ids: topicIds,
                chapter_titles: topicTitles,

                mabhas: chapterIds[0] || q.chapter_id, // chapter in DB = mabhas in UI
                mabhas_title: chapterTitles[0] || q.chapter_title || '----',
                mabhas_ids: chapterIds,
                mabhas_titles: chapterTitles,

                level: q.difficulty_level || 'متوسط',
                status: q.status || 'غیرفعال'
            }
        });

    } catch (error) {
        console.error("❌ SQL Error in handleGetQuestionForEdit:", error);
        res.json({ success: false, message: "Database error fetching question" });
    }
};


// ===============================================
// ADMIN FILTER DATA FETCHERS
// ===============================================

// adminController.js

const handleAdminGetSubjects = async (req, res) => {
    try {
        const sql = `
            SELECT DISTINCT s.id, s.title
            FROM questions_tam24 q
            JOIN subjects_tam24 s ON q.subject_id = s.id
            ORDER BY s.id ASC
        `;
        const [rows] = await pool.query(sql);
        res.json({ success: true, subjects: rows });
    } catch (error) {
        console.error("Error in handleAdminGetAllSubjects:", error);
        res.json({ success: false, message: error.message });
    }
};

const handleAdminGetGradesBySubject = async (req, res) => {
    try {
        const { subject_id } = req.body;
        if (!subject_id || subject_id === 'null') {
            return res.json({ success: true, grades: [] });
        }

        await ensureQuestionTagTables();
        const sql = `
            SELECT DISTINCT g.id, g.title
            FROM questions_tam24 q
            JOIN grades_tam24 g ON ${joinOnTag('q', 'g', 'grade')}
            WHERE q.subject_id = ?
            ORDER BY g.id ASC
        `;
        const [rows] = await pool.query(sql, [subject_id]);
        res.json({ success: true, grades: rows });
    } catch (error) {
        console.error("Error in handleAdminGetGradesBySubject:", error);
        res.json({ success: false, message: error.message });
    }
};

const handleAdminGetChaptersBySubject = async (req, res) => {
    try {
        const { subject_id, grade_id } = req.body;

        if (!subject_id || subject_id === 'null') {
            return res.json({ success: true, chapters: [] });
        }

        await ensureQuestionTagTables();
        const gradeMatch = matchTagIn('q', 'grade', grade_id);
        const sql = `
            SELECT DISTINCT t.id, t.title
            FROM questions_tam24 q
            JOIN topics_tam24 t ON ${joinOnTag('q', 't', 'topic')}
            WHERE q.subject_id = ? ${gradeMatch.sql ? `AND ${gradeMatch.sql}` : ''}
            ORDER BY t.id ASC
        `;
        const [rows] = await pool.query(sql, [subject_id, ...gradeMatch.params]);
        res.json({ success: true, chapters: rows });
    } catch (error) {
        console.error("Error in handleAdminGetChaptersBySubject:", error);
        res.json({ success: false, message: error.message });
    }
};

const handleAdminGetMabahesByChapter = async (req, res) => {
    try {
        const { topic_id } = req.body; // Frontend sends topic_id mapped to chapter dropdown
        if (!topic_id || topic_id === 'null') {
            return res.json({ success: true, mabahes: [] });
        }

        await ensureQuestionTagTables();
        const topicMatch = matchTagIn('q', 'topic', topic_id);
        const sql = `
            SELECT DISTINCT c.id, c.title
            FROM questions_tam24 q
            JOIN chapters_tam24 c ON ${joinOnTag('q', 'c', 'mabhas')}
            WHERE ${topicMatch.sql || '1=1'}
            ORDER BY c.id ASC
        `;
        const [rows] = await pool.query(sql, topicMatch.params);
        res.json({ success: true, mabahes: rows });
    } catch (error) {
        console.error("Error in handleAdminGetMabahesByChapter:", error);
        res.json({ success: false, message: error.message });
    }
};


// ===============================================
// UPDATE QUESTION (Set Correct Option + Activate)
// ===============================================
const handleUpdateQuestion = async (req, res) => {
    try {
        const adminId = getAdminIdFromRequest(req);
        if (!adminId) {
            return res.json({ success: false, message: "No valid admin session found." });
        }

        const questionId = requirePost(req, res, 'question_id');
        if (questionId === null) return;

        const correctOptionId = requirePost(req, res, 'correct_option_id');
        if (correctOptionId === null) return;

        await pool.query(`UPDATE options_tam24 SET is_correct = 0 WHERE question_id = ?`, [questionId]);
        const [result] = await pool.query(`UPDATE options_tam24 SET is_correct = 1 WHERE id = ? AND question_id = ?`, [correctOptionId, questionId]);

        if (result.affectedRows === 0) return res.json({ success: false, message: "Option or Question not found" });

        await pool.query(
            `UPDATE questions_tam24 SET status = 'فعال', last_edit_date = NOW(), last_edit_by = ? WHERE id = ?`,
            [adminId, questionId]
        );
        res.json({ success: true, message: "Question updated successfully" });
    } catch (error) {
        console.error("❌ SQL Error in handleUpdateQuestion:", error);
        res.json({ success: false, message: "Database error updating question" });
    }
};

const handleAdminLogin = async (req, res) => {
    const username = requirePost(req, res, "username");
    const password = requirePost(req, res, "password");
    if (!username || !password) return;

    const match = username.match(/^admin(\d+)$/);

    if (match) {
        const adminId = parseInt(match[1], 10);

        if (adminId >= 1 && adminId <= 20) {
            const expectedPassword = `Admin@${adminId}`;

            if (password === expectedPassword) {
                // --- NEW: Create a user object ---
                const user = {
                    id: adminId,
                    username: `admin${adminId}`,
                    role: 'admin' // The role is static in this case
                };

                // Create a token (can be a JWT for more security, but this is simple)
                const token = `ADMIN-${user.id}-${Date.now()}`;

                // --- NEW: Set a secure cookie ---
                res.setHeader('Set-Cookie', cookie.serialize('admin_token', token, {
                    httpOnly: true, // The browser cannot access this cookie via JavaScript
                    secure: process.env.NODE_ENV !== 'development', // Use secure in production
                    maxAge: 60 * 60 * 24 * 7, // 1 week
                    sameSite: 'strict',
                    path: '/',
                }));

                // --- NEW: Return the user object in the response body ---
                return res.json({ success: true, user });
            }
        }
    }

    res.json({ success: false, message: "Invalid credentials" });
};

// --- NEW: Function to verify session ---
const handleAdminVerify = async (req, res) => {
    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies.admin_token;

    if (!token) {
        return res.json({ success: false, message: "No session found." });
    }

    // Very basic token validation (in a real app, use JWT)
    const parts = token.split('-');
    if (parts[0] === 'ADMIN' && parts[1]) {
        const adminId = parseInt(parts[1], 10);
        const user = {
            id: adminId,
            username: `admin${adminId}`,
            role: 'admin'
        };
        return res.json({ success: true, user });
    }

    return res.json({ success: false, message: "Invalid session." });
};


// --- NEW: Function to handle logout ---
const handleAdminLogout = async (req, res) => {
    // Clear the cookie by setting its expiration date to the past
    res.setHeader('Set-Cookie', cookie.serialize('admin_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        expires: new Date(0), // Set to a past date
        sameSite: 'strict',
        path: '/',
    }));

    res.json({ success: true, message: "Logged out" });
};
// ===============================================
// FULL UPDATE QUESTION (Text, Options, Descriptive, Meta)
// ===============================================
const handleFullUpdateQuestion = async (req, res) => {
    try {
        const adminId = getAdminIdFromRequest(req);
        if (!adminId) {
            return res.json({ success: false, message: "No valid admin session found." });
        }

        const questionId = requirePost(req, res, 'question_id');
        if (!questionId) return;

        const { text, options, descriptiveAnswer, correct_option_id, subject_id, grade_id, chapter_id, topic_id, level, status } = req.body;
        const gradeIds = toPositiveIds(req.body.grade_ids || grade_id);
        const topicIds = toPositiveIds(req.body.topic_ids || topic_id);
        const chapterIds = toPositiveIds(req.body.chapter_ids || req.body.mabhas_ids || chapter_id);

        // 1. Update Question Text & Meta Info
        let updateFields = [];
        let updateParams = [];

        if (text !== undefined) { updateFields.push("question_text = ?"); updateParams.push(text); }
        if (subject_id !== undefined) { updateFields.push("subject_id = ?"); updateParams.push(subject_id); }
        if (gradeIds.length || grade_id !== undefined) {
            updateFields.push("grade_id = ?");
            updateParams.push(gradeIds[0] || grade_id || null);
        }

        if (chapterIds.length || chapter_id !== undefined) {
            updateFields.push("chapter_id = ?");
            updateParams.push(chapterIds[0] || chapter_id || null);
        }
        if (topicIds.length || topic_id !== undefined) {
            updateFields.push("topic_id = ?");
            updateParams.push(topicIds[0] || topic_id || null);
        }
        if (level !== undefined) { updateFields.push("difficulty_level = ?"); updateParams.push(level); }
        if (status !== undefined) { updateFields.push("status = ?"); updateParams.push(status); }

        // Always record which admin edited the question and when
        updateFields.push("last_edit_date = NOW()");
        updateFields.push("last_edit_by = ?");
        updateParams.push(adminId);

        updateParams.push(questionId);
        await pool.query(`UPDATE questions_tam24 SET ${updateFields.join(', ')} WHERE id = ?`, updateParams);

        if (grade_id !== undefined || topic_id !== undefined || chapter_id !== undefined || req.body.grade_ids || req.body.topic_ids || req.body.chapter_ids || req.body.mabhas_ids) {
            await saveQuestionTags(questionId, { gradeIds, topicIds, chapterIds });
        }

        // 2. Update Descriptive Answer
        if (descriptiveAnswer !== undefined) {
            const [exist] = await pool.query("SELECT question_id FROM descriptive_answers_tam24 WHERE question_id = ?", [questionId]);
            if (exist.length > 0) {
                await pool.query("UPDATE descriptive_answers_tam24 SET answer_text = ? WHERE question_id = ?", [descriptiveAnswer, questionId]);
            } else {
                await pool.query("INSERT INTO descriptive_answers_tam24 (question_id, answer_text) VALUES (?, ?)", [questionId, descriptiveAnswer]);
            }
        }

        // 3. Update Options & Correct Answer
        if (options && Array.isArray(options)) {
            await pool.query("UPDATE options_tam24 SET is_correct = 0 WHERE question_id = ?", [questionId]);
            for (let opt of options) {
                await pool.query("UPDATE options_tam24 SET option_text = ? WHERE id = ? AND question_id = ?", [opt.text, opt.id, questionId]);
            }
            if (correct_option_id) {
                await pool.query("UPDATE options_tam24 SET is_correct = 1 WHERE id = ? AND question_id = ?", [correct_option_id, questionId]);
            }
        }

        res.json({ success: true, message: "Question fully updated successfully!" });

    } catch (error) {
        console.error("❌ SQL Error in handleFullUpdateQuestion:", error);
        res.json({ success: false, message: "Database error updating question" });
    }
};

const getQuestionsByFilters = async (req, res) => {
    try {
        // Extract filters from the request query
        const {
            subject_id,
            grade_id,
            chapter_id,
            topic_id,
            difficulty_level,
            status,
            limit = 20,
            offset = 0
        } = req.query;

        // Base SQL with WHERE 1=1
        let sql = `
            SELECT q.id, q.question_text, q.difficulty_level, q.status,
                   s.title AS subject_title, 
                   t.title AS topic_title,
                   c.title AS chapter_title, 
                   g.title AS grade_title
            FROM questions_tam24 q
            LEFT JOIN subjects_tam24 s ON q.subject_id = s.id
            LEFT JOIN topics_tam24 t ON q.topic_id = t.id
            LEFT JOIN chapters_tam24 c ON q.chapter_id = c.id
            LEFT JOIN grades_tam24 g ON q.grade_id = g.id
            WHERE 1=1
        `;

        let params = [];

        // Dynamically append filters
        if (subject_id) {
            sql += ` AND q.subject_id = ?`;
            params.push(subject_id);
        }
        const gradeMatch = matchTagIn('q', 'grade', grade_id);
        if (gradeMatch.sql) { sql += ` AND ${gradeMatch.sql}`; params.push(...gradeMatch.params); }
        const mabhasMatch = matchTagIn('q', 'mabhas', chapter_id);
        if (mabhasMatch.sql) { sql += ` AND ${mabhasMatch.sql}`; params.push(...mabhasMatch.params); }
        const topicMatch = matchTagIn('q', 'topic', topic_id);
        if (topicMatch.sql) { sql += ` AND ${topicMatch.sql}`; params.push(...topicMatch.params); }
        if (difficulty_level) {
            sql += ` AND q.difficulty_level = ?`;
            params.push(difficulty_level);
        }
        if (status) {
            sql += ` AND q.status = ?`;
            params.push(status);
        }

        // Add sorting and pagination
        sql += ` ORDER BY q.id DESC LIMIT ? OFFSET ?`;

        // Ensure limit and offset are integers
        params.push(parseInt(limit), parseInt(offset));

        // Execute the query (assuming you are using a mysql2/promise pool named 'db')
        const [questions] = await pool.query(sql, params);

        // Optional: Get total count for pagination
        let countSql = `SELECT COUNT(*) as total FROM questions_tam24 q WHERE 1=1`;
        let countParams = [];

        // Re-apply same filters for the count query
        if (subject_id) { countSql += ` AND q.subject_id = ?`; countParams.push(subject_id); }
        if (gradeMatch.sql) { countSql += ` AND ${gradeMatch.sql}`; countParams.push(...gradeMatch.params); }
        if (mabhasMatch.sql) { countSql += ` AND ${mabhasMatch.sql}`; countParams.push(...mabhasMatch.params); }
        if (topicMatch.sql) { countSql += ` AND ${topicMatch.sql}`; countParams.push(...topicMatch.params); }
        if (difficulty_level) { countSql += ` AND q.difficulty_level = ?`; countParams.push(difficulty_level); }
        if (status) { countSql += ` AND q.status = ?`; countParams.push(status); }

        const [[{ total }]] = await pool.query(countSql, countParams);

        res.json({
            success: true,
            data: questions,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });

    } catch (error) {
        console.error("Error fetching filtered questions:", error);
        res.status(500).json({ success: false, message: "Server error while fetching questions." });
    }
};



// ===============================================
// CURRICULUM MANAGER (Subjects / Grades / Chapters / Mabhas)
// ===============================================
// UI naming reminder:
//   UI "Chapter" -> topics_tam24   (parent: subject)
//   UI "Mabhas"  -> chapters_tam24 (parent: topic)
const CURRICULUM_TABLES = {
    subject: { table: 'subjects_tam24', parentColumn: null, hasIcon: true },
    grade:   { table: 'grades_tam24',   parentColumn: null, hasIcon: false },
    topic:   { table: 'topics_tam24',   parentColumn: 'subject_id', hasIcon: false },
    chapter: { table: 'chapters_tam24', parentColumn: 'topic_id',   hasIcon: false }
};

// Fetch ALL curriculum entities in one call (not only the ones used by questions)
const handleAdminGetCurriculum = async (req, res) => {
    try {
        const [subjects] = await pool.query("SELECT id, title, icon FROM subjects_tam24 ORDER BY id ASC");
        const [grades] = await pool.query("SELECT id, title FROM grades_tam24 ORDER BY id ASC");
        const [topics] = await pool.query("SELECT id, subject_id, title FROM topics_tam24 ORDER BY id ASC");
        const [chapters] = await pool.query("SELECT id, topic_id, title FROM chapters_tam24 ORDER BY id ASC");

        res.json({ success: true, subjects, grades, topics, chapters });
    } catch (error) {
        console.error("❌ SQL Error in handleAdminGetCurriculum:", error);
        res.json({ success: false, message: "Database error fetching curriculum data" });
    }
};

// Create or update a curriculum item ({ type, id?, title, parent_id?, icon? })
const handleAdminSaveCurriculumItem = async (req, res) => {
    try {
        const { type, id, title, parent_id, icon } = req.body;

        const config = CURRICULUM_TABLES[type];
        if (!config) {
            return res.json({ success: false, message: "Invalid curriculum type." });
        }
        if (!title || String(title).trim() === '') {
            return res.json({ success: false, message: "Title is required." });
        }
        if (config.parentColumn && (!parent_id || parent_id === 'null')) {
            return res.json({ success: false, message: `A parent (${config.parentColumn}) is required for this item.` });
        }

        const cleanTitle = String(title).trim();

        if (id) {
            // UPDATE
            let sql = `UPDATE ${config.table} SET title = ?`;
            const params = [cleanTitle];
            if (config.parentColumn) {
                sql += `, ${config.parentColumn} = ?`;
                params.push(parent_id);
            }
            if (config.hasIcon && icon !== undefined) {
                sql += `, icon = ?`;
                params.push(icon || null);
            }
            sql += ` WHERE id = ?`;
            params.push(id);

            const [result] = await pool.query(sql, params);
            if (result.affectedRows === 0) {
                return res.json({ success: false, message: "Item not found." });
            }
            return res.json({ success: true, message: "Item updated successfully.", id });
        } else {
            // INSERT
            const columns = ['title'];
            const params = [cleanTitle];
            if (config.parentColumn) {
                columns.push(config.parentColumn);
                params.push(parent_id);
            }
            if (config.hasIcon && icon) {
                columns.push('icon');
                params.push(icon);
            }
            const placeholders = columns.map(() => '?').join(', ');
            const [result] = await pool.query(
                `INSERT INTO ${config.table} (${columns.join(', ')}) VALUES (${placeholders})`,
                params
            );
            return res.json({ success: true, message: "Item created successfully.", id: result.insertId });
        }
    } catch (error) {
        console.error("❌ SQL Error in handleAdminSaveCurriculumItem:", error);
        res.json({ success: false, message: "Database error saving curriculum item" });
    }
};

// Delete a curriculum item ({ type, id }) — restricted to admin id 1
const handleAdminDeleteCurriculumItem = async (req, res) => {
    try {
        if (requireSuperAdmin(req, res) === null) return;

        const { type, id } = req.body;
        const config = CURRICULUM_TABLES[type];
        if (!config || !id) {
            return res.json({ success: false, message: "Invalid delete request." });
        }

        const [result] = await pool.query(`DELETE FROM ${config.table} WHERE id = ?`, [id]);
        if (result.affectedRows === 0) {
            return res.json({ success: false, message: "Item not found." });
        }
        res.json({ success: true, message: "Item deleted successfully." });
    } catch (error) {
        console.error("❌ SQL Error in handleAdminDeleteCurriculumItem:", error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') {
            return res.json({ success: false, message: "Cannot delete: this item is still referenced by existing questions." });
        }
        res.json({ success: false, message: "Database error deleting curriculum item" });
    }
};


// ===============================================
// PDF LIBRARY MANAGER
// ===============================================

// Helper: format bytes into a human readable size string (e.g. "2.4 MB")
const formatFileSize = (bytes) => {
    if (!bytes || bytes <= 0) return '0 KB';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
        size /= 1024;
        i++;
    }
    return `${size.toFixed(size >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
};

// Helper: save a base64 encoded PDF to disk, returns { publicUrl, sizeLabel }
const savePdfFile = (fileData, originalName) => {
    // Strip a possible data-url prefix (data:application/pdf;base64,....)
    const base64 = String(fileData).replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');

    const safeName = String(originalName || 'document.pdf')
        .replace(/[^a-zA-Z0-9آ-ی_.-]+/g, '_')
        .replace(/\.pdf$/i, '');
    const fileName = `${Date.now()}_${safeName}.pdf`;

    fs.mkdirSync(PDF_UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(PDF_UPLOAD_DIR, fileName), buffer);

    return {
        publicUrl: `${PDF_PUBLIC_PATH}${fileName}`,
        sizeLabel: formatFileSize(buffer.length)
    };
};

// List all PDFs (admin view includes inactive ones), with optional search / category filter
const handleAdminGetPdfs = async (req, res) => {
    try {
        const { search, category } = req.body || {};

        let sql = `
            SELECT id, title, description, category, category_label, subject, grade,
                   file_size, pages, download_url, uploaded_at, is_active, download_count
            FROM pdf_library
            WHERE 1=1
        `;
        const params = [];

        if (category && ['pamphlet', 'exam', 'guide'].includes(category)) {
            sql += ` AND category = ?`;
            params.push(category);
        }
        if (search && String(search).trim() !== '') {
            sql += ` AND (title LIKE ? OR description LIKE ? OR subject LIKE ? OR grade LIKE ?)`;
            const like = `%${String(search).trim()}%`;
            params.push(like, like, like, like);
        }

        sql += ` ORDER BY uploaded_at DESC`;

        const [pdfs] = await pool.query(sql, params);
        res.json({ success: true, pdfs });
    } catch (error) {
        console.error("❌ SQL Error in handleAdminGetPdfs:", error);
        res.json({ success: false, message: "Database error fetching PDF library" });
    }
};

// Create or update a PDF record. Accepts an optional base64 `file_data` + `file_name`
// (required on create, optional on edit to replace the existing file).
const handleAdminSavePdf = async (req, res) => {
    try {
        const {
            id, title, description, category, category_label,
            subject, grade, pages, is_active, file_data, file_name
        } = req.body;

        if (!title || String(title).trim() === '') {
            return res.json({ success: false, message: "Title is required." });
        }
        if (!category || !['pamphlet', 'exam', 'guide'].includes(category)) {
            return res.json({ success: false, message: "A valid category (pamphlet/exam/guide) is required." });
        }
        if (!subject || String(subject).trim() === '') {
            return res.json({ success: false, message: "Subject is required." });
        }
        if (!grade || String(grade).trim() === '') {
            return res.json({ success: false, message: "Grade is required." });
        }

        let fileInfo = null;
        if (file_data) {
            fileInfo = savePdfFile(file_data, file_name);
        }

        if (id) {
            // UPDATE existing record
            let sql = `
                UPDATE pdf_library
                SET title = ?, description = ?, category = ?, category_label = ?,
                    subject = ?, grade = ?, pages = ?, is_active = ?
            `;
            const params = [
                String(title).trim(),
                description || null,
                category,
                category_label || 'جزوه',
                String(subject).trim(),
                String(grade).trim(),
                parseInt(pages, 10) || 0,
                is_active ? 1 : 0
            ];

            if (fileInfo) {
                sql += `, download_url = ?, file_size = ?`;
                params.push(fileInfo.publicUrl, fileInfo.sizeLabel);
            }

            sql += ` WHERE id = ?`;
            params.push(id);

            const [result] = await pool.query(sql, params);
            if (result.affectedRows === 0) {
                return res.json({ success: false, message: "PDF not found." });
            }
            return res.json({ success: true, message: "PDF updated successfully.", id });
        } else {
            // CREATE requires an uploaded file
            if (!fileInfo) {
                return res.json({ success: false, message: "A PDF file is required for new entries." });
            }

            const [result] = await pool.query(
                `INSERT INTO pdf_library
                    (title, description, category, category_label, subject, grade, file_size, pages, download_url, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    String(title).trim(),
                    description || null,
                    category,
                    category_label || 'جزوه',
                    String(subject).trim(),
                    String(grade).trim(),
                    fileInfo.sizeLabel,
                    parseInt(pages, 10) || 0,
                    fileInfo.publicUrl,
                    is_active === undefined || is_active ? 1 : 0
                ]
            );
            return res.json({ success: true, message: "PDF uploaded successfully.", id: result.insertId });
        }
    } catch (error) {
        console.error("❌ Error in handleAdminSavePdf:", error);
        res.json({ success: false, message: "Server error saving PDF" });
    }
};

// Delete a PDF record (and its file when possible) — restricted to admin id 1
const handleAdminDeletePdf = async (req, res) => {
    try {
        if (requireSuperAdmin(req, res) === null) return;

        const pdfId = requirePost(req, res, 'pdf_id');
        if (pdfId === null) return;

        const [rows] = await pool.query("SELECT download_url FROM pdf_library WHERE id = ?", [pdfId]);
        if (rows.length === 0) {
            return res.json({ success: false, message: "PDF not found." });
        }

        const [result] = await pool.query("DELETE FROM pdf_library WHERE id = ?", [pdfId]);
        if (result.affectedRows === 0) {
            return res.json({ success: false, message: "PDF not found." });
        }

        // Best-effort removal of the file from disk
        try {
            const url = rows[0].download_url || '';
            if (url.startsWith(PDF_PUBLIC_PATH)) {
                const filePath = path.join(PDF_UPLOAD_DIR, path.basename(url));
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
        } catch (fileError) {
            console.warn("⚠️ Could not remove PDF file from disk:", fileError.message);
        }

        res.json({ success: true, message: "PDF deleted successfully." });
    } catch (error) {
        console.error("❌ SQL Error in handleAdminDeletePdf:", error);
        res.json({ success: false, message: "Database error deleting PDF" });
    }
};


// ===============================================
// INSERT QUESTIONS (Manual + Word/.docx Auto Import)
// ===============================================

// A .docx file is a ZIP archive; extract word/document.xml using only Node's zlib
// (no external unzip dependency needed).
const extractDocxDocumentXml = (buffer) => {
    // Locate the End Of Central Directory record (signature PK\x05\x06)
    let eocd = -1;
    for (let i = buffer.length - 22; i >= 0; i--) {
        if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd === -1) throw new Error('The uploaded file is not a valid .docx document.');

    const entryCount = buffer.readUInt16LE(eocd + 10);
    let offset = buffer.readUInt32LE(eocd + 16);

    for (let i = 0; i < entryCount; i++) {
        if (buffer.readUInt32LE(offset) !== 0x02014b50) break; // central directory signature
        const method = buffer.readUInt16LE(offset + 10);
        const compressedSize = buffer.readUInt32LE(offset + 20);
        const nameLength = buffer.readUInt16LE(offset + 28);
        const extraLength = buffer.readUInt16LE(offset + 30);
        const commentLength = buffer.readUInt16LE(offset + 32);
        const localHeaderOffset = buffer.readUInt32LE(offset + 42);
        const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);

        if (name === 'word/document.xml') {
            const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
            const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
            const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
            const data = buffer.slice(dataStart, dataStart + compressedSize);

            if (method === 0) return data.toString('utf8');              // stored
            if (method === 8) return zlib.inflateRawSync(data).toString('utf8'); // deflated
            throw new Error('Unsupported compression method inside the .docx file.');
        }

        offset += 46 + nameLength + extraLength + commentLength;
    }

    throw new Error('word/document.xml not found — please upload a valid .docx file.');
};

// Convert the raw document XML into plain text (paragraphs -> newlines, entities decoded)
const docxXmlToText = (xml) => {
    return xml
        .replace(/<w:tab[^>]*\/>/g, '\t')
        .replace(/<w:br[^>]*\/>/g, '\n')
        .replace(/<\/w:p>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replace(/&amp;/g, '&');
};

// Extract question blocks from plain text using the agreed tag format:
// <q>..</q>, <o1>..</o1> ... <o4>..</o4>, <ans>1-4</ans>, optional <desc>..</desc>
const parseQuestionsFromText = (text) => {
    const questions = [];
    const errors = [];

    const blocks = text.split(/<q>/i).slice(1); // content following each <q> opening tag

    blocks.forEach((block, index) => {
        const blockNumber = index + 1;
        const grabTag = (tag) => {
            const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
            return match ? match[1].trim() : null;
        };

        const questionMatch = block.match(/^([\s\S]*?)<\/q>/i);
        const questionText = questionMatch ? questionMatch[1].trim() : null;
        const options = [grabTag('o1'), grabTag('o2'), grabTag('o3'), grabTag('o4')];
        const ansRaw = grabTag('ans');
        const descriptive = grabTag('desc');
        const correctIndex = parseInt(ansRaw, 10);

        if (!questionText) {
            errors.push(`Question ${blockNumber}: missing or empty question text (</q> not found).`);
        } else if (options.some(o => o === null || o === '')) {
            const missing = options.map((o, i) => (o === null || o === '') ? `o${i + 1}` : null).filter(Boolean).join(', ');
            errors.push(`Question ${blockNumber}: missing or empty option tag(s): ${missing}.`);
        } else if (!correctIndex || correctIndex < 1 || correctIndex > 4) {
            errors.push(`Question ${blockNumber}: <ans> must be a number from 1 to 4 (found: "${ansRaw ?? 'nothing'}").`);
        } else {
            questions.push({
                text: questionText,
                options,
                correct_index: correctIndex,
                descriptive: descriptive || ''
            });
        }
    });

    return { questions, errors };
};

// Parse an uploaded .docx (base64) and return the extracted questions for review
const handleAdminParseQuestionsDocx = async (req, res) => {
    try {
        const fileData = requirePost(req, res, 'file_data');
        if (fileData === null) return;

        const base64 = String(fileData).replace(/^data:.*?;base64,/, '');
        const buffer = Buffer.from(base64, 'base64');

        const xml = extractDocxDocumentXml(buffer);
        const text = docxXmlToText(xml);
        const { questions, errors } = parseQuestionsFromText(text);

        if (questions.length === 0 && errors.length === 0) {
            return res.json({ success: false, message: 'No <q>...</q> blocks were found in the document.' });
        }

        res.json({ success: true, questions, errors, total_found: questions.length });
    } catch (error) {
        console.error("❌ Error in handleAdminParseQuestionsDocx:", error);
        res.json({ success: false, message: error.message || "Failed to parse the Word file." });
    }
};

// Insert a batch of questions (manual form or reviewed auto-import).
// All new questions are inserted as INACTIVE (غیرفعال).
const handleAdminInsertQuestions = async (req, res) => {
    try {
        const adminId = getAdminIdFromRequest(req);
        if (!adminId) {
            return res.json({ success: false, message: "No valid admin session found." });
        }

        const { questions, insert_type, meta } = req.body;
        if (!Array.isArray(questions) || questions.length === 0) {
            return res.json({ success: false, message: "No questions provided." });
        }

        // Validate every question before inserting anything
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.text || String(q.text).trim() === '') {
                return res.json({ success: false, message: `Question ${i + 1}: text is required.` });
            }
            if (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some(o => !o || String(o).trim() === '')) {
                return res.json({ success: false, message: `Question ${i + 1}: exactly 4 non-empty options are required.` });
            }
            const ci = parseInt(q.correct_index, 10);
            if (!ci || ci < 1 || ci > 4) {
                return res.json({ success: false, message: `Question ${i + 1}: correct answer index must be 1-4.` });
            }
        }

        const insertType = insert_type === 'اتوماتیک' ? 'اتوماتیک' : 'دستی';
        const m = meta || {};
        const validLevels = ['آسان', 'متوسط', 'سخت'];
        const level = validLevels.includes(m.level) ? m.level : 'متوسط';
        const gradeIds = toPositiveIds(m.grade_ids || m.grade_id);
        const topicIds = toPositiveIds(m.topic_ids || m.topic_id);
        const chapterIds = toPositiveIds(m.chapter_ids || m.chapter_id || m.mabhas_ids);

        const insertedIds = [];
        const failed = [];

        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            try {
                const [qResult] = await pool.query(
                    `INSERT INTO questions_tam24
                        (question_text, subject_id, grade_id, topic_id, chapter_id, difficulty_level, source, book, status, insert_type, admin_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'غیرفعال', ?, ?)`,
                    [
                        String(q.text).trim(),
                        m.subject_id || null,
                        gradeIds[0] || null,
                        topicIds[0] || null,   // UI "Chapter" is DB "topic_id"
                        chapterIds[0] || null, // UI "Mabhas" is DB "chapter_id"
                        level,
                        m.source || null,
                        m.book || null,
                        insertType,
                        adminId
                    ]
                );
                const questionId = qResult.insertId;
                await saveQuestionTags(questionId, { gradeIds, topicIds, chapterIds });

                const correctIndex = parseInt(q.correct_index, 10);
                for (let optIdx = 0; optIdx < 4; optIdx++) {
                    await pool.query(
                        "INSERT INTO options_tam24 (question_id, option_text, is_correct) VALUES (?, ?, ?)",
                        [questionId, String(q.options[optIdx]).trim(), optIdx + 1 === correctIndex ? 1 : 0]
                    );
                }

                if (q.descriptive && String(q.descriptive).trim() !== '') {
                    await pool.query(
                        "INSERT INTO descriptive_answers_tam24 (question_id, answer_text) VALUES (?, ?)",
                        [questionId, String(q.descriptive).trim()]
                    );
                }

                insertedIds.push(questionId);
            } catch (insertError) {
                console.error(`❌ Failed to insert question ${i + 1}:`, insertError);
                failed.push(i + 1);
            }
        }

        if (insertedIds.length === 0) {
            return res.json({ success: false, message: "Failed to insert any questions." });
        }

        res.json({
            success: true,
            message: `Inserted ${insertedIds.length} question(s) successfully${failed.length > 0 ? `, ${failed.length} failed` : ''}.`,
            inserted_ids: insertedIds,
            failed_indexes: failed
        });
    } catch (error) {
        console.error("❌ SQL Error in handleAdminInsertQuestions:", error);
        res.json({ success: false, message: "Database error inserting questions" });
    }
};


module.exports = {
    handleUpdateQuestion,
    handleAdminLogin,
    handleGetQuestionForEdit,
    handleFullUpdateQuestion,
    handleAdminGetSubjects,
    handleAdminGetGradesBySubject,
    handleAdminGetChaptersBySubject,
    handleAdminGetMabahesByChapter,
    getQuestionsByFilters,
    handleAdminVerify,
    handleAdminLogout,
    // Curriculum manager
    handleAdminGetCurriculum,
    handleAdminSaveCurriculumItem,
    handleAdminDeleteCurriculumItem,
    // PDF library manager
    handleAdminGetPdfs,
    handleAdminSavePdf,
    handleAdminDeletePdf,
    // Insert questions (manual + docx auto-import)
    handleAdminParseQuestionsDocx,
    handleAdminInsertQuestions
};