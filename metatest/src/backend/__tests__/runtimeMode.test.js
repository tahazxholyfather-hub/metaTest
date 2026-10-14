'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('path');
const { isLocalhostFlag, profileFromEnv } = require('../runtimeMode');

test('localhost flag accepts the common off values', () => {
    assert.equal(isLocalhostFlag(undefined), true);
    assert.equal(isLocalhostFlag('true'), true);
    assert.equal(isLocalhostFlag('false'), false);
    assert.equal(isLocalhostFlag('0'), false);
    assert.equal(isLocalhostFlag('off'), false);
});

test('local profile uses the dev ports and the repo public folder', () => {
    const profile = profileFromEnv({ LOCALHOST: 'true', FRONTEND_ORIGIN: 'http://localhost:5173' });
    assert.equal(profile.localhost, true);
    assert.equal(profile.appBase, '/');
    assert.equal(profile.socketUrl, 'http://localhost:4000');
    assert.equal(profile.apiBase, 'http://localhost:3000/api');
    assert.equal(profile.avatarDir, path.resolve(__dirname, '../../../public/avatars'));
    assert.ok(profile.corsOrigins.includes('http://localhost:5173'));
});

test('cPanel profile uses /app, the public socket, and public_html', () => {
    const profile = profileFromEnv({ LOCALHOST: 'false', HOME: '/home/meta', WEB_ROOT: '' });
    assert.equal(profile.localhost, false);
    assert.equal(profile.appBase, '/app/');
    assert.equal(profile.socketUrl, 'https://socket.metatest.app');
    assert.equal(profile.apiBase, 'https://metatest.app/api');
    assert.equal(profile.avatarDir, path.resolve('/home/meta/public_html/avatars'));
    assert.ok(profile.corsOrigins.includes('https://metatest.app'));
});
