'use strict';

const pool = require('./db');

let repaired = false;

async function ensureVisitorCountIds() {
    const [[col]] = await pool.query(
        `SELECT COLUMN_KEY, EXTRA
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'tam24_visitor_counts'
           AND COLUMN_NAME = 'id'`
    );
    if (!col) return false;
    if (!String(col.COLUMN_KEY || '').includes('PRI')) {
        await pool.query('ALTER TABLE tam24_visitor_counts ADD PRIMARY KEY (id)');
    }
    if (!String(col.EXTRA || '').toLowerCase().includes('auto_increment')) {
        await pool.query('ALTER TABLE tam24_visitor_counts MODIFY id INT NOT NULL AUTO_INCREMENT');
        console.log('[db] tam24_visitor_counts.id is AUTO_INCREMENT now');
    }
    repaired = true;
    return true;
}

module.exports = { ensureVisitorCountIds, wasRepaired: () => repaired };
