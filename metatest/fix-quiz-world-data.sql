-- Fix mis-tagged questions that leaked the wrong chapter/mabhas in دنیای آزمون.
-- Run against the live quiz_app database (phpMyAdmin / mysql client).
-- Code changes hide most of these even before this script runs.

-- شیمی «فصل سه دهم» (topic 67) was tagged یازدهم, so it appeared in شیمی یازدهم.
UPDATE questions_tam24
SET grade_id = 1
WHERE id = 5293 AND topic_id = 67 AND grade_id = 2;

-- Biology questions with NULL grade_id (duplicate mabhas cards via GROUP BY grade_id).
UPDATE questions_tam24 SET grade_id = 1 WHERE id = 651 AND topic_id = 14 AND grade_id IS NULL;
UPDATE questions_tam24 SET grade_id = 2 WHERE id = 776 AND topic_id = 19 AND grade_id IS NULL;
UPDATE questions_tam24 SET grade_id = 1 WHERE id = 786 AND topic_id = 13 AND grade_id IS NULL;

-- ریاضی «قدر مطلق و جزء صحیح» (topic 62) is یازدهم. Questions whose primary
-- grade was دهم (including 4224) made the chapter card show up under دهم.
UPDATE questions_tam24
SET grade_id = 2
WHERE topic_id = 62 AND grade_id = 1;

DELETE qg FROM question_grades_tam24 qg
INNER JOIN questions_tam24 q ON q.id = qg.question_id
WHERE q.topic_id = 62 AND qg.grade_id = 1;

INSERT IGNORE INTO question_grades_tam24 (question_id, grade_id)
SELECT id, 2 FROM questions_tam24 WHERE topic_id = 62 AND grade_id = 2;

-- اشتراک الماسی دیده می‌شود، نامحدود و ۱۰٬۰۰۰٬۰۰۰ تومان است، ولی قابل خرید نیست.
-- ستون purchasable را سرور هنگام بالا آمدن می‌سازد و همین مقدار را هم اعمال می‌کند.
UPDATE subscription_plans
SET is_active = 1, days = NULL, price = 10000000
WHERE id = 'diamond';

-- Note: topics 69 and 70 (شیمی فصل دو/سه یازدهم) have zero usable questions
-- in the current dump, so those cards still will not appear until questions exist.
