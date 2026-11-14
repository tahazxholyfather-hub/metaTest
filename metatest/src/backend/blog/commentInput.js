'use strict';

function clean(value, max) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function validateComment(input) {
    const draft = input && typeof input === 'object' ? input : {};
    const name = clean(draft.name, 80);
    const body = clean(draft.body, 2000);
    const errors = {};
    if (name.length < 2) errors.name = 'نام را بنویسید.';
    if (body.length < 2) errors.body = 'متن دیدگاه را بنویسید.';
    return { ok: Object.keys(errors).length === 0, errors, value: { name, body } };
}

module.exports = { validateComment };
