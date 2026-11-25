import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner"; // اضافه شدن sonner
import {
    CalendarDays,
    CircleAlert,
    CreditCard,
    Hash,
    Phone,
    ShieldCheck,
    UserRound,
    CheckCircle2,
    Clock,
    XCircle,
    ArrowLeft,
    Copy, // آیکون کپی
} from "lucide-react";

type PaymentResultData = {
    payment: {
        id: number;
        finalPrice: number;
        currency: string;
        status: string;
        gateway: string;
        authority: string;
        refId: string | null;
        description: string;
        paidAt: string | null;
        verifiedAt: string | null;
        createdAt: string;
    };
    plan: {
        id: string;
        name: string;
        days: number;
    };
    user: {
        firstName: string;
        lastName: string;
        phone: string;
        planExpiresAt: string | null;
    };
};

function toPersianDigits(value: string | number) {
    return String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

function formatMoney(amount: number, currency: string) {
    const value = new Intl.NumberFormat("fa-IR").format(amount);
    return currency === "IR" ? `${value} ریال` : `${value} ${currency}`;
}

function formatPersianDate(date?: string | null, withTime = true) {
    if (!date) return "-";
    const options: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "long",
        day: "numeric",
    };
    if (withTime) {
        options.hour = "2-digit";
        options.minute = "2-digit";
    }
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", options).format(new Date(date));
}

function getStatusMeta(status: string) {
    switch (status) {
        case "paid":
            return {
                title: "پرداخت موفق",
                subtitle: "پرداخت شما با موفقیت ثبت و تایید شده است",
                Icon: CheckCircle2,
                colorClass: "text-emerald-500 dark:text-emerald-400",
                bgGlow: "rgba(16,185,129,0.15)",
                ringColor: "ring-emerald-500/30",
                buttonBg:
                    "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600",
                progressBg: "bg-emerald-900/40 dark:bg-emerald-900/50",
                gradientFrom: "from-emerald-500/10",
            };
        case "pending":
            return {
                title: "در انتظار پرداخت",
                subtitle: "وضعیت پرداخت هنوز نهایی نشده است",
                Icon: Clock,
                colorClass: "text-amber-500 dark:text-amber-400",
                bgGlow: "rgba(245,158,11,0.15)",
                ringColor: "ring-amber-500/30",
                buttonBg:
                    "bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600",
                progressBg: "bg-amber-900/40 dark:bg-amber-900/50",
                gradientFrom: "from-amber-500/10",
            };
        default:
            return {
                title: "پرداخت ناموفق",
                subtitle: "پرداخت انجام نشد یا تایید نهایی دریافت نشد",
                Icon: XCircle,
                colorClass: "text-rose-500 dark:text-rose-400",
                bgGlow: "rgba(239,68,0.15)",
                ringColor: "ring-rose-500/30",
                buttonBg:
                    "bg-rose-600 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600",
                progressBg: "bg-rose-900/40 dark:bg-rose-900/50",
                gradientFrom: "from-rose-500/10",
            };
    }
}

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.06 },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    show: {
        opacity: 1,
        y: 0,
        transition: { type: "spring", stiffness: 300, damping: 24 },
    },
};

function InfoRow({
                     icon,
                     label,
                     value,
                     isLast = false,
                 }: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    isLast?: boolean;
}) {
    return (
        <motion.div
            variants={itemVariants}
            className={`flex items-center justify-between gap-4 py-3.5 px-2 -mx-2 rounded-xl
                hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 transition-colors
                ${!isLast ? "border-b border-zinc-100 dark:border-zinc-800/60" : ""}`}
        >
            <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl
                    bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {icon}
                </div>
                <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    {label}
                </span>
            </div>
            <div className="min-w-0 text-left text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {value}
            </div>
        </motion.div>
    );
}

function RedirectButton({
                            countdown,
                            statusMeta,
                            onClick,
                        }: {
    countdown: number;
    statusMeta: ReturnType<typeof getStatusMeta>;
    onClick: () => void;
}) {
    return (
        <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.97 }}
            onClick={onClick}
            className={`relative w-full overflow-hidden rounded-2xl py-4 text-sm font-bold
                text-white transition-colors ${statusMeta.buttonBg}`}
        >
            <motion.div
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 15, ease: "linear" }} /* تغییر به ۱۵ ثانیه */
                className={`absolute bottom-0 left-0 top-0 ${statusMeta.progressBg}`}
            />
            <span className="relative z-10 flex items-center justify-center gap-2">
                بازگشت به داشبورد
                <span className="font-normal opacity-80">
                    ({toPersianDigits(countdown)} ثانیه)
                </span>
                <ArrowLeft size={15} className="mr-0.5" />
            </span>
        </motion.button>
    );
}

// ── Skeleton Loader ──────────────────
function PaymentSkeleton() {
    return (
        <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center px-4 py-16 animate-pulse">
            <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-5 gap-10 items-center">
                {/* Left Part Skeleton */}
                <div className="lg:col-span-2 flex flex-col items-center text-center gap-6">
                    <div className="h-28 w-28 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                    <div className="h-6 w-40 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
                    <div className="h-4 w-60 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
                    <div className="w-full h-12 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
                </div>
                {/* Right Part Skeleton */}
                <div className="lg:col-span-3 rounded-3xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden p-6 space-y-4">
                    <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
                        <div className="h-5 w-24 bg-zinc-200 dark:bg-zinc-800 rounded" />
                        <div className="h-5 w-16 bg-zinc-200 dark:bg-zinc-800 rounded" />
                    </div>
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="flex justify-between items-center py-2">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
                                <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
                            </div>
                            <div className="h-4 w-28 bg-zinc-200 dark:bg-zinc-800 rounded" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ════════════════════════════════
export default function PaymentResultPage() {
    const { token } = useParams();
    const navigate = useNavigate();

    const [paymentData, setPaymentData] = useState<PaymentResultData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [countdown, setCountdown] = useState(15); // تغییر مقدار پایه به ۱۵ ثانیه

    // کنترل تِم از localStorage
    useEffect(() => {
        const currentTheme = localStorage.getItem("app-theme") || "light";
        const root = window.document.documentElement;
        if (currentTheme === "dark") {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
    }, []);

    useEffect(() => {
        async function loadPayment() {
            if (!token) {
                setError("لینک پرداخت نامعتبر است");
                setLoading(false);
                return;
            }
            try {
                const res = await fetch(`/api/payments/result/${token}`);
                const data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.message || "خطا در دریافت نتیجه پرداخت");
                }
                setPaymentData(data.data);
            } catch (err) {
                setError(
                    err instanceof Error ? err.message : "خطا در دریافت نتیجه پرداخت"
                );
            } finally {
                setLoading(false);
            }
        }
        loadPayment();
    }, [token]);

    useEffect(() => {
        if (loading || error) return;
        if (countdown <= 0) {
            navigate("/dashboard");
            return;
        }
        const timer = setInterval(() => setCountdown((p) => p - 1), 1000);
        return () => clearInterval(timer);
    }, [countdown, loading, error, navigate]);

    const statusMeta = useMemo(
        () => getStatusMeta(paymentData?.payment.status || "failed"),
        [paymentData?.payment.status]
    );

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("کد رهگیری با موفقیت کپی شد");
    };

    if (loading) {
        return <PaymentSkeleton />;
    }

    if (error || !paymentData) {
        return (
            <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center px-4">
                <div className="w-full max-w-sm">
                    <div className="flex flex-col items-center rounded-3xl bg-zinc-50 dark:bg-zinc-900
                        p-8 text-center ring-1 ring-zinc-200 dark:ring-zinc-800">
                        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl
                            bg-rose-100 text-rose-500 dark:bg-rose-900/30 dark:text-rose-400">
                            <CircleAlert size={36} />
                        </div>
                        <h1 className="mb-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                            خطا دریافت اطلاعات
                        </h1>
                        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
                            {error || "اطلاعاتی یافت نشد"}
                        </p>
                        <button
                            onClick={() => navigate("/dashboard")}
                            className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium
                                text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900
                                dark:hover:bg-zinc-100 transition-colors"
                        >
                            بازگشت به داشبورد
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const { payment, user, plan } = paymentData;
    const fullName =
        [user.firstName, user.lastName].filter(Boolean).join(" ") || "-";
    const StatusIcon = statusMeta.Icon;

    return (
        <div className="min-h-screen bg-white dark:bg-zinc-950 transition-colors duration-200">
            {/* MOBILE layout (< lg) */}
            <div className="lg:hidden">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4 }}
                    className="min-h-screen pb-28 px-4 pt-12"
                >
                    <div className="flex flex-col items-center text-center mb-8">
                        <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{
                                delay: 0.3,
                                type: "spring",
                                stiffness: 160,
                                damping: 12,
                            }}
                            className={`mb-5 ${statusMeta.colorClass}`}
                        >
                            <StatusIcon size={96} strokeWidth={1.5} />
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="text-2xl font-black text-zinc-900 dark:text-zinc-50 mb-2"
                        >
                            {statusMeta.title}
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs"
                        >
                            {statusMeta.subtitle}
                        </motion.p>
                    </div>

                    <motion.section
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.55, duration: 0.4 }}
                        className="rounded-3xl bg-zinc-50 dark:bg-zinc-900 ring-1
                            ring-zinc-200 dark:ring-zinc-800 overflow-hidden"
                    >
                        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800
                            flex items-center justify-between">
                            <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                                جزئیات تراکنش
                            </h2>
                            <span className="text-xs text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800
                                px-2.5 py-1 rounded-lg font-medium">
                                #{toPersianDigits(payment.id)}
                            </span>
                        </div>

                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="show"
                            className="px-5 pb-2 pt-1"
                        >
                            <InfoRow icon={<UserRound size={16} />} label="نام کاربر" value={fullName} />
                            <InfoRow icon={<Phone size={16} />} label="موبایل" value={toPersianDigits(user.phone || "-")} />
                            <InfoRow icon={<ShieldCheck size={16} />} label="مبلغ" value={formatMoney(payment.finalPrice, payment.currency)} />
                            <InfoRow icon={<CreditCard size={16} />} label="پلن" value={`${plan.name} – ${toPersianDigits(plan.days)} روز`} />
                            {payment.gateway && (
                                <InfoRow icon={<CreditCard size={16} />} label="درگاه" value={payment.gateway} />
                            )}
                            <InfoRow
                                icon={<Hash size={16} />}
                                label="کد رهگیری"
                                value={
                                    payment.refId ? (
                                        <div className="flex items-center gap-1.5">
                                            <span>{toPersianDigits(payment.refId)}</span>
                                            <button
                                                onClick={() => handleCopy(payment.refId!)}
                                                className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 dark:text-zinc-550 transition-colors"
                                            >
                                                <Copy size={14} />
                                            </button>
                                        </div>
                                    ) : "-"
                                }
                            />
                            <InfoRow
                                icon={<CalendarDays size={16} />}
                                label="تاریخ پرداخت"
                                value={formatPersianDate(payment.paidAt)}
                                isLast
                            />
                        </motion.div>
                    </motion.section>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7, type: "spring", stiffness: 260, damping: 22 }}
                    className="fixed bottom-0 inset-x-0 z-50 px-4 pb-6 pt-3
                        bg-gradient-to-t from-white dark:from-zinc-950 to-transparent"
                >
                    <RedirectButton
                        countdown={countdown}
                        statusMeta={statusMeta}
                        onClick={() => navigate("/dashboard")}
                    />
                </motion.div>
            </div>

            {/* DESKTOP layout (≥ lg) */}
            <div className="hidden lg:flex min-h-screen items-center justify-center px-8 py-16">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="w-full max-w-5xl grid grid-cols-5 gap-10 items-center"
                >
                    <div className="col-span-2 flex flex-col items-center text-center gap-6">
                        <div className="relative flex items-center justify-center">
                            <motion.div
                                initial={{ scale: 0.6, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{
                                    delay: 0.25,
                                    type: "spring",
                                    stiffness: 140,
                                    damping: 14,
                                }}
                                style={{
                                    filter: `drop-shadow(0 0 40px ${statusMeta.bgGlow})`,
                                }}
                                className={statusMeta.colorClass}
                            >
                                <StatusIcon size={128} strokeWidth={1.2} />
                            </motion.div>
                        </div>

                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.45}}
                        >
                            <h1 className="text-3xl font-black text-zinc-900 dark:text-zinc-50 mb-2">
                                {statusMeta.title}
                            </h1>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                {statusMeta.subtitle}
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="w-full"
                        >
                            <RedirectButton
                                countdown={countdown}
                                statusMeta={statusMeta}
                                onClick={() => navigate("/dashboard")}
                            />
                        </motion.div>
                    </div>

                    <motion.section
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3, duration: 0.5, ease: "easeOut" }}
                        className="col-span-3 rounded-3xl bg-zinc-50 dark:bg-zinc-900
                            ring-1 ring-zinc-200 dark:ring-zinc-800 overflow-hidden"
                    >
                        <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800
                            flex items-center justify-between">
                            <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                                جزئیات تراکنش
                            </h2>
                            <span className="text-xs text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800
                                px-2.5 py-1 rounded-lg font-medium">
                                #{toPersianDigits(payment.id)}
                            </span>
                        </div>

                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="show"
                            className="px-6 pb-3 pt-2"
                        >
                            <InfoRow icon={<UserRound size={17} />} label="نام کاربر" value={fullName} />
                            <InfoRow icon={<Phone size={17} />} label="شماره موبایل" value={toPersianDigits(user.phone || "-")} />
                            <InfoRow icon={<ShieldCheck size={17} />} label="مبلغ پرداخت" value={formatMoney(payment.finalPrice, payment.currency)} />
                            <InfoRow icon={<CreditCard size={17} />} label="پلن اشتراک" value={`${plan.name} – ${toPersianDigits(plan.days)} روز`} />
                            {payment.gateway && (
                                <InfoRow icon={<CreditCard size={17} />} label="درگاه پرداخت" value={payment.gateway} />
                            )}
                            <InfoRow
                                icon={<Hash size={17} />}
                                label="کد رهگیری"
                                value={
                                    payment.refId ? (
                                        <div className="flex items-center gap-2">
                                            <span>{toPersianDigits(payment.refId)}</span>
                                            <button
                                                onClick={() => handleCopy(payment.refId!)}
                                                className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-450 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                                                title="کپی کد رهگیری"
                                            >
                                                <Copy size={15} />
                                            </button>
                                        </div>
                                    ) : "-"
                                }
                            />
                            <InfoRow
                                icon={<CalendarDays size={17} />}
                                label="تاریخ پرداخت"
                                value={formatPersianDate(payment.paidAt)}
                                isLast
                            />
                        </motion.div>
                    </motion.section>
                </motion.div>
            </div>
        </div>
    );
}
