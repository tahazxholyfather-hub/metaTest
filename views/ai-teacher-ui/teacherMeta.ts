import type { AiTeacherPublic } from './types';
import {
    Brain, Heart, Lightbulb, Smile, Sparkles, Shield, Target, Flame, BookOpen, Star,
} from 'lucide-react';

export type SkillAxis = { label: string; value: number };

export function splitTraits(raw?: string | null, extra: Array<string | null | undefined> = []) {
    const joined = [raw, ...extra].filter(Boolean).join('،');
    return Array.from(
        new Set(
            joined
                .split(/[،,|/·]/)
                .map((s) => s.trim())
                .filter((s) => s.length > 1)
        )
    );
}

export function skillAxes(teacher: AiTeacherPublic, max = 5): SkillAxis[] {
    const skills = splitTraits(teacher.specialty, [teacher.teachingStyle, teacher.expertise]);
    const fallback = ['دانش', 'تدریس', 'تخصص', 'ارتباط', 'تجربه'];
    const labels = [...skills.map((s) => (s.length > 8 ? `${s.slice(0, 8)}…` : s))];
    for (const f of fallback) {
        if (labels.length >= max) break;
        if (!labels.includes(f)) labels.push(f);
    }
    const base = Number(teacher.knowledgeLevel) || 72;
    const offsets = [-2, 7, -6, 4, 1];
    return labels.slice(0, max).map((label, i) => ({
        label,
        value: Math.max(42, Math.min(100, base + offsets[i % offsets.length])),
    }));
}

const TRAIT_ICONS = [Smile, Heart, Brain, Sparkles, Shield, Lightbulb, Target, Flame, BookOpen, Star];

export function personalityItems(teacher: AiTeacherPublic) {
    const traits = splitTraits(teacher.personality, [teacher.teachingStyle]).slice(0, 8);
    if (!traits.length) return [{ label: 'معلم همراه', Icon: Smile }];
    return traits.map((label, i) => ({
        label,
        Icon: TRAIT_ICONS[i % TRAIT_ICONS.length],
    }));
}
