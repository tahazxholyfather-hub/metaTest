-- USD/IRR cost columns + per-teacher model
-- Run after 001_ai_teacher.sql (004 may be applied before or after).

SET NAMES utf8mb4;

ALTER TABLE tam24_ai_messages
  ADD COLUMN IF NOT EXISTS cost_usd DECIMAL(14,10) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_irr BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cached_tokens INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exchange_rate_irr INT NOT NULL DEFAULT 0;

ALTER TABLE tam24_ai_usage_logs
  ADD COLUMN IF NOT EXISTS cost_usd DECIMAL(14,10) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_irr BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cached_tokens INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS energy_cost INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exchange_rate_irr INT NOT NULL DEFAULT 0;

ALTER TABLE tam24_ai_teachers
  ADD COLUMN IF NOT EXISTS model VARCHAR(80) NULL;

-- Exact API billing: teacher_multiplier 1.0 (no fake markup).
-- Typical energy ≈ ceil(USD * 1_000_000 IRR / 100) for a normal reply.
-- 1–3 use gpt-5.6-luna (~11 energy). 4–6 use gpt-5.6-terra (~110 energy).

UPDATE tam24_ai_teachers SET
  model = 'gpt-5.6-luna',
  model_multiplier = 1.000,
  teacher_multiplier = 1.000,
  price_per_message = 11,
  max_output_tokens = 380
WHERE id = 1;

UPDATE tam24_ai_teachers SET
  model = 'gpt-5.6-luna',
  model_multiplier = 1.000,
  teacher_multiplier = 1.000,
  price_per_message = 12,
  max_output_tokens = 560
WHERE id = 2;

UPDATE tam24_ai_teachers SET
  model = 'gpt-5.6-luna',
  model_multiplier = 1.000,
  teacher_multiplier = 1.000,
  price_per_message = 13,
  max_output_tokens = 640
WHERE id = 3;

UPDATE tam24_ai_teachers SET
  model = 'gpt-5.6-terra',
  model_multiplier = 1.000,
  teacher_multiplier = 1.000,
  price_per_message = 110,
  max_output_tokens = 720
WHERE id = 4;

UPDATE tam24_ai_teachers SET
  model = 'gpt-5.6-terra',
  model_multiplier = 1.000,
  teacher_multiplier = 1.000,
  price_per_message = 115,
  max_output_tokens = 800
WHERE id = 5;

UPDATE tam24_ai_teachers SET
  model = 'gpt-5.6-terra',
  model_multiplier = 1.000,
  teacher_multiplier = 1.000,
  price_per_message = 120,
  max_output_tokens = 880
WHERE id = 6;
