const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MIME_EXT = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
};

let columnsReady = false;

function imageError(message) {
    const err = new Error(message);
    err.statusCode = 400;
    return err;
}

function matchesMagic(ext, buffer) {
    if (ext === 'jpg') {
        return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }
    if (ext === 'png') {
        return buffer.length >= 8
            && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    }
    if (ext === 'gif') {
        return buffer.length >= 6 && buffer.slice(0, 6).toString('ascii').startsWith('GIF8');
    }
    if (ext === 'webp') {
        return buffer.length >= 12
            && buffer.slice(0, 4).toString('ascii') === 'RIFF'
            && buffer.slice(8, 12).toString('ascii') === 'WEBP';
    }
    return false;
}

function parseImageDataUrl(value) {
    if (value == null || value === '') return null;
    if (typeof value !== 'string') throw imageError('فرمت عکس نامعتبر است.');
    const match = /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(value.trim());
    if (!match) throw imageError('فقط تصویر jpg، png، webp یا gif مجاز است.');
    const ext = MIME_EXT[match[1].toLowerCase()];
    const buffer = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
        throw imageError('حجم هر عکس باید کمتر از ۴ مگابایت باشد.');
    }
    if (!matchesMagic(ext, buffer)) throw imageError('فایل انتخاب‌شده یک تصویر معتبر نیست.');
    return { ext, buffer };
}

function validateQuestionImages(question) {
    parseImageDataUrl(question?.image);
    parseImageDataUrl(question?.descriptive_image);
    if (question?.option_images == null) return;
    if (!Array.isArray(question.option_images) || question.option_images.length > 4) {
        throw imageError('فرمت عکس گزینه‌ها نامعتبر است.');
    }
    question.option_images.forEach((image) => parseImageDataUrl(image));
}

async function columnExists(table, column) {
    const pool = require('../db');
    const [rows] = await pool.query(
        `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
    );
    return Number(rows[0]?.c) > 0;
}

async function ensureColumn(table, column, definition) {
    if (await columnExists(table, column)) return;
    const pool = require('../db');
    try {
        await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    } catch (err) {
        if (err && (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060)) return;
        throw err;
    }
}

async function ensureQuestionImageColumns() {
    if (columnsReady) return;
    await ensureColumn('options_tam24', 'image_name', 'VARCHAR(255) NULL DEFAULT NULL');
    await ensureColumn('descriptive_answers_tam24', 'image_name', 'VARCHAR(255) NULL DEFAULT NULL');
    columnsReady = true;
}

function sqlAlias(alias) {
    if (alias == null || alias === '') return '';
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(alias)) throw new Error('invalid sql alias');
    return `${alias}.`;
}

function optionImageSql(alias) {
    if (!columnsReady) return 'NULL AS image_name';
    return `${sqlAlias(alias)}image_name`;
}

function descriptiveImageSql(alias) {
    if (!columnsReady) return 'NULL AS image_name';
    return `${sqlAlias(alias)}image_name`;
}

function questionHasImageSql(questionAlias = 'q') {
    const alias = questionAlias && /^[A-Za-z_][A-Za-z0-9_]*$/.test(questionAlias) ? questionAlias : 'q';
    const stem = `EXISTS (SELECT 1 FROM question_images_tam24 qi WHERE qi.question_id = ${alias}.id)`;
    if (!columnsReady) return stem;
    return `(${stem} OR EXISTS (SELECT 1 FROM options_tam24 oi WHERE oi.question_id = ${questionAlias}.id AND oi.image_name IS NOT NULL AND oi.image_name <> '') OR EXISTS (SELECT 1 FROM descriptive_answers_tam24 di WHERE di.question_id = ${questionAlias}.id AND di.image_name IS NOT NULL AND di.image_name <> ''))`;
}

async function saveQuestionImage(dataUrl) {
    const parsed = parseImageDataUrl(dataUrl);
    if (!parsed) return null;
    const { profile } = require('../runtimeMode');
    const dir = path.join(profile.webRoot, 'images', 'questions');
    await fs.promises.mkdir(dir, { recursive: true });
    const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${parsed.ext}`;
    await fs.promises.writeFile(path.join(dir, name), parsed.buffer);
    return name;
}

module.exports = {
    MAX_IMAGE_BYTES,
    parseImageDataUrl,
    validateQuestionImages,
    ensureQuestionImageColumns,
    optionImageSql,
    descriptiveImageSql,
    questionHasImageSql,
    saveQuestionImage,
};
