'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { isAppHandoff } = require('../marketingSite');

test('invite and room links are served by the marketing shell', () => {
    assert.equal(isAppHandoff('/invite/MT12AB'), true);
    assert.equal(isAppHandoff('/join/k8Jd2pQaL1'), true);
    assert.equal(isAppHandoff('/invite/MT12AB/'), true);
});

test('other site paths are not treated as an app handoff', () => {
    assert.equal(isAppHandoff('/invite'), false);
    assert.equal(isAppHandoff('/blog/hello'), false);
    assert.equal(isAppHandoff('/app/invite/MT12AB'), false);
});
