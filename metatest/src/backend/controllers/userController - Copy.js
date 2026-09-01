// controllers/userController.js
const db = require('../db');
const crypto = require('crypto');
const { sendOtpSms } = require('../utils/sms');
const pool = require("../db");

// ===================== Native Crypto Password Helpers =====================
// These use Node's built-in crypto module, requiring no external packages.

const hashPassword = (password) => {
    return new Promise((resolve, reject) => {
        // Generate a random 16-byte salt
        const salt = crypto.randomBytes(16).toString('hex');
        // Hash the password with the salt using scrypt (64-byte key length)
        crypto.scrypt(password, salt, 64, (err, derivedKey) => {
            if (err) reject(err);
            // Store as "salt:hash" so we can extract the salt later for comparison
            resolve(`${salt}:${derivedKey.toString('hex')}`);
        });
    });
};

const comparePassword = (password, storedHash) => {
    return new Promise((resolve, reject) => {
        const [salt, key] = storedHash.split(':');
        // Hash the input password with the extracted salt
        crypto.scrypt(password, salt, 64, (err, derivedKey) => {
            if (err) reject(err);
            // Compare the newly derived key with the stored key
            resolve(key === derivedKey.toString('hex'));
        });
    });
};

// ===================== Helpers =====================

// Helper to get client IP address, considering proxies
const getClientIp = (req) => {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length > 0) {
        return xff.split(',')[0].trim();
    }
    return req.socket?.remoteAddress || null;
};

// Helper to generate a 4-digit code
const generateOtp = () => Math.floor(1000 + Math.random() * 9000).toString();


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
                // Set true if password_hash exists and is not null/empty
                password_set: !!user.password_hash,
                // Security: Prevent the actual hash from being sent to the client
                password_hash: undefined,
                plan_expires_at: undefined
            }
        });

    } catch (error) {
        console.error('Error in get_user_info:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

// ===================== update_profile =====================
const handleUpdateProfile = async (req, res) => {
    // If dev mode, just simulate success
    if (process.env.DEV_MODE === 'true') {
        return res.json({ success: true, message: 'Profile updated (Dev Mode)' });
    }

    const userId = req.user.id;
    const {
        first_name,
        last_name,
        email,
        bio,
        social_links,
        currentPass,
        newPass
    } = req.body;

    try {
        // 1. Get current user to check password status
        const [users] = await db.query(
            'SELECT password_hash FROM tam24_users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.json({ success: false, message: 'User not found' });
        }

        const user = users[0];
        let finalPasswordHash = user.password_hash; // Keep existing by default

        // 2. Handle Password Update Logic
        if (newPass) {
            if (user.password_hash) {
                // User already has a password, verify the current one
                if (!currentPass) {
                    return res.json({ success: false, message: 'لطفا رمز عبور فعلی را وارد کنید' });
                }
                const isMatch = await comparePassword(currentPass, user.password_hash);
                if (!isMatch) {
                    return res.json({ success: false, message: 'رمز عبور فعلی اشتباه است' });
                }
                // Generate new hash
                finalPasswordHash = await hashPassword(newPass);
            } else {
                // User is setting password for the first time (no currentPass needed)
                finalPasswordHash = await hashPassword(newPass);
            }
        }

        // 3. Format social links for database
        const socialLinksString = typeof social_links === 'object'
            ? JSON.stringify(social_links)
            : JSON.stringify({});

        // 4. Update the database
        await db.query(`
            UPDATE tam24_users 
            SET 
                first_name = ?, 
                last_name = ?, 
                email = ?, 
                bio = ?, 
                social_links = ?, 
                password_hash = ?
            WHERE id = ?`,
            [
                first_name || '',
                last_name || '',
                email || null,
                bio || null,
                socialLinksString,
                finalPasswordHash,
                userId
            ]
        );

        res.json({
            success: true,
            message: 'اطلاعات با موفقیت بروزرسانی شد',
            password_set: !!finalPasswordHash
        });

    } catch (error) {
        console.error('Error in handleUpdateProfile:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
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

        const guestToken = Buffer.from(
            JSON.stringify({ id: guestId, role: 'guest' })
        ).toString('base64');

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
        return res.json({ success: false, message: 'Phone and password are required' });
    }

    try {
        const [users] = await db.query(
            'SELECT id, role, password_hash FROM tam24_users WHERE phone = ?',
            [phone]
        );

        if (users.length === 0) {
            return res.json({ success: false, message: 'User not found' });
        }

        const user = users[0];

        if (!user.password_hash) {
            return res.json({ success: false, message: 'Password not set for this account. Please use OTP.' });
        }

        // Use our native crypto compare function
        const isMatch = await comparePassword(password, user.password_hash);
        if (!isMatch) {
            return res.json({ success: false, message: 'Invalid credentials' });
        }

        const ip = getClientIp(req);
        await db.query(
            'UPDATE tam24_users SET last_login = NOW(), last_login_ip = ? WHERE id = ?',
            [ip, user.id]
        );

        const token = Buffer.from(
            JSON.stringify({ id: user.id, role: user.role })
        ).toString('base64');

        res.json({
            success: true,
            token,
            data: { id: user.id, phone, role: user.role }
        });
    } catch (error) {
        console.error('Error in password_login:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

// ===================== OTP send/verify =====================
const handleSendOtp = async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.json({ success: false, message: 'Phone number is required' });

    try {
        const code = generateOtp();
        // Set expiry to 5 minutes from now
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        const ip = getClientIp(req);

        // 1. Save or update OTP in database
        await db.query(`
            INSERT INTO tam24_otps (phone, code, expires_at, ip) 
            VALUES (?, ?, ?, ?) 
            ON DUPLICATE KEY UPDATE code = ?, expires_at = ?, ip = ?`,
            [phone, code, expiresAt, ip, code, expiresAt, ip]
        );

        // 2. Send SMS
        const smsResult = await sendOtpSms(phone, code);

        if (!smsResult.success) {
            return res.json({ success: false, message: smsResult.error });
        }

        // 3. Check if user already exists
        const [users] = await db.query('SELECT id FROM tam24_users WHERE phone = ?', [phone]);
        const isNewUser = users.length === 0;

        res.json({
            success: true,
            message: 'OTP sent successfully',
            isNewUser
        });
    } catch (error) {
        console.error('Error in handleSendOtp:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const handleVerifyOtp = async (req, res) => {
    const { phone, code, password} = req.body;

    try {
        // 1. Validate OTP using UTC_TIMESTAMP() to avoid timezone mismatch
        const [otps] = await db.query(
            'SELECT * FROM tam24_otps WHERE phone = ? AND code = ? AND expires_at > UTC_TIMESTAMP()',
            [phone, code]
        );

        if (otps.length === 0) {
            return res.json({ success: false, message: 'Invalid or expired OTP' });
        }

        // 2. Check User
        let [users] = await db.query('SELECT id, role FROM tam24_users WHERE phone = ?', [phone]);
        let userId;
        let role = 'user';
        const ip = getClientIp(req);

        if (users.length === 0) {
            //new user

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
            // Existing User Login Phase
            userId = users[0].id;
            role = users[0].role;
            await db.query(
                'UPDATE tam24_users SET last_login = NOW(), last_login_ip = ? WHERE id = ?',
                [ip, userId]
            );
        }

        // 3. Clear OTP
        await db.query('DELETE FROM tam24_otps WHERE phone = ?', [phone]);

        // 4. Generate Token (base64)
        const token = Buffer.from(JSON.stringify({ id: userId, role })).toString('base64');

        res.json({
            success: true,
            isComplete: true,
            token,
            data: { id: userId, phone, role }
        });

    } catch (error) {
        console.error('Error in handleVerifyOtp:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};



const handleGetDashboardData = async (req, res) => {
    // req.user is populated by your requireToken middleware in server.js
    const userId = req.user.id;

    try {
        // 1. Fetch User Data (XP, Trophies)
        const [users] = await db.query(
            'SELECT trophies, created_at FROM tam24_users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const user = users[0];

        // 2. Fetch User Answer Statistics (Calculate Accuracy)
        const [answerStats] = await db.query(`
            SELECT 
                COUNT(*) as total_questions,
                SUM(CASE WHEN status = 'correct' THEN 1 ELSE 0 END) as correct_answers,
                SUM(CASE WHEN status = 'wrong' THEN 1 ELSE 0 END) as wrong_answers,
                SUM(CASE WHEN status = 'unanswered' THEN 1 ELSE 0 END) as unanswered
            FROM tam24_user_answers 
            WHERE user_id = ?
        `, [userId]);

        const stats = answerStats[0];

        // Ensure values are numbers
        const correct = Number(stats.correct_answers) || 0;
        const wrong = Number(stats.wrong_answers) || 0;
        const totalAnswered = correct + wrong;

        // Calculate Accuracy: (Correct / Total Answered) * 100
        let accuracyRate = 0;
        if (totalAnswered > 0) {
            accuracyRate = Math.round((correct / totalAnswered) * 100);
        }

        // Mock practice time for now (e.g., 2 minutes per total questions encountered)
        const totalQ = Number(stats.total_questions) || 0;
        const practiceMinutes = totalQ * 2;
        const practiceHours = Math.floor(practiceMinutes / 60);
        const practiceDisplay = practiceHours > 0 ? `${practiceHours} ساعت` : (practiceMinutes > 0 ? `${practiceMinutes} دقیقه` : "۰ ساعت");

        // 3. Prepare Tasks (Default empty state missions)
        // This ensures the frontend TaskItem maps 'UserPlus' and 'Star' properly
        const tasks = {
            permanent: [
                {
                    title: "تکمیل پروفایل",
                    rewardXp: 50,
                    current: user.trophies > 0 ? 1 : 0,
                    target: 1,
                    icon: "UserPlus"
                },
                {
                    title: "اولین تمرین",
                    rewardXp: 100,
                    current: totalAnswered > 0 ? 1 : 0,
                    target: 1,
                    icon: "Star"
                }
            ],
            temporary: []
        };

        // 4. Construct the Payload strictly matching DashboardView.tsx expectations
        const dashboardData = {
            stats: {
                xp: user.trophies || 0,
                accuracy: accuracyRate > 0 ? `${accuracyRate}٪` : "۰٪",
                rank: "🔒 به زودی", // UI Lock implementation for rank
                practiceTime: practiceDisplay
            },
            tasks: tasks,
            invites: [], // Empty state
            topicMastery: [], // Empty state for radar chart
            activity: {
                '7d': [], // You can fetch from tam24_user_activity later
                '1m': [],
                '1y': []
            }
        };

        return res.status(200).json({
            success: true,
            data: dashboardData
        });

    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error while fetching dashboard.' });
    }
};



const handleGetFavorites = async (req, res) => {
    try {
        const userId = req.user.id;

        // Joins the favorites table with your questions table to return the full question object.

        const query = `
            SELECT q.*, f.date as favorited_at
            FROM favorites_tam24 f
            JOIN questions_tam24 q ON f.question_id = q.id
            WHERE f.user_id = ?
            ORDER BY f.date DESC
        `;

        const [rows] = await db.query(query, [userId]);

        // Parse options if they are stored as JSON strings in your database
        const formattedData = rows.map(row => ({
            ...row,
            options: typeof row.options === 'string' ? JSON.parse(row.options) : row.options,
            timestamp: row.favorited_at // Mapping the favorite date to the timestamp used for sorting in frontend
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

        // Using INSERT IGNORE prevents SQL errors if the user clicks favorite twice rapidly
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


// ===================== reports =====================
const handleGetReports = async (req, res) => {
    try {
        const userId = req.user.id; // Assuming requireToken middleware sets req.user

        // Query reports for the logged-in user and join with questions to get question_text
        const [rows] = await db.query(`
            SELECT 
                r.id, 
                r.question_id, 
                r.issue as issueType, 
                r.report_text as reportText, 
                r.status, 
                r.date as timestamp, 
                r.note,
                q.question_text as questionText
            FROM reports_tam24 r
            LEFT JOIN questions_tam24 q ON r.question_id = q.id
            WHERE r.reporter_id = ? AND r.reporter = 'user'
            ORDER BY r.date DESC
        `, [userId]);

        res.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error in get_reports:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};


const handleReportQuestion = async (req, res) => {
    try {
        // 1. Verify that the user is authenticated
        if (!req.user || !req.user.id) {
            return res.json({ success: false, message: 'لطفا ابتدا وارد حساب کاربری خود شوید.' });
        }

        const questionId = requirePost(req, res, 'question_id');
        const issue = requirePost(req, res, 'issue');

        if (questionId === null || issue === null) return;

        let reportText = req.body.report_text;
        if (!reportText || reportText.trim() === "") {
            reportText = "بدون متن";
        }

        // 2. Extract dynamic user information from the request
        const reporterId = req.user.id;
        // Use username, or first_name, or fallback to a default string if neither exists
        const reporter = 'user';

        const status = 'pending';
        const dateMs = Date.now();

        const sql = `
            INSERT INTO reports_tam24 
            (question_id, issue, report_text, reporter, reporter_id, status, date) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        // Assuming you are using 'db.query' globally in your controllers,
        // but keeping your 'pool.query' if that is what this specific file uses.
        // Change pool.query to db.query if this is inside userController.js
        await pool.query(sql, [
            Number(questionId), issue, reportText, reporter, reporterId, status, dateMs
        ]);

        res.json({ success: true, message: 'گزارش با موفقیت ثبت شد.' });
    } catch (error) {
        console.error("❌ SQL Error in handleReportQuestion:", error);
        res.json({ success: false, message: "Database error saving report" });
    }
};

// ===================== NOTES FUNCTIONS =====================

const handleGetNotes = async (req, res) => {
    try {
        // Check authentication
        if (!req.user || !req.user.id) {
            return res.json({ success: false, message: 'لطفا ابتدا وارد حساب کاربری خود شوید.' });
        }
        const userId = req.user.id;

        // Fetch notes and join with questions, subjects, topics, and chapters tables
        const [notes] = await db.query(`
            SELECT 
                n.id AS note_id, 
                n.question_id, 
                n.note_text, 
                n.timestamp,
                q.question_text AS questionText,
                q.difficulty_level,
                s.title AS subject,
                t.title AS topic,
                c.title AS chapter
            FROM notes_tam24 n
            JOIN questions_tam24 q ON n.question_id = q.id
            LEFT JOIN subjects_tam24 s ON q.subject_id = s.id
            LEFT JOIN topics_tam24 t ON q.topic_id = t.id
            LEFT JOIN chapters_tam24 c ON q.chapter_id = c.id
            WHERE n.user_id = ?
            ORDER BY n.timestamp DESC
        `, [userId]);

        // Loop through each note and fetch its options from the options_tam24 table
        const formattedNotes = await Promise.all(notes.map(async (note) => {
            const [optionsRows] = await db.query(
                "SELECT id, option_text FROM options_tam24 WHERE question_id = ? ORDER BY id ASC",
                [note.question_id]
            );

            const options = optionsRows.map(opt => ({
                id: Number(opt.id),
                text: opt.option_text
            }));

            // Optional: Fetch images for the question if your frontend expects it
            const [imageRows] = await db.query(
                "SELECT image_name FROM question_images_tam24 WHERE question_id = ? ORDER BY id ASC",
                [note.question_id]
            );
            const images = imageRows.map(img => img.image_name);

            return {
                ...note,
                date: new Date(Number(note.timestamp)).toLocaleDateString('fa-IR'),
                options: options,
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
        // Check authentication
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

        const sql = `
            INSERT INTO notes_tam24 (user_id, question_id, note_text, timestamp)
            VALUES (?, ?, ?, ?)
        `;

        await db.query(sql, [userId, Number(questionId), noteText, timestamp]);

        res.json({ success: true, message: 'یادداشت با موفقیت ثبت شد.' });
    } catch (error) {
        console.error('Error in handleAddNote:', error);
        res.status(500).json({ success: false, message: 'Database error saving note' });
    }
};

const handleDeleteNote = async (req, res) => {
    try {
        // Check authentication
        if (!req.user || !req.user.id) {
            return res.json({ success: false, message: 'لطفا ابتدا وارد حساب کاربری خود شوید.' });
        }
        const userId = req.user.id;
        const noteId = req.body.note_id;

        if (!noteId) {
            return res.json({ success: false, message: 'شناسه یادداشت الزامی است.' });
        }

        // Delete the note ONLY if it belongs to the authenticated user
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

        return res.json({
            success: true,
            message: 'Question successfully added to your review list.'
        });
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

        return res.json({
            success: true,
            message: 'Question successfully removed from your review list.'
        });
    } catch (error) {
        console.error('Error in handleRemoveReviewLater:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const handleGetReviewLaterQuestions = async (req, res) => {
    const userId = req.user.id;

    try {
        const query = `
            SELECT 
                q.*,
                rl.added_at,
                s.title AS subject_title,
                t.title AS topic_title,
                c.title AS chapter_title,
                g.title AS grade_title
            FROM review_later_tam24 rl
            JOIN questions_tam24 q ON rl.question_id = q.id
            LEFT JOIN subjects_tam24 s ON q.subject_id = s.id
            LEFT JOIN topics_tam24 t ON q.topic_id = t.id
            LEFT JOIN chapters_tam24 c ON q.chapter_id = c.id
            LEFT JOIN grades_tam24 g ON q.grade_id = g.id
            WHERE rl.user_id = ?
            ORDER BY rl.added_at DESC
        `;

        const [questions] = await db.query(query, [userId]);

        const processedQuestions = questions.map(question => {
            let parsedOptions = [];
            try {
                parsedOptions = typeof question.options === 'string' ? JSON.parse(question.options) : (question.options || []);
            } catch (e) {
                console.error(`Failed to parse options for question ID $${question.id}$`);
                parsedOptions = [];
            }

            return {
                ...question,
                options: parsedOptions,
                added_at_formatted: new Date(question.added_at).toISOString()
            };
        });

        return res.json({
            success: true,
            questions: processedQuestions
        });
    } catch (error) {
        console.error('Error in handleGetReviewLaterQuestions:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
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
    handleGetDashboardData
};
