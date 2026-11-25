'use strict';

const crypto = require('crypto');
const path = require('path');

/** Extension is chosen only from sniffed bytes, never from the client filename or MIME. */
const IMAGE_EXT = Object.freeze({
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
});

const AUDIO_EXT = Object.freeze({
    'audio/webm': '.webm',
    'audio/ogg': '.ogg',
    'audio/wav': '.wav',
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
});

function sniffImage(buffer) {
    if (!buffer || buffer.length < 12) return null;
    const b = buffer;
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
    if (b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
    if (b.slice(0, 4).toString('ascii') === 'GIF8') return 'image/gif';
    return null;
}

function sniffAudio(buffer) {
    if (!buffer || buffer.length < 12) return null;
    const b = buffer;
    if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'audio/webm';
    if (b.slice(0, 4).toString('ascii') === 'OggS') return 'audio/ogg';
    if (b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WAVE') return 'audio/wav';
    if (b.slice(0, 3).toString('ascii') === 'ID3') return 'audio/mpeg';
    if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return 'audio/mpeg';
    if (b.slice(4, 8).toString('ascii') === 'ftyp') return 'audio/mp4';
    return null;
}

function sniffPdf(buffer) {
    if (!buffer || buffer.length < 5) return null;
    return buffer.slice(0, 5).toString('ascii') === '%PDF-' ? 'application/pdf' : null;
}

const ALLOWED_STORED_EXT = new Set([
    ...Object.values(IMAGE_EXT),
    ...Object.values(AUDIO_EXT),
    '.pdf',
]);

function randomStoredName(ext) {
    const safe = String(ext || '').toLowerCase();
    if (!ALLOWED_STORED_EXT.has(safe)) {
        throw new Error('REFUSING_EXTENSION');
    }
    return crypto.randomBytes(16).toString('hex') + safe;
}

function assertInside(root, filename) {
    const rootResolved = path.resolve(root);
    const dest = path.resolve(rootResolved, path.basename(filename));
    if (dest !== rootResolved && !dest.startsWith(rootResolved + path.sep)) {
        throw new Error('PATH_ESCAPE');
    }
    return dest;
}

module.exports = {
    IMAGE_EXT,
    AUDIO_EXT,
    sniffImage,
    sniffAudio,
    sniffPdf,
    randomStoredName,
    assertInside,
};
