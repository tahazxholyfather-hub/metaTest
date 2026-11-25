'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = __dirname;

test('SEC-003 admin login does not build Admin@ passwords', () => {
    const src = fs.readFileSync(path.join(root, 'controllers/adminController.js'), 'utf8');
    assert.equal(src.includes('Admin@${'), false);
    assert.match(src, /expectedAdminPassword/);
});

test('SEC-004 admin cookie is signed', () => {
    const src = fs.readFileSync(path.join(root, 'controllers/adminController.js'), 'utf8');
    assert.match(src, /createHmac\('sha256'/);
    assert.equal(src.includes('ADMIN-${'), false);
});

test('SEC-005 curriculum save requires an admin session', () => {
    const src = fs.readFileSync(path.join(root, 'controllers/adminController.js'), 'utf8');
    const save = src.slice(src.indexOf('const handleAdminSaveCurriculumItem'));
    assert.match(save.slice(0, 400), /requireAdmin/);
});

test('SEC-006 forged base64 tokens are not accepted', () => {
    const src = fs.readFileSync(path.join(root, 'middleware/auth.js'), 'utf8');
    assert.equal(src.includes("role: 'admin'"), false);
    assert.equal(src.includes('APP_TOKEN'), false);
    assert.match(src, /jwt\.verify/);
});

test('SEC-008 answer checks do not prefer body user_id', () => {
    const src = fs.readFileSync(path.join(root, 'controllers/quizController.js'), 'utf8');
    assert.equal(src.includes('req.body.user_id'), false);
});

test('SEC-009 quiz result handler checks membership', () => {
    const src = fs.readFileSync(path.join(root, 'controllers/quizWorldController.js'), 'utf8');
    const fn = src.slice(src.indexOf('const handleGetQuizResultByUserAndQuiz'));
    assert.match(fn.slice(0, 2500), /quiz_members/);
});

test('SEC-010 OTP send is rate limited', () => {
    const src = fs.readFileSync(path.join(root, 'controllers/userController.js'), 'utf8');
    assert.match(src, /allowOtpAttempt/);
});
