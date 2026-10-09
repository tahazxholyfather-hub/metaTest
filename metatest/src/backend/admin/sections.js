'use strict';

// Section catalog for the admin panel. Super admin (id 1) always has every
// section. Other admins use defaults until the super admin saves overrides.
const SUPER_ADMIN_ID = 1;

const ASSIGNABLE_SECTIONS = [
    { key: 'dashboard', label: 'Dashboard', defaultAllowed: true },
    { key: 'edit-questions', label: 'Edit Questions', defaultAllowed: true },
    { key: 'insert-questions', label: 'Insert Questions', defaultAllowed: true },
    { key: 'curriculum', label: 'Curriculum', defaultAllowed: true },
    { key: 'pdf-library', label: 'PDF Library', defaultAllowed: true },
    { key: 'discount-codes', label: 'کد تخفیف', defaultAllowed: true },
    { key: 'referral-settings', label: 'تنظیمات دعوت', defaultAllowed: true },
    { key: 'withdrawals', label: 'برداشت‌ها', defaultAllowed: true },
    { key: 'word-stats', label: 'Word Activity', defaultAllowed: true },
    { key: 'discounts', label: 'Discount Codes', defaultAllowed: true },
    { key: 'reports', label: 'Reports', defaultAllowed: true },
    { key: 'ai-manager', label: 'AI Manager', defaultAllowed: false },
    { key: 'admins', label: 'Admins', defaultAllowed: false },
];

const ASSIGNABLE_KEYS = new Set(ASSIGNABLE_SECTIONS.map((section) => section.key));

// Flow actions that read shared curriculum lists are allowed from every
// section that renders those dropdowns. Mutations stay on one section.
const ACTION_SECTIONS = {
    Admin_update_question: ['edit-questions', 'reports'],
    Admin_get_question_for_edit: ['edit-questions', 'reports'],
    Admin_full_update_question: ['edit-questions', 'reports'],
    Admin_get_question_by_filters: ['edit-questions'],
    Admin_insert_questions: ['insert-questions'],
    Admin_parse_questions_docx: ['insert-questions'],
    Admin_get_curriculum: ['curriculum', 'insert-questions', 'edit-questions', 'reports'],
    Admin_save_curriculum_item: ['curriculum'],
    Admin_delete_curriculum_item: ['curriculum'],
    Admin_get_pdfs: ['pdf-library'],
    Admin_save_pdf: ['pdf-library'],
    Admin_delete_pdf: ['pdf-library'],
    Admin_get_discount_codes: ['discount-codes'],
    Admin_save_discount_code: ['discount-codes'],
    Admin_toggle_discount_code: ['discount-codes'],
    Admin_delete_discount_code: ['discount-codes'],
    Admin_get_referral_settings: ['referral-settings'],
    Admin_update_referral_settings: ['referral-settings'],
    Admin_get_withdrawal_requests: ['withdrawals'],
    Admin_update_withdrawal_status: ['withdrawals'],
    Admin_get_subjects: ['edit-questions', 'insert-questions', 'curriculum', 'reports'],
    Admin_get_grades_by_subject: ['edit-questions', 'insert-questions', 'curriculum', 'reports'],
    Admin_get_chapters_by_subject: ['edit-questions', 'insert-questions', 'curriculum', 'reports'],
    Admin_get_mabahes_by_chapter: ['edit-questions', 'insert-questions', 'curriculum', 'reports'],
};

function isSuperAdminId(admin) {
    return Number(admin?.id) === SUPER_ADMIN_ID || admin?.isSuper === true;
}

function resolveSections(adminId, rows = []) {
    const isSuper = Number(adminId) === SUPER_ADMIN_ID;
    const saved = new Map();
    for (const row of rows) {
        saved.set(String(row.section_key), Number(row.allowed) === 1);
    }

    const sections = {};
    for (const section of ASSIGNABLE_SECTIONS) {
        if (isSuper) sections[section.key] = true;
        else if (saved.has(section.key)) sections[section.key] = saved.get(section.key);
        else sections[section.key] = section.defaultAllowed;
    }
    sections.access = isSuper;
    return sections;
}

function sectionAllowed(admin, keys) {
    if (!admin) return false;
    if (isSuperAdminId(admin)) return true;
    const needed = Array.isArray(keys) ? keys : [keys];
    if (!admin.sections) return false;
    return needed.some((key) => admin.sections[key] === true);
}

function sectionsForAction(action) {
    if (!action || !Object.prototype.hasOwnProperty.call(ACTION_SECTIONS, action)) return null;
    return ACTION_SECTIONS[action];
}

function isActionAllowed(admin, action) {
    const needed = sectionsForAction(action);
    if (!needed) return true;
    return sectionAllowed(admin, needed);
}

function sanitizeSectionPatch(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
    const patch = {};
    for (const section of ASSIGNABLE_SECTIONS) {
        if (!Object.prototype.hasOwnProperty.call(input, section.key)) continue;
        patch[section.key] = input[section.key] === true || input[section.key] === 1 || input[section.key] === '1' || input[section.key] === 'true';
    }
    return Object.keys(patch).length ? patch : null;
}

module.exports = {
    SUPER_ADMIN_ID,
    ASSIGNABLE_SECTIONS,
    ASSIGNABLE_KEYS,
    ACTION_SECTIONS,
    resolveSections,
    sectionAllowed,
    sectionsForAction,
    isActionAllowed,
    sanitizeSectionPatch,
    isSuperAdminId,
};
