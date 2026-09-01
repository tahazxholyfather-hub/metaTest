// src/components/AuthView.tsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Smartphone, KeyRound, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { flowApi } from '../lib/authApi';

interface AuthViewProps {
    onSuccess: (token: string) => void;
}

// ─── Persian error mapping ────────────────────────────────────────────────────
// The backend now returns Persian messages, but this map keeps older/English
// responses and network-level errors readable for the user as well.
const AUTH_MESSAGE_MAP: Record<string, string> = {
    'User not found': 'کاربری با این شماره موبایل یافت نشد.',
    'Invalid credentials': 'شماره موبایل یا رمز عبور اشتباه است.',
    'Phone and password are required': 'شماره موبایل و رمز عبور الزامی است.',
    'Phone number is required': 'شماره موبایل الزامی است.',
    'Password not set for this account. Please use OTP.': 'برای این حساب رمز عبوری تنظیم نشده است. لطفاً با رمز یکبار مصرف وارد شوید.',
    'Invalid or expired OTP': 'کد وارد شده اشتباه یا منقضی شده است.',
    'Internal Server Error': 'خطای داخلی سرور. لطفاً بعداً دوباره تلاش کنید.',
    'Token has expired': 'نشست شما منقضی شده است. لطفاً دوباره وارد شوید.',
    'Invalid token': 'نشست نامعتبر است. لطفاً دوباره وارد شوید.',
    'Failed to fetch': 'ارتباط با سرور برقرار نشد. اینترنت خود را بررسی کنید.',
    'Network Error': 'ارتباط با سرور برقرار نشد. اینترنت خود را بررسی کنید.',
};

const hasPersianChars = (text: string) => /[\u0600-\u06FF]/.test(text);

const toPersianMessage = (message: string | undefined, fallback: string): string => {
    if (!message) return fallback;
    if (AUTH_MESSAGE_MAP[message]) return AUTH_MESSAGE_MAP[message];
    // Unknown English/technical message → show the generic Persian fallback
    return hasPersianChars(message) ? message : fallback;
};

const AnimatedIcon = ({ icon: Icon }: { icon: any }) => (
    <motion.div
        initial={{ scale: 0.5, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="text-[var(--color-primary-500)] bg-[var(--color-primary-500)]/10 p-4 rounded-full"
    >
        <Icon size={40} strokeWidth={1.5} />
    </motion.div>
);

export default function AuthView({ onSuccess }: AuthViewProps) {
    const [step, setStep] = useState<'phone' | 'otp'>('phone');
    const [loginMethod, setLoginMethod] = useState<'otp' | 'password'>('otp');

    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [otp, setOtp] = useState(['', '', '', '']); // 4 digits

    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
    const phoneInputRef = useRef<HTMLInputElement>(null);

    const handleLoginSuccess = (token: string) => {
        const date = new Date();
        date.setTime(date.getTime() + (365 * 24 * 60 * 60 * 1000));
        document.cookie = `token=${token};expires=${date.toUTCString()};path=/`;
        onSuccess(token);
    };

    const handlePhoneSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (phone.length < 10 || isLoading) return;

        setIsLoading(true);
        setErrorMsg('');
        try {
            const res = await flowApi.dispatch('send_otp', { phone });
            if (res.success) {
                setStep('otp');
            } else {
                setErrorMsg(toPersianMessage(res.message, 'خطا در ارسال کد تایید'));
            }
        } catch (err: any) {
            setErrorMsg(toPersianMessage(err?.message, 'خطای شبکه؛ لطفاً دوباره تلاش کنید'));
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (phone.length < 10 || !password || isLoading) return;

        setIsLoading(true);
        setErrorMsg('');
        try {
            const res = await flowApi.dispatch('password_login', { phone, password });
            if (res.success && res.token) {
                handleLoginSuccess(res.token);
            } else {
                setErrorMsg(toPersianMessage(res.message, 'شماره موبایل یا رمز عبور اشتباه است'));
            }
        } catch (err: any) {
            setErrorMsg(toPersianMessage(err?.message, 'خطای شبکه؛ لطفاً دوباره تلاش کنید'));
        } finally {
            setIsLoading(false);
        }
    };

    const verifyOtp = async (otpString: string) => {
        setIsLoading(true);
        setErrorMsg('');
        try {
            const res: any = await flowApi.dispatch('verify_otp', { phone, code: otpString });

            if (res.success) {
                if (res.isComplete) {
                    handleLoginSuccess(res.token);
                } else {
                    // Auto-register guest
                    const registerRes: any = await flowApi.dispatch('verify_otp', {
                        phone,
                        code: otpString,
                        firstName: 'کاربر',
                        lastName: 'مهمان',
                        password: ''
                    });

                    if (registerRes.success) {
                        handleLoginSuccess(registerRes.token);
                    } else {
                        setErrorMsg(toPersianMessage(registerRes.message, 'خطا در ثبت نام خودکار'));
                    }
                }
            } else {
                setErrorMsg(toPersianMessage(res.message, 'کد وارد شده اشتباه است'));
            }
        } catch (err: any) {
            setErrorMsg(toPersianMessage(err?.message, 'خطای شبکه؛ لطفاً دوباره تلاش کنید'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleOtpChange = (index: number, value: string) => {
        const digit = value.replace(/\D/g, '').slice(-1);
        if (!digit && value !== '') return;

        const newOtp = [...otp];
        newOtp[index] = digit;
        setOtp(newOtp);
        setErrorMsg('');

        if (digit && index < 3) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    // Auto focus
    useEffect(() => {
        if (step === 'otp') {
            const timer = setTimeout(() => otpRefs.current[0]?.focus(), 400);
            return () => clearTimeout(timer);
        } else if (step === 'phone') {
            const timer = setTimeout(() => phoneInputRef.current?.focus(), 400);
            return () => clearTimeout(timer);
        }
    }, [step]);

    // Check full OTP
    useEffect(() => {
        const fullOtp = otp.join('');
        if (step === 'otp' && fullOtp.length === 4) {
            verifyOtp(fullOtp);
        }
    }, [otp, step]);

    // Web OTP API (Auto SMS Detection)
    useEffect(() => {
        if (step === 'otp' && 'OTPCredential' in window) {
            const ac = new AbortController();
            navigator.credentials.get({
                otp: { transport: ['sms'] },
                signal: ac.signal
            }).then((content: any) => {
                if (content && content.code) {
                    const codeArray = content.code.split('').slice(0, 4);
                    const newOtp = [...otp];
                    for (let i = 0; i < codeArray.length; i++) {
                        newOtp[i] = codeArray[i];
                    }
                    setOtp(newOtp);
                }
            }).catch(err => {
                console.log('Web OTP API Error:', err);
            });
            return () => ac.abort();
        }
    }, [step]);

    const pageVariants = {
        initial: { opacity: 0, x: -10 },
        animate: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" } },
        exit: { opacity: 0, x: 10, transition: { duration: 0.3, ease: "easeIn" } }
    };

    const expandVariants = {
        hidden: { opacity: 0, height: 0, overflow: 'hidden' },
        visible: { opacity: 1, height: 'auto', overflow: 'visible', transition: { duration: 0.3 } }
    };

    const inputClasses = "w-full bg-transparent text-[var(--text-primary)] border border-[var(--text-secondary)]/30 rounded-xl py-3.5 px-4 outline-none transition-all duration-300 placeholder-[var(--text-secondary)]/50 focus:border-[var(--color-primary-500)] focus:shadow-[0_0_0_1px_var(--color-primary-500)]";

    return (
        <div className="relative flex flex-col items-center justify-center h-full w-full max-w-[380px] mx-auto py-10 px-6" dir="rtl">
            <div className="w-full">
                <AnimatePresence mode="wait" initial={false}>
                    {/* STEP 1: PHONE & PASSWORD */}
                    {step === 'phone' && (
                        <motion.div key={`phone-${loginMethod}`} variants={pageVariants} initial="initial" animate="animate" exit="exit" className="space-y-8">
                            <div className="flex flex-col items-center text-center">
                                <AnimatedIcon icon={loginMethod === 'otp' ? Smartphone : KeyRound} />
                                <h1 className="text-xl font-bold mt-6 text-[var(--text-primary)]">خوش آمدید</h1>
                                <p className="text-[var(--text-secondary)] text-sm mt-1.5">شماره موبایل خود را وارد کنید</p>
                            </div>

                            {/* Ultra Minimal Tab */}
                            <div className="relative flex justify-center gap-6">
                                {['otp', 'password'].map((method) => (
                                    <button
                                        key={method}
                                        type="button"
                                        onClick={() => {
                                            setLoginMethod(method as 'otp' | 'password');
                                            setErrorMsg('');
                                        }}
                                        className={`relative px-4 py-2 text-sm font-medium transition-colors duration-200 z-10 ${
                                            loginMethod === method ? 'text-[var(--color-primary-500)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                        }`}
                                    >
                                        {loginMethod === method && (
                                            <motion.div
                                                layoutId="activeTabPill"
                                                className="absolute inset-0 bg-[var(--color-primary-500)]/10 rounded-full -z-10"
                                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                            />
                                        )}
                                        {method === 'otp' ? 'رمز یکبار مصرف' : 'رمز عبور'}
                                    </button>
                                ))}
                            </div>

                            <form onSubmit={loginMethod === 'otp' ? handlePhoneSubmit : handlePasswordSubmit} className="flex flex-col gap-4">
                                <input
                                    ref={phoneInputRef}
                                    type="tel"
                                    dir="ltr"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                                    placeholder="0912 000 0000"
                                    maxLength={11}
                                    className={`${inputClasses} text-center tracking-widest text-lg`}
                                    disabled={isLoading}
                                />

                                <AnimatePresence>
                                    {loginMethod === 'password' && (
                                        <motion.div variants={expandVariants} initial="hidden" animate="visible" exit="hidden">
                                            <div className="relative mt-1">
                                                <input
                                                    type={showPassword ? 'text' : 'password'}
                                                    dir="ltr"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    placeholder="رمز عبور"
                                                    className={`${inputClasses} text-center text-lg pl-12`}
                                                    disabled={isLoading}
                                                />
                                                <button
                                                    type="button"
                                                    tabIndex={-1}
                                                    onClick={() => setShowPassword((prev) => !prev)}
                                                    className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--color-primary-500)] transition-colors bg-transparent border-none"
                                                    aria-label={showPassword ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}
                                                    title={showPassword ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}
                                                >
                                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {errorMsg && (
                                    <p className="text-red-500 text-xs text-center font-medium m-0">{errorMsg}</p>
                                )}

                                <button
                                    type="submit"
                                    disabled={phone.length < 10 || (loginMethod === 'password' && !password) || isLoading}
                                    className="w-full mt-2 flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-medium text-white transition-opacity duration-200 bg-[var(--color-primary-500)] hover:opacity-90 disabled:opacity-50"
                                >
                                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'ادامه'}
                                </button>
                            </form>
                        </motion.div>
                    )}

                    {/* STEP 2: OTP */}
                    {step === 'otp' && (
                        <motion.div key="otp" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="space-y-8">
                            <div className="flex flex-col items-center text-center">
                                <AnimatedIcon icon={ShieldCheck} />
                                <h1 className="text-xl font-bold mt-6 text-[var(--text-primary)]">کد تایید</h1>
                                <p className="text-[var(--text-secondary)] text-sm mt-1.5">
                                    کد ارسال شده به <span dir="ltr" className="text-[var(--color-primary-500)]">{phone}</span> را وارد کنید
                                </p>
                            </div>

                            <div className="flex justify-center gap-3" dir="ltr">
                                {otp.map((digit, index) => (
                                    <input
                                        key={index}
                                        ref={(el) => (otpRefs.current[index] = el)}
                                        type="text"
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleOtpChange(index, e.target.value)}
                                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                        disabled={isLoading}
                                        className="w-14 h-14 sm:w-16 sm:h-16 text-center text-2xl font-bold rounded-xl outline-none transition-all duration-300 bg-transparent border border-[var(--text-secondary)]/30 text-[var(--text-primary)] focus:border-[var(--color-primary-500)] focus:shadow-[0_0_0_1px_var(--color-primary-500)]"
                                    />
                                ))}
                            </div>

                            {errorMsg && (
                                <p className="text-red-500 text-xs text-center font-medium">{errorMsg}</p>
                            )}

                            <div className="text-center h-6">
                                {isLoading ? (
                                    <div className="flex justify-center items-center gap-2 text-[var(--color-primary-500)]">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span className="text-xs font-medium">در حال بررسی...</span>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => {
                                            setStep('phone');
                                            setOtp(['', '', '', '']);
                                            setErrorMsg('');
                                        }}
                                        className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--color-primary-500)] transition-colors"
                                    >
                                        ویرایش شماره موبایل
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}