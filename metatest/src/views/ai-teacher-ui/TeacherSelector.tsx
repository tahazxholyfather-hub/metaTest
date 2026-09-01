import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Check, Coins, Loader2, ArrowRight, Star, Users, BookOpen, Brain,
    Lightbulb, Target, GraduationCap,
} from 'lucide-react';
import type { AiTeacherPublic } from './types';
import { aiTeacherApi } from './api';
import { personalityItems, skillAxes } from './teacherMeta';
import {
    AiPageShell,
    FlatButton,
    GraySpinner,
    HiddenScroll,
    PersonalityStrip,
    RadarChart,
    SkillProgressBars,
    easeOut,
    useIsMobile,
} from './ui';

type Props = {
    selectedId?: number | null;
    onSelect: (teacher: AiTeacherPublic) => Promise<void> | void;
    onBack?: () => void;
    loading?: boolean;
    title?: string;
};

function Stars({ value, size = 14 }: { value: number | null | undefined; size?: number }) {
    const n = Math.max(0, Math.min(5, Number(value) || 0));
    const full = Math.round(n);
    return (
        <span className="inline-flex items-center gap-0.5" aria-label={`امتیاز ${n}`}>
            {Array.from({ length: 5 }, (_, i) => (
                <Star
                    key={i}
                    size={size}
                    className={i < full ? 'text-amber-400' : 'text-[var(--border-strong)]'}
                    fill={i < full ? 'currentColor' : 'none'}
                />
            ))}
            <span className="text-[12px] font-black text-[var(--text-primary)] tabular-nums mr-1">
                {value != null ? Number(value).toFixed(1) : '—'}
            </span>
        </span>
    );
}

function SelectCta({
    onClick,
    busy,
    fullWidth,
    locked,
}: {
    onClick: () => void;
    busy: boolean;
    fullWidth?: boolean;
    locked?: boolean;
}) {
    return (
        <motion.button
            type="button"
            whileTap={{ scale: locked ? 1 : 0.98 }}
            onClick={onClick}
            disabled={busy || locked}
            className={`${fullWidth ? 'w-full' : 'w-auto min-w-[12rem]'} h-11 px-5 rounded-[14px] inline-flex items-center justify-center gap-2 ${
                locked
                    ? 'bg-[color-mix(in_srgb,var(--text-primary)_12%,transparent)] text-[var(--text-muted)]'
                    : 'bg-[var(--color-primary-500)] text-white'
            } text-[13.5px] font-extrabold disabled:opacity-40`}
        >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {locked ? 'فقط با اشتراک ویژه' : 'انتخاب این معلم'}
        </motion.button>
    );
}

function ProfileBody({ teacher }: { teacher: AiTeacherPublic }) {
    const axes = useMemo(() => skillAxes(teacher), [teacher]);
    const bars = useMemo(() => skillAxes(teacher, 4), [teacher]);
    const traits = useMemo(() => personalityItems(teacher), [teacher]);
    const facts = [
        teacher.specialty && { icon: Target, label: teacher.specialty },
        teacher.teachingStyle && { icon: Lightbulb, label: teacher.teachingStyle },
        teacher.expertise && { icon: Brain, label: teacher.expertise },
        teacher.experience && { icon: GraduationCap, label: teacher.experience },
    ].filter(Boolean) as { icon: React.ElementType; label: string }[];

    return (
        <div className="space-y-6 text-right w-full">
            {teacher.description && (
                <p className="text-[13.5px] text-[var(--text-secondary)] leading-8">
                    {teacher.description}
                </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,168px)_1fr] gap-5 items-center">
                <RadarChart axes={axes} size={168} />
                <SkillProgressBars skills={bars} active />
            </div>

            <div>
                <div className="text-[11px] font-extrabold text-[var(--text-muted)] mb-2">شخصیت</div>
                <PersonalityStrip items={traits} />
            </div>

            {teacher.stats && (
                <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-[14px] border border-[var(--border)]/70 py-3 text-center">
                        <Users size={14} className="mx-auto mb-1 text-[var(--color-primary-400)]" />
                        <div className="text-[15px] font-black tabular-nums text-[var(--text-primary)]">
                            {Number(teacher.stats.students || 0).toLocaleString('fa-IR')}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] mt-0.5">دانش‌آموز</div>
                    </div>
                    <div className="rounded-[14px] border border-[var(--border)]/70 py-3 text-center">
                        <Brain size={14} className="mx-auto mb-1 text-[var(--color-primary-400)]" />
                        <div className="text-[15px] font-black tabular-nums text-[var(--text-primary)]">
                            {Number(teacher.stats.questionsAnswered || 0).toLocaleString('fa-IR')}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] mt-0.5">پاسخ</div>
                    </div>
                    <div className="rounded-[14px] border border-[var(--border)]/70 py-3 text-center">
                        <Star size={14} className="mx-auto mb-1 text-amber-400" />
                        <div className="text-[15px] font-black tabular-nums text-[var(--text-primary)]">
                            {teacher.stats.averageRating != null
                                ? Number(teacher.stats.averageRating).toFixed(1)
                                : '—'}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] mt-0.5">امتیاز</div>
                    </div>
                </div>
            )}

            {facts.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {facts.map(({ icon: Icon, label }) => (
                        <span
                            key={label}
                            className="inline-flex items-start gap-1.5 max-w-full rounded-[10px] border border-[var(--border)]/70 px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--text-secondary)]"
                        >
                            <Icon size={13} className="text-[var(--color-primary-400)] mt-0.5 shrink-0" />
                            <span className="leading-5">{label}</span>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

export function TeacherSelector({ selectedId, onSelect, onBack, loading, title = 'انتخاب معلم' }: Props) {
    const isMobile = useIsMobile();
    const [teachers, setTeachers] = useState<AiTeacherPublic[]>([]);
    const [index, setIndex] = useState(0);
    const [fetching, setFetching] = useState(true);
    const [error, setError] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [dragX, setDragX] = useState(0);
    const startX = useRef<number | null>(null);

    useEffect(() => {
        let alive = true;
        setFetching(true);
        aiTeacherApi.listTeachers()
            .then((res) => {
                if (!alive) return;
                const list = res.data || [];
                setTeachers(list);
                const initialIdx = Math.max(0, list.findIndex((t) => t.id === selectedId));
                setIndex(initialIdx === -1 ? 0 : initialIdx);
            })
            .catch((err) => setError(err.message || 'خطا در دریافت معلمان'))
            .finally(() => alive && setFetching(false));
        return () => { alive = false; };
    }, [selectedId]);

    const teacher = teachers[index];

    const go = (dir: number) => {
        if (!teachers.length) return;
        setIndex((i) => (i + dir + teachers.length) % teachers.length);
    };

    const handleConfirm = async () => {
        if (!teacher || confirming || loading || teacher.locked) return;
        setConfirming(true);
        try {
            await onSelect(teacher);
        } finally {
            setConfirming(false);
        }
    };

    const onPointerDown = (e: React.PointerEvent) => {
        startX.current = e.clientX;
        setDragX(0);
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e: React.PointerEvent) => {
        if (startX.current == null) return;
        setDragX(e.clientX - startX.current);
    };
    const onPointerUp = () => {
        if (startX.current == null) return;
        if (dragX > 70) go(-1);
        else if (dragX < -70) go(1);
        startX.current = null;
        setDragX(0);
    };

    if (fetching) {
        return (
            <AiPageShell>
                <div className="flex-1 flex items-center justify-center">
                    <GraySpinner size={28} />
                </div>
            </AiPageShell>
        );
    }

    if (error || !teacher) {
        return (
            <AiPageShell>
                <div className="flex-1 flex items-center justify-center px-6 text-center">
                    <p className="text-sm font-bold text-[var(--text-primary)]">{error || 'معلمی در دسترس نیست.'}</p>
                </div>
            </AiPageShell>
        );
    }

    const busy = confirming || !!loading;

    /* ───────── Desktop ───────── */
    if (!isMobile) {
        return (
            <AiPageShell>
                <div className="h-[4.25rem] shrink-0 px-8 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-black text-[var(--text-primary)]">{title}</h2>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">معلم را از فهرست انتخاب کنید و پروفایل را ببینید</p>
                    </div>
                    {onBack && (
                        <FlatButton onClick={onBack} className="gap-1 text-[var(--text-muted)]">
                            <ArrowRight size={14} />
                            بازگشت
                        </FlatButton>
                    )}
                </div>

                <div className="flex-1 min-h-0 flex gap-6 px-8 pb-8">
                    <HiddenScroll className="w-[280px] shrink-0 pr-1">
                        <div className="space-y-1.5">
                            {teachers.map((t, i) => {
                                const active = i === index;
                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setIndex(i)}
                                        className={`w-full flex items-center gap-3 text-right rounded-[14px] px-2.5 py-2.5 transition-colors ${
                                            active
                                                ? 'bg-[color-mix(in_srgb,var(--color-primary-500)_10%,transparent)] border border-[color-mix(in_srgb,var(--color-primary-500)_32%,var(--border))]'
                                                : 'border border-transparent hover:bg-[color-mix(in_srgb,var(--text-primary)_4%,transparent)]'
                                        }`}
                                    >
                                        <img
                                            src={t.avatarUrl || '/avatars/user_default.png'}
                                            alt=""
                                            className="w-11 h-11 rounded-full object-cover shrink-0 ring-1 ring-[var(--border)]"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[13px] font-extrabold text-[var(--text-primary)] truncate">
                                                {t.displayName}
                                            </div>
                                            <div className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                                                {t.subject}
                                            </div>
                                        </div>
                                        <span className={`text-[10px] font-bold shrink-0 ${
                                            t.locked
                                                ? 'text-[var(--text-muted)]'
                                                : t.isFree ? 'text-emerald-500' : 'text-[var(--color-primary-400)]'
                                        }`}>
                                            {t.locked ? 'قفل' : t.isFree ? 'رایگان' : 'ویژه'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </HiddenScroll>

                    <HiddenScroll className="flex-1 min-w-0">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={teacher.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.28, ease: easeOut }}
                                className="max-w-3xl"
                            >
                                <div className="flex items-center gap-5 mb-6">
                                    <img
                                        src={teacher.avatarUrl || '/avatars/user_default.png'}
                                        alt=""
                                        className="w-[5.5rem] h-[5.5rem] rounded-full object-cover ring-2 ring-[var(--border)] shrink-0"
                                    />
                                    <div className="min-w-0 flex-1 text-right">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-2xl font-black text-[var(--text-primary)] truncate">
                                                {teacher.displayName}
                                            </h3>
                                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-secondary)]">
                                                {teacher.locked ? 'قفل' : teacher.isFree ? 'رایگان' : 'ویژه'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-[var(--text-muted)] mt-1">
                                            {teacher.subject}
                                            {teacher.age ? ` · ${teacher.age} ساله` : ''}
                                        </p>
                                        <div className="mt-2 flex items-center gap-3">
                                            <Stars value={teacher.stats?.averageRating} />
                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--text-secondary)]">
                                                <Coins size={13} className="text-amber-500" />
                                                حدود {(teacher.typicalEnergy || teacher.pricePerMessage || 0).toLocaleString('fa-IR')} انرژی / پیام
                                            </span>
                                        </div>
                                    </div>
                                    <SelectCta onClick={handleConfirm} busy={busy} locked={!!teacher.locked} />
                                </div>

                                <ProfileBody teacher={teacher} />
                            </motion.div>
                        </AnimatePresence>
                    </HiddenScroll>
                </div>
            </AiPageShell>
        );
    }

    /* ───────── Mobile slider ───────── */
    return (
        <AiPageShell>
            <div className="h-[4.25rem] shrink-0 px-4 flex items-center justify-between" dir="ltr">
                <div className="flex items-center gap-2">
                    {onBack && (
                        <FlatButton onClick={onBack} className="p-2" aria-label="بازگشت">
                            <ArrowRight size={18} className="rotate-180" />
                        </FlatButton>
                    )}
                </div>
                <div className="text-center" dir="rtl">
                    <h2 className="text-sm font-black text-[var(--text-primary)]">{title}</h2>
                    <p className="text-[10px] text-[var(--text-muted)]">{index + 1} از {teachers.length}</p>
                </div>
                <div className="w-10" />
            </div>

            <HiddenScroll className="flex-1 min-h-0">
                <div
                    className="px-5 pt-2 pb-4 touch-pan-y select-none"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                >
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={teacher.id}
                            initial={{ opacity: 0, x: dragX || 32 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -32 }}
                            transition={{ duration: 0.28, ease: easeOut }}
                            className="max-w-md mx-auto flex flex-col items-center"
                            style={{ transform: dragX ? `translateX(${dragX * 0.15}px)` : undefined }}
                        >
                            <img
                                src={teacher.avatarUrl || '/avatars/user_default.png'}
                                alt=""
                                className="w-[6.5rem] h-[6.5rem] rounded-full object-cover ring-2 ring-[var(--border)] mb-3"
                                draggable={false}
                            />
                            <h3 className="text-xl font-black text-[var(--text-primary)] text-center">
                                {teacher.displayName}
                            </h3>
                            <p className="text-xs text-[var(--text-muted)] mt-1 mb-2">
                                {teacher.subject}{teacher.age ? ` · ${teacher.age} ساله` : ''}
                            </p>
                            <Stars value={teacher.stats?.averageRating} />
                            <div className="flex items-center gap-3 text-[11px] font-bold text-[var(--text-secondary)] mt-2 mb-5">
                                <span>{teacher.locked ? 'قفل' : teacher.isFree ? 'رایگان' : 'ویژه'}</span>
                                <span className="inline-flex items-center gap-1">
                                    <Coins size={12} className="text-amber-500" />
                                    حدود {(teacher.typicalEnergy || teacher.pricePerMessage || 0).toLocaleString('fa-IR')} انرژی
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <BookOpen size={12} />
                                    {teacher.specialty?.split(/[،,]/)[0] || teacher.subject}
                                </span>
                            </div>
                            <ProfileBody teacher={teacher} />
                        </motion.div>
                    </AnimatePresence>
                </div>
            </HiddenScroll>

            <div className="flex justify-center gap-1.5 py-2">
                {teachers.map((t, i) => (
                    <button
                        key={t.id}
                        type="button"
                        aria-label={`معلم ${i + 1}`}
                        onClick={() => setIndex(i)}
                        className={`h-1.5 rounded-full transition-all ${
                            i === index ? 'w-5 bg-[var(--color-primary-500)]' : 'w-1.5 bg-[var(--border)]'
                        }`}
                    />
                ))}
            </div>

            <div
                className="shrink-0 px-5 pt-1"
                style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            >
                <SelectCta onClick={handleConfirm} busy={busy} fullWidth locked={!!teacher.locked} />
                <p className="text-[10px] text-center text-[var(--text-muted)] mt-2">برای دیدن معلم بعدی سوایپ کنید</p>
            </div>
        </AiPageShell>
    );
}
