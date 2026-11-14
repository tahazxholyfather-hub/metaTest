'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateComment } = require('./commentInput');

test('comment needs a name and a body', () => {
    const empty = validateComment({});
    assert.equal(empty.ok, false);
    assert.ok(empty.errors.name);
    assert.ok(empty.errors.body);
});

test('comment trims and accepts a short note', () => {
    const parsed = validateComment({ name: '  سارا  ', body: '  مفید بود.  ' });
    assert.equal(parsed.ok, true);
    assert.equal(parsed.value.name, 'سارا');
    assert.equal(parsed.value.body, 'مفید بود.');
});
