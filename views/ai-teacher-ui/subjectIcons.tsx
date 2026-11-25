import React from 'react';
import { Sigma, Dna, Atom, FlaskConical, Sparkles } from 'lucide-react';
import type { SubjectKey } from './types';

export const SUBJECT_ICON_MAP: Record<string, React.ElementType> = {
    sigma: Sigma,
    dna: Dna,
    atom: Atom,
    'flask-conical': FlaskConical,
};

export function subjectIcon(icon?: string): React.ElementType {
    return (icon && SUBJECT_ICON_MAP[icon]) || Sparkles;
}

/** Renders the right subject glyph without creating a dynamic component reference in callers. */
export function SubjectIcon({ icon, size = 14, className }: { icon?: string; size?: number; className?: string }) {
    const Cmp = subjectIcon(icon);
    return <Cmp size={size} className={className} />;
}

/** Static fallback labels/colors so the UI never blanks out before /subjects resolves. */
/** Colors match the Met character's 4 body themes (violet/blue/green/pink). */
export const SUBJECT_FALLBACKS: Record<SubjectKey, { nameFa: string; icon: string; color: string }> = {
    math: { nameFa: 'ریاضی', icon: 'sigma', color: '#8B5CF6' },
    biology: { nameFa: 'زیست‌شناسی', icon: 'dna', color: '#10B981' },
    physics: { nameFa: 'فیزیک', icon: 'atom', color: '#3B82F6' },
    chemistry: { nameFa: 'شیمی', icon: 'flask-conical', color: '#EC4899' },
};

export const SUBJECT_ORDER: SubjectKey[] = ['math', 'biology', 'physics', 'chemistry'];
