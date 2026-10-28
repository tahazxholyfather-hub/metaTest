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

function cleanCoverUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (raw.length > 500 || !/^https?:\/\/[^\s]+$/i.test(raw)) return undefined;
    return raw;
}

module.exports = { slugify, cleanText, cleanCoverUrl };
