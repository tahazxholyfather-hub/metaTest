'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { profile } = require('../runtimeMode');

const TYPES = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
};

function mediaDir() {
    const dir = path.join(profile.webRoot, 'blog-media');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

const blogUpload = multer({
    storage: multer.diskStorage({
        destination(_req, _file, cb) {
            cb(null, mediaDir());
        },
        filename(_req, file, cb) {
            const ext = TYPES[file.mimetype] || '';
            cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
        },
    }),
    limits: { fileSize: 80 * 1024 * 1024 },
    fileFilter(_req, file, cb) {
        if (TYPES[file.mimetype]) cb(null, true);
        else cb(new Error('فقط تصویر (jpg, png, webp, gif) یا ویدیو (mp4, webm, mov) مجاز است'));
    },
});

function rejectUpload(err, _req, res, next) {
    if (!err) return next();
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    res.status(400).json({
        success: false,
        message: tooBig ? 'حجم فایل زیاد است. تصویر تا ۱۲ مگابایت و ویدیو تا ۸۰ مگابایت.' : (err.message || 'آپلود ممکن نشد'),
    });
}

module.exports = { blogUpload, rejectUpload, TYPES };
