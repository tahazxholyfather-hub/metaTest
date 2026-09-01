import React, { useState, useRef, useEffect, useCallback } from "react";
import Cropper from "react-easy-crop";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
    CreditCard, Crown, Calendar, CheckCircle2, XCircle,
    Clock, Loader2, Star, Shield as ShieldIcon, Diamond, User as UserIcon,
    Inbox, Receipt, BadgePercent, UserPlus
} from "lucide-react";
import { useUser } from "../context/UserContext";
import { flowApi } from '../lib/authApi';
import { getCookie } from '../lib/cookies.ts';
import { getCroppedImg } from "../lib/cropImage";

// --- FIX 2: Import your custom ResponsiveModal component ---
import { ResponsiveModal } from "../components/ResponsiveModal"; // Adjust the path if necessary

// --- Icons (no changes) ---
const Icons = {
    User: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    Mail: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
    Phone: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>,
    Lock: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    Camera: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>,
    Shield: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    LogOut: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>,
    Edit: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>,
    Check: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    ChevronLeft: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
    Link: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
    Plus: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    Trash: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
};

// Social platform configs (no changes)
const PLATFORMS = {
    instagram: { name: "اینستاگرام", icon: Icons.Link, color: "text-pink-500", prefix: "instagram.com/" },
    telegram: { name: "تلگرام", icon: Icons.Link, color: "text-blue-500", prefix: "t.me/" },
    twitter: { name: "توییتر (X)", icon: Icons.Link, color: "text-gray-800 dark:text-white", prefix: "twitter.com/" },
    linkedin: { name: "لینکدین", icon: Icons.Link, color: "text-blue-700", prefix: "linkedin.com/in/" },
    website: { name: "وب‌سایت", icon: Icons.Link, color: "text-[var(--accent)]", prefix: "https://" }
};

type Tab = "info" | "social" | "security" | "payments" | "plan" | "invites";

interface ProfileViewProps {
    onLogout: () => void;
    onStateChange?: (state: { title: string; showBackButton: boolean }) => void;
}

// Tabs shown in the sidebar (desktop) and the scrollable tab bar (mobile)
const TAB_CONFIG: { id: Tab; label: string; shortLabel: string; icon: React.ReactNode }[] = [
    { id: "info", label: "اطلاعات فردی", shortLabel: "اطلاعات", icon: <UserIcon size={19} strokeWidth={1.7} /> },
    { id: "social", label: "شبکه‌های اجتماعی", shortLabel: "اجتماعی", icon: <Icons.Link /> },
    { id: "security", label: "امنیت و رمز", shortLabel: "امنیت", icon: <ShieldIcon size={19} strokeWidth={1.7} /> },
    { id: "plan", label: "اشتراک من", shortLabel: "اشتراک", icon: <Crown size={19} strokeWidth={1.7} /> },
    { id: "payments", label: "تاریخچه پرداخت‌ها", shortLabel: "پرداخت‌ها", icon: <CreditCard size={19} strokeWidth={1.7} /> },
    { id: "invites", label: "دعوت‌های من", shortLabel: "دعوت‌ها", icon: <UserPlus size={19} strokeWidth={1.7} /> },
];

const TAB_HEADERS: Record<Tab, { title: string; subtitle: string }> = {
    info: { title: "ویرایش اطلاعات فردی", subtitle: "اطلاعات حساب کاربری خود را در اینجا مدیریت کنید" },
    social: { title: "مدیریت شبکه‌های اجتماعی", subtitle: "راه‌های ارتباطی خود را اضافه کنید تا دیگران راحت‌تر شما را پیدا کنند" },
    security: { title: "تنظیمات امنیتی", subtitle: "برای حفظ امنیت، رمز عبور خود را مدیریت کنید" },
    plan: { title: "اشتراک فعال", subtitle: "وضعیت طرح فعلی، روزهای باقی‌مانده و سوابق خرید بسته‌ها" },
    payments: { title: "تاریخچه پرداخت‌ها", subtitle: "اطلاعات کامل تمام تراکنش‌های شما در سیستم" },
    invites: { title: "دعوت‌های من", subtitle: "لیست کامل کاربرانی که با معرفی شما ثبت‌نام کرده‌اند" },
};

// Plan meta used in the subscription tab
const PLAN_META: Record<string, { label: string; colorClass: string; bgClass: string; icon: React.ElementType; totalDays: number }> = {
    free: { label: 'طرح رایگان', colorClass: 'text-slate-500', bgClass: 'bg-slate-500/10', icon: UserIcon, totalDays: 0 },
    bronze: { label: 'برنزی', colorClass: 'text-amber-700 dark:text-amber-500', bgClass: 'bg-amber-500/10', icon: Star, totalDays: 30 },
    silver: { label: 'نقره‌ای', colorClass: 'text-gray-600 dark:text-gray-400', bgClass: 'bg-gray-500/10', icon: ShieldIcon, totalDays: 90 },
    golden: { label: 'طلایی', colorClass: 'text-yellow-500 dark:text-yellow-400', bgClass: 'bg-yellow-500/10', icon: Crown, totalDays: 180 },
    diamond: { label: 'الماسی', colorClass: 'text-cyan-600 dark:text-cyan-400', bgClass: 'bg-cyan-500/10', icon: Diamond, totalDays: 365 },
};

const PAYMENT_STATUS_META: Record<string, { label: string; classes: string; icon: React.ElementType }> = {
    paid: { label: 'پرداخت موفق', classes: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
    pending: { label: 'در انتظار پرداخت', classes: 'text-amber-600 bg-amber-500/10 border-amber-500/20', icon: Clock },
    failed: { label: 'ناموفق', classes: 'text-rose-600 bg-rose-500/10 border-rose-500/20', icon: XCircle },
    cancelled: { label: 'لغو شده', classes: 'text-slate-500 bg-slate-500/10 border-slate-500/20', icon: XCircle },
    expired: { label: 'منقضی شده', classes: 'text-slate-500 bg-slate-500/10 border-slate-500/20', icon: Clock },
};

const formatPrice = (value: number | string) => `${Number(value || 0).toLocaleString('fa-IR')} ریال`;
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString('fa-IR') : '—';

const ProfileInput = ({ icon: Icon, label, value, onChange, type = "text", readOnly = false, placeholder, rightElement }: any) => (
    <div className="group">
        <label className="block text-xs font-bold text-[var(--text-secondary)] mb-2 mr-1 opacity-80 group-focus-within:opacity-100 transition-opacity">
            {label}
        </label>
        <div className={`relative transition-all duration-300 transform ${!readOnly && "group-focus-within:-translate-y-0.5"}`}>
            <div className={`absolute top-1/2 -translate-y-1/2 right-4 transition-colors ${readOnly ? "text-[var(--text-muted)] opacity-50" : "text-[var(--text-muted)] group-focus-within:text-[var(--accent)]"}`}>
                <Icon />
            </div>
            <input
                dir={type === "password" || type === "tel" || type === "email" ? "ltr" : "rtl"}
                type={type}
                readOnly={readOnly}
                disabled={readOnly}
                className={`w-full rounded-xl py-3.5 pr-12 pl-[4.5rem] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-all duration-200 outline-none font-medium
                    ${readOnly
                    ? "bg-[var(--bg-element)]/50 border border-transparent cursor-not-allowed text-[var(--text-muted)]"
                    : "bg-[var(--bg-elevated)] border border-transparent focus:bg-[var(--bg-card)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10"
                }`}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
            />
            {rightElement && (
                <div className="absolute top-1/2 -translate-y-1/2 left-2">
                    {rightElement}
                </div>
            )}
        </div>
    </div>
);


export default function ProfileView({ onLogout, onStateChange }: ProfileViewProps) {
    const { user, setUser } = useUser();
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        onStateChange?.({ title: 'پروفایل کاربری', showBackButton: false });
    }, [onStateChange]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState<Tab>("info");

    // --- Avatar & Crop State ---
    const [avatar, setAvatar] = useState<string | null>(user?.avatar_url || null);
    const [tempImage, setTempImage] = useState<string | null>(null);
    const [isCropModalOpen, setIsCropModalOpen] = useState(false); // <-- FIX 2: State for new modal
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

    // استیت‌های مدیریت مودال تایید خروج و حذف آواتار
    const [isResettingAvatar, setIsResettingAvatar] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);


    const [info, setInfo] = useState({
        first_name: user?.first_name || "",
        last_name: user?.last_name || "",
        phone: user?.phone || "",
        email: user?.email || "",
        bio: user?.bio || ""
    });

    const [socials, setSocials] = useState<Record<string, string>>(user?.social_links || {});

    const [security, setSecurity] = useState({
        currentPass: "",
        newPass: "",
        confirmPass: ""
    });

    // --- Payments / Plan / Invites (lazy-loaded from backend) ---
    const [paymentsData, setPaymentsData] = useState<{ payments: any[]; subscription: any } | null>(null);
    const [paymentsLoading, setPaymentsLoading] = useState(false);
    const [paymentsError, setPaymentsError] = useState<string | null>(null);

    const [invitesData, setInvitesData] = useState<{ list: any[]; totalInvited: number; activeInvites: number } | null>(null);
    const [invitesLoading, setInvitesLoading] = useState(false);
    const [invitesError, setInvitesError] = useState<string | null>(null);

    const fetchPayments = useCallback(async () => {
        setPaymentsLoading(true);
        setPaymentsError(null);
        try {
            const res = await flowApi.dispatch('get_payment_history');
            if (res.success && res.data) {
                setPaymentsData(res.data);
            } else {
                setPaymentsError(res.message || 'خطا در دریافت تاریخچه پرداخت‌ها');
            }
        } catch (err: any) {
            setPaymentsError(err?.message || 'خطای شبکه در ارتباط با سرور');
        } finally {
            setPaymentsLoading(false);
        }
    }, []);

    const fetchInvites = useCallback(async () => {
        setInvitesLoading(true);
        setInvitesError(null);
        try {
            const res = await flowApi.dispatch('get_my_invites');
            if (res.success && res.data) {
                setInvitesData(res.data);
            } else {
                setInvitesError(res.message || 'خطا در دریافت لیست دعوت‌ها');
            }
        } catch (err: any) {
            setInvitesError(err?.message || 'خطای شبکه در ارتباط با سرور');
        } finally {
            setInvitesLoading(false);
        }
    }, []);

    useEffect(() => {
        if ((activeTab === 'payments' || activeTab === 'plan') && !paymentsData && !paymentsLoading) {
            fetchPayments();
        }
        if (activeTab === 'invites' && !invitesData && !invitesLoading) {
            fetchInvites();
        }
    }, [activeTab, paymentsData, paymentsLoading, invitesData, invitesLoading, fetchPayments, fetchInvites]);

    useEffect(() => {
        if (user) {
            setInfo({
                first_name: user.first_name || "",
                last_name: user.last_name || "",
                phone: user.phone || "",
                email: user.email || "",
                bio: user.bio || ""
            });
            setSocials(user.social_links || {});
        }
    }, [
        user?.first_name,
        user?.last_name,
        user?.phone,
        user?.email,
        user?.bio,
        JSON.stringify(user?.social_links)
    ]);


    const handleAvatarClick = () => fileInputRef.current?.click();

    const onCropComplete = useCallback((_area: any, pixels: any) => {
        setCroppedAreaPixels(pixels);
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                setTempImage(reader.result as string);
                setIsCropModalOpen(true);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCloseCropModal = () => {
        setIsCropModalOpen(false);
        setTimeout(() => setTempImage(null), 300);
    };

    const handleUploadAvatar = async () => {
        if (!tempImage || !croppedAreaPixels) return;
        setIsUploadingAvatar(true);

        try {
            const croppedBlob = await getCroppedImg(tempImage, croppedAreaPixels);
            const file = new File([croppedBlob as Blob], "avatar.jpg", { type: "image/jpeg" });
            const formData = new FormData();
            formData.append('avatar', file);
            const token = getCookie('token');

            const response = await fetch('/api/upload_avatar', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'x-app-token': `${token}`
                },
                body: formData,
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // Directly use the returned avatar_url to change the src
                setAvatar(result.avatarUrl);
                setUser({ ...user!, avatar_url: result.avatarUrl });

                toast.success("تصویر پروفایل با موفقیت بروزرسانی شد");
                handleCloseCropModal();
            } else {
                toast.error(result.message || "خطا در آپلود تصویر");
            }
        } catch (error) {
            console.error("Upload Error:", error);
            toast.error("خطایی در پردازش تصویر رخ داد");
        } finally {
            setIsUploadingAvatar(false);
        }
    };


    const handleResetAvatar = async () => {
        setIsResettingAvatar(true);
        try {
            const token = getCookie('token');
            const response = await fetch('/api/reset-avatar', {
                method: 'POST',
                headers: {
                    'x-app-token': `${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();

            if (response.ok && result.success) {
                const defaultAvatarUrl = result.avatar_url || '/avatars/user_default.png';
                setAvatar(defaultAvatarUrl);
                setUser({ ...user!, avatar_url: defaultAvatarUrl });
                toast.success("تصویر پروفایل با موفقیت حذف شد");
            } else {
                toast.error(result.message || "خطا در حذف تصویر");
            }
        } catch (error) {
            console.error("Reset Error:", error);
            toast.error("خطا در برقراری ارتباط با سرور");
        } finally {
            setIsResettingAvatar(false);
            setIsDeleteModalOpen(false); // بستن مودال بعد از اتمام عملیات
        }
    };

    const handleAddSocial = (platformKey: string) => {
        if (!(platformKey in socials)) {
            setSocials({ ...socials, [platformKey]: "" });
        }
    };

    const handleRemoveSocial = (platformKey: string) => {
        const updated = { ...socials };
        delete updated[platformKey];
        setSocials(updated);
    };

    const handleSocialChange = (platformKey: string, val: string) => {
        setSocials({ ...socials, [platformKey]: val });
    };

    const handleSave = async () => {
        if (security.newPass && security.newPass !== security.confirmPass) {
            toast.error("رمز عبور جدید و تکرار آن مطابقت ندارند");
            return;
        }

        setIsLoading(true);

        try {
            const result = await flowApi.dispatch('update_profile', {
                first_name: info.first_name,
                last_name: info.last_name,
                email: info.email,
                bio: info.bio,
                social_links: socials,
                currentPass: security.currentPass,
                newPass: security.newPass
            });

            if (result.success) {
                if (user) {
                    setUser({
                        ...user,
                        first_name: info.first_name,
                        last_name: info.last_name,
                        email: info.email,
                        bio: info.bio,
                        social_links: socials,
                        // @ts-ignore
                        password_set: result.password_set
                    });
                }
                toast.success(result.message || "تغییرات با موفقیت ذخیره شد");
                setSecurity({ currentPass: "", newPass: "", confirmPass: "" });
            } else {
                toast.error(result.message || "خطا در ذخیره اطلاعات");
            }
        } catch (error: any) {
            console.error("Update error:", error);
            toast.error(error.message || "خطا در برقراری ارتباط با سرور");
        } finally {
            setIsLoading(false);
        }
    };


    const fullName = `${info.first_name} ${info.last_name}`.trim() || "کاربر مهمان";

    // برای اطمینان از اینکه عکس پیش‌فرض است یا خیر (چون ممکنه تایم‌استمپ داشته باشه)
    const isCustomAvatar = avatar && !avatar.includes('user_default.png');

    const SidebarContent = () => (
        <div className="flex flex-col h-full">
            <div className="flex flex-col items-center p-6 border-b border-[var(--border)]/50 lg:border-none">
                <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                    <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-[var(--color-primary-500)] to-[var(--color-secondary-500)] opacity-70 blur group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="relative w-28 h-28 rounded-full bg-[var(--bg-elevated)] border-4 border-[var(--bg-card)] overflow-hidden shadow-xl">
                        {isCustomAvatar ? (
                            <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <img src='/avatars/user_default.png' alt="Avatar" className="w-full h-full object-cover" />
                        )}
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
                            <div className="text-white"><Icons.Camera /></div>
                        </div>
                    </div>
                    {/* آیکون ویرایش */}
                    <div className="absolute bottom-1 right-1 bg-[var(--bg-card)] p-1.5 rounded-full shadow-md border border-[var(--border)] text-[var(--accent)] hover:scale-110 transition-transform">
                        <Icons.Edit />
                    </div>
                    {/* آیکون حذف (فقط وقتی فعال باشد که کاربر تصویر شخصی داشته باشد) */}
                    {isCustomAvatar && (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsDeleteModalOpen(true);
                            }}
                            className="absolute bottom-1 left-1 bg-[var(--bg-card)] p-1.5 rounded-full shadow-md border border-[var(--border)] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:scale-110 transition-all z-10"
                            title="حذف تصویر پروفایل"
                        >
                            {isResettingAvatar ? (
                                <div className="w-4 h-4 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                            ) : (
                                <Icons.Trash />
                            )}
                        </div>
                    )}
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                </div>
                <h2 className="mt-4 text-xl font-bold text-[var(--text-primary)]">{fullName}</h2>
                <p className="text-[var(--text-muted)] text-sm" dir="ltr">{info.phone}</p>
            </div>

            <div className="hidden lg:flex flex-col gap-2 px-4 pb-4 flex-1">
                {TAB_CONFIG.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 font-medium text-sm
                            ${activeTab === tab.id
                            ? "bg-[var(--color-primary-50)] dark:bg-[var(--color-primary-900)]/30 text-[var(--color-primary-600)] dark:text-[var(--color-primary-400)]"
                            : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"}`}
                    >
                        {tab.icon}
                        <span>{tab.label}</span>
                        {activeTab === tab.id && <div className="mr-auto"><Icons.ChevronLeft /></div>}
                    </button>
                ))}
            </div>

            <div className="hidden lg:block p-4 mt-auto border-t border-[var(--border)]/50">
                <button
                    onClick={() => setIsLogoutModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-sm font-bold"
                >
                    <Icons.LogOut />
                    <span>خروج از حساب</span>
                </button>
            </div>
        </div>
    );
    return (
        <div className="w-full max-w-7xl mx-auto px-4 pb-8 pt-6">

            {/* مودال کراپ تصویر */}
            <ResponsiveModal
                isOpen={isCropModalOpen}
                onClose={handleCloseCropModal}
                title="تنظیم تصویر پروفایل"
                className="md:w-[500px]"
            >
                {tempImage && (
                    <div className="flex flex-col">
                        <div className="relative h-80 w-full bg-[#111] -mx-6">
                            <Cropper
                                image={tempImage}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                cropShape="round"
                                showGrid={false}
                                onCropChange={setCrop}
                                onCropComplete={onCropComplete}
                                onZoomChange={setZoom}
                            />
                        </div>

                        <div className="pt-6 space-y-6">
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-[var(--text-muted)]">
                                    <span>بزرگنمایی</span>
                                    <span>{Math.round(zoom * 100)}%</span>
                                </div>
                                <input
                                    type="range"
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    value={zoom}
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    className="w-full h-1.5 bg-[var(--bg-elevated)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    disabled={isUploadingAvatar}
                                    onClick={handleUploadAvatar}
                                    className="flex-1 bg-[var(--accent)] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                                >
                                    {isUploadingAvatar ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <Icons.Check />
                                            تایید و ذخیره
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={handleCloseCropModal}
                                    className="flex-1 bg-[var(--bg-elevated)] text-[var(--text-primary)] py-3 rounded-xl font-bold"
                                >
                                    انصراف
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </ResponsiveModal>

            {/* مودال تایید حذف تصویر */}
            <ResponsiveModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="حذف تصویر پروفایل"
                className="md:w-[400px]"
            >
                <div className="p-4 text-right">
                    <p className="text-[var(--text-secondary)] mb-6">آیا از حذف تصویر پروفایل خود اطمینان دارید؟ این عمل قابل بازگشت نیست.</p>
                    <div className="flex justify-end gap-3 mt-4">
                        <button
                            onClick={() => setIsDeleteModalOpen(false)}
                            className="px-4 py-2 bg-[var(--bg-elevated)] text-[var(--text-primary)] rounded-xl font-bold"
                        >
                            انصراف
                        </button>
                        <button
                            onClick={handleResetAvatar}
                            disabled={isResettingAvatar}
                            className="px-4 py-2 bg-red-500 text-white rounded-xl font-bold"
                        >
                            {isResettingAvatar ? 'در حال حذف...' : 'بله، حذف کن'}
                        </button>
                    </div>
                </div>
            </ResponsiveModal>



            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
                <div className="lg:col-span-4 xl:col-span-3 lg:sticky lg:top-6 lg:self-start z-30">
                    <div className="bg-[var(--bg-card)] rounded-3xl shadow-sm border border-[var(--border)] overflow-hidden">
                        <SidebarContent />
                    </div>
                </div>

                <div className="lg:col-span-8 xl:col-span-9 space-y-6 relative z-10">
                    <div className="lg:hidden bg-[var(--bg-elevated)] p-1.5 rounded-2xl flex relative overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        {TAB_CONFIG.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 min-w-[72px] relative z-10 py-2.5 px-1 text-[11px] sm:text-sm font-bold transition-colors duration-300 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 whitespace-nowrap
                                ${activeTab === tab.id ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
                            >
                                {tab.icon}
                                <span className="mt-0.5">{tab.shortLabel}</span>
                                {activeTab === tab.id && (
                                    <motion.div
                                        layoutId="activeTabProfileMobile"
                                        className="absolute inset-0 bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border)]/50 -z-10"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="card bg-[var(--bg-card)] shadow-lg shadow-[var(--shadow-1)] border border-[var(--border-strong)]/40 rounded-3xl p-6 sm:p-8 overflow-hidden min-h-[400px]">
                        <div className="mb-6 pb-4 border-b border-[var(--border)]/50 hidden lg:block">
                            <h3 className="text-xl font-bold text-[var(--text-primary)]">{TAB_HEADERS[activeTab].title}</h3>
                            <p className="text-[var(--text-muted)] text-sm mt-1">{TAB_HEADERS[activeTab].subtitle}</p>
                        </div>

                        <AnimatePresence mode="wait">
                            {activeTab === "info" && (
                                <motion.div
                                    key="info"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-5"
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <ProfileInput
                                            icon={Icons.User}
                                            label="نام"
                                            value={info.first_name}
                                            onChange={(e: any) => setInfo({ ...info, first_name: e.target.value })}
                                        />
                                        <ProfileInput
                                            icon={Icons.User}
                                            label="نام خانوادگی"
                                            value={info.last_name}
                                            onChange={(e: any) => setInfo({ ...info, last_name: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <ProfileInput
                                            icon={Icons.Phone}
                                            label="شماره موبایل"
                                            value={info.phone}
                                            readOnly
                                        />
                                        <ProfileInput
                                            icon={Icons.Mail}
                                            label="ایمیل (اختیاری)"
                                            value={info.email}
                                            type="email"
                                            placeholder="example@gmail.com"
                                            onChange={(e: any) => setInfo({ ...info, email: e.target.value })}
                                        />
                                    </div>
                                    <ProfileInput
                                        icon={Icons.Edit}
                                        label="بیوگرافی"
                                        value={info.bio || ""}
                                        placeholder="درباره خودتان بنویسید..."
                                        onChange={(e: any) => setInfo({ ...info, bio: e.target.value })}
                                    />
                                </motion.div>
                            )}

                            {activeTab === "social" && (
                                <motion.div
                                    key="social"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-5"
                                >
                                    {Object.keys(socials).length === 0 && (
                                        <div className="text-center py-8 text-[var(--text-muted)]">
                                            هیچ شبکه اجتماعی ثبت نشده است. از لیست زیر برای افزودن استفاده کنید.
                                        </div>
                                    )}

                                    <div className="space-y-4">
                                        {Object.entries(socials).map(([key, value]) => {
                                            const platform = PLATFORMS[key as keyof typeof PLATFORMS] || { name: key, icon: Icons.Link, color: "text-[var(--text-primary)]", prefix: "" };
                                            return (
                                                <ProfileInput
                                                    key={key}
                                                    icon={platform.icon}
                                                    label={platform.name}
                                                    value={value}
                                                    dir="ltr"
                                                    placeholder={platform.prefix}
                                                    onChange={(e: any) => handleSocialChange(key, e.target.value)}
                                                    rightElement={
                                                        <button
                                                            onClick={() => handleRemoveSocial(key)}
                                                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                            title="حذف"
                                                        >
                                                            <Icons.Trash />
                                                        </button>
                                                    }
                                                />
                                            );
                                        })}
                                    </div>

                                    <div className="pt-6 border-t border-[var(--border)]/50">
                                        <label className="block text-xs font-bold text-[var(--text-secondary)] mb-3">افزودن شبکه جدید</label>
                                        <div className="flex flex-wrap gap-2">
                                            {Object.entries(PLATFORMS).map(([key, platform]) => {
                                                if (key in socials) return null;
                                                return (
                                                    <button
                                                        key={key}
                                                        onClick={() => handleAddSocial(key)}
                                                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all text-sm font-medium text-[var(--text-secondary)]"
                                                    >
                                                        <Icons.Plus />
                                                        {platform.name}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === "security" && (
                                <motion.div
                                    key="security"
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-5"
                                >
                                    {!user?.password_set ? (
                                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 text-blue-700 dark:text-blue-400 text-sm p-4 rounded-xl leading-relaxed flex items-start gap-3">
                                            <div className="mt-0.5"><Icons.Shield /></div>
                                            <span>شما هنوز رمز عبوری برای حساب خود تنظیم نکرده‌اید. با تنظیم رمز عبور می‌توانید در دفعات بعدی سریع‌تر وارد حساب شوید.</span>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 text-amber-700 dark:text-amber-400 text-xs p-4 rounded-xl leading-relaxed flex items-start gap-2">
                                                <div className="mt-0.5"><Icons.Shield /></div>
                                                <span>برای تغییر رمز عبور، ابتدا باید رمز فعلی خود را وارد کنید.</span>
                                            </div>
                                            <ProfileInput
                                                icon={Icons.Lock}
                                                label="رمز عبور فعلی"
                                                type="password"
                                                value={security.currentPass}
                                                onChange={(e: any) => setSecurity({ ...security, currentPass: e.target.value })}
                                            />
                                            <div className="h-px bg-[var(--border)] w-full opacity-50 my-2"></div>
                                        </>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <ProfileInput
                                            icon={Icons.Lock}
                                            label={user?.password_set ? "رمز عبور جدید" : "رمز عبور"}
                                            type="password"
                                            value={security.newPass}
                                            onChange={(e: any) => setSecurity({ ...security, newPass: e.target.value })}
                                        />
                                        <ProfileInput
                                            icon={Icons.Check}
                                            label="تکرار رمز عبور"
                                            type="password"
                                            value={security.confirmPass}
                                            onChange={(e: any) => setSecurity({ ...security, confirmPass: e.target.value })}
                                        />
                                    </div>
                                </motion.div>
                            )}

                            {/* ─── Subscription / Active Plan Tab ─── */}
                            {activeTab === "plan" && (
                                <motion.div
                                    key="plan"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-5"
                                >
                                    {paymentsLoading ? (
                                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--text-muted)]">
                                            <Loader2 size={26} className="animate-spin text-[var(--accent)]" />
                                            <span className="text-xs font-bold">در حال دریافت وضعیت اشتراک...</span>
                                        </div>
                                    ) : paymentsError ? (
                                        <div className="text-center py-12 space-y-3">
                                            <p className="text-sm text-rose-500 font-bold">{paymentsError}</p>
                                            <button onClick={fetchPayments} className="px-5 py-2 bg-[var(--accent)] text-white rounded-xl text-xs font-bold">تلاش مجدد</button>
                                        </div>
                                    ) : (
                                        (() => {
                                            const sub = paymentsData?.subscription;
                                            const planKey = (sub?.currentPlan === 'epic' ? 'diamond' : sub?.currentPlan) || 'free';
                                            const meta = PLAN_META[planKey] || PLAN_META.free;
                                            const PlanIcon = meta.icon;
                                            const daysRemaining = sub?.daysRemaining || 0;
                                            const progress = meta.totalDays > 0 ? Math.min(100, Math.max(0, (daysRemaining / meta.totalDays) * 100)) : 0;
                                            const paidPayments = (paymentsData?.payments || []).filter((p: any) => p.status === 'paid');

                                            return (
                                                <>
                                                    {/* Active plan card */}
                                                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]/60 p-5">
                                                        <div className="flex items-center justify-between flex-wrap gap-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${meta.bgClass}`}>
                                                                    <PlanIcon size={24} className={meta.colorClass} />
                                                                </div>
                                                                <div>
                                                                    <h4 className={`text-base font-black ${meta.colorClass}`}>{meta.label}</h4>
                                                                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                                                                        {planKey === 'free'
                                                                            ? 'شما در حال حاضر اشتراک فعالی ندارید.'
                                                                            : `اعتبار تا ${formatDate(sub?.planExpiresAt)}`}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            {planKey !== 'free' && (
                                                                <div className="text-center px-4 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                                                                    <span className="block text-2xl font-black text-[var(--text-primary)] leading-none">{daysRemaining.toLocaleString('fa-IR')}</span>
                                                                    <span className="text-[10px] text-[var(--text-muted)]">روز باقی‌مانده</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {planKey !== 'free' && meta.totalDays > 0 && (
                                                            <div className="mt-4 h-2 w-full bg-[var(--bg-element)] rounded-full overflow-hidden border border-[var(--border)]/60">
                                                                <motion.div
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${progress}%` }}
                                                                    transition={{ duration: 0.9, ease: "easeOut" }}
                                                                    className="h-full rounded-full bg-[var(--accent)]"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Purchase history (paid packages) */}
                                                    <div>
                                                        <h4 className="text-sm font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                                                            <Receipt size={16} className="text-[var(--accent)]" /> سوابق خرید بسته‌ها
                                                        </h4>
                                                        {paidPayments.length === 0 ? (
                                                            <div className="flex flex-col items-center justify-center py-10 gap-2 text-[var(--text-muted)] bg-[var(--bg-elevated)]/40 border border-dashed border-[var(--border)] rounded-2xl">
                                                                <Inbox size={22} />
                                                                <span className="text-xs font-bold">هنوز بسته‌ای خریداری نکرده‌اید.</span>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {paidPayments.map((p: any) => (
                                                                    <div key={`paid-${p.id}`} className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/40">
                                                                        <div className="flex items-center gap-3 min-w-0">
                                                                            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                                                                                <CheckCircle2 size={17} />
                                                                            </div>
                                                                            <div className="min-w-0">
                                                                                <span className="block text-xs font-bold text-[var(--text-primary)] truncate">{p.planName}</span>
                                                                                <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] mt-0.5">
                                                                                    <Calendar size={10} /> {formatDate(p.paidAt || p.requestedAt)}
                                                                                    {p.planDays ? ` • ${p.planDays} روزه` : ''}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        <span className="text-xs font-black text-[var(--text-primary)] shrink-0">{formatPrice(p.finalPrice)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            );
                                        })()
                                    )}
                                </motion.div>
                            )}

                            {/* ─── Payment History Tab ─── */}
                            {activeTab === "payments" && (
                                <motion.div
                                    key="payments"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-3"
                                >
                                    {paymentsLoading ? (
                                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--text-muted)]">
                                            <Loader2 size={26} className="animate-spin text-[var(--accent)]" />
                                            <span className="text-xs font-bold">در حال دریافت تاریخچه پرداخت‌ها...</span>
                                        </div>
                                    ) : paymentsError ? (
                                        <div className="text-center py-12 space-y-3">
                                            <p className="text-sm text-rose-500 font-bold">{paymentsError}</p>
                                            <button onClick={fetchPayments} className="px-5 py-2 bg-[var(--accent)] text-white rounded-xl text-xs font-bold">تلاش مجدد</button>
                                        </div>
                                    ) : (paymentsData?.payments || []).length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-14 gap-2 text-[var(--text-muted)] bg-[var(--bg-elevated)]/40 border border-dashed border-[var(--border)] rounded-2xl">
                                            <CreditCard size={24} />
                                            <span className="text-xs font-bold">هیچ تراکنشی ثبت نشده است.</span>
                                        </div>
                                    ) : (
                                        (paymentsData?.payments || []).map((p: any) => {
                                            const statusMeta = PAYMENT_STATUS_META[p.status] || PAYMENT_STATUS_META.pending;
                                            const StatusIcon = statusMeta.icon;
                                            const totalDiscount = Number(p.planDiscountAmount || 0) + Number(p.couponDiscountAmount || 0);
                                            return (
                                                <div key={`pay-${p.id}`} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]/40 p-4 space-y-3">
                                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <div className="w-9 h-9 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center shrink-0">
                                                                <CreditCard size={17} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <span className="block text-xs font-bold text-[var(--text-primary)] truncate">{p.planName}</span>
                                                                <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] mt-0.5">
                                                                    <Calendar size={10} /> {formatDate(p.requestedAt)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold ${statusMeta.classes}`}>
                                                            <StatusIcon size={12} /> {statusMeta.label}
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                                                        <div className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]/70">
                                                            <span className="block text-[9px] text-[var(--text-muted)] mb-0.5">مبلغ پایه</span>
                                                            <span className="text-[11px] font-bold text-[var(--text-primary)]">{formatPrice(p.basePrice)}</span>
                                                        </div>
                                                        <div className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]/70">
                                                            <span className="block text-[9px] text-[var(--text-muted)] mb-0.5">تخفیف</span>
                                                            <span className={`text-[11px] font-bold ${totalDiscount > 0 ? 'text-rose-500' : 'text-[var(--text-primary)]'}`}>
                                                                {totalDiscount > 0 ? `−${formatPrice(totalDiscount)}` : '—'}
                                                            </span>
                                                        </div>
                                                        <div className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]/70">
                                                            <span className="block text-[9px] text-[var(--text-muted)] mb-0.5">مبلغ نهایی</span>
                                                            <span className="text-[11px] font-black text-[var(--accent)]">{formatPrice(p.finalPrice)}</span>
                                                        </div>
                                                        <div className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]/70">
                                                            <span className="block text-[9px] text-[var(--text-muted)] mb-0.5">کد پیگیری</span>
                                                            <span className="text-[11px] font-bold text-[var(--text-primary)]" dir="ltr">{p.refId || '—'}</span>
                                                        </div>
                                                    </div>

                                                    {Number(p.couponPercent) > 0 && (
                                                        <div className="flex items-center gap-1.5 text-[10px] text-rose-500 font-bold">
                                                            <BadgePercent size={12} /> کد تخفیف {Number(p.couponPercent).toLocaleString('fa-IR')}٪ اعمال شده است
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </motion.div>
                            )}

                            {/* ─── Invites Tab ─── */}
                            {activeTab === "invites" && (
                                <motion.div
                                    key="invites"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-4"
                                >
                                    {invitesLoading ? (
                                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--text-muted)]">
                                            <Loader2 size={26} className="animate-spin text-[var(--accent)]" />
                                            <span className="text-xs font-bold">در حال دریافت لیست دعوت‌ها...</span>
                                        </div>
                                    ) : invitesError ? (
                                        <div className="text-center py-12 space-y-3">
                                            <p className="text-sm text-rose-500 font-bold">{invitesError}</p>
                                            <button onClick={fetchInvites} className="px-5 py-2 bg-[var(--accent)] text-white rounded-xl text-xs font-bold">تلاش مجدد</button>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Summary */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="p-4 rounded-2xl bg-[var(--bg-elevated)]/60 border border-[var(--border)] text-center">
                                                    <span className="block text-2xl font-black text-[var(--text-primary)]">{(invitesData?.totalInvited || 0).toLocaleString('fa-IR')}</span>
                                                    <span className="text-[11px] text-[var(--text-muted)]">کل دعوت‌شده‌ها</span>
                                                </div>
                                                <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-center">
                                                    <span className="block text-2xl font-black text-emerald-500">{(invitesData?.activeInvites || 0).toLocaleString('fa-IR')}</span>
                                                    <span className="text-[11px] text-[var(--text-muted)]">کاربران فعال‌شده</span>
                                                </div>
                                            </div>

                                            {/* Full list */}
                                            {(invitesData?.list || []).length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-12 gap-2 text-[var(--text-muted)] bg-[var(--bg-elevated)]/40 border border-dashed border-[var(--border)] rounded-2xl">
                                                    <UserPlus size={24} />
                                                    <span className="text-xs font-bold">هنوز کسی با معرفی شما ثبت‌نام نکرده است.</span>
                                                    <span className="text-[10px]">لینک دعوت خود را از داشبورد برای دوستانتان ارسال کنید.</span>
                                                </div>
                                            ) : (
                                                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                                    {(invitesData?.list || []).map((invite: any, idx: number) => {
                                                        const isActive = invite.status === 'active';
                                                        return (
                                                            <div key={invite.id || `inv-${idx}`} className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/40">
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    <div className="w-9 h-9 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center shrink-0">
                                                                        <span className="text-xs font-bold text-[var(--accent)]">{(invite.name || 'ک').trim().charAt(0) || 'ک'}</span>
                                                                    </div>
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className="text-xs font-bold text-[var(--text-primary)] truncate">{(invite.name || '').trim() || 'کاربر بدون نام'}</span>
                                                                        <span className="text-[10px] text-[var(--text-muted)] tracking-wider" dir="ltr">{invite.invited_phone}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    <span className="hidden sm:flex items-center gap-1 text-[9px] text-[var(--text-muted)]">
                                                                        <Calendar size={10} /> {formatDate(invite.createdAt)}
                                                                    </span>
                                                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${isActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                                                        {isActive ? 'فعال شده' : 'در انتظار'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {["info", "social", "security"].includes(activeTab) && (
                            <div className="mt-8 pt-4 border-t border-[var(--border)]/50 flex justify-end">
                                <button
                                    onClick={handleSave}
                                    disabled={isLoading}
                                    className="w-full md:w-auto px-8 relative h-12 rounded-xl font-bold text-white text-base overflow-hidden shadow-lg shadow-[var(--color-primary-500)]/20 transition-all duration-300 hover:shadow-[var(--color-primary-500)]/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
                                    style={{
                                        background: "linear-gradient(135deg, var(--color-primary-600) 0%, var(--color-primary-500) 100%)"
                                    }}
                                >
                                    <div className={`flex items-center justify-center gap-2 transition-all duration-300 ${isLoading ? "opacity-0" : "opacity-100"}`}>
                                        <span>ذخیره تغییرات</span>
                                    </div>
                                    {isLoading && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <svg className="animate-spin w-5 h-5 text-white" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        </div>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="lg:hidden flex justify-center mt-6 mb-20">
                        <button onClick={onLogout} className="text-red-500 px-4 py-2 flex items-center gap-2 font-bold text-sm">
                            <Icons.LogOut />
                            <span>خروج از حساب کاربری</span>
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}