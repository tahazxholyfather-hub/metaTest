import type { User } from './AuthView';

export const ADMIN_NAV: { id: string; label: string; superOnly?: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'edit-questions', label: 'Edit Questions' },
    { id: 'insert-questions', label: 'Insert Questions' },
    { id: 'curriculum', label: 'Curriculum' },
    { id: 'pdf-library', label: 'PDF Library' },
    { id: 'subscription-plans', label: 'پلن‌ها و تعرفه‌ها' },
    { id: 'blog', label: 'بلاگ آموزشی' },
    { id: 'access', label: 'دسترسی‌ها', superOnly: true },
];

const TITLES = Object.fromEntries(ADMIN_NAV.map((item) => [item.id, item.label]));

export function sectionTitle(id: string) {
    return TITLES[id] || 'Admin';
}

export function canAccessSection(user: User | null | undefined, section: string) {
    if (!user) return false;
    if (section === 'access') return Boolean(user.isSuper || user.id === 1);
    if (user.isSuper || user.id === 1) return true;
    if (!user.sections) return section !== 'blog';
    return user.sections[section] === true;
}
