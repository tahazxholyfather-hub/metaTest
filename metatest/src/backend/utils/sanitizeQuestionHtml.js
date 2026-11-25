'use strict';

// Same rules as src/lib/sanitizeQuestionHtml.ts (SEC-013).
// Script tags and event-handler attributes are removed. Math and formatting tags stay.

const BLOCKED_BLOCK = /<\s*(script|iframe|object|embed|link|meta|base|form|svg)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const BLOCKED_SINGLE = /<\s*\/?\s*(script|iframe|object|embed|link|meta|base|form|svg)\b[^>]*>/gi;
const EVENT_ATTR = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const STYLE_ATTR = /\s+style\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URL = /(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi;

function sanitizeQuestionHtml(input) {
    if (typeof input !== 'string') return input;
    if (!input) return '';
    return input
        .replace(BLOCKED_BLOCK, '')
        .replace(BLOCKED_SINGLE, '')
        .replace(EVENT_ATTR, '')
        .replace(STYLE_ATTR, '')
        .replace(JS_URL, '$1=$2#$2');
}

const DIRECT_HTML_KEYS = new Set([
    'question_text',
    'questionText',
    'note_text',
    'noteText',
    'user_note',
    'option_text',
    'descriptiveAnswer',
    'descriptive_answer',
    'descriptiveText',
    'descriptive',
    'answer_text',
    'solution',
]);

const QUESTION_TEXT_PARENT_KEYS = new Set([
    'descriptive_answer',
    'question',
    'questions',
]);

function isQuestionTextObject(parent) {
    if (!parent || typeof parent !== 'object') return false;
    return 'options' in parent
        || 'is_correct' in parent
        || 'percent' in parent
        || 'descriptiveAnswer' in parent
        || 'descriptive_image' in parent
        || 'has_image' in parent
        || 'subject_id' in parent
        || 'correctOptionIndex' in parent
        || ('id' in parent && 'image' in parent)
        || ('index' in parent && 'text' in parent);
}

function shouldSanitize(key, parentKey, parent) {
    if (!key) return false;
    if (DIRECT_HTML_KEYS.has(key)) return true;
    if (key !== 'text') return false;
    if (parentKey && QUESTION_TEXT_PARENT_KEYS.has(parentKey)) return true;
    return isQuestionTextObject(parent);
}

function isWalkable(value) {
    if (!value || typeof value !== 'object') return false;
    if (value instanceof Date) return false;
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return false;
    if (value instanceof Map || value instanceof Set) return false;
    return true;
}

function sanitizeApiValue(value, key, parentKey, parent, seen) {
    if (typeof value === 'string') {
        return shouldSanitize(key, parentKey, parent) ? sanitizeQuestionHtml(value) : value;
    }
    if (!isWalkable(value)) return value;
    if (seen.has(value)) return value;
    seen.add(value);

    if (Array.isArray(value)) {
        if (key === 'options' && value.every((item) => item == null || typeof item === 'string')) {
            let changed = false;
            const next = value.map((item) => {
                if (typeof item !== 'string') return item;
                const clean = sanitizeQuestionHtml(item);
                if (clean !== item) changed = true;
                return clean;
            });
            return changed ? next : value;
        }
        let changed = false;
        const next = value.map((item) => {
            const clean = sanitizeApiValue(item, null, key, null, seen);
            if (clean !== item) changed = true;
            return clean;
        });
        return changed ? next : value;
    }

    let changed = false;
    const next = {};
    for (const [childKey, childValue] of Object.entries(value)) {
        const clean = sanitizeApiValue(childValue, childKey, key, value, seen);
        if (clean !== childValue) changed = true;
        next[childKey] = clean;
    }
    return changed ? next : value;
}

/** Neutralize question and note HTML already stored in the database before it leaves the API. */
function sanitizeApiBody(body) {
    if (!isWalkable(body)) return body;
    return sanitizeApiValue(body, null, null, null, new WeakSet());
}

module.exports = {
    sanitizeQuestionHtml,
    sanitizeApiBody,
};
