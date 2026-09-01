// controllers/userController.js
const db = require('../db');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { markManualTask } = require('./taskController');
const jwt = require('jsonwebtoken');

const { sendOtpSms } = require('../utils/sms');
const { encodeResultId } = require('../utils/hash');

// ===================== Native Crypto Password Helpers =====================
const hashPassword = (password) => {
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(16).toString('hex');
        crypto.scrypt(password, salt, 64, (err, derivedKey) => {
            if (err) reject(err);
            resolve(`${salt}:${derivedKey.toString('hex')}`);
        });
    });
};

const comparePassword = (password, storedHash) => {
    return new Promise((resolve, reject) => {
        const [salt, key] = storedHash.split(':');
        crypto.scrypt(password, salt, 64, (err, derivedKey) => {
            if (err) reject(err);
            resolve(key === derivedKey.toString('hex'));
        });
    });
};

// ===================== Helpers =====================
const getClientIp = (req) => {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length > 0) {
        return xff.split(',')[0].trim();
    }
    return req.socket?.remoteAddress || null;
};

const generateOtp = () => Math.floor(1000 + Math.random() * 9000).toString();

/**
 * Single-device session helper.
 * Every login stamps `last_login` and signs the JWT with that exact moment
 * (`loginAt`, unix seconds). The auth middleware rejects tokens whose
 * `loginAt` is older than the stored `last_login`, which means any newer
 * login (a second device) immediately invalidates all previous sessions.
 */
const issueSessionToken = async (userId, role, ip) => {
    const loginAt = Math.floor(Date.now() / 1000);
    await db.query(
        'UPDATE tam24_users SET last_login = FROM_UNIXTIME(?), last_login_ip = ? WHERE id = ?',
        [loginAt, ip, userId]
    );
    return jwt.sign(
        { id: userId, role, loginAt },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );
};

// ===================== get_user_info =====================
const handleGetUserInfo = async (req, res) => {
    if (process.env.DEV_MODE === 'true') {
        return res.json({
            success: true,
            data: {
                id: 999,
                username: 'dev_admin',
                email: 'admin@tam24.local',
                role: 'developer',
                first_name: 'Dev',
                last_name: 'User',
                avatar_url: 'https://ui-avatars.com/api/?name=Dev+User',
                bio: 'Mock user for development mode',
                social_links: { github: "https://github.com" },
                xp_level: 50,
                xp_points: 2500,
                trophies: 10,
                current_plan: 'premium',
                days_remaining: 365,
                status: 'active'
            }
        });
    }

    try {
        const userId = req.user.id;

        const [rows] = await db.query(`
                    SELECT
                        id, password_hash, username, email, phone, first_name, last_name, avatar_url, bio,
                        social_links, xp_level, xp_points, trophies, current_plan, plan_expires_at,
                        role, status, created_at, last_login, last_login_ip
                    FROM tam24_users
                    WHERE id = ?`,
            [userId]
        );

        if (rows.length === 0) {
            return res.json({ success: false, message: 'User not found' });
        }

        const user = rows[0];

        let daysRemaining = 0;
        if (user.plan_expires_at) {
            const now = new Date();
            const expires = new Date(user.plan_expires_at);
            const diffMs = expires - now;
            daysRemaining = diffMs > 0 ? Math.ceil(diffMs / (1000 * 60 * 60 * 24)) : 0;
        }

        const socialLinks = typeof user.social_links === 'string'
            ? JSON.parse(user.social_links)
            : (user.social_links || {});

        res.json({
            success: true,
            data: {
                ...user,
                social_links: socialLinks,
                days_remaining: daysRemaining,
                password_set: !!user.password_hash,
                password_hash: undefined,
                plan_expires_at: undefined
            }
        });

    } catch (error) {
        console.error('Error in get_user_info:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

// ===================== UPDATE PROFILE =====================
const handleUpdateProfile = async (req, res) => {
    if (process.env.DEV_MODE === 'true') {
        return res.json({ success: true, message: 'Profile updated (Dev Mode)' });
    }

    const userId = req.user.id;
    const { first_name, last_name, email, bio, social_links, currentPass, newPass } = req.body;

    try {
        const [users] = await db.query(
            'SELECT password_hash FROM tam24_users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.json({ success: false, message: 'User not found' });
        }

        const user = users[0];
        let finalPasswordHash = user.password_hash;
        let passwordWasSet = false;  // ← tracks whether password changed this request

        if (newPass) {
            if (user.password_hash) {
                if (!currentPass) {
                    return res.json({ success: false, message: 'لطفا رمز عبور فعلی را وارد کنید' });
                }
                const isMatch = await comparePassword(currentPass, user.password_hash);
                if (!isMatch) {
                    return res.json({ success: false, message: 'رمز عبور فعلی اشتباه است' });
                }
            }
            finalPasswordHash = await hashPassword(newPass);
            passwordWasSet = true;  // ← only true when we actually hashed a new password
        }

        const socialLinksString = typeof social_links === 'object'
            ? JSON.stringify(social_links)
            : JSON.stringify({});

        await db.query(`
                    UPDATE tam24_users
                    SET first_name = ?, last_name = ?, email = ?, bio = ?, social_links = ?, password_hash = ?
                    WHERE id = ?`,
            [first_name || '', last_name || '', email || null, bio || null, socialLinksString, finalPasswordHash, userId]
        );

        // Task 8: user set their name
        if (first_name || last_name) {
            await markManualTask(userId, 8).catch(err =>
                console.error('markManualTask(8) failed:', err)
            );
        }

        // Task 9: user set/changed their password
        if (passwordWasSet) {
            await markManualTask(userId, 9).catch(err =>
                console.error('markManualTask(9) failed:', err)
            );
        }

        return res.json({
            success: true,
            message: 'اطلاعات با موفقیت بروزرسانی شد',
            password_set: !!finalPasswordHash,
        });

    } catch (error) {
        console.error('Error in handleUpdateProfile:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};



// ===================== guest_login =====================
const handleGuestLogin = async (req, res) => {
    try {
        const guestUsername = `guest_${crypto.randomBytes(4).toString('hex')}`;
        const planExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const ip = getClientIp(req);

        const [result] = await db.query(`
                    INSERT INTO tam24_users
                    (username, role, current_plan, plan_expires_at, first_name, last_name, last_login_ip)
                    VALUES (?, 'guest', 'guest_pass', ?, 'Guest', 'User', ?)`,
            [guestUsername, planExpiresAt, ip]
        );

        const guestId = result.insertId;
        const guestToken = Buffer.from(JSON.stringify({ id: guestId, role: 'guest' })).toString('base64');

        await db.query('UPDATE tam24_users SET last_login = NOW() WHERE id = ?', [guestId]);

        res.json({
            success: true,
            token: guestToken,
            data: { id: guestId, username: guestUsername, role: 'guest' }
        });
    } catch (error) {
        console.error('Error in guest_login:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

// ===================== password_login =====================
const handlePasswordLogin = async (req, res) => {
    const { phone, password } = req.body;

    if (!phone || !password) {
        return res.json({ success: false, message: 'شماره موبایل و رمز عبور الزامی است.' });
    }

    try {
        const [users] = await db.query('SELECT id, role, password_hash FROM tam24_users WHERE phone = ?', [phone]);

        if (users.length === 0) {
            return res.json({ success: false, message: 'کاربری با این شماره موبایل یافت نشد.' });
        }

        const user = users[0];

        if (!user.password_hash) {
            return res.json({ success: false, message: 'برای این حساب رمز عبوری تنظیم نشده است. لطفاً با رمز یکبار مصرف وارد شوید.' });
        }

        const isMatch = await comparePassword(password, user.password_hash);
        if (!isMatch) {
            return res.json({ success: false, message: 'شماره موبایل یا رمز عبور اشتباه است.' });
        }

        const ip = getClientIp(req);

        // Single-session JWT: stamps last_login and invalidates older sessions
        const token = await issueSessionToken(user.id, user.role, ip);

        res.json({ success: true, token, data: { id: user.id, phone, role: user.role } });
    } catch (error) {
        console.error('Error in password_login:', error);
        res.status(500).json({ success: false, message: 'خطای داخلی سرور. لطفاً بعداً دوباره تلاش کنید.' });
    }
};


// ===================== OTP send/verify =====================
const handleSendOtp = async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.json({ success: false, message: 'شماره موبایل الزامی است.' });

    try {
        const code = generateOtp();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        const ip = getClientIp(req);

        await db.query(`
                    INSERT INTO tam24_otps (phone, code, expires_at, ip)
                    VALUES (?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE code = ?, expires_at = ?, ip = ?`,
            [phone, code, expiresAt, ip, code, expiresAt, ip]
        );

        const smsResult = await sendOtpSms(phone, code);

        if (!smsResult.success) {
            return res.json({ success: false, message: smsResult.error });
        }

        const [users] = await db.query('SELECT id FROM tam24_users WHERE phone = ?', [phone]);
        const isNewUser = users.length === 0;

        res.json({ success: true, message: 'کد تایید با موفقیت ارسال شد.', isNewUser });
    } catch (error) {
        console.error('Error in handleSendOtp:', error);
        res.status(500).json({ success: false, message: 'خطا در ارسال کد تایید. لطفاً دوباره تلاش کنید.' });
    }
};

const handleVerifyOtp = async (req, res) => {
    const { phone, code, password} = req.body;

    try {
        const [otps] = await db.query(
            'SELECT * FROM tam24_otps WHERE phone = ? AND code = ? AND expires_at > UTC_TIMESTAMP()',
            [phone, code]
        );

        if (otps.length === 0) {
            return res.json({ success: false, message: 'کد وارد شده اشتباه یا منقضی شده است.' });
        }

        let [users] = await db.query('SELECT id, role FROM tam24_users WHERE phone = ?', [phone]);
        let userId;
        let role = 'user';
        const ip = getClientIp(req);

        if (users.length === 0) {
            const hashedPassword = password ? await hashPassword(password) : null;
            const firstName = 'کاربر';
            const lastName = 'مهمان';

            const [insertResult] = await db.query(`
                        INSERT INTO tam24_users (phone, username, first_name, last_name, password_hash, role, status, last_login_ip)
                        VALUES (?, ?, ?, ?, ?, 'user', 'active', ?)`,
                [phone, `user_${phone}`, firstName, lastName, hashedPassword, ip]
            );
            userId = insertResult.insertId;
        } else {
            userId = users[0].id;
            role = users[0].role;
        }

        await db.query('DELETE FROM tam24_otps WHERE phone = ?', [phone]);

        // Single-session JWT: stamps last_login and invalidates older sessions
        const token = await issueSessionToken(userId, role, ip);

        res.json({ success: true, isComplete: true, token, data: { id: userId, phone, role } });
    } catch (error) {
        console.error('Error in handleVerifyOtp:', error);
        res.status(500).json({ success: false, message: 'خطای داخلی سرور. لطفاً بعداً دوباره تلاش کنید.' });
    }
};


// ===================== FAVORITES =====================
const handleGetFavorites = async (req, res) => {
    try {
        const userId = req.user.id;

        const query = `
            SELECT
                q.*,
                f.date as favorited_at,
                s.title AS subject_title,
                t.title AS topic_title,
                c.title AS chapter_title,
                g.title AS grade_title,
                d.answer_text AS descriptive_answer
            FROM favorites_tam24 f
                     JOIN questions_tam24 q ON f.question_id = q.id
                     LEFT JOIN subjects_tam24 s ON q.subject_id = s.id
                     LEFT JOIN topics_tam24 t ON q.topic_id = t.id
                     LEFT JOIN chapters_tam24 c ON q.chapter_id = c.id
                     LEFT JOIN grades_tam24 g ON q.grade_id = g.id
                     LEFT JOIN descriptive_answers_tam24 d ON d.question_id = q.id
            WHERE f.user_id = ?
            ORDER BY f.date DESC
        `;
        const [rows] = await db.query(query, [userId]);

        const formattedData = await Promise.all(rows.map(async (row) => {
            const [optionsRows] = await db.query(
                `SELECT
                     id,
                     option_text,
                     COALESCE(CAST(is_correct AS UNSIGNED), 0) AS is_correct
                 FROM options_tam24
                 WHERE question_id = ?
                 ORDER BY id ASC`,
                [row.id]
            );

            const [imageRows] = await db.query(
                "SELECT image_name FROM question_images_tam24 WHERE question_id = ? ORDER BY id ASC",
                [row.id]
            );

            // رفع مشکل: تبدیل صریح مقدار دریافتی از دیتابیس به Number
            const correctIndex = optionsRows.findIndex(opt => Number(opt.is_correct) === 1);
            const finalCorrectIndex = correctIndex !== -1 ? correctIndex : 0;

            return {
                ...row,
                subject: row.subject_title || 'نامشخص',
                chapter: row.chapter_title || 'نامشخص',
                lesson: row.topic_title || 'نامشخص',
                grade: row.grade_title || 'نامشخص',

                options: optionsRows.map(opt => ({
                    id: Number(opt.id),
                    text: opt.option_text,
                    // رفع مشکل: تبدیل صریح به Number برای تشخیص درستی
                    isCorrect: Number(opt.is_correct) === 1
                })),

                correct_answer_index: finalCorrectIndex,
                images: imageRows.map(img => img.image_name),
                timestamp: row.favorited_at
            };
        }));

        res.json({ success: true, data: formattedData });
    } catch (error) {
        console.error('Error in get_favorites:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const handleAddFavorite = async (req, res) => {
    try {
        const userId = req.user.id;
        const { question_id } = req.body;
        const date = Date.now();

        await db.query(
            `INSERT IGNORE INTO favorites_tam24 (user_id, question_id, date) VALUES (?, ?, ?)`,
            [userId, question_id, date]
        );

        res.json({ success: true, message: 'Question added to favorites successfully' });
    } catch (error) {
        console.error('Error in add_favorite:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const handleRemoveFavorite = async (req, res) => {
    try {
        const userId = req.user.id;
        const { question_id } = req.body;

        await db.query(
            `DELETE FROM favorites_tam24 WHERE user_id = ? AND question_id = ?`,
            [userId, question_id]
        );

        res.json({ success: true, message: 'Question removed from favorites' });
    } catch (error) {
        console.error('Error in remove_favorite:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

// ===================== REPORTS =====================
const handleGetReports = async (req, res) => {
    try {
        const userId = req.user.id;

        const [rows] = await db.query(`
            SELECT
                r.id, r.question_id, r.issue as issueType, r.report_text as reportText,
                r.status, r.date as timestamp, r.note, q.question_text as questionText
            FROM reports_tam24 r
                LEFT JOIN questions_tam24 q ON r.question_id = q.id
            WHERE r.reporter_id = ? AND r.reporter = 'user'
            ORDER BY r.date DESC
        `, [userId]);

        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error in get_reports:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const handleReportQuestion = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.json({ success: false, message: 'لطفا ابتدا وارد حساب کاربری خود شوید.' });
        }

        // Fix: Replaced missing requirePost function with direct body extraction
        const questionId = req.body.question_id;
        const issue = req.body.issue;

        if (!questionId || !issue) {
            return res.json({ success: false, message: 'شناسه سوال و مشکل الزامی است.' });
        }

        let reportText = req.body.report_text;
        if (!reportText || reportText.trim() === "") {
            reportText = "بدون متن";
        }

        const reporterId = req.user.id;
        const reporter = 'user';
        const status = 'pending';
        const dateMs = Date.now();

        const sql = `
            INSERT INTO reports_tam24
                (question_id, issue, report_text, reporter, reporter_id, status, date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        await db.query(sql, [Number(questionId), issue, reportText, reporter, reporterId, status, dateMs]);

        res.json({ success: true, message: 'گزارش با موفقیت ثبت شد.' });
    } catch (error) {
        console.error("❌ SQL Error in handleReportQuestion:", error);
        res.json({ success: false, message: "Database error saving report" });
    }
};

// ===================== NOTES =====================
const handleGetNotes = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.json({ success: false, message: 'لطفا ابتدا وارد حساب کاربری خود شوید.' });
        }
        const userId = req.user.id;

        // اضافه شدن LEFT JOIN برای descriptive_answers_tam24
        const [notes] = await db.query(`
            SELECT
                n.id AS note_id, n.question_id, n.note_text, n.timestamp,
                q.question_text AS questionText, q.difficulty_level,
                s.title AS subject, t.title AS topic, c.title AS chapter,
                d.answer_text AS descriptive_answer
            FROM notes_tam24 n
                     JOIN questions_tam24 q ON n.question_id = q.id
                     LEFT JOIN subjects_tam24 s ON q.subject_id = s.id
                     LEFT JOIN topics_tam24 t ON q.topic_id = t.id
                     LEFT JOIN chapters_tam24 c ON q.chapter_id = c.id
                     LEFT JOIN descriptive_answers_tam24 d ON q.id = d.question_id
            WHERE n.user_id = ?
            ORDER BY n.timestamp DESC
        `, [userId]);

        const formattedNotes = await Promise.all(notes.map(async (note) => {
            // دریافت گزینه‌ها به همراه وضعیت صحیح بودن
            const [optionsRows] = await db.query(
                "SELECT id, option_text, COALESCE(CAST(is_correct AS UNSIGNED), 0) AS is_correct FROM options_tam24 WHERE question_id = ? ORDER BY id ASC",
                [note.question_id]
            );

            // استخراج متون گزینه‌ها به صورت آرایه استرینگ
            const options = optionsRows.map(opt => opt.option_text);

            // پیدا کردن ایندکس گزینه صحیح (از صفر شروع می‌شود)
            const correctAnswerIndex = optionsRows.findIndex(opt => Number(opt.is_correct) === 1);

            // دریافت تصاویر
            const [imageRows] = await db.query(
                "SELECT image_name FROM question_images_tam24 WHERE question_id = ? ORDER BY id ASC",
                [note.question_id]
            );
            const images = imageRows.map(img => img.image_name);

            return {
                id: note.note_id, // ارسال به عنوان id برای راحتی فرانت‌اند
                questionId: note.question_id,
                questionText: note.questionText,
                difficulty: note.difficulty_level,
                subject: note.subject,
                topic: note.topic,
                chapter: note.chapter,
                noteText: note.note_text,
                timestamp: note.timestamp,
                descriptiveAnswer: note.descriptive_answer,
                date: new Date(Number(note.timestamp)).toLocaleDateString('fa-IR'),
                options: options,
                correctAnswerIndex: correctAnswerIndex,
                images: images,
                has_image: images.length > 0
            };
        }));

        res.json({ success: true, data: formattedNotes });
    } catch (error) {
        console.error('Error in handleGetNotes:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error while fetching notes' });
    }
};


const handleAddNote = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.json({ success: false, message: 'لطفا ابتدا وارد حساب کاربری خود شوید.' });
        }
        const userId = req.user.id;
        const questionId = req.body.question_id;
        const noteText = req.body.note_text;

        if (!questionId || !noteText || String(noteText).trim() === '') {
            return res.json({ success: false, message: 'شناسه سوال و متن یادداشت الزامی است.' });
        }

        const timestamp = Date.now();
        const sql = `INSERT INTO notes_tam24 (user_id, question_id, note_text, timestamp) VALUES (?, ?, ?, ?)`;

        await db.query(sql, [userId, Number(questionId), noteText, timestamp]);

        res.json({ success: true, message: 'یادداشت با موفقیت ثبت شد.' });
    } catch (error) {
        console.error('Error in handleAddNote:', error);
        res.status(500).json({ success: false, message: 'Database error saving note' });
    }
};

const handleDeleteNote = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.json({ success: false, message: 'لطفا ابتدا وارد حساب کاربری خود شوید.' });
        }
        const userId = req.user.id;
        const noteId = req.body.note_id;

        if (!noteId) {
            return res.json({ success: false, message: 'شناسه یادداشت الزامی است.' });
        }

        const sql = `DELETE FROM notes_tam24 WHERE id = ? AND user_id = ?`;
        const [result] = await db.query(sql, [Number(noteId), userId]);

        if (result.affectedRows === 0) {
            return res.json({ success: false, message: 'یادداشت پیدا نشد یا شما دسترسی حذف آن را ندارید.' });
        }

        res.json({ success: true, message: 'یادداشت با موفقیت حذف شد.' });
    } catch (error) {
        console.error('Error in handleDeleteNote:', error);
        res.status(500).json({ success: false, message: 'Database error deleting note' });
    }
};

// ===================== REVIEW LATER =====================
const handleAddReviewLater = async (req, res) => {
    const userId = req.user.id;
    const { question_id } = req.body;

    if (!question_id) {
        return res.json({ success: false, message: 'Question ID is required.' });
    }

    try {
        const query = `
            INSERT INTO review_later_tam24 (user_id, question_id)
            VALUES (?, ?)
                ON DUPLICATE KEY UPDATE added_at = CURRENT_TIMESTAMP
        `;

        await db.query(query, [userId, question_id]);

        return res.json({ success: true, message: 'Question successfully added to your review list.' });
    } catch (error) {
        console.error('Error in handleAddReviewLater:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const handleRemoveReviewLater = async (req, res) => {
    const userId = req.user.id;
    const { question_id } = req.body;

    if (!question_id) {
        return res.json({ success: false, message: 'Question ID is required.' });
    }

    try {
        const query = 'DELETE FROM review_later_tam24 WHERE user_id = ? AND question_id = ?';
        const [result] = await db.query(query, [userId, question_id]);

        if (result.affectedRows === 0) {
            return res.json({ success: false, message: 'Question was not found in your review list.' });
        }

        return res.json({ success: true, message: 'Question successfully removed from your review list.' });
    } catch (error) {
        console.error('Error in handleRemoveReviewLater:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const handleGetReviewLaterQuestions = async (req, res) => {
    const userId = req.user.id;

    try {
        // اضافه کردن LEFT JOIN برای پاسخ تشریحی
        const query = `
            SELECT
                q.*, rl.added_at, s.title AS subject_title, t.title AS topic_title,
                c.title AS chapter_title, g.title AS grade_title,
                d.answer_text AS descriptive_answer
            FROM review_later_tam24 rl
                     JOIN questions_tam24 q ON rl.question_id = q.id
                     LEFT JOIN subjects_tam24 s ON q.subject_id = s.id
                     LEFT JOIN topics_tam24 t ON q.topic_id = t.id
                     LEFT JOIN chapters_tam24 c ON q.chapter_id = c.id
                     LEFT JOIN grades_tam24 g ON q.grade_id = g.id
                     LEFT JOIN descriptive_answers_tam24 d ON q.id = d.question_id
            WHERE rl.user_id = ?
            ORDER BY rl.added_at DESC
        `;

        const [questions] = await db.query(query, [userId]);

        const processedQuestions = await Promise.all(questions.map(async (question) => {
            // استخراج گزینه‌ها و وضعیت صحیح بودن
            const [optionsRows] = await db.query(
                "SELECT id, option_text, COALESCE(CAST(is_correct AS UNSIGNED), 0) AS is_correct FROM options_tam24 WHERE question_id = ? ORDER BY id ASC",
                [question.id]
            );

            // استخراج تصاویر
            const [imageRows] = await db.query(
                "SELECT image_name FROM question_images_tam24 WHERE question_id = ? ORDER BY id ASC",
                [question.id]
            );

            const correctAnswerIndex = optionsRows.findIndex(opt => Number(opt.is_correct) === 1);

            // تبدیل سختی سوال به فرمت فرانت اند
            let diff = 'easy';
            if (question.difficulty_level === 'متوسط' || question.difficulty_level === 'medium') diff = 'medium';
            if (question.difficulty_level === 'سخت' || question.difficulty_level === 'hard') diff = 'hard';

            return {
                id: question.id,
                text: question.question_text,
                image: imageRows.length > 0 ? imageRows[0].image_name : undefined,
                options: optionsRows.map(opt => opt.option_text),
                correctAnswerIndex: correctAnswerIndex,
                userAnswerIndex: null, // در حالت مرور، چون تاریخچه آزمون نداریم نال می‌فرستیم
                descriptiveAnswer: question.descriptive_answer,
                difficulty: diff,
                date: new Date(question.added_at).toLocaleDateString('fa-IR'),
                timestamp: new Date(question.added_at).getTime(),
                lesson: question.subject_title || 'نامشخص',
                subject: question.topic_title || 'نامشخص',
                chapter: question.chapter_title || 'نامشخص',
                grade: question.grade_title || 'نامشخص'
            };
        }));

        // فرانت اند انتظار آرایه ای با کلید data را دارد
        return res.json({ success: true, data: processedQuestions });
    } catch (error) {
        console.error('Error in handleGetReviewLaterQuestions:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

// ===================== AVATAR UPLOAD =====================
const handleUploadAvatar = async (req, res) => {
    try {
        const userId = req.user.id;
        const file = req.file;

        if (!file) {
            return res.json({ success: false, message: "فایلی برای آپلود یافت نشد." });
        }

        const avatarUrl = `/avatars/${file.filename}`;

        const [result] = await db.query(
            'UPDATE tam24_users SET avatar_url = ? WHERE id = ?',
            [avatarUrl, userId]
        );

        if (result.affectedRows === 0) {
            return res.json({ success: false, message: "کاربر یافت نشد." });
        }

        // Task 10: user uploaded an avatar
        await markManualTask(userId, 10).catch(err =>
            console.error('markManualTask(10) failed:', err)
        );

        return res.json({
            success: true,
            message: "آواتار با موفقیت بروزرسانی شد.",
            avatarUrl,
        });

    } catch (error) {
        console.error("Error uploading avatar:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};


// ===================== RESET AVATAR =====================
const handleResetAvatar = async (req, res) => {
    try {
        const userId = req.user.id;
        const defaultAvatarUrl = '/user_default.png';

        // 1. Get the user's current avatar from the database
        const [users] = await db.query(
            'SELECT avatar_url FROM tam24_users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.json({ success: false, message: "کاربر یافت نشد." });
        }

        const currentAvatarUrl = users[0].avatar_url;

        // 2. If it's not the default avatar, delete the file from the server
        if (currentAvatarUrl && currentAvatarUrl !== defaultAvatarUrl) {
            // Extract the filename and construct the absolute path to the file
            // Note: Adjust the '../public' path if your folder structure requires it
            const filePath = path.join(__dirname, '../../public', currentAvatarUrl);

            // Check if file exists, then delete
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        // 3. Update the database to set the avatar_url back to the default
        await db.query(
            'UPDATE tam24_users SET avatar_url = ? WHERE id = ?',
            [defaultAvatarUrl, userId]
        );

        return res.json({
            success: true,
            message: "آواتار با موفقیت حذف و به حالت پیش‌فرض بازگشت.",
            avatarUrl: defaultAvatarUrl
        });

    } catch (error) {
        console.error("Error resetting avatar:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
// --- Save/Update User Activity (Daily Time Spent) ---
const saveUserActivity = async (req, res) => {
    // Get user ID and the amount of active seconds in the current interval from the client
    const { user_id, seconds } = req.body;

    if (!user_id || !seconds) {
        return res.status(400).json({ success: false, message: "user_id and seconds are required" });
    }

    try {
        // If no record exists for the user today, insert a new one.
        // If it exists, add the new seconds to the existing time_spent_seconds (UPSERT).
        const query = `
            INSERT INTO tam24_user_activities (user_id, activity_date, time_spent_seconds)
            VALUES (?, CURDATE(), ?)
                ON DUPLICATE KEY UPDATE time_spent_seconds = time_spent_seconds + VALUES(time_spent_seconds)
        `;

        await db.execute(query, [user_id, seconds]);

        return res.json({ success: true, message: "Activity time updated successfully" });
    } catch (error) {
        console.error("Error saving user activity:", error);
        return res.status(500).json({ success: false, message: "Database error" });
    }
};

// --- Track Page Views / Visitors ---
const trackViewCount = async (req, res) => {
    // Get the page name/path from the client
    const { view } = req.body;

    // Extract IP address and User Agent from the request headers
    const ip_address = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const user_agent = req.headers['user-agent'] || 'Unknown';

    if (!view) {
        return res.status(400).json({ success: false, message: "page_view is required" });
    }

    try {
        // Insert a new record for every visit/page view
        const query = `
            INSERT INTO tam24_visitor_counts (page_view, ip_address, user_agent)
            VALUES (?, ?, ?)
        `;

        await db.execute(query, [view, ip_address, user_agent]);

        return res.json({ success: true, message: "View tracked successfully" });
    } catch (error) {
        console.error("Error tracking view count:", error);
        return res.status(500).json({ success: false, message: "Database error" });
    }
};


// ===================== QUIZ HISTORY =====================
// Full quiz history for the current user: quiz_results joined with quizzes.
const handleGetQuizHistory = async (req, res) => {
    try {
        const userId = req.user.id;

        const [rows] = await db.query(`
            SELECT
                r.id                 AS resultId,
                r.quiz_id            AS quizId,
                q.title              AS title,
                q.quiz_type          AS quizType,
                q.difficulty         AS difficulty,
                q.status             AS status,
                r.accuracy_rate      AS accuracyRate,
                r.correct_count      AS correctCount,
                r.incorrect_count    AS incorrectCount,
                r.unanswered_count   AS unansweredCount,
                r.total_score        AS totalScore,
                r.total_time_spent   AS totalTimeSpent,
                r.created_at         AS createdAt
            FROM quiz_results r
            JOIN quizzes q ON r.quiz_id = q.id
            WHERE r.user_id = ?
            ORDER BY r.created_at DESC
        `, [userId]);

        // Encrypt result ids for /result/:resultId (same scheme as QuizResultView)
        const data = rows.map((row) => ({
            ...row,
            resultId: encodeResultId(row.resultId),
        }));

        return res.json({ success: true, data });
    } catch (error) {
        console.error('Error in get_quiz_history:', error);
        return res.status(500).json({ success: false, message: 'خطا در دریافت تاریخچه آزمون‌ها.' });
    }
};

// ===================== PUBLIC PDF LIBRARY =====================
const handleGetPublicPdfs = async (req, res) => {
    try {
        const { search, category } = req.body || {};

        let sql = `
            SELECT id, title, description, category, category_label, subject, grade,
                   file_size, pages, download_url, uploaded_at, download_count
            FROM pdf_library
            WHERE is_active = 1
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

        const [pdfs] = await db.query(sql, params);
        return res.json({ success: true, pdfs });
    } catch (error) {
        console.error('Error in get_pdfs:', error);
        return res.status(500).json({ success: false, message: 'خطا در دریافت فایل‌های کتابخانه.' });
    }
};

const handleTrackPdfDownload = async (req, res) => {
    try {
        const { pdf_id } = req.body;
        if (!pdf_id) {
            return res.json({ success: false, message: 'شناسه فایل الزامی است.' });
        }

        const [result] = await db.query(
            'UPDATE pdf_library SET download_count = download_count + 1 WHERE id = ? AND is_active = 1',
            [Number(pdf_id)]
        );

        if (result.affectedRows === 0) {
            return res.json({ success: false, message: 'فایل مورد نظر یافت نشد.' });
        }

        return res.json({ success: true });
    } catch (error) {
        console.error('Error in track_pdf_download:', error);
        return res.status(500).json({ success: false, message: 'خطا در ثبت دانلود.' });
    }
};

// ===================== PAYMENT HISTORY =====================
// Full payment history from the payments table (joined with plan names).
const handleGetPaymentHistory = async (req, res) => {
    try {
        const userId = req.user.id;

        const [rows] = await db.query(`
            SELECT
                p.id,
                p.plan_id              AS planId,
                COALESCE(sp.name, p.plan_id) AS planName,
                sp.days                AS planDays,
                p.base_price           AS basePrice,
                p.plan_discount_percent AS planDiscountPercent,
                p.plan_discount_amount AS planDiscountAmount,
                p.coupon_percent       AS couponPercent,
                p.coupon_discount_amount AS couponDiscountAmount,
                p.final_price          AS finalPrice,
                p.currency,
                p.status,
                p.gateway,
                p.ref_id               AS refId,
                p.description,
                p.requested_at         AS requestedAt,
                p.paid_at              AS paidAt
            FROM payments p
                     LEFT JOIN subscription_plans sp ON p.plan_id = sp.id
            WHERE p.user_id = ?
            ORDER BY p.created_at DESC
        `, [userId]);

        // Current plan snapshot for the subscription tab
        const [userRows] = await db.query(
            'SELECT current_plan, plan_expires_at FROM tam24_users WHERE id = ?',
            [userId]
        );

        let currentPlan = 'free';
        let planExpiresAt = null;
        let daysRemaining = 0;

        if (userRows.length > 0) {
            const u = userRows[0];
            const isActive = u.plan_expires_at && new Date(u.plan_expires_at).getTime() > Date.now();
            if (isActive) {
                currentPlan = u.current_plan || 'free';
                planExpiresAt = u.plan_expires_at;
                daysRemaining = Math.ceil((new Date(u.plan_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            }
        }

        return res.json({
            success: true,
            data: {
                payments: rows,
                subscription: { currentPlan, planExpiresAt, daysRemaining }
            }
        });
    } catch (error) {
        console.error('Error in get_payment_history:', error);
        return res.status(500).json({ success: false, message: 'خطا در دریافت تاریخچه پرداخت‌ها.' });
    }
};

// ===================== MY INVITES =====================
// Full list of users invited by the current user (referrer_code_submitted match).
const handleGetMyInvites = async (req, res) => {
    try {
        const userId = req.user.id;

        const [userRows] = await db.query(
            'SELECT phone, username FROM tam24_users WHERE id = ?',
            [userId]
        );

        if (userRows.length === 0) {
            return res.json({ success: false, message: 'کاربر یافت نشد.' });
        }

        const { phone, username } = userRows[0];

        const [invites] = await db.query(`
            SELECT
                id,
                CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) AS name,
                phone      AS invited_phone,
                status,
                created_at AS createdAt
            FROM tam24_users
            WHERE referrer_code_submitted = ? OR referrer_code_submitted = ?
            ORDER BY created_at DESC
        `, [phone || '', username || '']);

        return res.json({
            success: true,
            data: {
                list: invites,
                totalInvited: invites.length,
                activeInvites: invites.filter(i => i.status === 'active').length
            }
        });
    } catch (error) {
        console.error('Error in get_my_invites:', error);
        return res.status(500).json({ success: false, message: 'خطا در دریافت لیست دعوت‌ها.' });
    }
};

module.exports = {
    handleGetUserInfo,
    handleGuestLogin,
    handleVerifyOtp,
    handleSendOtp,
    handlePasswordLogin,
    handleUpdateProfile,
    handleGetFavorites,
    handleAddFavorite,
    handleRemoveFavorite,
    handleGetReports,
    handleGetNotes,
    handleAddNote,
    handleDeleteNote,
    handleReportQuestion,
    handleAddReviewLater,
    handleRemoveReviewLater,
    handleGetReviewLaterQuestions,
    // handleGetDashboardData,
    handleUploadAvatar,
    handleResetAvatar,
    saveUserActivity,
    trackViewCount,
    handleGetQuizHistory,
    handleGetPublicPdfs,
    handleTrackPdfDownload,
    handleGetPaymentHistory,
    handleGetMyInvites
};