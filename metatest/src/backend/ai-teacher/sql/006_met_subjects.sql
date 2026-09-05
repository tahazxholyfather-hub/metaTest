-- Met — subject-based AI tutor (replaces the teacher roster)
-- Run after 001 → 005. Safe to re-run (IF NOT EXISTS / ON DUPLICATE KEY).

SET NAMES utf8mb4;

-- ─── Subjects (editable copy of backend/ai-teacher/subjects.js) ─────────────
CREATE TABLE IF NOT EXISTS tam24_ai_subjects (
  `key` VARCHAR(20) NOT NULL,
  name_fa VARCHAR(80) NOT NULL,
  name_en VARCHAR(80) NOT NULL,
  icon VARCHAR(40) NOT NULL DEFAULT 'sparkles',
  color VARCHAR(16) NOT NULL DEFAULT '#8B5CF6',
  general_prompt MEDIUMTEXT NULL,
  reference_instructions MEDIUMTEXT NULL,
  model VARCHAR(80) NULL,
  max_output_tokens INT NOT NULL DEFAULT 700,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 100,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Colors match the Met character's 4 body themes (violet/blue/green/pink).
INSERT INTO tam24_ai_subjects (`key`, name_fa, name_en, icon, color, max_output_tokens, sort_order) VALUES
('math', 'ریاضی', 'Math', 'sigma', '#8B5CF6', 700, 1),
('biology', 'زیست‌شناسی', 'Biology', 'dna', '#10B981', 700, 2),
('physics', 'فیزیک', 'Physics', 'atom', '#3B82F6', 700, 3),
('chemistry', 'شیمی', 'Chemistry', 'flask-conical', '#EC4899', 700, 4)
ON DUPLICATE KEY UPDATE name_fa = VALUES(name_fa), name_en = VALUES(name_en);

-- Prompts stay authored in code (subjects.js) by default; DB row overrides
-- them only when general_prompt / reference_instructions are non-null, so
-- an admin can later customize a subject without a deploy.

-- ─── Users: intro flag + last-used subject (teacher fields retired) ────────
ALTER TABLE tam24_users
  ADD COLUMN IF NOT EXISTS ai_met_intro_seen TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_last_subject VARCHAR(20) NULL DEFAULT NULL;

-- ─── Books: attach to a subject instead of a teacher ────────────────────────
ALTER TABLE tam24_ai_books
  ADD COLUMN IF NOT EXISTS subject_key VARCHAR(20) NULL DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_books_subject ON tam24_ai_books (subject_key, is_active);

UPDATE tam24_ai_books SET subject_key = 'physics' WHERE id = 1;
UPDATE tam24_ai_books SET subject_key = 'math' WHERE id = 2;
UPDATE tam24_ai_books SET subject_key = 'chemistry' WHERE id = 3;

INSERT INTO tam24_ai_books (id, title, subject, subject_key, grade, publisher, pdf_url, content_summary, is_active, sort_order) VALUES
(4, 'زیست‌شناسی دهم — چاپ ۱۴۰۳', 'زیست‌شناسی', 'biology', 'دهم', 'آموزش و پرورش', '/books/biology-10.pdf', 'کتاب درسی زیست‌شناسی پایه دهم: زیست‌شناسی دیروز امروز فردا، سفری به درون سلول، بافت‌ها و اندام‌ها.', 1, 4)
ON DUPLICATE KEY UPDATE title = VALUES(title), subject_key = VALUES(subject_key), is_active = VALUES(is_active);

-- ─── RAG: chunked + embedded book content (fast, cheap retrieval) ──────────
CREATE TABLE IF NOT EXISTS tam24_ai_book_chunks (
  id BIGINT NOT NULL AUTO_INCREMENT,
  book_id INT NOT NULL,
  subject_key VARCHAR(20) NOT NULL,
  chunk_index INT NOT NULL,
  content MEDIUMTEXT NOT NULL,
  content_hash CHAR(64) NOT NULL,
  token_estimate INT NOT NULL DEFAULT 0,
  embedding_model VARCHAR(80) NULL,
  embedding MEDIUMTEXT NULL COMMENT 'JSON float array; NULL until embedded',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_book_chunk (book_id, chunk_index),
  KEY idx_chunk_subject (subject_key),
  KEY idx_chunk_hash (content_hash),
  CONSTRAINT fk_chunk_book FOREIGN KEY (book_id) REFERENCES tam24_ai_books(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─── Conversations: subject replaces teacher ────────────────────────────────
ALTER TABLE tam24_ai_conversations
  ADD COLUMN IF NOT EXISTS subject_key VARCHAR(20) NULL DEFAULT NULL,
  MODIFY COLUMN teacher_id INT NULL,
  ADD COLUMN IF NOT EXISTS title_generated TINYINT(1) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ai_conv_subject ON tam24_ai_conversations (user_id, subject_key);

-- Best-effort backfill for any pre-existing rows (teacher subject text -> key)
UPDATE tam24_ai_conversations c
  JOIN tam24_ai_teachers t ON t.id = c.teacher_id
  SET c.subject_key = CASE
    WHEN t.subject LIKE '%ریاض%' THEN 'math'
    WHEN t.subject LIKE '%زیست%' THEN 'biology'
    WHEN t.subject LIKE '%فیزیک%' THEN 'physics'
    WHEN t.subject LIKE '%شیمی%' THEN 'chemistry'
    ELSE 'math'
  END
  WHERE c.subject_key IS NULL;

UPDATE tam24_ai_conversations SET subject_key = 'math' WHERE subject_key IS NULL;

-- ─── Messages: image attachments (uploaded or Met-generated) ───────────────
ALTER TABLE tam24_ai_messages
  ADD COLUMN IF NOT EXISTS attachments JSON NULL COMMENT 'Array of {type, url, mimeType, promptUsed?}',
  ADD COLUMN IF NOT EXISTS subject_key VARCHAR(20) NULL DEFAULT NULL;

-- ─── Wallet: flat energy price for an AI-generated image ───────────────────
-- (kept as a config constant, no schema needed — see config.js IMAGE_ENERGY_COST)
