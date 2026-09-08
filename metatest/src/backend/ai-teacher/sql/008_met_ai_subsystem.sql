-- Met — AI subsystem v2
-- Coins (daily + purchased buckets, full ledger), usage/cost logging, model
-- pricing, knowledge base, suggestions, files, PDF references, tool calls,
-- richer settings/memory, `general` subject — and removal of the legacy
-- teacher-roster schema.
--
-- Run after 001 → 007. Safe to re-run (IF [NOT] EXISTS everywhere).
-- Requires MariaDB 10.2+ (IF EXISTS on ALTER/DROP, JSON alias).

SET NAMES utf8mb4;

-- ─── Subjects: add the general fallback room, align order ───────────────────
INSERT INTO tam24_ai_subjects (`key`, name_fa, name_en, icon, color, max_output_tokens, sort_order) VALUES
('math', 'ریاضی', 'Math', 'sigma', '#8B5CF6', 700, 1),
('physics', 'فیزیک', 'Physics', 'atom', '#3B82F6', 700, 2),
('chemistry', 'شیمی', 'Chemistry', 'flask-conical', '#EC4899', 700, 3),
('biology', 'زیست‌شناسی', 'Biology', 'dna', '#10B981', 700, 4),
('general', 'گفتگوی آزاد', 'General', 'sparkles', '#A78BFA', 600, 5)
ON DUPLICATE KEY UPDATE name_fa = VALUES(name_fa), name_en = VALUES(name_en), icon = VALUES(icon),
  color = VALUES(color), sort_order = VALUES(sort_order);

-- ─── Wallet: two buckets. `balance` stays as the mirrored total ─────────────
ALTER TABLE tam24_ai_wallets
  ADD COLUMN IF NOT EXISTS daily_balance INT NOT NULL DEFAULT 0 COMMENT 'Today''s free coins; resets daily, never rolls over',
  ADD COLUMN IF NOT EXISTS purchased_balance INT NOT NULL DEFAULT 0 COMMENT 'Bought/bonus coins; never expire',
  ADD COLUMN IF NOT EXISTS daily_granted_on DATE NULL COMMENT 'Local date of the last daily grant';

-- Legacy balances were daily-only: carry them into the daily bucket once.
UPDATE tam24_ai_wallets
   SET daily_balance = GREATEST(0, balance),
       daily_granted_on = last_daily_refill_date
 WHERE daily_balance = 0 AND purchased_balance = 0 AND balance > 0;

-- ─── Ledger: every coin movement, with per-bucket deltas ────────────────────
ALTER TABLE tam24_ai_coin_transactions
  MODIFY COLUMN type ENUM(
    'daily_refill','ai_message','purchase','bonus','refund','admin_adjustment','reservation','reservation_release',
    'daily_grant','daily_expire','ai_usage','reservation_settle'
  ) NOT NULL,
  ADD COLUMN IF NOT EXISTS daily_delta INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchased_delta INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS operation_type VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS conversation_id BIGINT NULL,
  ADD COLUMN IF NOT EXISTS message_id BIGINT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_tx_user_type ON tam24_ai_coin_transactions (user_id, type, created_at);

-- ─── Usage logs: one row per AI operation ───────────────────────────────────
ALTER TABLE tam24_ai_usage_logs
  ADD COLUMN IF NOT EXISTS operation_type VARCHAR(40) NOT NULL DEFAULT 'chat'
    COMMENT 'chat|vision|image_generation|stt|tts|embedding|title|memory|summary|suggestions|knowledge',
  ADD COLUMN IF NOT EXISTS provider VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS subject_key VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS status ENUM('success','error','stopped') NOT NULL DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS error_message VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS retrieved_knowledge_ids JSON NULL,
  ADD COLUMN IF NOT EXISTS retrieved_question_ids JSON NULL,
  ADD COLUMN IF NOT EXISTS retrieved_reference_ids JSON NULL,
  ADD COLUMN IF NOT EXISTS tool_calls JSON NULL,
  ADD COLUMN IF NOT EXISTS attached_files JSON NULL,
  ADD COLUMN IF NOT EXISTS units DECIMAL(12,4) NULL COMMENT 'Non-token units: seconds of audio, characters, images';

ALTER TABLE tam24_ai_usage_logs DROP INDEX IF EXISTS idx_ai_usage_teacher;
ALTER TABLE tam24_ai_usage_logs DROP COLUMN IF EXISTS teacher_id;
CREATE INDEX IF NOT EXISTS idx_ai_usage_op ON tam24_ai_usage_logs (operation_type, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_conv ON tam24_ai_usage_logs (conversation_id);

-- ─── Model pricing (admin-editable; code constants are the fallback) ────────
CREATE TABLE IF NOT EXISTS tam24_ai_model_pricing (
  id INT NOT NULL AUTO_INCREMENT,
  provider VARCHAR(40) NOT NULL DEFAULT 'gapgpt',
  model VARCHAR(80) NOT NULL,
  operation_type VARCHAR(40) NOT NULL DEFAULT 'chat',
  input_usd_per_1m DECIMAL(12,6) NOT NULL DEFAULT 0,
  cached_usd_per_1m DECIMAL(12,6) NOT NULL DEFAULT 0,
  output_usd_per_1m DECIMAL(12,6) NOT NULL DEFAULT 0,
  unit_usd DECIMAL(12,6) NOT NULL DEFAULT 0 COMMENT 'Per image / per audio minute / per 1K chars',
  flat_coin_cost INT NULL COMMENT 'Optional flat coin surcharge for this op',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_model_pricing (provider, model, operation_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO tam24_ai_model_pricing (provider, model, operation_type, input_usd_per_1m, cached_usd_per_1m, output_usd_per_1m, unit_usd) VALUES
('gapgpt', 'gpt-5.6-luna', 'chat', 0.20, 0.02, 1.20, 0),
('gapgpt', 'gpt-5.6-terra', 'chat', 2.00, 0.20, 12.00, 0),
('gapgpt', 'gpt-5.6-sol', 'chat', 5.00, 0.50, 30.00, 0),
('gapgpt', 'text-embedding-3-small', 'embedding', 0.02, 0, 0, 0),
('gapgpt', 'dall-e-3', 'image_generation', 0, 0, 0, 0.04),
('gapgpt', 'whisper-1', 'stt', 0, 0, 0, 0.006),
('gapgpt', 'tts-1', 'tts', 0, 0, 0, 0.015)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- ─── Knowledge base (human-authored) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tam24_ai_knowledge (
  id INT NOT NULL AUTO_INCREMENT,
  subject_key VARCHAR(20) NOT NULL,
  grade VARCHAR(30) NULL,
  chapter VARCHAR(120) NULL,
  topic VARCHAR(160) NULL,
  title VARCHAR(200) NOT NULL,
  content MEDIUMTEXT NOT NULL,
  examples MEDIUMTEXT NULL,
  key_points TEXT NULL,
  keywords VARCHAR(500) NULL COMMENT 'Comma-separated retrieval hints',
  source VARCHAR(200) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_kb_subject (subject_key, is_active, grade),
  FULLTEXT KEY ft_kb (title, topic, chapter, keywords, key_points, content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS tam24_ai_knowledge_chunks (
  id BIGINT NOT NULL AUTO_INCREMENT,
  knowledge_id INT NOT NULL,
  chunk_index INT NOT NULL,
  content MEDIUMTEXT NOT NULL,
  token_estimate INT NOT NULL DEFAULT 0,
  embedding_model VARCHAR(80) NULL,
  embedding MEDIUMTEXT NULL COMMENT 'JSON float array; NULL until embedded',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_kb_chunk (knowledge_id, chunk_index),
  CONSTRAINT fk_kb_chunk FOREIGN KEY (knowledge_id) REFERENCES tam24_ai_knowledge(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS tam24_ai_knowledge_usage (
  id BIGINT NOT NULL AUTO_INCREMENT,
  knowledge_id INT NOT NULL,
  user_id INT NOT NULL,
  conversation_id BIGINT NULL,
  message_id BIGINT NULL,
  score DECIMAL(6,4) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_kbu_knowledge (knowledge_id, created_at),
  KEY idx_kbu_user (user_id, created_at),
  CONSTRAINT fk_kbu_knowledge FOREIGN KEY (knowledge_id) REFERENCES tam24_ai_knowledge(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─── Smart suggestions cache (10 per subject; 4 served) ─────────────────────
CREATE TABLE IF NOT EXISTS tam24_ai_suggestions (
  id INT NOT NULL AUTO_INCREMENT,
  subject_key VARCHAR(20) NOT NULL,
  title VARCHAR(80) NOT NULL,
  prompt TEXT NOT NULL,
  hint VARCHAR(160) NULL,
  icon VARCHAR(40) NULL,
  source ENUM('seed','generated') NOT NULL DEFAULT 'generated',
  use_count INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sugg_subject (subject_key, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─── Files: every stored upload / generated asset ───────────────────────────
CREATE TABLE IF NOT EXISTS tam24_ai_files (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  conversation_id BIGINT NULL,
  message_id BIGINT NULL,
  kind ENUM('image','audio','pdf','generated_image','tts_audio') NOT NULL,
  original_name VARCHAR(255) NULL,
  stored_name VARCHAR(255) NOT NULL,
  public_url VARCHAR(600) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  width INT NULL,
  height INT NULL,
  duration_seconds DECIMAL(10,2) NULL,
  pages INT NULL,
  transcript MEDIUMTEXT NULL,
  prompt_used TEXT NULL,
  model VARCHAR(80) NULL,
  coin_cost INT NOT NULL DEFAULT 0,
  status ENUM('ready','processing','failed') NOT NULL DEFAULT 'ready',
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ai_files_user (user_id, kind, created_at),
  KEY idx_ai_files_conv (conversation_id),
  CONSTRAINT fk_ai_files_user FOREIGN KEY (user_id) REFERENCES tam24_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─── PDF references attached to a conversation (max 4 active) ───────────────
CREATE TABLE IF NOT EXISTS tam24_ai_conversation_references (
  id BIGINT NOT NULL AUTO_INCREMENT,
  conversation_id BIGINT NOT NULL,
  file_id BIGINT NOT NULL,
  user_id INT NOT NULL,
  title VARCHAR(240) NOT NULL,
  status ENUM('pending','indexing','ready','failed') NOT NULL DEFAULT 'pending',
  chunk_count INT NOT NULL DEFAULT 0,
  pages INT NULL,
  error_message VARCHAR(300) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_conv_ref (conversation_id, is_active),
  CONSTRAINT fk_conv_ref_conv FOREIGN KEY (conversation_id) REFERENCES tam24_ai_conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_conv_ref_file FOREIGN KEY (file_id) REFERENCES tam24_ai_files(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS tam24_ai_reference_chunks (
  id BIGINT NOT NULL AUTO_INCREMENT,
  reference_id BIGINT NOT NULL,
  chunk_index INT NOT NULL,
  page_hint INT NULL,
  content MEDIUMTEXT NOT NULL,
  token_estimate INT NOT NULL DEFAULT 0,
  embedding_model VARCHAR(80) NULL,
  embedding MEDIUMTEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ref_chunk (reference_id, chunk_index),
  CONSTRAINT fk_ref_chunk FOREIGN KEY (reference_id) REFERENCES tam24_ai_conversation_references(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─── Tool calls (audit of every backend tool the model invoked) ─────────────
CREATE TABLE IF NOT EXISTS tam24_ai_tool_calls (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  conversation_id BIGINT NULL,
  message_id BIGINT NULL,
  tool_name VARCHAR(80) NOT NULL,
  arguments JSON NULL,
  result_summary VARCHAR(500) NULL,
  success TINYINT(1) NOT NULL DEFAULT 1,
  error_message VARCHAR(300) NULL,
  duration_ms INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tool_user (user_id, created_at),
  KEY idx_tool_name (tool_name, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─── Settings: clean abstractions (no raw provider params) ──────────────────
ALTER TABLE tam24_ai_user_settings
  ADD COLUMN IF NOT EXISTS tone ENUM('friendly','formal','playful') NOT NULL DEFAULT 'friendly',
  ADD COLUMN IF NOT EXISTS reasoning_level ENUM('fast','balanced','deep') NOT NULL DEFAULT 'balanced',
  ADD COLUMN IF NOT EXISTS verbosity ENUM('short','normal','detailed') NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS creativity TINYINT UNSIGNED NOT NULL DEFAULT 50 COMMENT '0-100 → temperature',
  ADD COLUMN IF NOT EXISTS memory_enabled TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS knowledge_enabled TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pdf_references_enabled TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS voice_replies TINYINT(1) NOT NULL DEFAULT 1;

ALTER TABLE tam24_ai_user_settings DROP COLUMN IF EXISTS selected_book_id;

-- ─── Memory: auditable long-term memory ─────────────────────────────────────
ALTER TABLE tam24_ai_student_memory
  ADD COLUMN IF NOT EXISTS subject_key VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS source_message_id BIGINT NULL,
  ADD COLUMN IF NOT EXISTS confidence TINYINT UNSIGNED NOT NULL DEFAULT 70;

-- ─── Messages / conversations ───────────────────────────────────────────────
ALTER TABLE tam24_ai_messages
  ADD COLUMN IF NOT EXISTS status ENUM('complete','stopped','error') NOT NULL DEFAULT 'complete',
  ADD COLUMN IF NOT EXISTS latency_ms INT NULL,
  ADD COLUMN IF NOT EXISTS regenerated_from BIGINT NULL;

ALTER TABLE tam24_ai_conversations DROP FOREIGN KEY IF EXISTS fk_ai_conv_teacher;
ALTER TABLE tam24_ai_conversations DROP INDEX IF EXISTS idx_ai_conv_teacher;
ALTER TABLE tam24_ai_conversations DROP COLUMN IF EXISTS teacher_id;
UPDATE tam24_ai_conversations SET subject_key = 'math' WHERE subject_key IS NULL;

-- ─── Users: intro flag retired (no intro screen), teacher columns removed ───
ALTER TABLE tam24_users DROP INDEX IF EXISTS idx_users_ai_teacher_id;
ALTER TABLE tam24_users DROP FOREIGN KEY IF EXISTS fk_users_ai_teacher;
ALTER TABLE tam24_users
  DROP COLUMN IF EXISTS ai_teacher_id,
  DROP COLUMN IF EXISTS ai_teacher_onboarding_completed,
  DROP COLUMN IF EXISTS ai_met_intro_seen;

-- ─── Legacy teacher roster: gone ────────────────────────────────────────────
DROP TABLE IF EXISTS tam24_ai_teacher_starter_messages;
DROP TABLE IF EXISTS tam24_ai_teachers;
DROP TABLE IF EXISTS tam24_ai_student_profiles;
