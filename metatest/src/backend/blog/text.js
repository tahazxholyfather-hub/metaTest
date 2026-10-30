'use strict';

function slugify(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\p{L}\p{N}-]+/gu, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 160);
}

function cleanText(value, max) {
    const text = String(value || '').replace(/\r\n/g, '\n').trim();
    return text ? text.slice(0, max) : '';
}

function acceptedMediaUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.length > 500) return null;
    if (/^https?:\/\/[^\s]+$/i.test(raw)) return raw;
    if (/^\/blog-media\/[A-Za-z0-9._-]+$/.test(raw)) return raw;
    return null;
}

function cleanCoverUrl(value) {
    const cleaned = acceptedMediaUrl(value);
    if (cleaned === null) return undefined;
    return cleaned || null;
}

module.exports = { slugify, cleanText, cleanCoverUrl, acceptedMediaUrl };
