import assert from 'node:assert/strict';
import { compareCurriculumItems, topicMatchesGradeTitle } from './chapterGrades.ts';

const topics = [
    { id: 1, title: 'آمار', subject_id: 1 },
    { id: 12, title: 'فصل یک دهم', subject_id: 4 },
    { id: 19, title: 'فصل یک یازدهم', subject_id: 4 },
    { id: 36, title: 'ترکیبی دهم و یازدهم', subject_id: 4 },
    { id: 40, title: 'ترکیبی سه پایه', subject_id: 4 },
    { id: 42, title: 'تابع يازدهم', subject_id: 1 },
    { id: 3, title: 'سینماتیک', subject_id: 2 },
];

assert.equal(topicMatchesGradeTitle('فصل یک دهم', 'دهم'), true);
assert.equal(topicMatchesGradeTitle('فصل یک دهم', 'یازدهم'), false);
assert.equal(topicMatchesGradeTitle('فصل یک یازدهم', 'دوازدهم'), false);
assert.equal(topicMatchesGradeTitle('ترکیبی دهم و یازدهم', 'دهم'), true);
assert.equal(topicMatchesGradeTitle('ترکیبی دهم و یازدهم', 'دوازدهم'), false);
assert.equal(topicMatchesGradeTitle('ترکیبی سه پایه', 'دوازدهم'), true);
assert.equal(topicMatchesGradeTitle('تابع يازدهم', 'یازدهم'), true);
assert.equal(topicMatchesGradeTitle('آمار', 'دهم'), false);
assert.equal(topicMatchesGradeTitle('فصل چهاردهم', 'دهم'), false);
assert.equal(topicMatchesGradeTitle('فصل یک دهم', ''), true);

const chapters = [
    { id: 9, title: 'گفتار دهم', topic_id: 12 },
    { id: 2, title: 'گفتار یازدهم', topic_id: 19 },
    { id: 4, title: 'گفتار دیگر دهم', topic_id: 12 },
];

const ordered = [...chapters].sort((a, b) => compareCurriculumItems(a, b, 'chapter', topics));
assert.deepEqual(ordered.map((row) => row.id), [4, 9, 2]);

const orderedTopics = [...topics].sort((a, b) => compareCurriculumItems(a, b, 'topic', topics));
assert.deepEqual(orderedTopics.map((row) => row.id), [42, 1, 3, 12, 36, 19, 40]);

console.log('chapter grade filter ok');
