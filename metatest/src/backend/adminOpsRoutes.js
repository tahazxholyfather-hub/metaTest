'use strict';

const ops = require('./controllers/adminOpsController');
const { requireSection } = require('./admin/access');
const { requireAdminSession, requireSuperAdmin } = require('./middleware/adminAuth');

function wrap(handler) {
    return async (req, res, next) => {
        try {
            await handler(req, res, next);
        } catch (err) {
            console.error('[admin] route error:', err);
            if (res.headersSent) return;
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    };
}

// Word activity, discount codes, reports, and section access.
// `withSession` is for mounting on the app directly. The admin router already
// applies requireAdminSession to everything except login.
function registerAdminOps(target, { prefix = '', withSession = false } = {}) {
    const session = withSession ? [requireAdminSession] : [];
    const route = (method, path, ...handlers) => {
        target[method](`${prefix}${path}`, ...session, ...handlers);
    };

    route('get', '/words', requireSection('word-stats'), wrap(ops.handleWordStats));

    route('get', '/discounts', requireSection('discounts'), wrap(ops.handleListDiscounts));
    route('post', '/discounts', requireSection('discounts'), wrap(ops.handleSaveDiscount));
    route('patch', '/discounts/:id', requireSection('discounts'), wrap(ops.handleSaveDiscount));
    route('delete', '/discounts/:id', requireSection('discounts'), wrap(ops.handleDeleteDiscount));

    route('get', '/reports', requireSection('reports'), wrap(ops.handleListReports));
    route('patch', '/reports/:id', requireSection('reports'), wrap(ops.handleUpdateReport));

    route('get', '/access', requireSuperAdmin, wrap(ops.handleListAccess));
    route('put', '/access/:id', requireSuperAdmin, wrap(ops.handleSaveAccess));
}

module.exports = {
    registerAdminOps,
};
