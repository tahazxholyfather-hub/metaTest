'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const aiProvider = require('./aiProvider');

const UPLOAD_DIR = path.resolve(__dirname, '../../../../public/uploads/ai-chat');
const PUBLIC_PREFIX = '/uploads/ai-chat';

function ensureDir() {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
ensureDir();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        ensureDir();
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const suffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
        cb(null, `chat-${suffix}${path.extname(file.originalname || '').slice(0, 8)}`);
    },
});

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);

/** Multer middleware for the student's message-bar image/file upload button. */
const uploadMiddleware = multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!ALLOWED_MIME.has(file.mimetype)) {
            return cb(new Error('UNSUPPORTED_FILE_TYPE'));
        }
        cb(null, true);
    },
}).single('image');

function publicUrlFor(filename) {
    return `${PUBLIC_PREFIX}/${filename}`;
}

/**
 * Ask the provider to generate an image, then persist it locally so it
 * survives even if the provider's own hosted URL later expires.
 */
async function generateAndStoreImage({ prompt, model, size }) {
    const result = await aiProvider.generateImage({ prompt, model, size });

    if (result.b64) {
        ensureDir();
        const filename = `gen-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.png`;
        fs.writeFileSync(path.join(UPLOAD_DIR, filename), Buffer.from(result.b64, 'base64'));
        return { url: publicUrlFor(filename), promptUsed: result.revisedPrompt || prompt, source: 'generated' };
    }

    if (result.url) {
        // Hosted by the provider's CDN — reference directly, no local copy needed.
        return { url: result.url, promptUsed: result.revisedPrompt || prompt, source: 'generated' };
    }

    throw new Error('EMPTY_IMAGE_RESULT');
}

module.exports = {
    uploadMiddleware,
    publicUrlFor,
    generateAndStoreImage,
    UPLOAD_DIR,
};
