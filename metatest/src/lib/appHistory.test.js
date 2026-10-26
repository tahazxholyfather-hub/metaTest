import assert from 'node:assert/strict';
import { createHistory, pushEntry, back, noteRouter, sameEntry, entryForPath, toAppPath, EXIT_NOTICE } from './appHistory.js';

const dash = { kind: 'view', view: 'dashboard' };
const practice = { kind: 'view', view: 'practice' };
const step2 = { kind: 'practice', step: 2 };
const step3 = { kind: 'practice', step: 3 };
const tests = { kind: 'view', view: 'tests' };
const selector = { kind: 'tests', screen: 'selector' };

const state = (...entries) => ({ stack: entries, guardOnTop: false, armedUntil: 0 });

assert.equal(sameEntry(step2, { kind: 'practice', step: 2 }), true);
assert.equal(sameEntry(selector, { kind: 'tests', screen: 'needs' }), false);

let s = pushEntry(pushEntry(createHistory(dash), practice), step2);
assert.deepEqual(s.stack.map((e) => e.kind === 'view' ? e.view : e.step), ['dashboard', 'practice', 2]);

let popped = back(s, 1_000);
assert.equal(popped.action, 'pop');
assert.equal(popped.popped.step, 2);
assert.equal(popped.top.view, 'practice');
assert.equal(popped.needsGuard, false);

s = pushEntry(pushEntry(createHistory(tests), selector), { kind: 'tests', screen: 'needs' });
popped = back(s, 1_000);
assert.equal(popped.popped.screen, 'needs');
popped = back(popped.state, 1_000);
assert.equal(popped.popped.screen, 'selector');
assert.equal(popped.needsGuard, true);
assert.equal(popped.top.view, 'tests');

const duplicate = pushEntry(state(dash, step2), step2);
assert.equal(duplicate.stack.length, 2);

const root = createHistory(dash);
const first = back(root, 5_000);
assert.equal(first.action, 'trap');
assert.equal(first.notice, EXIT_NOTICE);
const second = back(first.state, 5_500);
assert.equal(second.action, 'leave');
const late = back(first.state, 9_000);
assert.equal(late.action, 'trap');

const noted = noteRouter(createHistory(dash), practice, 'PUSH');
assert.equal(noted.stack.length, 2);
const same = noteRouter(noted, practice, 'PUSH');
assert.equal(same.stack.length, 2);
const replaced = noteRouter(noted, { kind: 'route', path: '/quiz/1' }, 'REPLACE');
assert.equal(replaced.stack[1].path, '/quiz/1');
assert.equal(noteRouter(replaced, dash, 'POP').stack.length, 2);

s = pushEntry(pushEntry(createHistory(dash), practice), step3);
assert.equal(back(s, 0).popped.step, 3);

assert.equal(toAppPath('/app/dashboard', '/app'), '/dashboard');
assert.equal(toAppPath('/app', '/app'), '/');
assert.equal(toAppPath('/dashboard', '/app'), '/dashboard');
assert.equal(toAppPath('/dashboard', ''), '/dashboard');
assert.equal(sameEntry(entryForPath('/app/quiz/4', '/app'), { kind: 'route', path: '/quiz/4' }), true);
assert.equal(sameEntry(entryForPath('/app/practice', '/app'), { kind: 'view', view: 'practice' }), true);
assert.equal(toAppPath('/app/quiz/4', '/app').startsWith('/quiz'), true);

console.log('appHistory.test.js ok');
