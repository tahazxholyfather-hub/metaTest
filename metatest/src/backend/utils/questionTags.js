const pool = require('../db');

const TAGS = {
    grade: {
        table: 'question_grades_tam24',
        column: 'grade_id',
        questionColumn: 'grade_id',
    },
    topic: {
        table: 'question_topics_tam24',
        column: 'topic_id',
        questionColumn: 'topic_id',
    },
    mabhas: {
        table: 'question_mabhas_tam24',
        column: 'chapter_id',
        questionColumn: 'chapter_id',
    },
};

let ensured = false;

const CREATE_SQL = `
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
`;

const BACKFILL_SQL = [
    `INSERT IGNORE INTO question_grades_tam24 (question_id, grade_id)
     SELECT id, grade_id FROM questions_tam24 WHERE grade_id IS NOT NULL`,
    `INSERT IGNORE INTO question_topics_tam24 (question_id, topic_id)
     SELECT id, topic_id FROM questions_tam24 WHERE topic_id IS NOT NULL`,
    `INSERT IGNORE INTO question_mabhas_tam24 (question_id, chapter_id)
     SELECT id, chapter_id FROM questions_tam24 WHERE chapter_id IS NOT NULL`,
];

async function ensureQuestionTagTables() {
    if (ensured) return;
    try {
        const statements = CREATE_SQL.split(';').map((s) => s.trim()).filter(Boolean);
        for (const sql of statements) {
            await pool.query(sql);
        }
        for (const sql of BACKFILL_SQL) {
            await pool.query(sql);
        }
        ensured = true;
    } catch (error) {
        console.error('❌ Failed to ensure question tag tables:', error.message);
        throw error;
    }
}

const toPositiveIds = (val) => {
    const list = Array.isArray(val) ? val : (val == null || val === '' ? [] : [val]);
    const ids = [];
    const seen = new Set();
    for (const item of list) {
        const n = Number(item && typeof item === 'object' ? item.id : item);
        if (!Number.isInteger(n) || n <= 0 || seen.has(n)) continue;
        seen.add(n);
        ids.push(n);
    }
    return ids;
};

async function saveQuestionTags(questionId, { gradeIds, topicIds, chapterIds }) {
    await ensureQuestionTagTables();
    const qid = Number(questionId);
    if (!qid) return;

    const grades = toPositiveIds(gradeIds);
    const topics = toPositiveIds(topicIds);
    const mabhas = toPositiveIds(chapterIds);

    await pool.query('DELETE FROM question_grades_tam24 WHERE question_id = ?', [qid]);
    await pool.query('DELETE FROM question_topics_tam24 WHERE question_id = ?', [qid]);
    await pool.query('DELETE FROM question_mabhas_tam24 WHERE question_id = ?', [qid]);

    const insertRows = async (table, column, ids) => {
        if (!ids.length) return;
        const placeholders = ids.map(() => '(?, ?)').join(', ');
        const params = [];
        for (const id of ids) params.push(qid, id);
        await pool.query(
            `INSERT IGNORE INTO ${table} (question_id, ${column}) VALUES ${placeholders}`,
            params
        );
    };

    await insertRows(TAGS.grade.table, TAGS.grade.column, grades);
    await insertRows(TAGS.topic.table, TAGS.topic.column, topics);
    await insertRows(TAGS.mabhas.table, TAGS.mabhas.column, mabhas);
}

async function getQuestionTags(questionId) {
    await ensureQuestionTagTables();
    const qid = Number(questionId);
    if (!qid) {
        return { grade_ids: [], topic_ids: [], chapter_ids: [], grade_titles: [], topic_titles: [], chapter_titles: [] };
    }

    const [[grades], [topics], [mabhas]] = await Promise.all([
        pool.query(
            `SELECT g.id, g.title
             FROM question_grades_tam24 qg
             JOIN grades_tam24 g ON g.id = qg.grade_id
             WHERE qg.question_id = ?
             ORDER BY g.id ASC`,
            [qid]
        ),
        pool.query(
            `SELECT t.id, t.title
             FROM question_topics_tam24 qt
             JOIN topics_tam24 t ON t.id = qt.topic_id
             WHERE qt.question_id = ?
             ORDER BY t.id ASC`,
            [qid]
        ),
        pool.query(
            `SELECT c.id, c.title
             FROM question_mabhas_tam24 qm
             JOIN chapters_tam24 c ON c.id = qm.chapter_id
             WHERE qm.question_id = ?
             ORDER BY c.id ASC`,
            [qid]
        ),
    ]);

    return {
        grade_ids: grades.map((r) => Number(r.id)),
        grade_titles: grades.map((r) => r.title),
        topic_ids: topics.map((r) => Number(r.id)),
        topic_titles: topics.map((r) => r.title),
        chapter_ids: mabhas.map((r) => Number(r.id)),
        chapter_titles: mabhas.map((r) => r.title),
    };
}

function joinOnTag(questionAlias, entityAlias, tagKey) {
    const tag = TAGS[tagKey];
    return `(
        ${entityAlias}.id = ${questionAlias}.${tag.questionColumn}
        OR EXISTS (
            SELECT 1 FROM ${tag.table} xt
            WHERE xt.question_id = ${questionAlias}.id
              AND xt.${tag.column} = ${entityAlias}.id
        )
    )`;
}

function matchTagIn(questionAlias, tagKey, ids) {
    const clean = toPositiveIds(ids);
    if (!clean.length) return { sql: '', params: [] };
    const tag = TAGS[tagKey];
    const placeholders = clean.map(() => '?').join(',');
    return {
        sql: `(
            ${questionAlias}.${tag.questionColumn} IN (${placeholders})
            OR EXISTS (
                SELECT 1 FROM ${tag.table} xt
                WHERE xt.question_id = ${questionAlias}.id
                  AND xt.${tag.column} IN (${placeholders})
            )
        )`,
        params: [...clean, ...clean],
    };
}

function addTagFilter(parts, params, questionAlias, tagKey, ids) {
    const matched = matchTagIn(questionAlias, tagKey, ids);
    if (!matched.sql) return;
    parts.push(matched.sql);
    params.push(...matched.params);
}

function normalizeFaDigits(title) {
    return String(title || '')
        .replace(/ي/g, 'ی')
        .replace(/ك/g, 'ک');
}

/** Grade ids mentioned in a chapter title. 'دهم' is not counted inside یازدهم/دوازدهم. */
function gradesFromTopicTitle(title) {
    const t = normalizeFaDigits(title);
    const found = new Set();
    if (t.includes('دوازدهم')) found.add(3);
    if (t.includes('یازدهم')) found.add(2);
    const stripped = t.replace(/دوازدهم/g, '\0').replace(/یازدهم/g, '\0');
    if (stripped.includes('دهم')) found.add(1);
    return found;
}

/**
 * A topic's home grade: most of its primary-tagged فعال/done questions.
 * Used when the title does not name a grade (e.g. آمار, مشتق).
 */
function majorityGradeSql(topicAlias = 't', { requireEditDone = true } = {}) {
    const editClause = requireEditDone ? "AND q2.edit_status = 'done'" : '';
    return `(
        SELECT q2.grade_id
        FROM questions_tam24 q2
        WHERE q2.topic_id = ${topicAlias}.id
          AND q2.status = 'فعال'
          ${editClause}
          AND q2.grade_id IS NOT NULL
        GROUP BY q2.grade_id
        ORDER BY COUNT(*) DESC, q2.grade_id ASC
        LIMIT 1
    )`;
}

function filterTopicsForSelectedGrades(rows, gradeIds) {
    const selected = toPositiveIds(gradeIds);
    if (!selected.length) return rows;
    const selectedSet = new Set(selected);
    return (rows || []).filter((row) => {
        const named = gradesFromTopicTitle(row.title);
        if (named.size > 0) {
            for (const g of named) {
                if (selectedSet.has(g)) return true;
            }
            return false;
        }
        const maj = Number(row.majority_grade_id);
        if (Number.isInteger(maj) && maj > 0) {
            return selectedSet.has(maj);
        }
        return true;
    });
}

module.exports = {
    ensureQuestionTagTables,
    saveQuestionTags,
    getQuestionTags,
    joinOnTag,
    matchTagIn,
    addTagFilter,
    toPositiveIds,
    gradesFromTopicTitle,
    majorityGradeSql,
    filterTopicsForSelectedGrades,
};
