'use strict';

async function ensureOpsSchema(pool) {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS tam24_admin_word_events (
            id BIGINT NOT NULL AUTO_INCREMENT,
            admin_id INT NOT NULL,
            action ENUM('insert','edit') NOT NULL,
            question_id INT NULL,
            word_count INT NOT NULL,
            source ENUM('live','backfill') NOT NULL DEFAULT 'live',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_admin_action (admin_id, action),
            KEY idx_question_action (question_id, action)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS tam24_admin_section_access (
            admin_id INT NOT NULL,
            section_key VARCHAR(40) NOT NULL,
            allowed TINYINT(1) NOT NULL DEFAULT 1,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            updated_by INT NULL DEFAULT NULL,
            PRIMARY KEY (admin_id, section_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
}

module.exports = { ensureOpsSchema };
