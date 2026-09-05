-- Met — voice replies setting + subject color alignment with the character's
-- 4 body themes (violet/blue/green/pink). Run after 006.

SET NAMES utf8mb4;

ALTER TABLE tam24_ai_user_settings
  ADD COLUMN IF NOT EXISTS voice_replies TINYINT(1) NOT NULL DEFAULT 1;

-- Subject colors must match the Met character themes so the UI stays in sync:
--   math → violet, physics → blue, biology → green, chemistry → pink
UPDATE tam24_ai_subjects SET color = '#8B5CF6' WHERE `key` = 'math';
UPDATE tam24_ai_subjects SET color = '#3B82F6' WHERE `key` = 'physics';
UPDATE tam24_ai_subjects SET color = '#10B981' WHERE `key` = 'biology';
UPDATE tam24_ai_subjects SET color = '#EC4899' WHERE `key` = 'chemistry';
