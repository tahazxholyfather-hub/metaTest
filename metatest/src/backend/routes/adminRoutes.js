'use strict';

const express = require('express');
const router = express.Router();
const dashboard = require('../controllers/adminDashboardController');
const staff = require('../controllers/adminStaffController');
const ai = require('../controllers/adminAiController');
const ops = require('../controllers/adminOpsController');
const subscriptions = require('../controllers/adminSubscriptionController');
const { requireSection, withSections } = require('../admin/access');
const {
    requireAdminSession,
    requireSuperAdmin,
    loginRateLimited,
    clientIp,
    authenticateAdmin,
    recordLoginSuccess,
    issueSession,
    clearAdminCookie,
    attachAdminIfPresent,
} = require('../middleware/adminAuth');

function wrap(handler) {
    return async (req, res, next) => {
        try {
            await handler(req, res, next);
        } catch (err) {
            next(err);
        }
    };
}

// ── Auth (no student JWT) ────────────────────────────────────────────────────
router.post('/auth/login', wrap(async (req, res) => {
    if (loginRateLimited(req)) {
        return res.status(429).json({ success: false, message: 'Too many login attempts. Please wait a minute.' });
    }
    const username = req.body.username;
    const password = req.body.password;
    if (!username || !password) {
        return res.json({ success: false, message: 'Username and password are required' });
    }
    const result = await authenticateAdmin(username, password);
    if (!result.ok) return res.json({ success: false, message: result.message });
    await recordLoginSuccess(result.admin.id, clientIp(req));
    const user = await issueSession(res, result.admin);
    await withSections(user);
    return res.json({ success: true, user });
}));

router.get('/auth/me', wrap(async (req, res) => {
    const admin = await attachAdminIfPresent(req);
    if (!admin) return res.json({ success: false, message: 'No session found.' });
    await withSections(admin);
    return res.json({ success: true, user: admin });
}));

router.post('/auth/logout', wrap(async (_req, res) => {
    clearAdminCookie(res);
    return res.json({ success: true, message: 'Logged out' });
}));

// Everything below requires a valid admin session
router.use(requireAdminSession);

router.get('/dashboard', requireSection('dashboard'), wrap(dashboard.handleGetDashboard));

router.get('/words', requireSection('word-stats'), wrap(ops.handleWordStats));

router.get('/reports', requireSection('reports'), wrap(ops.handleListReports));
router.patch('/reports/:id', requireSection('reports'), wrap(ops.handleUpdateReport));

// Section access stays with the main admin even if another admin can open Admins.
router.get('/subscriptions', requireSuperAdmin, wrap(subscriptions.handleGetCatalog));
router.post('/subscriptions/plans', requireSuperAdmin, wrap(subscriptions.handleCreatePlan));
router.put('/subscriptions/settings', requireSuperAdmin, wrap(subscriptions.handleSaveSettings));
router.put('/subscriptions/plans/:id', requireSuperAdmin, wrap(subscriptions.handleSavePlan));
router.delete('/subscriptions/plans/:id', requireSuperAdmin, wrap(subscriptions.handleDeletePlan));
router.put('/subscriptions/loyalty', requireSuperAdmin, wrap(subscriptions.handleSaveLoyalty));

router.get('/access', requireSuperAdmin, wrap(ops.handleListAccess));
router.put('/access/:id', requireSuperAdmin, wrap(ops.handleSaveAccess));

router.get('/admins', requireSection('admins'), wrap(staff.handleListAdmins));
router.post('/admins', requireSection('admins'), wrap(staff.handleCreateAdmin));
router.patch('/admins/:id', requireSection('admins'), wrap(staff.handleUpdateAdmin));
router.delete('/admins/:id', requireSection('admins'), wrap(staff.handleDeleteAdmin));

router.get('/ai/settings', requireSection('ai-manager'), wrap(ai.handleGetSettings));
router.put('/ai/settings', requireSection('ai-manager'), wrap(ai.handleSaveSettings));
router.get('/ai/stats', requireSection('ai-manager'), wrap(ai.handleAiStats));
router.get('/ai/usage', requireSection('ai-manager'), wrap(ai.handleUsageLogs));

router.get('/ai/subjects', requireSection('ai-manager'), wrap(ai.handleListSubjects));
router.put('/ai/subjects/:key', requireSection('ai-manager'), wrap(ai.handleSaveSubject));
router.post('/ai/subjects/:key/reset-prompts', requireSection('ai-manager'), wrap(ai.handleResetSubjectPrompts));

router.get('/ai/knowledge', requireSection('ai-manager'), wrap(ai.handleListKnowledge));
router.get('/ai/knowledge/:id', requireSection('ai-manager'), wrap(ai.handleGetKnowledge));
router.post('/ai/knowledge', requireSection('ai-manager'), wrap(ai.handleSaveKnowledge));
router.put('/ai/knowledge/:id', requireSection('ai-manager'), wrap(ai.handleSaveKnowledge));
router.delete('/ai/knowledge/:id', requireSection('ai-manager'), wrap(ai.handleDeleteKnowledge));

router.get('/ai/suggestions', requireSection('ai-manager'), wrap(ai.handleListSuggestions));
router.post('/ai/suggestions', requireSection('ai-manager'), wrap(ai.handleSaveSuggestion));
router.put('/ai/suggestions/:id', requireSection('ai-manager'), wrap(ai.handleSaveSuggestion));
router.delete('/ai/suggestions/:id', requireSection('ai-manager'), wrap(ai.handleDeleteSuggestion));

router.get('/ai/books', requireSection('ai-manager'), wrap(ai.handleListBooks));
router.post('/ai/books', requireSection('ai-manager'), wrap(ai.handleSaveBook));
router.put('/ai/books/:id', requireSection('ai-manager'), wrap(ai.handleSaveBook));
router.delete('/ai/books/:id', requireSection('ai-manager'), wrap(ai.handleDeleteBook));
router.post('/ai/books/:id/ingest', requireSection('ai-manager'), wrap(ai.handleIngestBook));

router.get('/ai/pricing', requireSection('ai-manager'), wrap(ai.handleListPricing));
router.post('/ai/pricing', requireSection('ai-manager'), wrap(ai.handleSavePricing));
router.put('/ai/pricing/:id', requireSection('ai-manager'), wrap(ai.handleSavePricing));
router.delete('/ai/pricing/:id', requireSection('ai-manager'), wrap(ai.handleDeletePricing));

router.get('/ai/wallets', requireSection('ai-manager'), wrap(ai.handleSearchWallets));
router.post('/ai/wallets/:userId/adjust', requireSection('ai-manager'), wrap(ai.handleAdjustWallet));

router.get('/ai/memory', requireSection('ai-manager'), wrap(ai.handleListMemory));
router.post('/ai/memory', requireSection('ai-manager'), wrap(ai.handleSaveMemory));
router.put('/ai/memory/:id', requireSection('ai-manager'), wrap(ai.handleSaveMemory));
router.delete('/ai/memory/:id', requireSection('ai-manager'), wrap(ai.handleDeleteMemory));

router.get('/ai/conversations', requireSection('ai-manager'), wrap(ai.handleListConversations));
router.get('/ai/conversations/:id', requireSection('ai-manager'), wrap(ai.handleGetConversation));
router.delete('/ai/conversations/:id', requireSection('ai-manager'), wrap(ai.handleDeleteConversation));

router.get('/ai/user-settings/:userId', requireSection('ai-manager'), wrap(ai.handleGetUserSettings));
router.put('/ai/user-settings/:userId', requireSection('ai-manager'), wrap(ai.handleSaveUserSettings));

router.use((err, _req, res, _next) => {
    console.error('[admin] route error:', err);
    if (res.headersSent) return;
    res.status(500).json({ success: false, message: 'Internal server error' });
});

module.exports = router;
