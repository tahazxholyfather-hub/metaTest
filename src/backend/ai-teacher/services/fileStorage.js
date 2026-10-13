'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { FILE_LIMITS } = require('../config');

/**
 * File storage abstraction for everything the AI subsystem persists:
 *
 *   /uploads/ai/images/     student-uploaded images (vision input)
 *   /uploads/ai/audio/      voice notes (STT input) and synthesized replies (TTS)
 *   /uploads/ai/pdfs/       PDF references attached to a conversation
 *   /uploads/ai/generated/  images Met generated
 *
 * Unique filenames, MIME + magic-byte validation, size limits from config,
 * optional image optimisation (sharp, when installed), and a metadata row in
 * tam24_ai_files for every stored asset.
 */

// Same web root the rest of the backend uses for avatars / PDF library.
const WEB_ROOT = FILE_LIMITS.uploadRoot
    ? path.resolve(FILE_LIMITS.uploadRoot)
    : path.resolve(__dirname, '../../../../public');
const BASE_DIR = path.join(WEB_ROOT, 'uploads', 'ai');
const PUBLIC_PREFIX = '/uploads/ai';

const KIND_DIRS = Object.freeze({
    image: 'images',
    audio: 'audio',
    tts_audio: 'audio',
    pdf: 'pdfs',
    generated_image: 'generated',
});

const IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);
const AUDIO_MIME = new Set([
    'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/wav', 'audio/x-wav',
    'audio/m4a', 'audio/x-m4a', 'audio/aac', 'video/webm',
]);
const PDF_MIME = new Set(['application/pdf']);

const EXT_BY_MIME = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
    'audio/webm': 'webm', 'video/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
    'audio/mp4': 'm4a', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/m4a': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac',
    'application/pdf': 'pdf',
};

let sharp = null;
try { sharp = require('sharp'); } catch { sharp = null; }

function dirFor(kind) {
    const sub = KIND_DIRS[kind];
    if (!sub) throw new Error(`Unknown file kind: ${kind}`);
    const dir = path.join(BASE_DIR, sub);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function publicUrlFor(kind, storedName) {
    return `${PUBLIC_PREFIX}/${KIND_DIRS[kind]}/${storedName}`;
}

function uniqueName(prefix, ext) {
    const stamp = Date.now().toString(36);
    const rand = crypto.randomBytes(8).toString('hex');
    return `${prefix}-${stamp}-${rand}.${String(ext || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 6).toLowerCase()}`;
}

function baseMime(m) {
    return String(m || '').split(';')[0].trim().toLowerCase();
}

/** Cheap content sniffing so a renamed executable can't masquerade as an image/PDF. */
function sniff(buffer) {
    if (!buffer || buffer.length < 12) return null;
    const b = buffer;
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
    if (b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
    if (b.slice(0, 4).toString('ascii') === 'GIF8') return 'image/gif';
    if (b.slice(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
    return null;
}

function assertContent(kind, buffer, declaredMime) {
    const declared = baseMime(declaredMime);
    if (kind === 'image') {
        const real = sniff(buffer);
        if (!real || !IMAGE_MIME.has(real)) throw Object.assign(new Error('UNSUPPORTED_FILE_TYPE'), { code: 'UNSUPPORTED_FILE_TYPE' });
        return real;
    }
    if (kind === 'pdf') {
        if (sniff(buffer) !== 'application/pdf') throw Object.assign(new Error('UNSUPPORTED_FILE_TYPE'), { code: 'UNSUPPORTED_FILE_TYPE' });
        return 'application/pdf';
    }
    if (kind === 'audio') {
        if (!AUDIO_MIME.has(declared)) throw Object.assign(new Error('UNSUPPORTED_FILE_TYPE'), { code: 'UNSUPPORTED_FILE_TYPE' });
        return declared;
    }
    return declared;
}

/**
 * Downscale + convert uploaded images to WebP so vision requests and the chat
 * history stay light. Falls back to the original bytes when sharp is missing
 * or the image can't be decoded (GIFs are kept as-is to preserve animation).
 */
async function optimizeImage(buffer, mime) {
    if (!sharp || mime === 'image/gif') return { buffer, mime, width: null, height: null };
    try {
        const img = sharp(buffer, { failOn: 'none' }).rotate();
        const meta = await img.metadata();
        const out = await img
            .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 82 })
            .toBuffer({ resolveWithObject: true });
        return { buffer: out.data, mime: 'image/webp', width: out.info.width, height: out.info.height, originalWidth: meta.width, originalHeight: meta.height };
    } catch {
        return { buffer, mime, width: null, height: null };
    }
}

/** Persist a buffer; returns stored metadata (no DB write). */
async function saveBuffer(kind, buffer, { mime, originalName = null, optimize = true } = {}) {
    const realMime = assertContent(kind, buffer, mime);
    let data = buffer;
    let finalMime = realMime;
    let width = null;
    let height = null;

    if ((kind === 'image' || kind === 'generated_image') && optimize) {
        const opt = await optimizeImage(buffer, realMime);
        data = opt.buffer;
        finalMime = opt.mime;
        width = opt.width;
        height = opt.height;
    }

    const ext = EXT_BY_MIME[finalMime] || path.extname(originalName || '').replace('.', '') || 'bin';
    const prefix = kind === 'generated_image' ? 'gen' : kind === 'tts_audio' ? 'tts' : kind === 'pdf' ? 'ref' : kind === 'audio' ? 'voice' : 'img';
    const storedName = uniqueName(prefix, ext);
    const absPath = path.join(dirFor(kind), storedName);
    await fs.promises.writeFile(absPath, data);

    return {
        kind,
        storedName,
        absPath,
        publicUrl: publicUrlFor(kind, storedName),
        mimeType: finalMime,
        sizeBytes: data.length,
        width,
        height,
        originalName: originalName ? String(originalName).slice(0, 255) : null,
    };
}

async function deleteStored(kind, storedName) {
    try {
        await fs.promises.unlink(path.join(dirFor(kind), path.basename(storedName)));
    } catch { /* already gone */ }
}

/** Insert the metadata row for a stored asset. Returns the file id. */
async function recordFile(dbOrConn, {
    userId, conversationId = null, messageId = null, kind, stored, durationSeconds = null, pages = null,
    transcript = null, promptUsed = null, model = null, coinCost = 0, status = 'ready', metadata = null,
}) {
    const [res] = await dbOrConn.query(
        `INSERT INTO tam24_ai_files
         (user_id, conversation_id, message_id, kind, original_name, stored_name, public_url, mime_type, size_bytes,
          width, height, duration_seconds, pages, transcript, prompt_used, model, coin_cost, status, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            userId, conversationId, messageId, kind, stored.originalName, stored.storedName, stored.publicUrl, stored.mimeType,
            stored.sizeBytes, stored.width, stored.height, durationSeconds, pages, transcript, promptUsed, model, coinCost, status,
            metadata ? JSON.stringify(metadata) : null,
        ]
    );
    return res.insertId;
}

async function attachFileToMessage(dbOrConn, fileIds, { conversationId, messageId }) {
    const ids = (fileIds || []).map(Number).filter(Boolean);
    if (!ids.length) return;
    await dbOrConn.query(
        `UPDATE tam24_ai_files SET conversation_id = COALESCE(conversation_id, ?), message_id = ? WHERE id IN (${ids.map(() => '?').join(',')})`,
        [conversationId, messageId, ...ids]
    );
}

async function getFileForUser(db, fileId, userId) {
    const [[row]] = await db.query(`SELECT * FROM tam24_ai_files WHERE id = ? AND user_id = ? LIMIT 1`, [fileId, userId]);
    return row || null;
}

function absolutePathFor(kind, storedName) {
    return path.join(dirFor(kind), path.basename(String(storedName || '')));
}

/**
 * Local uploads are not reachable by the AI provider, so vision input is
 * sent inline as a data URL (the optimised WebP keeps this small).
 */
async function readAsDataUrl(kind, storedName, mime) {
    const buffer = await fs.promises.readFile(absolutePathFor(kind, storedName));
    return `data:${mime || 'image/webp'};base64,${buffer.toString('base64')}`;
}

/** Public shape of a tam24_ai_files row for API responses / message attachments. */
function publicFile(row) {
    if (!row) return null;
    return {
        fileId: row.id,
        kind: row.kind,
        type: row.kind === 'pdf' ? 'pdf' : row.kind.includes('audio') ? 'audio' : 'image',
        url: row.public_url,
        mimeType: row.mime_type,
        sizeBytes: row.size_bytes == null ? null : Number(row.size_bytes),
        width: row.width,
        height: row.height,
        durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
        pages: row.pages,
        transcript: row.transcript || null,
        promptUsed: row.prompt_used || null,
        originalName: row.original_name || null,
        status: row.status,
        createdAt: row.created_at,
    };
}

// ─── multer middlewares (memory storage: bytes are validated/optimised before hitting disk) ──
const mb = (v) => Math.round(v * 1024 * 1024);
const mimeFilter = (allowed) => (req, file, cb) => {
    if (!allowed.has(baseMime(file.mimetype))) return cb(Object.assign(new Error('UNSUPPORTED_FILE_TYPE'), { code: 'UNSUPPORTED_FILE_TYPE' }));
    cb(null, true);
};

const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: mb(FILE_LIMITS.imageMb) }, fileFilter: mimeFilter(IMAGE_MIME) }).single('image');
const audioUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: mb(FILE_LIMITS.audioMb) }, fileFilter: mimeFilter(AUDIO_MIME) }).single('audio');
const pdfUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: mb(FILE_LIMITS.pdfMb) }, fileFilter: mimeFilter(PDF_MIME) }).single('pdf');

/** Wrap a multer middleware so upload failures become clean Persian API errors. */
function handleUpload(middleware, { tooLarge, unsupported }) {
    return (req, res, next) => {
        middleware(req, res, (err) => {
            if (!err) return next();
            if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ success: false, code: 'FILE_TOO_LARGE', message: tooLarge });
            return res.status(400).json({ success: false, code: 'UNSUPPORTED_FILE_TYPE', message: unsupported });
        });
    };
}

module.exports = {
    BASE_DIR,
    PUBLIC_PREFIX,
    KIND_DIRS,
    IMAGE_MIME,
    AUDIO_MIME,
    PDF_MIME,
    sniff,
    saveBuffer,
    deleteStored,
    recordFile,
    attachFileToMessage,
    getFileForUser,
    absolutePathFor,
    readAsDataUrl,
    publicFile,
    publicUrlFor,
    imageUpload,
    audioUpload,
    pdfUpload,
    handleUpload,
    hasSharp: () => !!sharp,
};
