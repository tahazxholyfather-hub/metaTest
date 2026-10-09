import type { User } from './AuthView';

export interface AdminSection {
    key: string;
    label: string;
    defaultAllowed?: boolean;
}

export const ADMIN_NAV: { id: string; label: string; superOnly?: boolean }[] = [
    { id: 'dashboard', label: 'داشبورد' },
    { id: 'edit-questions', label: 'ویرایش سوال‌ها' },
    { id: 'insert-questions', label: 'افزودن سوال' },
    { id: 'curriculum', label: 'سرفصل‌ها' },
    { id: 'pdf-library', label: 'کتابخانه PDF' },
    { id: 'discount-codes', label: 'کد تخفیف', superOnly: true },
    { id: 'referral-settings', label: 'تنظیمات دعوت', superOnly: true },
    { id: 'withdrawals', label: 'برداشت‌ها', superOnly: true },
    { id: 'word-stats', label: 'فعالیت واژه‌ها' },
    { id: 'reports', label: 'گزارش‌ها' },
    { id: 'ai-manager', label: 'مدیریت هوش مصنوعی' },
    { id: 'admins', label: 'ادمین‌ها' },
    { id: 'access', label: 'دسترسی‌ها', superOnly: true },
];

const TITLES = Object.fromEntries(ADMIN_NAV.map((item) => [item.id, item.label]));

const MAIN_ADMIN_ONLY = new Set(
    ADMIN_NAV.filter((item) => item.superOnly).map((item) => item.id),
);

export function sectionTitle(id: string) {
    return TITLES[id] || 'ادمین';
}

export function canAccessSection(user: User | null | undefined, section: string) {
    if (!user) return false;
    const isMainAdmin = Boolean(user.isSuper || user.id === 1);
    if (MAIN_ADMIN_ONLY.has(section)) return isMainAdmin;
    if (isMainAdmin) return true;
    if (!user.sections) {
        return section !== 'ai-manager' && section !== 'admins';
    }
    return user.sections[section] === true;
}
