-- =============================================================================
-- Referral (invite) commission + Toman wallet + withdrawal system
-- Migration for the "databaseAdd" feature branch.
--
-- What this adds:
--   1. tam24_users.referral_code  — a unique, shareable invite code per user.
--   2. tam24_toman_wallets        — Toman (IRR) wallet balance per user.
--   3. tam24_toman_transactions   — wallet ledger (credit/debit).
--   4. tam24_referral_rewards     — one row per awarded referral commission.
--   5. tam24_withdrawal_requests  — cash-out requests (admin handles manually).
--   6. tam24_referral_settings    — single-row reward config (percent/fixed/token).
--
-- IMPORTANT: run this against the same database used by src/backend/db.js.
-- It is written to be idempotent (safe to re-run).
-- =============================================================================

-- 1. Unique invite code on users ----------------------------------------------
ALTER TABLE `tam24_users`
    ADD COLUMN `referral_code` VARCHAR(32) NULL AFTER `referrer_code_submitted`,
    ADD UNIQUE KEY `uq_referral_code` (`referral_code`);

-- 2. Toman wallet --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tam24_toman_wallets` (
    `user_id`          INT NOT NULL,
    `balance`          BIGINT NOT NULL DEFAULT 0,
    `lifetime_earned`  BIGINT NOT NULL DEFAULT 0,
    `lifetime_spent`   BIGINT NOT NULL DEFAULT 0,
    `updated_at`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`),
    CONSTRAINT `fk_toman_wallet_user` FOREIGN KEY (`user_id`)
        REFERENCES `tam24_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 3. Toman wallet ledger --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tam24_toman_transactions` (
    `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id`        INT NOT NULL,
    `type`           ENUM('referral_reward','purchase','withdrawal','withdrawal_refund','admin_adjustment') NOT NULL,
    `amount`         BIGINT NOT NULL COMMENT 'signed: + credit, - debit (Toman)',
    `balance_after`  BIGINT NOT NULL DEFAULT 0,
    `description`    VARCHAR(255) DEFAULT NULL,
    `reference_type` VARCHAR(50)  DEFAULT NULL,
    `reference_id`   VARCHAR(50)  DEFAULT NULL,
    `created_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_toman_tx_user` (`user_id`),
    CONSTRAINT `fk_toman_tx_user` FOREIGN KEY (`user_id`)
        REFERENCES `tam24_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 4. Referral commission records (idempotent per payment) -----------------------
CREATE TABLE IF NOT EXISTS `tam24_referral_rewards` (
    `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `inviter_id`      INT NOT NULL,
    `invitee_id`      INT NOT NULL,
    `payment_id`      BIGINT UNSIGNED NOT NULL,
    `plan_id`         VARCHAR(50) DEFAULT NULL,
    `base_amount`     BIGINT NOT NULL DEFAULT 0,
    `reward_type`     ENUM('percent','fixed','token') NOT NULL DEFAULT 'percent',
    `reward_percent`  DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    `reward_amount`   BIGINT NOT NULL DEFAULT 0 COMMENT 'Toman for percent/fixed, coins for token',
    `created_at`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_referral_payment` (`payment_id`),
    KEY `idx_referral_inviter` (`inviter_id`),
    KEY `idx_referral_invitee` (`invitee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 5. Withdrawal (cash-out) requests ---------------------------------------------
CREATE TABLE IF NOT EXISTS `tam24_withdrawal_requests` (
    `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id`     INT NOT NULL,
    `amount`      BIGINT NOT NULL,
    `status`      ENUM('pending','approved','rejected','paid') NOT NULL DEFAULT 'pending',
    `note`        VARCHAR(255) DEFAULT NULL,
    `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_withdrawal_user` (`user_id`),
    KEY `idx_withdrawal_status` (`status`),
    CONSTRAINT `fk_withdrawal_user` FOREIGN KEY (`user_id`)
        REFERENCES `tam24_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 6. Referral reward settings (single row id=1) ---------------------------------
CREATE TABLE IF NOT EXISTS `tam24_referral_settings` (
    `id`                   TINYINT NOT NULL DEFAULT 1,
    `reward_type`          ENUM('percent','fixed','token') NOT NULL DEFAULT 'percent',
    `reward_percent`       DECIMAL(5,2) NOT NULL DEFAULT 30.00,
    `reward_fixed_amount`  BIGINT NOT NULL DEFAULT 0,
    `reward_token_amount`  BIGINT NOT NULL DEFAULT 0,
    `is_active`            TINYINT(1) NOT NULL DEFAULT 1,
    `updated_at`           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `tam24_referral_settings`
    (`id`, `reward_type`, `reward_percent`, `reward_fixed_amount`, `reward_token_amount`, `is_active`)
VALUES
    (1, 'percent', 30.00, 0, 0, 1)
ON DUPLICATE KEY UPDATE `id` = `id`;
