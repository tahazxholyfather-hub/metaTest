-- Free vs paid usage counters and coin-pack checkout.
-- Safe to re-run. The app also creates these tables on first use.

CREATE TABLE IF NOT EXISTS tam24_plan_usage (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  feature VARCHAR(40) NOT NULL,
  subject_key VARCHAR(64) NOT NULL DEFAULT '',
  resource_id VARCHAR(64) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_plan_usage (user_id, feature, subject_key, resource_id),
  KEY idx_plan_usage_window (user_id, feature, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tam24_coin_purchases (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  package_id VARCHAR(40) NOT NULL,
  coins INT NOT NULL,
  price_toman INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  authority VARCHAR(120) NULL,
  ref_id VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_coin_purchase_user (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
