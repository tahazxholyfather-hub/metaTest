'use strict';

const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
    if (id === 'mysql2/promise') {
        return { createPool() { return { query: () => Promise.resolve([[]]) }; } };
    }
    if (id === 'dotenv') return { config() {} };
    return originalRequire.apply(this, arguments);
};

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { gradesFromTopicTitle, filterTopicsForSelectedGrades } = require('../questionTags');

test('دهم is not counted inside longer ordinals', () => {
    assert.deepEqual([...gradesFromTopicTitle('فصل یک سیزدهم')], []);
    assert.deepEqual([...gradesFromTopicTitle('فصل چهاردهم')], []);
    assert.deepEqual([...gradesFromTopicTitle('فصل یک دهم')], [1]);
    assert.deepEqual([...gradesFromTopicTitle('فصل یک یازدهم')], [2]);
    assert.deepEqual([...gradesFromTopicTitle('فصل یک دوازدهم')], [3]);
    assert.deepEqual([...gradesFromTopicTitle('ترکیبی دهم و یازدهم')].sort(), [1, 2]);
});

test('absolute value stays grade 11', () => {
    assert.ok(gradesFromTopicTitle('قدرمطلق و جزءصحيح').has(2));
    assert.ok(gradesFromTopicTitle('قدر مطلق و جزء صحیح').has(2));
});

test('a chapter titled سیزدهم is not forced into grade 10', () => {
    const rows = [{ id: 89, title: 'فصل یک سیزدهم', majority_grade_id: 3 }];
    assert.deepEqual(filterTopicsForSelectedGrades(rows, [1]).map((row) => row.id), []);
    assert.deepEqual(filterTopicsForSelectedGrades(rows, [3]).map((row) => row.id), [89]);
});
