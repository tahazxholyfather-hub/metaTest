import { Check } from 'lucide-react';
import { Met, subjectToMetColor } from '../../components/met';
import type { MetSubject, SubjectKey } from './types';
import { SlugIcon } from './subjectIcons';

const DESCRIPTIONS: Record<SubjectKey, string> = {
    general: 'برنامه‌ریزی، روش مطالعه و هر سؤال عمومی',
    math: 'حل قدم‌به‌قدم، اثبات و تمرین کنکوری',
    physics: 'مفهوم + فرمول + مسئله‌ی عددی',
    chemistry: 'موازنه، استوکیومتری، پیوندها',
    biology: 'مفاهیم کتاب، مقایسه و مرور فصل',
};

type Props = {
    subjects: MetSubject[];
    value: SubjectKey;
    onChange: (key: SubjectKey) => void;
    /** Compact horizontal chips (empty-state hero). */
    variant?: 'list' | 'chips';
    className?: string;
};

export function SubjectPicker({ subjects, value, onChange, variant = 'list', className = '' }: Props) {
    if (variant === 'chips') {
        return (
            <div className={`flex flex-wrap justify-center gap-2 ${className}`} role="radiogroup" aria-label="درس">
                {subjects.map((s) => {
                    const active = s.key === value;
                    return (
                        <button
                            key={s.key}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => onChange(s.key)}
                            className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-[12.5px] font-bold transition-all active:scale-95 ${
                                active ? 'text-white border-transparent shadow-[0_8px_20px_-10px_rgba(0,0,0,0.6)]' : 'border-[var(--border)]/80 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]'
                            }`}
                            style={active ? { background: s.color } : undefined}
                        >
                            <SlugIcon icon={s.icon} size={14} />
                            {s.nameFa}
                        </button>
                    );
                })}
            </div>
        );
    }

    return (
        <ul className={`m-0 p-0 list-none space-y-1 ${className}`} role="radiogroup" aria-label="درس" dir="rtl">
            {subjects.map((s) => {
                const active = s.key === value;
                return (
                    <li key={s.key}>
                        <button
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => onChange(s.key)}
                            className={`w-full flex items-center gap-3 p-2.5 rounded-[14px] border text-right transition-colors ${
                                active ? 'border-[var(--color-primary-500)]/35 bg-[var(--color-primary-500)]/10' : 'border-transparent hover:bg-[var(--hover-overlay)]'
                            }`}
                        >
                            <span className="w-10 h-10 shrink-0">
                                <Met size="100%" state={active ? 'happy' : 'idle'} color={subjectToMetColor(s.key)} reducedMotion={!active} />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1.5 text-[13px] font-extrabold text-[var(--text-primary)]">
                                    <SlugIcon icon={s.icon} size={13} className="opacity-80" />
                                    {s.nameFa}
                                </span>
                                <span className="block text-[10.5px] text-[var(--text-muted)] mt-0.5 truncate">{DESCRIPTIONS[s.key] || s.nameEn}</span>
                            </span>
                            {active && <Check size={16} className="text-[var(--color-primary-400)] shrink-0" />}
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}

export default SubjectPicker;
