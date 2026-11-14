'use strict';

const express = require('express');
const contact = require('../controllers/contactController');

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

router.post('/', wrap(contact.handlePublicSubmit));

router.use((err, _req, res, _next) => {
    console.error('[contact]', err.message);
    res.status(500).json({ success: false, message: 'ثبت پیام ممکن نشد. کمی بعد دوباره تلاش کنید.' });
});

module.exports = router;
