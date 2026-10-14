'use strict';

const express = require('express');
const router = express.Router();
const dashboard = require('./controllers/adminDashboardController');
const staff = require('./controllers/adminStaffController');
const ai = require('./controllers/adminAiController');
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
    publicAdmin,
} = require('./middleware/adminAuth');

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
    return res.json({ success: true, user });
}));

router.get('/auth/me', wrap(async (req, res) => {
    const admin = await attachAdminIfPresent(req);
    if (!admin) return res.json({ success: false, message: 'No session found.' });
    return res.json({ success: true, user: publicAdmin(admin) });
}));

router.post('/auth/logout', wrap(async (_req, res) => {
    clearAdminCookie(res);
    return res.json({ success: true, message: 'Logged out' });
}));

// Everything below requires a valid admin session
router.use(requireAdminSession);

router.get('/dashboard', wrap(dashboard.handleGetDashboard));

// Admins manager + AI manager: main admin (id 1) only
router.get('/admins', requireSuperAdmin, wrap(staff.handleListAdmins));
router.post('/admins', requireSuperAdmin, wrap(staff.handleCreateAdmin));
router.patch('/admins/:id', requireSuperAdmin, wrap(staff.handleUpdateAdmin));
router.delete('/admins/:id', requireSuperAdmin, wrap(staff.handleDeleteAdmin));

router.get('/ai/settings', requireSuperAdmin, wrap(ai.handleGetSettings));
router.put('/ai/settings', requireSuperAdmin, wrap(ai.handleSaveSettings));
router.get('/ai/stats', requireSuperAdmin, wrap(ai.handleAiStats));
router.get('/ai/usage', requireSuperAdmin, wrap(ai.handleUsageLogs));

router.get('/ai/subjects', requireSuperAdmin, wrap(ai.handleListSubjects));
router.put('/ai/subjects/:key', requireSuperAdmin, wrap(ai.handleSaveSubject));
router.post('/ai/subjects/:key/reset-prompts', requireSuperAdmin, wrap(ai.handleResetSubjectPrompts));

router.get('/ai/knowledge', requireSuperAdmin, wrap(ai.handleListKnowledge));
router.get('/ai/knowledge/:id', requireSuperAdmin, wrap(ai.handleGetKnowledge));
router.post('/ai/knowledge', requireSuperAdmin, wrap(ai.handleSaveKnowledge));
router.put('/ai/knowledge/:id', requireSuperAdmin, wrap(ai.handleSaveKnowledge));
router.delete('/ai/knowledge/:id', requireSuperAdmin, wrap(ai.handleDeleteKnowledge));

router.get('/ai/suggestions', requireSuperAdmin, wrap(ai.handleListSuggestions));
router.post('/ai/suggestions', requireSuperAdmin, wrap(ai.handleSaveSuggestion));
router.put('/ai/suggestions/:id', requireSuperAdmin, wrap(ai.handleSaveSuggestion));
router.delete('/ai/suggestions/:id', requireSuperAdmin, wrap(ai.handleDeleteSuggestion));

router.get('/ai/books', requireSuperAdmin, wrap(ai.handleListBooks));
router.post('/ai/books', requireSuperAdmin, wrap(ai.handleSaveBook));
router.put('/ai/books/:id', requireSuperAdmin, wrap(ai.handleSaveBook));
router.delete('/ai/books/:id', requireSuperAdmin, wrap(ai.handleDeleteBook));
router.post('/ai/books/:id/ingest', requireSuperAdmin, wrap(ai.handleIngestBook));

router.get('/ai/pricing', requireSuperAdmin, wrap(ai.handleListPricing));
router.post('/ai/pricing', requireSuperAdmin, wrap(ai.handleSavePricing));
router.put('/ai/pricing/:id', requireSuperAdmin, wrap(ai.handleSavePricing));
router.delete('/ai/pricing/:id', requireSuperAdmin, wrap(ai.handleDeletePricing));

router.get('/ai/wallets', requireSuperAdmin, wrap(ai.handleSearchWallets));
router.post('/ai/wallets/:userId/adjust', requireSuperAdmin, wrap(ai.handleAdjustWallet));

router.get('/ai/memory', requireSuperAdmin, wrap(ai.handleListMemory));
router.post('/ai/memory', requireSuperAdmin, wrap(ai.handleSaveMemory));
router.put('/ai/memory/:id', requireSuperAdmin, wrap(ai.handleSaveMemory));
router.delete('/ai/memory/:id', requireSuperAdmin, wrap(ai.handleDeleteMemory));

router.get('/ai/conversations', requireSuperAdmin, wrap(ai.handleListConversations));
router.get('/ai/conversations/:id', requireSuperAdmin, wrap(ai.handleGetConversation));
router.delete('/ai/conversations/:id', requireSuperAdmin, wrap(ai.handleDeleteConversation));

router.get('/ai/user-settings/:userId', requireSuperAdmin, wrap(ai.handleGetUserSettings));
router.put('/ai/user-settings/:userId', requireSuperAdmin, wrap(ai.handleSaveUserSettings));

router.use((err, _req, res, _next) => {
    console.error('[admin] route error:', err);
    if (res.headersSent) return;
    res.status(500).json({ success: false, message: 'Internal server error' });
});

module.exports = router;
