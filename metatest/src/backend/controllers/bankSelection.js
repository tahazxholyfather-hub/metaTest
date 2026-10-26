const pool = require('../db');
const crypto = require('crypto');

const MAX_SELECTED = 50;

const ensureBankSelectionTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS bank_selections (
            id INT AUTO_INCREMENT PRIMARY KEY,
            code VARCHAR(12) NOT NULL,
            user_id INT NOT NULL,
            title VARCHAR(191) NULL,
            settings_json LONGTEXT NOT NULL,
            question_ids_json LONGTEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_bank_selection_code (code),
            KEY idx_bank_selection_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
};

const toIdList = (value, limit = 40) => (Array.isArray(value) ? value : [])
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0)
    .slice(0, limit);

const cleanSettings = (input) => {
    const src = input && typeof input === 'object' ? input : {};
    const difficulties = (Array.isArray(src.difficulties) ? src.difficulties : [])
        .map((item) => String(item))
        .filter((item) => ['آسان', 'متوسط', 'سخت'].includes(item));
    const memberLimit = Number(src.memberLimit);
    return {
        subjectIds: toIdList(src.subjectIds),
        gradeIds: toIdList(src.gradeIds),
        topicIds: toIdList(src.topicIds),
        mabhasIds: toIdList(src.mabhasIds),
        difficulties,
        search: String(src.search || '').slice(0, 120),
        mode: src.mode === 'auto' ? 'auto' : 'manual',
        autoCount: Math.min(MAX_SELECTED, Math.max(1, parseInt(src.autoCount, 10) || 10)),
        time: Math.min(300, Math.max(1, parseInt(src.time, 10) || 30)),
        isCustomTime: Boolean(src.isCustomTime),
        visibility: src.visibility === 'public' ? 'public' : 'private',
        memberLimit: [5, 10, 15].includes(memberLimit) ? memberLimit : 10,
        quizName: String(src.quizName || '').slice(0, 80),
    };
};

const parseJson = (value, fallback) => {
    if (value == null) return fallback;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};

const mintCode = async () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        const [rows] = await pool.query('SELECT id FROM bank_selections WHERE code = ? LIMIT 1', [code]);
        if (!rows.length) return code;
    }
    throw new Error('code');
};

const loadQuestionsByIds = async (ids) => {
    const clean = toIdList(ids, MAX_SELECTED);
    if (!clean.length) return [];
    const marks = clean.map(() => '?').join(',');
    const [rows] = await pool.query(
        `SELECT q.id, q.question_text, q.difficulty_level, q.subject_id, q.grade_id, q.topic_id, q.chapter_id,
                s.title AS subject_title, g.title AS grade_title, t.title AS topic_title, c.title AS chapter_title
         FROM questions_tam24 q
         LEFT JOIN subjects_tam24 s ON q.subject_id = s.id
         LEFT JOIN grades_tam24 g ON q.grade_id = g.id
         LEFT JOIN topics_tam24 t ON q.topic_id = t.id
         LEFT JOIN chapters_tam24 c ON q.chapter_id = c.id
         WHERE q.id IN (${marks})`,
        clean
    );
    const [optRows] = await pool.query(
        `SELECT id, question_id, option_text FROM options_tam24 WHERE question_id IN (${marks}) ORDER BY id ASC`,
        clean
    );
    const [imgRows] = await pool.query(
        `SELECT question_id, image_name FROM question_images_tam24 WHERE question_id IN (${marks}) ORDER BY id ASC`,
        clean
    );
    const optionsByQuestion = {};
    for (const opt of optRows) {
        if (!optionsByQuestion[opt.question_id]) optionsByQuestion[opt.question_id] = [];
        optionsByQuestion[opt.question_id].push({ id: Number(opt.id), text: opt.option_text });
    }
    const imagesByQuestion = {};
    for (const img of imgRows) {
        if (!imagesByQuestion[img.question_id]) imagesByQuestion[img.question_id] = img.image_name;
    }
    const byId = new Map(rows.map((row) => [Number(row.id), row]));
    return clean.map((id) => byId.get(id)).filter(Boolean).map((q) => ({
        id: Number(q.id),
        text: q.question_text,
        difficulty: q.difficulty_level || 'متوسط',
        subject_id: q.subject_id,
        grade_id: q.grade_id,
        topic_id: q.topic_id,
        chapter_id: q.chapter_id,
        subject_title: q.subject_title || '',
        grade_title: q.grade_title || '',
        topic_title: q.topic_title || '',
        chapter_title: q.chapter_title || '',
        image: imagesByQuestion[q.id] || null,
        options: optionsByQuestion[q.id] || [],
    }));
};

const handleSaveBankSelection = async (req, res) => {
    try {
        const userId = Number(req.user?.id);
        if (!userId) return res.status(401).json({ success: false, message: 'برای ذخیره باید وارد حساب شوید.' });

        await ensureBankSelectionTable();
        const settings = cleanSettings(req.body?.settings);
        const questionIds = toIdList(req.body?.question_ids, MAX_SELECTED);
        const title = String(req.body?.title || settings.quizName || 'انتخاب بانک تست').slice(0, 191);
        const requested = String(req.body?.code || '').trim().toUpperCase();

        const settingsJson = JSON.stringify(settings);
        const idsJson = JSON.stringify(questionIds);
        let code = '';
        if (requested) {
            const [owned] = await pool.query(
                'SELECT id FROM bank_selections WHERE code = ? AND user_id = ? LIMIT 1',
                [requested, userId]
            );
            if (owned.length) code = requested;
        }
        if (code) {
            await pool.query(
                `UPDATE bank_selections
                 SET title = ?, settings_json = ?, question_ids_json = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE code = ? AND user_id = ?`,
                [title, settingsJson, idsJson, code, userId]
            );
        } else {
            code = await mintCode();
            await pool.query(
                `INSERT INTO bank_selections (code, user_id, title, settings_json, question_ids_json)
                 VALUES (?, ?, ?, ?, ?)`,
                [code, userId, title, settingsJson, idsJson]
            );
        }

        return res.json({ success: true, code, title, count: questionIds.length });
    } catch (error) {
        console.error('save_bank_selection', error);
        return res.json({ success: false, message: 'ذخیره انتخاب‌ها انجام نشد.' });
    }
};

const handleGetBankSelection = async (req, res) => {
    try {
        const userId = Number(req.user?.id);
        if (!userId) return res.status(401).json({ success: false, message: 'برای بارگذاری باید وارد حساب شوید.' });
        const code = String(req.body?.code || '').trim().toUpperCase();
        if (!code) return res.json({ success: false, message: 'کد را وارد کنید.' });

        await ensureBankSelectionTable();
        const [rows] = await pool.query(
            'SELECT code, user_id, title, settings_json, question_ids_json, updated_at FROM bank_selections WHERE code = ? LIMIT 1',
            [code]
        );
        if (!rows.length) return res.json({ success: false, message: 'کدی با این مشخصات پیدا نشد.' });

        const row = rows[0];
        const settings = cleanSettings(parseJson(row.settings_json, {}));
        const questionIds = toIdList(parseJson(row.question_ids_json, []), MAX_SELECTED);
        const questions = await loadQuestionsByIds(questionIds);

        return res.json({
            success: true,
            code: row.code,
            title: row.title || settings.quizName || 'انتخاب ذخیره‌شده',
            settings,
            questions,
            owned: Number(row.user_id) === userId,
            updatedAt: row.updated_at,
        });
    } catch (error) {
        console.error('get_bank_selection', error);
        return res.json({ success: false, message: 'بارگذاری کد انجام نشد.' });
    }
};

const handleListBankSelections = async (req, res) => {
    try {
        const userId = Number(req.user?.id);
        if (!userId) return res.status(401).json({ success: false, message: 'وارد حساب شوید.' });
        await ensureBankSelectionTable();
        const [rows] = await pool.query(
            `SELECT code, title, question_ids_json, updated_at
             FROM bank_selections
             WHERE user_id = ?
             ORDER BY updated_at DESC
             LIMIT 30`,
            [userId]
        );
        const items = rows.map((row) => ({
            code: row.code,
            title: row.title || 'بدون نام',
            count: toIdList(parseJson(row.question_ids_json, []), MAX_SELECTED).length,
            updatedAt: row.updated_at,
        }));
        return res.json({ success: true, items });
    } catch (error) {
        console.error('list_bank_selections', error);
        return res.json({ success: false, message: 'فهرست ذخیره‌ها دریافت نشد.' });
    }
};

module.exports = {
    handleSaveBankSelection,
    handleGetBankSelection,
    handleListBankSelections,
};
