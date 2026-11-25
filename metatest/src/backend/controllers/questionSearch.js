// Builds the free-text predicate for the admin question editor.
// Three independent switches (question text, options, descriptive answer)
// combine into 8 modes. Selected fields are OR-ed. With a query and every
// switch off, the predicate matches nothing.

function isOn(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback;
    if (value === true || value === 1 || value === '1' || value === 'true') return true;
    if (value === false || value === 0 || value === '0' || value === 'false') return false;
    return fallback;
}

function buildQuestionTextSearch(filters) {
    const raw = filters && filters.search_text != null ? String(filters.search_text).trim() : '';
    if (!raw) return { sql: '', params: [] };

    // Missing flags keep the previous behaviour: question text only.
    const inText = isOn(filters.search_in_text, true);
    const inOptions = isOn(filters.search_in_options, false);
    const inAnswer = isOn(filters.search_in_answer, false);

    const like = `%${raw}%`;
    const clauses = [];
    const params = [];

    if (inText) {
        clauses.push('q.question_text LIKE ?');
        params.push(like);
    }
    if (inOptions) {
        clauses.push('EXISTS (SELECT 1 FROM options_tam24 o WHERE o.question_id = q.id AND o.option_text LIKE ?)');
        params.push(like);
    }
    if (inAnswer) {
        clauses.push('EXISTS (SELECT 1 FROM descriptive_answers_tam24 da WHERE da.question_id = q.id AND da.answer_text LIKE ?)');
        params.push(like);
    }

    if (clauses.length === 0) return { sql: ' AND 1=0', params: [] };
    return { sql: ` AND (${clauses.join(' OR ')})`, params };
}

module.exports = { buildQuestionTextSearch };
