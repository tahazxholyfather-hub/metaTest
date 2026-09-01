'use strict';

/**
 * Met — AI tutor routes
 * Mount: app.use('/api/ai-teacher', require('./ai-teacher/routes'));
 */

const express = require('express');
const router = express.Router();
const { requireToken } = require('../middleware/auth');
const controller = require('./controller');
const { uploadMiddleware } = require('./services/imageService');

router.use(requireToken);

router.get('/bootstrap', controller.getBootstrap);
router.post('/intro-seen', controller.markIntroSeen);
router.get('/subjects', controller.listSubjects);

router.get('/session', controller.openSession);
router.post('/conversations', controller.createConversation);
router.get('/conversations', controller.listConversations);
router.get('/conversations/:id', controller.getConversation);
router.patch('/conversations/:id', controller.renameConversation);
router.delete('/conversations/:id', controller.deleteConversation);

router.get('/wallet', controller.getWallet);

router.post('/upload-image', (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
        if (err) {
            return res.status(400).json({ success: false, message: 'آپلود تصویر ناموفق بود (نوع یا حجم فایل نامعتبر).' });
        }
        next();
    });
}, controller.uploadChatImage);

router.post('/chat/stream', controller.streamChat);

module.exports = router;
