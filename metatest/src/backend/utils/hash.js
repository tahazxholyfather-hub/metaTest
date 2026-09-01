// utils/hashId.js
const Hashids = require('hashids/cjs');

const SALT = process.env.HASHIDS_SALT || 'super-secret-salt-change-me-please';

const quizHash = new Hashids(SALT + ':quiz', 12);
const resultHash = new Hashids(SALT + ':result', 12);
const shareHash = new Hashids(SALT + ':share', 10);

function encodeQuizId(id) {
    const num = Number(id);
    if (!Number.isInteger(num) || num <= 0) return null;
    return quizHash.encode(num);
}

function decodeQuizId(hash) {
    if (!hash) return null;
    const decoded = quizHash.decode(hash);
    return decoded.length ? Number(decoded[0]) : null;
}

function encodeResultId(id) {
    const num = Number(id);
    if (!Number.isInteger(num) || num <= 0) return null;
    return resultHash.encode(num);
}

function decodeResultId(hash) {
    if (!hash) return null;
    const decoded = resultHash.decode(hash);
    return decoded.length ? Number(decoded[0]) : null;
}

function encodeShareCode(id) {
    const num = Number(id);
    if (!Number.isInteger(num) || num <= 0) return null;
    return shareHash.encode(num);
}

function decodeShareCode(hash) {
    if (!hash) return null;
    const decoded = shareHash.decode(hash);
    return decoded.length ? Number(decoded[0]) : null;
}

module.exports = {
    encodeQuizId,
    decodeQuizId,
    encodeResultId,
    decodeResultId,
    encodeShareCode,
    decodeShareCode,
};
