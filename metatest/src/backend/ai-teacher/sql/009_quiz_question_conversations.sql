-- Per-question Met conversations (practice / quiz).
-- One conversation per (user, question). Regular chats stay source_type='chat'.
-- Safe to re-run.

SET NAMES utf8mb4;

ALTER TABLE tam24_ai_conversations
  ADD COLUMN IF NOT EXISTS source_type ENUM('chat','quiz_question') NOT NULL DEFAULT 'chat',
  ADD COLUMN IF NOT EXISTS question_id INT NULL,
  ADD COLUMN IF NOT EXISTS question_snapshot JSON NULL;

CREATE INDEX IF NOT EXISTS idx_ai_conv_source ON tam24_ai_conversations (user_id, source_type, last_message_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_conv_user_question ON tam24_ai_conversations (user_id, question_id);

ALTER TABLE tam24_ai_messages
  ADD COLUMN IF NOT EXISTS finish_reason VARCHAR(40) NULL;
