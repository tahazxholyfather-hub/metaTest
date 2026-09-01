-- AI Teacher — reference books (PDF-backed) + per-user selected book
-- Run after 001_ai_teacher.sql

-- ─── Books catalog ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tam24_ai_books (
  id INT NOT NULL AUTO_INCREMENT,
  title VARCHAR(240) NOT NULL,
  subject VARCHAR(120) NULL,
  grade VARCHAR(50) NULL,
  publisher VARCHAR(160) NULL,
  pdf_url VARCHAR(600) NULL COMMENT 'Path/URL of the source PDF',
  -- Extracted text of the PDF (fill via extraction script / admin import).
  -- The prompt builder sends a bounded excerpt of this as reference context.
  content_text MEDIUMTEXT NULL,
  content_summary TEXT NULL COMMENT 'Short summary used when content_text is too large',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 100,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ai_books_active (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ─── Per-user selected reference book ────────────────────────────────────────
ALTER TABLE tam24_ai_user_settings
  ADD COLUMN IF NOT EXISTS selected_book_id INT NULL DEFAULT NULL;

-- MySQL < 8.0.29 fallback:
-- ALTER TABLE tam24_ai_user_settings ADD COLUMN selected_book_id INT NULL DEFAULT NULL;

-- ─── Seed sample books (replace pdf_url with real files) ─────────────────────
INSERT INTO tam24_ai_books (id, title, subject, grade, publisher, pdf_url, content_summary, is_active, sort_order) VALUES
(1, 'فیزیک دهم — چاپ ۱۴۰۳', 'فیزیک', 'دهم', 'آموزش و پرورش', '/books/physics-10.pdf', 'کتاب درسی فیزیک پایه دهم: اندازه‌گیری، کار و انرژی، ویژگی‌های فیزیکی مواد، دما و گرما.', 1, 1),
(2, 'ریاضی دهم — چاپ ۱۴۰۳', 'ریاضی', 'دهم', 'آموزش و پرورش', '/books/math-10.pdf', 'کتاب درسی ریاضی پایه دهم: مجموعه‌ها، الگو و دنباله، توان‌های گویا، معادله‌ها و نامعادله‌ها، تابع، شمارش و احتمال.', 1, 2),
(3, 'شیمی دهم — چاپ ۱۴۰۳', 'شیمی', 'دهم', 'آموزش و پرورش', '/books/chemistry-10.pdf', 'کتاب درسی شیمی پایه دهم: کیهان زادگاه الفبای هستی، ردپای گازها در زندگی، آب آهنگ زندگی.', 1, 3)
ON DUPLICATE KEY UPDATE title = VALUES(title), is_active = VALUES(is_active);
