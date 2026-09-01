-- AI Private Teacher module schema
-- Run against the existing Metatest / tam24 database.
-- Naming follows tam24_* conventions.

-- ─── Users: selected teacher + onboarding flag ───────────────────────────────
ALTER TABLE tam24_users
  ADD COLUMN IF NOT EXISTS ai_teacher_id INT NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_teacher_onboarding_completed TINYINT(1) NOT NULL DEFAULT 0;

-- MySQL < 8.0.29 may not support IF NOT EXISTS on ADD COLUMN — fallback:
-- ALTER TABLE tam24_users ADD COLUMN ai_teacher_id INT NULL DEFAULT NULL;
-- ALTER TABLE tam24_users ADD COLUMN ai_teacher_onboarding_completed TINYINT(1) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_ai_teacher_id ON tam24_users (ai_teacher_id);

-- ─── Teachers ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tam24_ai_teachers (
  id INT NOT NULL AUTO_INCREMENT,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  display_name VARCHAR(160) NOT NULL,
  age INT NULL,
  avatar_url VARCHAR(500) DEFAULT '/avatars/ai_teacher_default.png',
  subject VARCHAR(120) NOT NULL,
  specialty TEXT NULL,
  description TEXT NULL,
  personality TEXT NULL,
  teaching_style TEXT NULL,
  knowledge_level TINYINT UNSIGNED NOT NULL DEFAULT 50,
  expertise TEXT NULL,
  experience TEXT NULL,
  system_prompt MEDIUMTEXT NOT NULL,
  behavior_rules TEXT NULL,
  teaching_rules TEXT NULL,
  response_style TEXT NULL,
  is_free TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  price_per_message INT NOT NULL DEFAULT 0 COMMENT 'Display/base coin estimate; real charge from usage',
  model_multiplier DECIMAL(6,3) NOT NULL DEFAULT 1.000,
  teacher_multiplier DECIMAL(6,3) NOT NULL DEFAULT 1.000,
  max_output_tokens INT NOT NULL DEFAULT 800,
  sort_order INT NOT NULL DEFAULT 100,
  students_count INT NOT NULL DEFAULT 0,
  questions_answered INT NOT NULL DEFAULT 0,
  conversations_count INT NOT NULL DEFAULT 0,
  average_rating DECIMAL(3,2) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ai_teachers_active (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─── Starter messages (no AI call) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tam24_ai_teacher_starter_messages (
  id INT NOT NULL AUTO_INCREMENT,
  teacher_id INT NOT NULL,
  message TEXT NOT NULL,
  type ENUM('greeting','introduction','study_prompt','question_prompt','motivation','practice_prompt') NOT NULL DEFAULT 'greeting',
  language VARCHAR(10) NOT NULL DEFAULT 'fa',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_starter_teacher (teacher_id, is_active, sort_order),
  CONSTRAINT fk_starter_teacher FOREIGN KEY (teacher_id) REFERENCES tam24_ai_teachers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─── Student AI profile ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tam24_ai_student_profiles (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  school_name VARCHAR(200) NULL,
  grade VARCHAR(50) NULL,
  field VARCHAR(120) NULL,
  weaknesses TEXT NULL,
  strengths TEXT NULL,
  learning_goals TEXT NULL,
  learning_preferences TEXT NULL,
  additional_notes TEXT NULL,
  memory_summary TEXT NULL,
  learning_summary TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_student_profile_user (user_id),
  CONSTRAINT fk_ai_profile_user FOREIGN KEY (user_id) REFERENCES tam24_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─── Selective memory ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tam24_ai_student_memory (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  memory_type ENUM('weakness','strength','preference','goal','learning_behavior','important_fact','progress') NOT NULL,
  content TEXT NOT NULL,
  importance TINYINT UNSIGNED NOT NULL DEFAULT 5,
  source VARCHAR(80) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ai_memory_user (user_id, is_active, importance),
  CONSTRAINT fk_ai_memory_user FOREIGN KEY (user_id) REFERENCES tam24_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─── User AI settings ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tam24_ai_user_settings (
  user_id INT NOT NULL,
  low_coin_mode TINYINT(1) NOT NULL DEFAULT 0,
  always_examples TINYINT(1) NOT NULL DEFAULT 1,
  concise_responses TINYINT(1) NOT NULL DEFAULT 0,
  step_by_step TINYINT(1) NOT NULL DEFAULT 1,
  parent_reports_enabled TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_ai_settings_user FOREIGN KEY (user_id) REFERENCES tam24_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─── Conversations ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tam24_ai_conversations (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  teacher_id INT NOT NULL,
  title VARCHAR(200) NOT NULL DEFAULT 'گفتگوی جدید',
  summary TEXT NULL,
  summary_updated_at TIMESTAMP NULL DEFAULT NULL,
  message_count INT NOT NULL DEFAULT 0,
  total_tokens INT NOT NULL DEFAULT 0,
  last_message_at TIMESTAMP NULL DEFAULT NULL,
  archived_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ai_conv_user (user_id, last_message_at),
  KEY idx_ai_conv_teacher (teacher_id),
  CONSTRAINT fk_ai_conv_user FOREIGN KEY (user_id) REFERENCES tam24_users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ai_conv_teacher FOREIGN KEY (teacher_id) REFERENCES tam24_ai_teachers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─── Messages ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tam24_ai_messages (
  id BIGINT NOT NULL AUTO_INCREMENT,
  conversation_id BIGINT NOT NULL,
  role ENUM('system','user','assistant') NOT NULL,
  content MEDIUMTEXT NOT NULL,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  total_tokens INT NOT NULL DEFAULT 0,
  coin_cost INT NOT NULL DEFAULT 0,
  model VARCHAR(80) NULL,
  is_starter TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ai_msg_conv (conversation_id, id),
  CONSTRAINT fk_ai_msg_conv FOREIGN KEY (conversation_id) REFERENCES tam24_ai_conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─── Coin wallet + ledger ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tam24_ai_wallets (
  user_id INT NOT NULL,
  balance INT NOT NULL DEFAULT 0,
  lifetime_earned INT NOT NULL DEFAULT 0,
  lifetime_spent INT NOT NULL DEFAULT 0,
  last_daily_refill_date DATE NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_ai_wallet_user FOREIGN KEY (user_id) REFERENCES tam24_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS tam24_ai_coin_transactions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  type ENUM('daily_refill','ai_message','purchase','bonus','refund','admin_adjustment','reservation','reservation_release') NOT NULL,
  amount INT NOT NULL COMMENT 'Signed: +credit / -debit',
  balance_before INT NOT NULL,
  balance_after INT NOT NULL,
  reason VARCHAR(255) NULL,
  reference_type VARCHAR(60) NULL,
  reference_id VARCHAR(80) NULL,
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ai_tx_user (user_id, created_at),
  KEY idx_ai_tx_ref (reference_type, reference_id),
  UNIQUE KEY uq_daily_refill (user_id, type, reference_id),
  CONSTRAINT fk_ai_tx_user FOREIGN KEY (user_id) REFERENCES tam24_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─── Usage tracking ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tam24_ai_usage_logs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  teacher_id INT NULL,
  conversation_id BIGINT NULL,
  message_id BIGINT NULL,
  model VARCHAR(80) NULL,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  total_tokens INT NOT NULL DEFAULT 0,
  coin_cost INT NOT NULL DEFAULT 0,
  request_duration_ms INT NULL,
  success TINYINT(1) NOT NULL DEFAULT 0,
  error_code VARCHAR(80) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ai_usage_user (user_id, created_at),
  KEY idx_ai_usage_teacher (teacher_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Optional FK from users to teachers (after teachers exist)
-- ALTER TABLE tam24_users
--   ADD CONSTRAINT fk_users_ai_teacher FOREIGN KEY (ai_teacher_id) REFERENCES tam24_ai_teachers(id) ON DELETE SET NULL;

-- Teacher personas (6 Iranian teachers, 1 free + 5 pro) are seeded in:
--   004_iranian_teachers.sql
-- USD/IRR usage columns + per-teacher models:
--   005_usage_costs.sql
-- Run 001 → 002 → 004 → 005 (005 may also run before 004).
