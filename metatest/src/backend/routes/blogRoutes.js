'use strict';

const express = require('express');
const blog = require('../controllers/blogController');

const router = express.Router();

function wrap(handler) {
    return async (req, res, next) => {
        try {
            await handler(req, res, next);
        } catch (err) {
            console.error('[blog]', err.message);
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: 'خطا در دریافت مطالب' });
            }
        }
    };
}

router.get('/posts', wrap(blog.handlePublicList));
router.get('/posts/:slug', wrap(blog.handlePublicOne));

module.exports = router;
