/* eslint-disable react-refresh/only-export-components -- shared UI primitives + helpers */
import React from 'react';
import {
    AlertCircle, Atom, Beaker, Brain, Calculator, Calendar, Columns2, Compass, Dna, FlaskConical, FunctionSquare,
    Grid3x3, Heart, HeartPulse, LineChart, Link, ListChecks, Repeat, Ruler, Sigma, Sparkles, Target, Triangle, Zap,
} from 'lucide-react';
import type { MetSubject, SubjectKey } from './types';

/** Lucide icons the backend may reference by slug (subjects + suggestion cards). */
const ICONS: Record<string, React.ElementType> = {
    sigma: Sigma,
    dna: Dna,
    atom: Atom,
    'flask-conical': FlaskConical,
    sparkles: Sparkles,
    calculator: Calculator,
    'function-square': FunctionSquare,
    'alert-circle': AlertCircle,
    target: Target,
    triangle: Triangle,
    ruler: Ruler,
    zap: Zap,
    'line-chart': LineChart,
    link: Link,
    'grid-3x3': Grid3x3,
    beaker: Beaker,
    'list-checks': ListChecks,
    'columns-2': Columns2,
    heart: Heart,
    calendar: Calendar,
    brain: Brain,
    'heart-pulse': HeartPulse,
    repeat: Repeat,
    compass: Compass,
};

export function iconFor(slug?: string | null): React.ElementType {
    return (slug && ICONS[slug]) || Sparkles;
}

export function SlugIcon({ icon, size = 14, className, strokeWidth }: { icon?: string | null; size?: number; className?: string; strokeWidth?: number }) {
    return React.createElement(iconFor(icon), { size, className, strokeWidth });
}

/** Static fallbacks so the UI never blanks before /bootstrap resolves. Colors match Met's body themes. */
export const SUBJECT_FALLBACKS: MetSubject[] = [
    { key: 'general', nameFa: 'گفتگوی آزاد', nameEn: 'General', icon: 'sparkles', color: '#8B5CF6' },
    { key: 'math', nameFa: 'ریاضی', nameEn: 'Math', icon: 'sigma', color: '#8B5CF6' },
    { key: 'physics', nameFa: 'فیزیک', nameEn: 'Physics', icon: 'atom', color: '#3B82F6' },
    { key: 'chemistry', nameFa: 'شیمی', nameEn: 'Chemistry', icon: 'flask-conical', color: '#EC4899' },
    { key: 'biology', nameFa: 'زیست‌شناسی', nameEn: 'Biology', icon: 'dna', color: '#10B981' },
];

export const SUBJECT_ORDER: SubjectKey[] = ['general', 'math', 'physics', 'chemistry', 'biology'];

export function sortSubjects(list: MetSubject[]): MetSubject[] {
    return [...list].sort((a, b) => SUBJECT_ORDER.indexOf(a.key) - SUBJECT_ORDER.indexOf(b.key));
}

export function findSubject(list: MetSubject[], key?: SubjectKey | null): MetSubject {
    return list.find((s) => s.key === key) || list.find((s) => s.key === 'general') || SUBJECT_FALLBACKS[0];
}
