'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { createRequire } = require('module');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseCookieHeader, serializeCookie } = require('../../utils/cookies');
const {
    resolveSections,
    sectionAllowed,
    isActionAllowed,
    sanitizeSectionPatch,
} = require('../../admin/sections');
const { countWords, wordDelta } = require('../../admin/words');
const { validateDiscountPayload, parseExpiry } = require('../../admin/discounts');

test('word counts keep Persian words and ZWNJ together', () => {
    assert.equal(countWords('سلام دنیا'), 2);
    assert.equal(countWords('نیم‌فاصله'), 1);
    assert.equal(countWords('<p>Hello&nbsp;world</p>'), 2);
    assert.equal(countWords(''), 0);
});

test('word delta counts added and removed words', () => {
    assert.equal(wordDelta('یک دو سه', 'یک دو سه'), 0);
    assert.equal(wordDelta('یک دو', 'یک دو سه'), 1);
    assert.equal(wordDelta('Hello world', 'hello there'), 2);
    assert.equal(wordDelta('', 'گزینه اول'), 2);
});

test('section defaults and super override', () => {
    const staff = resolveSections(4, []);
    assert.equal(staff.dashboard, true);
    assert.equal(staff['edit-questions'], true);
    assert.equal(staff.discounts, true);
    assert.equal(staff.reports, true);
    assert.equal(staff['word-stats'], true);
    assert.equal(staff['ai-manager'], false);
    assert.equal(staff.admins, false);
    assert.equal(staff.access, false);

    const saved = resolveSections(4, [
        { section_key: 'discounts', allowed: 0 },
        { section_key: 'ai-manager', allowed: 1 },
    ]);
    assert.equal(saved.discounts, false);
    assert.equal(saved['ai-manager'], true);
    assert.equal(saved.dashboard, true);

    const superSections = resolveSections(1, [{ section_key: 'dashboard', allowed: 0 }]);
    assert.equal(superSections.dashboard, true);
    assert.equal(superSections.access, true);
    assert.equal(superSections['ai-manager'], true);
});

test('flow actions follow section grants', () => {
    const reporter = {
        id: 3,
        sections: resolveSections(3, [
            { section_key: 'edit-questions', allowed: 0 },
            { section_key: 'reports', allowed: 1 },
        ]),
    };
    assert.equal(isActionAllowed(reporter, 'Admin_full_update_question'), true);
    assert.equal(isActionAllowed(reporter, 'Admin_insert_questions'), true);
    reporter.sections['insert-questions'] = false;
    assert.equal(isActionAllowed(reporter, 'Admin_insert_questions'), false);
    assert.equal(isActionAllowed(reporter, 'Admin_get_subjects'), true);
    assert.equal(isActionAllowed({ id: 8, sections: { dashboard: true } }, 'not_an_admin_action'), true);
    assert.equal(sectionAllowed({ id: 1, isSuper: true, sections: { reports: false } }, ['reports']), true);
});

test('section patch only keeps known keys', () => {
    const patch = sanitizeSectionPatch({
        dashboard: false,
        access: true,
        'ai-manager': 'true',
        unknown: true,
    });
    assert.deepEqual(patch, { dashboard: false, 'ai-manager': true });
    assert.equal(sanitizeSectionPatch({}), null);
    assert.equal(sanitizeSectionPatch(null), null);
});

test('discount payload validation', () => {
    const ok = validateDiscountPayload({
        code: ' save-10 ',
        percent: 10.5,
        maxUses: '',
        expiresAt: '2026-12-01T18:30',
        allowedPlanIds: ['monthly', 'monthly'],
        active: true,
    });
    assert.equal(ok.ok, true);
    assert.equal(ok.value.code, 'SAVE-10');
    assert.equal(ok.value.percent, 10.5);
    assert.equal(ok.value.maxUses, null);
    assert.equal(ok.value.expiresAt, '2026-12-01 18:30:00');
    assert.equal(ok.value.allowedPlanIds, JSON.stringify(['monthly']));

    assert.equal(validateDiscountPayload({ code: 'A', percent: 10 }).ok, false);
    assert.equal(validateDiscountPayload({ code: 'OK', percent: 0 }).ok, false);
    assert.equal(validateDiscountPayload({ code: 'OK', percent: 101 }).ok, false);
    assert.equal(validateDiscountPayload({ code: 'OK', percent: 5, maxUses: 1.5 }).ok, false);
    assert.equal(parseExpiry('2026-02-31T10:00').ok, false);
    assert.equal(validateDiscountPayload({ code: 'OK', percent: 5, active: 'false' }).value.active, 0);
});

test('admin routes load controllers from the backend root', () => {
    const routeFile = require.resolve('../../routes/adminRoutes.js');
    const src = fs.readFileSync(routeFile, 'utf8');
    assert.doesNotMatch(src, /require\('\.\/(?:controllers|middleware|admin)\//);
    const req = createRequire(routeFile);
    for (const spec of [
        '../controllers/adminDashboardController',
        '../controllers/adminStaffController',
        '../controllers/adminAiController',
        '../adminOpsRoutes',
        '../admin/access',
        '../middleware/adminAuth',
    ]) {
        assert.match(req.resolve(spec), /\.js$/);
        assert.match(src, new RegExp(spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }

    const opsFile = require.resolve('../../adminOpsRoutes.js');
    const opsSrc = fs.readFileSync(opsFile, 'utf8');
    const opsReq = createRequire(opsFile);
    for (const spec of [
        './controllers/adminOpsController',
        './admin/access',
        './middleware/adminAuth',
    ]) {
        assert.match(opsReq.resolve(spec), /\.js$/);
        assert.match(opsSrc, new RegExp(spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.match(opsSrc, /\/discounts/);
    assert.match(opsSrc, /\/reports/);
    assert.match(opsSrc, /\/words/);
    assert.match(opsSrc, /\/access/);

    const serverSrc = fs.readFileSync(require.resolve('../../server.js'), 'utf8');
    assert.match(serverSrc, /registerAdminOps\(app,\s*\{\s*prefix:\s*'\/api\/admin'/);
    const authSrc = fs.readFileSync(require.resolve('../../middleware/adminAuth.js'), 'utf8');
    assert.doesNotMatch(authSrc, /require\(['"]cookie['"]\)/);
});

test('admin session cookies are parsed without the cookie package', () => {
    const set = serializeCookie('admin_token', 'aaa.bbb-ccc_ddd', {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
    });
    assert.equal(set, 'admin_token=aaa.bbb-ccc_ddd; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax');

    const cleared = serializeCookie('admin_token', '', {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        expires: new Date(0),
        maxAge: 0,
    });
    assert.equal(
        cleared,
        'admin_token=; Max-Age=0; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax'
    );
    assert.equal(parseCookieHeader('admin_token=aaa.bbb; other=1').admin_token, 'aaa.bbb');
    assert.equal(parseCookieHeader('').admin_token, undefined);
    assert.equal(parseCookieHeader(['admin_token=%61%62']).admin_token, 'ab');
});

function httpJson(port, method, urlPath, headers) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port,
            method,
            path: urlPath,
            headers,
        }, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const text = Buffer.concat(chunks).toString('utf8');
                let body = text;
                try { body = JSON.parse(text); } catch { /* HTML 404 from express stays text */ }
                resolve({ status: res.statusCode, body, text });
            });
        });
        req.on('error', reject);
        req.end();
    });
}

test('discount and report endpoints answer instead of 404', async (t) => {
    let express;
    let jwt;
    try {
        express = require('express');
        jwt = require('jsonwebtoken');
    } catch (err) {
        if (err && err.code === 'MODULE_NOT_FOUND') {
            t.skip(String(err.message).split('\n')[0]);
            return;
        }
        throw err;
    }

    const dbPath = require.resolve('../../db.js');
    const drop = [
        path.join(__dirname, '../../middleware/adminAuth.js'),
        path.join(__dirname, '../../adminOpsRoutes.js'),
        path.join(__dirname, '../../controllers/adminOpsController.js'),
        path.join(__dirname, '../../admin/access.js'),
    ];
    for (const file of drop) delete require.cache[file];
    require.cache[dbPath] = {
        id: dbPath,
        filename: dbPath,
        loaded: true,
        exports: {
            query: async (sql) => {
                const text = String(sql);
                if (text.includes('reports_tam24')) {
                    if (text.includes('COUNT(*)')) return [[{ total: 0 }]];
                    return [[]];
                }
                if (text.includes('tam24_admins')) {
                    return [[{
                        id: 1,
                        username: 'admin',
                        full_name: 'Main',
                        role: 'super',
                        status: 'active',
                    }]];
                }
                return [[]];
            },
            getConnection: async () => {
                throw new Error('no db');
            },
        },
    };

    process.env.JWT_SECRET = process.env.JWT_SECRET || 'ops-route-test-secret';
    const secret = process.env.ADMIN_JWT_SECRET || `${process.env.JWT_SECRET}:admin-panel`;
    const token = jwt.sign(
        { kind: 'admin', id: 1, username: 'admin', role: 'admin' },
        secret
    );

    const { registerAdminOps } = require('../../adminOpsRoutes');
    const app = express();
    app.use(express.json());
    registerAdminOps(app, { prefix: '/api/admin', withSession: true });
    const login = express.Router();
    login.post('/auth/login', (_req, res) => res.json({ success: true, reached: true }));
    app.use('/api/admin', login);

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    try {
        const anon = await httpJson(port, 'GET', '/api/admin/discounts');
        assert.equal(anon.status, 401);
        assert.equal(anon.body.message, 'Admin authentication required');
        assert.doesNotMatch(String(anon.body.message || anon.text), /Cannot GET/);

        const discounts = await httpJson(port, 'GET', '/api/admin/discounts', { 'x-admin-token': token });
        assert.equal(discounts.status, 200);
        assert.equal(discounts.body.success, true);
        assert.deepEqual(discounts.body.discounts, []);

        const reports = await httpJson(
            port,
            'GET',
            '/api/admin/reports?status=all&page=1',
            { 'x-admin-token': token }
        );
        assert.equal(reports.status, 200);
        assert.equal(reports.body.success, true);
        assert.equal(reports.body.page, 1);
        assert.deepEqual(reports.body.reports, []);
        assert.doesNotMatch(reports.text, /Cannot GET/);

        const loginRes = await httpJson(port, 'POST', '/api/admin/auth/login');
        assert.equal(loginRes.status, 200);
        assert.equal(loginRes.body.reached, true);
    } finally {
        await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    }
});
