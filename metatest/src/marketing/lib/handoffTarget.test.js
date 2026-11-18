import assert from 'node:assert/strict';
import test from 'node:test';
import { handoffUrl, safeToken } from './handoffTarget.js';

test('invite links on the public site open the app mount', () => {
    assert.equal(handoffUrl('invite', 'MT12AB', 'metatest.app'), '/app/invite/MT12AB');
    assert.equal(handoffUrl('join', 'k8Jd2pQaL1', 'www.metatest.app'), '/app/lobby/k8Jd2pQaL1');
});

test('local marketing hands the visitor to the dev app', () => {
    assert.equal(handoffUrl('invite', 'MT12AB', 'localhost'), 'http://localhost:5173/invite/MT12AB');
    assert.equal(handoffUrl('join', 'k8Jd2pQaL1', '127.0.0.1'), 'http://localhost:5173/lobby/k8Jd2pQaL1');
});

test('unsafe codes do not become a redirect', () => {
    assert.equal(safeToken('../admin'), '');
    assert.equal(safeToken(''), '');
    assert.equal(handoffUrl('invite', 'https://evil.example', 'metatest.app'), '');
    assert.equal(handoffUrl('nope', 'MT12AB', 'metatest.app'), '');
});
