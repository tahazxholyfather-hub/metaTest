'use strict';

/**
 * AI Teacher routes
 * Mount: app.use('/api/ai-teacher', require('./ai-teacher/routes'));
 */

const express = require('express');
const router = express.Router();
const { requireToken } = require('../middleware/auth');
const controller = require('./controller');

router.use(requireToken);

router.get('/bootstrap', controller.getBootstrap);
router.get('/teachers', controller.listTeachers);
router.post('/profile', controller.saveStudentProfile);
router.post('/select-teacher', controller.selectTeacher);
router.get('/session', controller.openSession);
router.post('/conversations', controller.createConversation);
router.get('/conversations', controller.listConversations);
router.get('/conversations/:id', controller.getConversation);
router.get('/wallet', controller.getWallet);
router.get('/books', controller.listBooks);
router.post('/settings', controller.updateSettings);
router.post('/chat/stream', controller.streamChat);

module.exports = router;
