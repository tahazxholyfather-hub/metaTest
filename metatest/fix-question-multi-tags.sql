-- Extra tags so one question can belong to several grades / chapters / mabhas.
-- The Node backend also creates these tables automatically on first use.

CREATE TABLE IF NOT EXISTS question_grades_tam24 (
    question_id INT NOT NULL,
    grade_id INT NOT NULL,
    PRIMARY KEY (question_id, grade_id),
    KEY idx_qg_grade (grade_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS question_topics_tam24 (
    question_id INT NOT NULL,
    topic_id INT NOT NULL,
    PRIMARY KEY (question_id, topic_id),
    KEY idx_qt_topic (topic_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS question_mabhas_tam24 (
    question_id INT NOT NULL,
    chapter_id INT NOT NULL,
    PRIMARY KEY (question_id, chapter_id),
    KEY idx_qm_chapter (chapter_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT IGNORE INTO question_grades_tam24 (question_id, grade_id)
SELECT id, grade_id FROM questions_tam24 WHERE grade_id IS NOT NULL;

INSERT IGNORE INTO question_topics_tam24 (question_id, topic_id)
SELECT id, topic_id FROM questions_tam24 WHERE topic_id IS NOT NULL;

INSERT IGNORE INTO question_mabhas_tam24 (question_id, chapter_id)
SELECT id, chapter_id FROM questions_tam24 WHERE chapter_id IS NOT NULL;
