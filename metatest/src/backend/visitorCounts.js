'use strict';

const pool = require('./db');

let repaired = false;

const IDENTITY_TABLES = ['tam24_visitor_counts', 'quizzes', 'quiz_members', 'quiz_results'];

async function ensureAutoIncrement(table) {
    if (!/^[a-z0-9_]+$/i.test(table)) return false;
    const [[col]] = await pool.query(
        `SELECT COLUMN_KEY, EXTRA
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = 'id'`,
        [table]
    );
    if (!col) return false;
    if (!String(col.COLUMN_KEY || '').includes('PRI')) {
        await pool.query(`ALTER TABLE \`${table}\` ADD PRIMARY KEY (id)`);
    }
    if (!String(col.EXTRA || '').toLowerCase().includes('auto_increment')) {
        await pool.query(`ALTER TABLE \`${table}\` MODIFY id INT NOT NULL AUTO_INCREMENT`);
        console.log(`[db] ${table}.id is AUTO_INCREMENT now`);
    }
    return true;
}

async function ensureVisitorCountIds() {
    let ok = false;
    for (const table of IDENTITY_TABLES) {
        try {
            ok = (await ensureAutoIncrement(table)) || ok;
        } catch (err) {
            console.error(`[db] ${table} id repair failed:`, err.message);
        }
    }
    repaired = ok;
    return ok;
}

module.exports = { ensureVisitorCountIds, wasRepaired: () => repaired };
