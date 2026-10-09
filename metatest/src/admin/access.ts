import type { User } from './AuthView';

export interface AdminSection {
    key: string;
    label: string;
    defaultAllowed?: boolean;
}

export const ADMIN_NAV: { id: string; label: string; superOnly?: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'edit-questions', label: 'Edit Questions' },
    { id: 'insert-questions', label: 'Insert Questions' },
    { id: 'curriculum', label: 'Curriculum' },
    { id: 'pdf-library', label: 'PDF Library' },
    { id: 'discount-codes', label: 'کد تخفیف' },
    { id: 'referral-settings', label: 'تنظیمات دعوت' },
    { id: 'withdrawals', label: 'برداشت‌ها' },
    { id: 'word-stats', label: 'Word Activity' },
    { id: 'reports', label: 'Reports' },
    { id: 'ai-manager', label: 'AI Manager' },
    { id: 'admins', label: 'Admins' },
    { id: 'access', label: 'Access', superOnly: true },
];

const TITLES = Object.fromEntries(ADMIN_NAV.map((item) => [item.id, item.label]));

export function sectionTitle(id: string) {
    return TITLES[id] || 'Admin';
}

export function canAccessSection(user: User | null | undefined, section: string) {
    if (!user) return false;
    if (section === 'access') return Boolean(user.isSuper || user.id === 1);
    if (user.isSuper || user.id === 1) return true;
    if (!user.sections) {
        return section !== 'ai-manager' && section !== 'admins' && section !== 'access';
    }
    return user.sections[section] === true;
}
