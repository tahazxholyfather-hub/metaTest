// src/views/testworld/MainTestSelector.tsx
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Globe, Loader2, Server, ShieldCheck, Lock } from 'lucide-react';
import { ResponsiveModal } from '../../components/ResponsiveModal';
import { flowApi } from '../../lib/authApi';
import { toast } from 'sonner';
import {
    encodeQuizId,
    decodeQuizId,
    encodeResultId,
    decodeResultId,
    encodeShareCode,
    decodeShareCode,
} from '../../utils/hash';
interface TestType {
    id: string;
    label: string;
    title: string;
    description: string;
    image: string;
    color: string;
    hasOnlineLobby?: boolean;
    locked?: boolean;
}

// ... بقیه تایپ‌ها (LobbyQuizInfo) ثابت هستند ...
interface LobbyQuizInfo {
    id: number;
    shareCode: string;
    quizName: string;
    quizType: string;
    settings?: {
        time?: number;
        difficulty?: number;
        visibility?: string;
        memberLimit?: number;
        quizName?: string;
        questionCounts?: Record<string, number>;
        selectionNames?: {
            lessonNames?: Record<string, string>;
            gradeNames?: Record<string, string>;
            chapterNames?: Record<string, string>;
            mabhasNames?: Record<string, string>;
        };
    };
    lessons?: { id: number; title: string }[];
    grades?: { id: number; title: string }[];
    chapters?: { id: number; title: string }[];
    mabhas?: { id: number; title: string }[];
}

const TEST_TYPES: TestType[] = [
        {
        id: 'needs',
        label: 'سفارشی',
        title: 'تمرین بر اساس نیاز',
        description: 'با انتخاب دروس ، فصل ، موضوعات و پایه‌های دلخواه خود آزمون خود سفارشی بسازید',
        image: 'images/compressed_Background%20(3).webp',
        color: '#8b5cf6',
        hasOnlineLobby: true,
        locked: false,
    },
    {
        id: 'selector',
        label: 'بانک سوال',
        title: 'انتخاب سوال از بانک',
        description: 'با فیلترهای کناری درس، پایه، فصل، مبحث و سطح سختی، سوال‌ها را ببین، سریع عوض کن و آزمون بساز.',
        image: 'images/compressed_Background%20(3).webp',
        color: '#6366f1',
        hasOnlineLobby: true,
        locked: false,
    },
    {
        id: 'comprehensive',
        label: 'جامع',
        title: 'آزمون‌های جامع سنتر',
        description: 'شبیه‌سازی کامل فضای کنکور با استانداردترین سوالات تالیفی و شناسنامه‌دار برای آمادگی ۱۰۰ درصدی.',
        image: 'images/compressed_photo1769697454.webp',
        color: '#10b981',
        locked: true,
    },
    {
        id: 'konkur',
        label: 'کنکور',
        title: 'آرشیو کنکور سراسری',
        description: 'دسترسی به سوالات کنکور ۱۰ سال اخیر همراه با پاسخنامه‌های کاملاً تشریحی و تحلیل اساتید برتر.',
        image: 'images/compressed_Background%20(1)%20(1).webp',
        color: '#f59e0b',
        locked: true,
    },
    {
        id: 'kanoon',
        label: 'کانونی',
        title: 'شبیه‌ساز آزمون کانون',
        description: 'مطابق با آخرین بودجه‌بندی قلم‌چی برای آمادگی حداکثری در آزمون‌های دوهفته یک‌بار کشوری.',
        image: 'images/compressed_download%20(1).webp',
        color: '#ef4444',
        locked: true,
    },
];

const containerVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { staggerChildren: 0.1, duration: 0.5 } },
    exit: { opacity: 0, x: 20, transition: { duration: 0.3 } }
};

const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

export default function MainTestSelector({
                                             onStart,
                                             onJoinLobby,
                                         }: {
    onStart: (id: string) => void;
    onJoinLobby: (code: string) => Promise<void>;
}) {
    const [index, setIndex] = useState(0);
    const current = TEST_TYPES[index];

    // پیگیری آنی وضعیت تم از روی کلاس html بدون نیاز به prop drilling
    const [isDark, setIsDark] = useState(() =>
        typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true
    );

    useEffect(() => {
        const observer = new MutationObserver(() => {
            setIsDark(document.documentElement.classList.contains('dark'));
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });

        return () => observer.disconnect();
    }, []);

    // محاسبه رنگ با توجه به تم واقعی اکتیو
    const currentColor = (index === 0 || index === 1) ? (isDark ? '#8b5cf6' : '#1C4070') : current.color;

    const [isLobbyModalOpen, setIsLobbyModalOpen] = useState(false);
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [isLoadingInfo, setIsLoadingInfo] = useState(false);
    const [lobbyInfo, setLobbyInfo] = useState<LobbyQuizInfo | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isJoining, setIsJoining] = useState(false);

    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // ... بقیه کدهای منطق (بدون تغییر) ...
    const handleOtpChange = (val: string, i: number) => {
        const digits = val.replace(/\D/g, '');
        if (!digits) {
            const newOtp = [...otp];
            newOtp[i] = '';
            setOtp(newOtp);
            return;
        }
        const newOtp = [...otp];
        let idx = i;
        for (const d of digits) {
            if (idx > 5) break;
            newOtp[idx] = d;
            idx++;
        }
        setOtp(newOtp);
        if (idx <= 5) {
            inputRefs.current[idx]?.focus();
        } else {
            inputRefs.current[5]?.blur();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, i: number) => {
        const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'];
        if (allowed.includes(e.key)) {
            if (e.key === 'Backspace') {
                if (otp[i]) {
                    const newOtp = [...otp];
                    newOtp[i] = '';
                    setOtp(newOtp);
                    e.preventDefault();
                } else if (i > 0) {
                    inputRefs.current[i - 1]?.focus();
                    const newOtp = [...otp];
                    newOtp[i - 1] = '';
                    setOtp(newOtp);
                    e.preventDefault();
                }
            }
            if (e.key === 'ArrowLeft' && i > 0) inputRefs.current[i - 1]?.focus();
            if (e.key === 'ArrowRight' && i < 5) inputRefs.current[i + 1]?.focus();
            return;
        }
        if (!/^[0-9]$/.test(e.key)) e.preventDefault();
    };

    const fetchLobbyPreview = async (shareCode: string) => {
        try {
            setIsLoadingInfo(true);
            setError(null);
            setLobbyInfo(null);
           const encodedShare = encodeShareCode(shareCode);
            if (!encodedShare) {
                throw new Error('کد اشتراک نامعتبر است.');
            }
            const res = await flowApi.dispatch('get_quiz_by_share_code', { shareCode:encodedShare, });
            if (!res?.success) throw new Error('لابی با این کد یافت نشد.');
            setLobbyInfo(res);
        } catch (err: any) {
            setLobbyInfo(null);
            setError(err?.message || 'دریافت اطلاعات لابی ناموفق بود.');
        } finally {
            setIsLoadingInfo(false);
        }
    };

    useEffect(() => {
        const shareCode = otp.join('');
        if (shareCode.length === 6) fetchLobbyPreview(shareCode);
        else { setLobbyInfo(null); setError(null); setIsLoadingInfo(false); }
    }, [otp]);

    const handleJoinLobby = async () => {
        const code = otp.join('').trim();
        if (code.length !== 6) { setError('کد لابی باید ۶ رقمی باشد.'); return; }
        if (!lobbyInfo) { setError('ابتدا اطلاعات لابی را بررسی کنید.'); return; }
        const encodeShare = encodeShareCode(code);
        try {
            setIsJoining(true);
            setError(null);
            await onJoinLobby(encodeShare);
            setIsJoining(false);
            setIsLobbyModalOpen(false);
            setOtp(['', '', '', '', '', '']);
            setLobbyInfo(null);
            setError(null);
        } catch (err: any) {
            console.error('Join failed:', err);
            setIsJoining(false);
            setError(err?.message || 'اتصال به لابی ناموفق بود.');
        }
    };

    const handleCloseModal = () => {
        setIsLobbyModalOpen(false);
        setTimeout(() => {
            setOtp(['', '', '', '', '', '']);
            setLobbyInfo(null);
            setError(null);
            setIsJoining(false);
            setIsLoadingInfo(false);
        }, 300);
    };

    const handleStartClick = () => {
        if (current.locked) {
            toast.info('این بخش به زودی فعال می‌شود', { icon: <Lock size={16} /> });
            return;
        }
        onStart(current.id);
    };

    const handleLobbyClick = () => {
        if (current.locked) {
            toast.info('این بخش به زودی فعال می‌شود', { icon: <Lock size={16} /> });
            return;
        }
        setIsLobbyModalOpen(true);
    };

    const lessonsText = lobbyInfo?.lessons?.map((item) => item.title).join(' ، ') || '—';
    const gradesText = lobbyInfo?.grades?.map((item) => item.title).join(' ، ') || '—';
    const chaptersText = lobbyInfo?.chapters?.map((item) => item.title).join(' ، ') || '—';

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative w-full min-h-[calc(100vh-80px)] flex flex-col items-center overflow-x-hidden pb-28 md:pb-8"
            >
                {/* پس‌زمینه رنگی */}
                <div
                    style={{ backgroundColor: currentColor }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] md:w-[500px] md:h-[200px] blur-[120px] rounded-full opacity-20 pointer-events-none transition-colors duration-300"
                />

                <nav className="w-full px-4 md:px-6 flex justify-center py-4 md:py-6 mt-2 md:mt-4 z-20">
                    <div className="flex items-center w-full max-w-lg md:w-auto p-1 bg-[var(--bg-card)]/60 backdrop-blur-xl border border-[var(--border)] rounded-2xl shadow-sm justify-between md:justify-center md:gap-2">
                        {TEST_TYPES.map((t, i) => (
                            <button
                                key={t.id}
                                onClick={() => setIndex(i)}
                                className={`relative flex-1 md:flex-none px-2 py-2 md:px-5 md:py-2.5 text-[10px] md:text-[12px] font-bold transition-all duration-300 rounded-xl flex items-center justify-center gap-1 md:gap-2 ${
                                    index === i
                                        ? 'text-white'
                                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                }`}
                            >
                                {index === i && (
                                    <motion.div
                                        layoutId="activeTabSelector"
                                        style={{ backgroundColor: currentColor }}
                                        className="absolute inset-0 shadow-md rounded-xl -z-10 transition-colors duration-300"
                                    />
                                )}
                                {t.locked && <Lock size={10} className={`md:w-3 md:h-3 ${index === i ? "text-white/80" : ""}`} />}
                                <span className="relative z-10 whitespace-nowrap">{t.label}</span>
                            </button>
                        ))}
                    </div>
                </nav>

                <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-6 grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8 lg:gap-16 items-center py-2 md:py-4 lg:py-12 relative z-10">
                    <div className="flex justify-center items-center order-1 lg:order-2 relative mt-4 md:mt-0">
                        <button
                            onClick={() => setIndex(prev => prev === 0 ? TEST_TYPES.length - 1 : prev - 1)}
                            className="absolute right-0 z-20 hidden lg:flex bg-[var(--bg-card)] border border-[var(--border)] p-3 rounded-full hover:scale-110 transition-transform shadow-lg"
                        >
                            <ChevronRight size={24} />
                        </button>

                        <motion.div
                            className="relative w-58 h-58 md:w-64 md:h-64 lg:w-[360px] lg:h-[360px] p-2 md:p-4"
                            animate={{ y: [0, -8, 0] }}
                            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                        >
                            <AnimatePresence mode="wait">
                                <motion.img
                                    key={index}
                                    src={current.image}
                                    initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
                                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                    exit={{ opacity: 0, scale: 0.8, rotate: 5 }}
                                    transition={{ duration: 0.5, type: 'spring', damping: 20 }}
                                    className={`w-full h-full object-cover rounded-[1.5rem] md:rounded-[2rem]  relative z-10 ${current.locked ? 'grayscale-[40%]' : ''}`}
                                />
                            </AnimatePresence>
                        </motion.div>

                        <button
                            onClick={() => setIndex(prev => prev === TEST_TYPES.length - 1 ? 0 : prev + 1)}
                            className="absolute left-0 z-20 hidden lg:flex bg-[var(--bg-card)] border border-[var(--border)] p-3 rounded-full hover:scale-110 transition-transform shadow-lg"
                        >
                            <ChevronLeft size={24} />
                        </button>
                    </div>

                    <div className="order-2 lg:order-1 flex flex-col items-center lg:items-start text-center lg:text-right h-full justify-center">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={index}
                                variants={containerVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                className="space-y-4 md:space-y-6 w-full flex flex-col items-center lg:items-start"
                            >
                                <motion.h3
                                    variants={itemVariants}
                                    className="text-2xl md:text-3xl lg:text-5xl font-black text-[var(--text-primary)] leading-tight"
                                >
                                    {current.title}
                                </motion.h3>

                                <motion.p
                                    variants={itemVariants}
                                    className="text-sm md:text-base lg:text-lg text-[var(--text-secondary)] leading-relaxed max-w-lg font-medium px-2 md:px-0"
                                >
                                    {current.description}
                                </motion.p>

                                <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full mt-4 md:mt-6 justify-center lg:justify-start">
                                    <motion.button
                                        onClick={handleStartClick}
                                        style={{ backgroundColor: currentColor, color: '#fff' }}
                                        className="group relative flex items-center justify-center gap-3 px-6 md:px-8 py-3.5 md:py-4 rounded-xl md:rounded-2xl font-bold text-[13px] md:text-[14px] transition-all duration-300 hover:scale-[1.02] active:scale-95 shadow-xl w-full sm:w-auto"
                                    >
                                        <span>ورود به سامانه</span>
                                        <div className="bg-white/20 p-1 rounded-md">
                                            <ChevronLeft size={16} className="md:w-[18px] md:h-[18px]" />
                                        </div>
                                    </motion.button>

                                    {current.hasOnlineLobby && (
                                        <motion.button
                                            onClick={handleLobbyClick}
                                            style={{ borderColor: currentColor, color: currentColor }}
                                            className="group relative flex items-center justify-center gap-2 bg-[var(--bg-body)] border-2 px-6 md:px-8 py-3.5 md:py-4 rounded-xl md:rounded-2xl font-bold text-[13px] md:text-[14px] hover:scale-[1.02] active:scale-95 transition-all duration-300 shadow-md w-full sm:w-auto"
                                        >
                                            <Globe size={18} className="md:w-[20px] md:h-[20px]" />
                                            <span>ورود به لابی آنلاین</span>
                                        </motion.button>
                                    )}
                                </motion.div>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </main>
            </motion.div>

            {/* بخش ResponsiveModal دقیقاً مشابه قبل بدون تغییر */}
            <ResponsiveModal
                isOpen={isLobbyModalOpen}
                onClose={handleCloseModal}
                title={
                    <div className="flex items-center gap-2">
                        <Globe className="text-[var(--accent)]" size={20} />
                        <span>اتصال به لابی آنلاین</span>
                    </div>
                }
            >
                <div className="flex flex-col items-center py-4 space-y-8" dir="rtl">
                    <p className="text-sm font-medium text-[var(--text-secondary)]">
                        لطفا کد ۶ رقمی لابی را وارد کنید
                    </p>

                    <div className="flex justify-center gap-2 md:gap-4" dir="ltr">
                        {otp.map((digit, i) => (
                            <input
                                key={i}
                                ref={(el) => (inputRefs.current[i] = el)}
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleOtpChange(e.target.value, i)}
                                onKeyDown={(e) => handleKeyDown(e, i)}
                                onFocus={(e) => e.target.select()}
                                className={`w-11 h-14 md:w-14 md:h-16 text-center text-2xl md:text-3xl font-black rounded-2xl border-2 outline-none transition-all bg-[var(--bg-card)] shadow-sm caret-transparent tracking-wider ${
                                    digit
                                        ? 'border-[var(--accent)] text-[var(--text-primary)] shadow-[0_0_0_3px_rgba(139,92,246,0.12)]'
                                        : 'border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(139,92,246,0.10)]'
                                }`}
                            />
                        ))}
                    </div>

                    {isLoadingInfo && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center gap-2 text-[var(--accent)]"
                        >
                            <Loader2 className="animate-spin" size={18} />
                            <span className="text-sm font-bold">در حال دریافت اطلاعات آزمون...</span>
                        </motion.div>
                    )}

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="w-full px-4 py-3 bg-red-500/10 text-red-500 rounded-lg text-sm font-bold text-center"
                        >
                            {error}
                        </motion.div>
                    )}

                    <AnimatePresence>
                        {lobbyInfo && !isLoadingInfo && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="w-full bg-[var(--bg-body)] rounded-2xl p-4 border border-[var(--border)] space-y-4"
                            >
                                <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-[var(--accent)]/10 p-2 rounded-lg text-[var(--accent)]">
                                            <Server size={20} />
                                        </div>
                                        <div>
                                            <div className="text-xs text-[var(--text-muted)] font-bold">نام آزمون</div>
                                            <div className="text-sm text-[var(--text-primary)] font-black">
                                                {lobbyInfo.quizName || 'بدون عنوان'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                        <ShieldCheck size={14} />
                                        معتبر
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-[10px] text-[var(--text-muted)] font-bold">نوع آزمون</div>
                                        <div className="text-sm font-bold text-[var(--text-primary)]">
                                            {lobbyInfo.quizType || '—'}
                                        </div>
                                    </div>

                                    <div className="text-left">
                                        <div className="text-[10px] text-[var(--text-muted)] font-bold">زمان</div>
                                        <div className="text-sm font-bold text-[var(--text-primary)]">
                                            {lobbyInfo.settings?.time ? `${lobbyInfo.settings.time} دقیقه` : '—'}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-[10px] text-[var(--text-muted)] font-bold">درس</div>
                                        <div className="text-sm font-bold text-[var(--text-primary)]">
                                            {lessonsText}
                                        </div>
                                    </div>

                                    <div className="text-left">
                                        <div className="text-[10px] text-[var(--text-muted)] font-bold">پایه</div>
                                        <div className="text-sm font-bold text-[var(--text-primary)]">
                                            {gradesText}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div className="text-[10px] text-[var(--text-muted)] font-bold mb-1">فصل</div>
                                    <div className="text-sm font-bold text-[var(--text-primary)] break-words">
                                        {chaptersText}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                                    <div>
                                        <div className="text-[10px] text-[var(--text-muted)] font-bold">ظرفیت اعضا</div>
                                        <div className="text-sm font-bold text-[var(--text-primary)]">
                                            {lobbyInfo.settings?.memberLimit ?? '—'}
                                        </div>
                                    </div>

                                    <div className="text-left">
                                        <div className="text-[10px] text-[var(--text-muted)] font-bold">کد اشتراک</div>
                                        <div className="text-sm font-black text-[var(--accent)] tracking-widest">
                                            {decodeShareCode(lobbyInfo.shareCode)}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="w-full flex gap-3 pt-2">
                        <button
                            onClick={handleCloseModal}
                            className="flex-1 py-3.5 rounded-xl font-bold text-sm bg-[var(--bg-body)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--hover-overlay)] transition-colors"
                        >
                            انصراف
                        </button>
                        <button
                            disabled={!lobbyInfo || isJoining || isLoadingInfo}
                            onClick={handleJoinLobby}
                            className="flex-[2] py-3.5 rounded-xl font-bold text-sm text-white bg-[var(--accent)] transition-all disabled:opacity-50 flex justify-center items-center gap-2 hover:bg-[var(--accent-hover)] shadow-lg hover:shadow-[var(--accent)]/30"
                        >
                            {isJoining ? <Loader2 className="animate-spin" size={18} /> : 'ورود به لابی'}
                        </button>
                    </div>
                </div>
            </ResponsiveModal>
        </>
    );
}
