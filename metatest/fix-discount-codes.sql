CREATE TABLE IF NOT EXISTS discount_codes (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  code varchar(100) NOT NULL,
  percent decimal(5,2) NOT NULL,
  active tinyint(1) NOT NULL DEFAULT 1,
  expires_at datetime DEFAULT NULL,
  max_uses int(11) DEFAULT NULL,
  used_count int(11) NOT NULL DEFAULT 0,
  allowed_plan_ids longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT current_timestamp(),
  updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY code (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
