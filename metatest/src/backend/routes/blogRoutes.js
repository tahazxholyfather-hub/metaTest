'use strict';

const express = require('express');
const blog = require('../controllers/blogController');

const router = express.Router();

function wrap(handler) {
    return async (req, res, next) => {
        try {
            await handler(req, res, next);
        } catch (err) {
            next(err);
        }
    };
}

router.get('/categories', wrap(blog.handlePublicCategories));
router.get('/posts', wrap(blog.handlePublicList));
router.get('/posts/:slug', wrap(blog.handlePublicOne));

router.use((err, _req, res, _next) => {
    console.error('[blog]', err.message);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'خطا در دریافت مطالب' });
});

module.exports = router;
