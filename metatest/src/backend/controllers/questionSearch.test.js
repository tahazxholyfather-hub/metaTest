const assert = require('assert');
const { buildQuestionTextSearch } = require('./questionSearch');

const like = '%آب%';
const text = 'q.question_text LIKE ?';
const options = 'EXISTS (SELECT 1 FROM options_tam24 o WHERE o.question_id = q.id AND o.option_text LIKE ?)';
const answer = 'EXISTS (SELECT 1 FROM descriptive_answers_tam24 da WHERE da.question_id = q.id AND da.answer_text LIKE ?)';

function mode(search_in_text, search_in_options, search_in_answer) {
    return buildQuestionTextSearch({
        search_text: 'آب',
        search_in_text,
        search_in_options,
        search_in_answer,
    });
}

const cases = [
    { flags: [true, true, true], parts: [text, options, answer] },
    { flags: [true, true, false], parts: [text, options] },
    { flags: [true, false, true], parts: [text, answer] },
    { flags: [true, false, false], parts: [text] },
    { flags: [false, true, true], parts: [options, answer] },
    { flags: [false, true, false], parts: [options] },
    { flags: [false, false, true], parts: [answer] },
    { flags: [false, false, false], parts: [] },
];

assert.strictEqual(cases.length, 8);

for (const entry of cases) {
    const result = mode(...entry.flags);
    if (entry.parts.length === 0) {
        assert.strictEqual(result.sql, ' AND 1=0', entry.flags.join(','));
        assert.deepStrictEqual(result.params, []);
        continue;
    }
    assert.strictEqual(result.sql, ` AND (${entry.parts.join(' OR ')})`, entry.flags.join(','));
    assert.deepStrictEqual(result.params, entry.parts.map(() => like), entry.flags.join(','));
}

assert.deepStrictEqual(buildQuestionTextSearch({ search_text: '   ' }), { sql: '', params: [] });
assert.deepStrictEqual(buildQuestionTextSearch({}), { sql: '', params: [] });
assert.deepStrictEqual(buildQuestionTextSearch(null), { sql: '', params: [] });

const legacy = buildQuestionTextSearch({ search_text: 'آب' });
assert.strictEqual(legacy.sql, ` AND (${text})`);
assert.deepStrictEqual(legacy.params, [like]);

console.log('questionSearch: 8 modes ok');
