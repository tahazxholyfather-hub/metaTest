'use strict';

const pool = require('./db');
const { emptyDocument, sanitizeDocument } = require('./questionDisplay');

let schemaReady = null;

function ensureSchema() {
    if (!schemaReady) {
        schemaReady = pool.query(
            `CREATE TABLE IF NOT EXISTS tam24_question_display (
                id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
                settings_json JSON NOT NULL,
                updated_by INT NULL,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )`
        ).catch((err) => {
            schemaReady = null;
            throw err;
        });
    }
    return schemaReady;
}

function parseJson(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch {
        return {};
    }
}

async function readDocument() {
    await ensureSchema();
    const [rows] = await pool.query(
        'SELECT settings_json, updated_at FROM tam24_question_display WHERE id = 1 LIMIT 1'
    );
    if (!rows.length) return { document: emptyDocument(), updatedAt: null };
    return {
        document: sanitizeDocument(parseJson(rows[0].settings_json)),
        updatedAt: rows[0].updated_at || null,
    };
}

async function writeDocument(input, adminId) {
    const document = sanitizeDocument(input);
    await ensureSchema();
    await pool.query(
        `INSERT INTO tam24_question_display (id, settings_json, updated_by)
         VALUES (1, ?, ?)
         ON DUPLICATE KEY UPDATE
            settings_json = VALUES(settings_json),
            updated_by = VALUES(updated_by)`,
        [JSON.stringify(document), Number(adminId) || null]
    );
    return document;
}

module.exports = {
    ensureSchema,
    readDocument,
    writeDocument,
};
