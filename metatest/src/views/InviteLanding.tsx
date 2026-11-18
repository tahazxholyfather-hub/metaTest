import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

// Landing page for shared invite links (/invite/:code, or /app/invite/:code).
// Persists the invite code so registration can attribute the referral,
// then forwards the user into the app.
export default function InviteLanding() {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();
    const home = import.meta.env.BASE_URL || "/";

    useEffect(() => {
        if (code) {
            try {
                localStorage.setItem("invite_code", code);
            } catch {
                // Storage can throw in private mode. The visitor still enters the app.
            }
        }
        navigate("/", { replace: true });
    }, [code, navigate]);

    return (
        <div
            dir="rtl"
            className="min-h-[100dvh] bg-[var(--bg-app)] text-[var(--text-primary)] flex items-center justify-center p-6"
        >
            <div className="max-w-sm w-full text-center">
                <p className="text-lg font-bold">در حال باز کردن متاتست</p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    کد دعوت ذخیره شد. چند لحظه دیگر وارد برنامه می‌شوید.
                </p>
                <a href={home} className="inline-block mt-5 text-sm font-bold text-[var(--color-primary-600)]">
                    ورود به برنامه
                </a>
            </div>
        </div>
    );
}
