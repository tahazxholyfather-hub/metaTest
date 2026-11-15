'use strict';

const { emptyDocument } = require('../questionDisplay');
const store = require('../questionDisplayStore');

const handleGetQuestionDisplay = async (req, res) => {
    try {
        const { document } = await store.readDocument();
        return res.json({ success: true, document });
    } catch (error) {
        console.error('get_question_display error:', error.message);
        return res.json({ success: true, document: emptyDocument() });
    }
};

const handleAdminGetQuestionDisplay = async (req, res) => {
    try {
        const { document, updatedAt } = await store.readDocument();
        return res.json({ success: true, document, updatedAt });
    } catch (error) {
        console.error('Admin_get_question_display error:', error.message);
        return res.status(500).json({ success: false, message: 'خطا در دریافت تنظیمات نمایش.' });
    }
};

const handleAdminUpdateQuestionDisplay = async (req, res) => {
    try {
        const document = await store.writeDocument(req.body?.document ?? req.body, req.admin?.id);
        return res.json({ success: true, document, message: 'تنظیمات نمایش ذخیره شد.' });
    } catch (error) {
        console.error('Admin_update_question_display error:', error.message);
        return res.status(500).json({ success: false, message: 'خطا در ذخیره تنظیمات نمایش.' });
    }
};

module.exports = {
    handleGetQuestionDisplay,
    handleAdminGetQuestionDisplay,
    handleAdminUpdateQuestionDisplay,
};
