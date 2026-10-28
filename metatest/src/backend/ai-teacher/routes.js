'use strict';

/**
 * Met — AI tutor routes
 * Mount: app.use('/api/ai-teacher', require('./ai-teacher/routes'));
 *
 * Everything requires a valid session. Endpoints that call the AI provider
 * are additionally guarded by requireAi / requireFeature so the rest of the
 * app keeps working when the subsystem is disabled or unconfigured.
 */

const express = require('express');
const router = express.Router();
const { requireToken } = require('../middleware/auth');
const controller = require('./controller');
const { streamChat } = require('./chatController');
const fileStorage = require('./services/fileStorage');
const { chatLimiter, uploadLimiter, voiceLimiter, requireAi, requireFeature } = require('./middleware');
const { FILE_LIMITS } = require('./config');

router.use(requireToken);

// Availability + config (works even when AI is off — the UI needs it to render the unavailable state)
router.get('/bootstrap', controller.getBootstrap);
router.get('/subjects', controller.listSubjects);
router.get('/suggestions', controller.getSuggestions);
router.post('/suggestions/:id/used', controller.useSuggestion);

// Conversations & history (read-only history stays available when AI is off)
router.get('/session', controller.openSession);
router.post('/conversations', requireAi, controller.createConversation);
router.get('/conversations', controller.listConversations);
router.get('/conversations/:id', controller.getConversation);
router.patch('/conversations/:id', controller.renameConversation);
router.delete('/conversations/:id', controller.deleteConversation);

// PDF references per conversation (max FILE_LIMITS.maxPdfsPerConversation)
router.get('/conversations/:id/references', controller.listReferences);
router.post(
    '/conversations/:id/references',
    requireFeature('pdfReferences', 'قابلیت منابع PDF غیرفعال است.'),
    uploadLimiter,
    fileStorage.handleUpload(fileStorage.pdfUpload, {
        tooLarge: `حجم PDF باید کمتر از ${FILE_LIMITS.pdfMb} مگابایت باشد.`,
        unsupported: 'فقط فایل PDF پذیرفته می‌شود.',
    }),
    controller.addReference
);
router.delete('/conversations/:id/references/:refId', controller.removeReference);

// Coins
router.get('/wallet', controller.getWallet);
router.get('/wallet/ledger', controller.getLedger);

// Settings
router.get('/settings', controller.getSettings);
router.post('/settings', controller.updateSettings);
router.patch('/settings', controller.updateSettings);

// Memory (student can audit / forget)
router.get('/memory', controller.listMemory);
router.delete('/memory/:id', controller.forgetMemory);
router.delete('/memory', controller.clearMemory);

// Uploads
router.post(
    '/upload-image',
    requireFeature('vision', 'خواندن تصویر فعلاً غیرفعال است.'),
    uploadLimiter,
    fileStorage.handleUpload(fileStorage.imageUpload, {
        tooLarge: `حجم تصویر باید کمتر از ${FILE_LIMITS.imageMb} مگابایت باشد.`,
        unsupported: 'فقط تصویر (PNG، JPG، WebP، GIF) پذیرفته می‌شود.',
    }),
    controller.uploadChatImage
);

// Voice
router.post(
    '/voice/transcribe',
    requireFeature('stt', 'تبدیل گفتار به متن فعلاً غیرفعال است.'),
    voiceLimiter,
    fileStorage.handleUpload(fileStorage.audioUpload, {
        tooLarge: `حجم فایل صوتی باید کمتر از ${FILE_LIMITS.audioMb} مگابایت باشد.`,
        unsupported: 'فرمت صوتی پشتیبانی نمی‌شود.',
    }),
    controller.voiceTranscribe
);
router.post('/voice/speak', requireFeature('tts', 'پاسخ صوتی فعلاً غیرفعال است.'), voiceLimiter, controller.voiceSpeak);

// Per-question practice / quiz conversations
router.get('/questions/:questionId/conversation', requireAi, controller.getQuestionSession);

// Chat (SSE)
router.post('/chat/stream', requireAi, chatLimiter, streamChat);

module.exports = router;
