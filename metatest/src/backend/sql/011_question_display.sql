-- Display settings for practice, exam, and exam review.
-- The app also creates this table on startup.

CREATE TABLE IF NOT EXISTS tam24_question_display (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  settings_json JSON NOT NULL,
  updated_by INT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
