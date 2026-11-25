'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { sanitizeQuestionHtml, sanitizeApiBody } = require('../sanitizeQuestionHtml');

const STORED_SCRIPT = '<p>2<sup>3</sup></p><script>alert(1)</script><img src=x onerror="alert(1)"><a href="javascript:alert(1)">x</a>';

test('SEC-013 strips script and event handlers and keeps math tags', () => {
    const clean = sanitizeQuestionHtml(STORED_SCRIPT);
    assert.equal(clean.includes('<script'), false);
    assert.equal(clean.includes('onerror'), false);
    assert.equal(clean.includes('javascript:'), false);
    assert.equal(clean.includes('<sup>'), true);
    assert.equal(clean.includes('<p>'), true);
});

test('SEC-013 a stored script is neutralized before the API returns it', () => {
    const stored = {
        success: true,
        data: [{
            questionText: STORED_SCRIPT,
            noteText: 'یادداشت<script>alert(1)</script><img src=x onerror=alert(1)>',
            descriptiveAnswer: '<span style="color:red" onclick="alert(1)">پاسخ</span>',
            options: ['<b>گزینه</b>', '<script>alert(1)</script>'],
        }],
        question: {
            id: 4,
            text: STORED_SCRIPT,
            subject_id: 1,
            options: [{ id: 1, text: '<sup>2</sup><img src=x onerror="alert(1)">', image: null }],
        },
        descriptive_answer: { text: STORED_SCRIPT, image: null },
        question_text: STORED_SCRIPT,
    };
    const clean = sanitizeApiBody(stored);
    const blob = JSON.stringify(clean);
    assert.equal(blob.includes('<script'), false);
    assert.equal(blob.includes('onerror'), false);
    assert.equal(blob.includes('onclick'), false);
    assert.equal(blob.includes('javascript:'), false);
    assert.equal(blob.includes('style='), false);
    assert.equal(clean.data[0].questionText.includes('<sup>'), true);
    assert.equal(clean.data[0].noteText.includes('یادداشت'), true);
    assert.equal(clean.data[0].options[0].includes('<b>'), true);
    assert.equal(clean.question.options[0].text.includes('<sup>'), true);
    assert.equal(clean.question.id, 4);
    assert.equal(clean.question.subject_id, 1);
});

test('SEC-013 leaves unrelated text fields alone', () => {
    const blog = { type: 'html', text: '<p style="color:red">سلام</p>' };
    assert.equal(sanitizeApiBody(blog), blog);
});

test('SEC-013 null question html stays null', () => {
    const body = { descriptive_answer: { text: null, image: null } };
    assert.equal(sanitizeApiBody(body).descriptive_answer.text, null);
});

test('SEC-013 saves and responses both call the sanitizer', () => {
    const root = path.resolve(__dirname, '../..');
    const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
    const admin = fs.readFileSync(path.join(root, 'controllers/adminController.js'), 'utf8');
    const user = fs.readFileSync(path.join(root, 'controllers/userController.js'), 'utf8');
    assert.match(server, /sanitizeApiBody/);
    assert.match(admin, /sanitizeQuestionHtml\(text\)/);
    assert.match(admin, /sanitizeQuestionHtml\(question\.text\)/);
    assert.match(user, /sanitizeQuestionHtml\(rawNote\)/);
});
