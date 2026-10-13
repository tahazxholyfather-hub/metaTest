import React, { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { AiStudentProfile } from './types';
import {
    AiPageShell,
    FadeIn,
    FlatButton,
    FlatPrimaryButton,
    GraySpinner,
    HiddenScroll,
    useIsMobile,
} from './ui';

type Props = {
    firstName?: string;
    lastName?: string;
    initial?: AiStudentProfile | null;
    onSubmit: (profile: AiStudentProfile) => Promise<void> | void;
    onBack?: () => void;
    loading?: boolean;
};

const Field = ({
    label,
    value,
    onChange,
    placeholder,
    optional,
    textarea,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    optional?: boolean;
    textarea?: boolean;
}) => (
    <label className="block text-right">
        <span className="text-xs font-bold text-[var(--text-secondary)] mb-1.5 flex items-center gap-1.5">
            {label}
            {optional && <span className="text-[10px] font-medium text-[var(--text-muted)]">اختیاری</span>}
        </span>
        {textarea ? (
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                rows={3}
                className="w-full border-0 border-b border-[var(--border)] bg-transparent px-0 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] resize-none transition-colors"
            />
        ) : (
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full border-0 border-b border-[var(--border)] bg-transparent px-0 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
            />
        )}
    </label>
);

export function ProfileSetup({ firstName, lastName, initial, onSubmit, onBack, loading }: Props) {
    const isMobile = useIsMobile();
    const [schoolName, setSchoolName] = useState(initial?.schoolName || '');
    const [grade, setGrade] = useState(initial?.grade || '');
    const [field, setField] = useState(initial?.field || '');
    const [weaknesses, setWeaknesses] = useState(initial?.weaknesses || '');
    const [learningGoals, setLearningGoals] = useState(initial?.learningGoals || '');
    const [additionalNotes, setAdditionalNotes] = useState(initial?.additionalNotes || '');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSubmit({
            schoolName: schoolName.trim() || null,
            grade: grade.trim() || null,
            field: field.trim() || null,
            weaknesses: weaknesses.trim() || null,
            learningGoals: learningGoals.trim() || null,
            additionalNotes: additionalNotes.trim() || null,
        });
    };

    return (
        <AiPageShell>
            <div
                className="h-[5rem] shrink-0 px-4 sm:px-6 border-b border-[var(--border)] flex items-center justify-between"
                dir={isMobile ? 'ltr' : 'rtl'}
            >
                {isMobile ? (
                    <>
                        <FlatButton onClick={onBack} className="p-2" aria-label="بازگشت" disabled={!onBack}>
                            <ArrowRight size={18} className="rotate-180" />
                        </FlatButton>
                        <div className="text-center" dir="rtl">
                            <h2 className="text-sm font-black text-[var(--text-primary)]">پروفایل یادگیری</h2>
                        </div>
                        <div className="w-10" />
                    </>
                ) : (
                    <>
                        <div>
                            <h2 className="text-lg font-black text-[var(--text-primary)]">پروفایل یادگیری</h2>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">اطلاعات کمکی برای شخصی‌سازی معلم</p>
                        </div>
                        {onBack && (
                            <FlatButton onClick={onBack} className="gap-1 text-[var(--text-muted)]">
                                <ArrowRight size={14} />
                                بازگشت
                            </FlatButton>
                        )}
                    </>
                )}
            </div>

            <HiddenScroll className="flex-1 min-h-0 p-4 sm:p-6 lg:p-8">
                <FadeIn>
                    <form onSubmit={handleSubmit} className="max-w-lg mx-auto space-y-5">
                        <p className="text-xs text-[var(--text-muted)] leading-6 text-right">
                            نام از حساب شما خوانده شد
                            {(firstName || lastName) ? ` — ${[firstName, lastName].filter(Boolean).join(' ')}` : ''}.
                        </p>

                        <div className="grid grid-cols-2 gap-4 border-b border-[var(--border)] pb-4">
                            <div className="text-right">
                                <div className="text-[10px] text-[var(--text-muted)] mb-1">نام</div>
                                <div className="text-sm font-bold text-[var(--text-primary)]">{firstName || '—'}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] text-[var(--text-muted)] mb-1">نام خانوادگی</div>
                                <div className="text-sm font-bold text-[var(--text-primary)]">{lastName || '—'}</div>
                            </div>
                        </div>

                        <Field label="مدرسه" value={schoolName} onChange={setSchoolName} placeholder="مثلاً دبیرستان نمونه" optional />
                        <Field label="پایه تحصیلی" value={grade} onChange={setGrade} placeholder="مثلاً دهم" />
                        <Field label="رشته" value={field} onChange={setField} placeholder="مثلاً ریاضی‌فیزیک" optional />
                        <Field label="نقاط ضعف" value={weaknesses} onChange={setWeaknesses} placeholder="مثلاً معادله درجه دو" textarea optional />
                        <Field label="هدف یادگیری" value={learningGoals} onChange={setLearningGoals} placeholder="مثلاً آمادگی برای امتحان" textarea optional />
                        <Field label="توضیحات بیشتر" value={additionalNotes} onChange={setAdditionalNotes} textarea optional />

                        <div className="pt-4 pb-8 flex justify-center sm:justify-start">
                            <FlatPrimaryButton type="submit" disabled={loading} className="text-sm">
                                {loading ? <GraySpinner size={14} /> : null}
                                {loading ? 'در حال ذخیره…' : 'ادامه'}
                                {!loading && <ArrowLeft size={16} />}
                            </FlatPrimaryButton>
                        </div>
                    </form>
                </FadeIn>
            </HiddenScroll>
        </AiPageShell>
    );
}
