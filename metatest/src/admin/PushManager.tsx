import { useEffect, useState } from 'react';
import { AlertCircle, BellRing, Loader2, Monitor, Send, Smartphone } from 'lucide-react';
import { adminApi } from '../lib/adminApi';

interface PushRule {
    key: string;
    enabled: boolean;
    title: string;
    body: string;
    icon: string;
    image: string;
    link: string;
}

interface PushSend {
    id: number;
    userId?: number | null;
    ruleKey?: string | null;
    title: string;
    status: string;
    createdAt?: string;
}

interface Draft {
    title: string;
    body: string;
    icon: string;
    image: string;
    link: string;
}

const HINTS: Record<string, string> = {
    practice_idle_2: 'برای کسی که دو روز تمرین نکرده. اگر قانون سه روز هم روشن باشد، روز سوم فقط همان فرستاده می‌شود.',
    practice_idle_3: 'برای کسی که سه روز یا بیشتر تمرین نکرده.',
    level_up: 'همان لحظه که سطح کاربر بالا می‌رود. {level} با شماره سطح عوض می‌شود.',
    achievement_quiz_10: 'یک بار، بعد از ده روز تمرین ثبت‌شده.',
    review_waiting: 'وقتی جعبه مرور سؤال دارد. {count} تعداد سؤال است.',
    streak_risk: 'دیروز تمرین کرده و امروز هنوز نه.',
    plan_expiring: 'کمتر از سه روز تا پایان اشتراک فعال.',
};

const LABELS: Record<string, string> = {
    practice_idle_2: 'دو روز بدون تمرین',
    practice_idle_3: 'سه روز بدون تمرین',
    level_up: 'سطح جدید',
    achievement_quiz_10: 'ده روز تمرین',
    review_waiting: 'جعبه مرور',
    streak_risk: 'خطر قطع زنجیره',
    plan_expiring: 'پایان اشتراک',
};

const emptyDraft: Draft = {
    title: 'متاتست',
    body: 'یک خبر تازه برای تو داریم.',
    icon: '',
    image: '',
    link: '/practice',
};

function formatWhen(value?: string) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('fa-IR', {
        timeZone: 'Asia/Tehran',
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

function NotificationCard({ draft, compact = false }: { draft: Draft; compact?: boolean }) {
    return (
        <div className={`w-full rounded-2xl bg-white text-right text-zinc-900 shadow-lg ${compact ? 'p-2.5' : 'p-3'}`} dir="rtl">
            <div className="flex items-start gap-2">
                {draft.icon ? (
                    <img src={draft.icon} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1C4070] text-[10px] font-black text-white">م</div>
                )}
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-black">{draft.title || 'عنوان اعلان'}</p>
                    <p className="mt-0.5 line-clamp-3 text-[11px] leading-5 text-zinc-600">{draft.body || 'متن اعلان'}</p>
                </div>
            </div>
            {draft.image && (
                <img src={draft.image} alt="" className="mt-2 h-16 w-full rounded-xl object-cover" />
            )}
        </div>
    );
}

function DevicePreview({ draft }: { draft: Draft }) {
    return (
        <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-[#dadce0] bg-[#f8f9fa] p-4 dark:border-[#333537] dark:bg-[#131314]">
                <p className="mb-3 flex items-center gap-1.5 text-xs font-bold text-[#5f6368] dark:text-[#9aa0a6]">
                    <Smartphone size={14} /> موبایل
                </p>
                <div className="mx-auto w-[220px] rounded-[28px] border-4 border-zinc-800 bg-zinc-950 p-3 shadow-inner">
                    <div className="mb-3 h-1.5 w-16 mx-auto rounded-full bg-zinc-700" />
                    <NotificationCard draft={draft} compact />
                    <div className="mt-6 space-y-2">
                        <div className="h-2 rounded-full bg-zinc-800" />
                        <div className="h-2 w-2/3 rounded-full bg-zinc-800" />
                    </div>
                </div>
            </div>
            <div className="rounded-3xl border border-[#dadce0] bg-[#f8f9fa] p-4 dark:border-[#333537] dark:bg-[#131314]">
                <p className="mb-3 flex items-center gap-1.5 text-xs font-bold text-[#5f6368] dark:text-[#9aa0a6]">
                    <Monitor size={14} /> دسکتاپ
                </p>
                <div className="relative min-h-[220px] overflow-hidden rounded-2xl border border-[#dadce0] bg-gradient-to-br from-[#dbe7f6] to-[#eef2f7] dark:border-[#333537] dark:from-[#1a1c22] dark:to-[#111216]">
                    <div className="absolute inset-x-0 top-0 flex h-8 items-center gap-1.5 bg-white/70 px-3 dark:bg-black/30">
                        <span className="h-2 w-2 rounded-full bg-rose-400" />
                        <span className="h-2 w-2 rounded-full bg-amber-400" />
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    </div>
                    <div className="absolute bottom-3 left-3 w-[240px]">
                        <NotificationCard draft={draft} />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function PushManager() {
    const [draft, setDraft] = useState<Draft>(emptyDraft);
    const [preview, setPreview] = useState<Draft>(emptyDraft);
    const [query, setQuery] = useState('');
    const [rules, setRules] = useState<PushRule[]>([]);
    const [recent, setRecent] = useState<PushSend[]>([]);
    const [subscriptionCount, setSubscriptionCount] = useState(0);
    const [subscriberCount, setSubscriberCount] = useState(0);
    const [ready, setReady] = useState(true);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [savingKey, setSavingKey] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await adminApi.pushOverview();
            if (!res.success) throw new Error(res.message || 'بارگذاری اعلان پوش ناموفق بود');
            setRules(res.rules || []);
            setRecent(res.recent || []);
            setSubscriptionCount(Number(res.subscriptionCount) || 0);
            setSubscriberCount(Number(res.subscriberCount) || 0);
            setReady(res.webPushReady !== false);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'بارگذاری اعلان پوش ناموفق بود');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void load(); }, []);

    const updateDraft = (patch: Partial<Draft>) => {
        setDraft((current) => {
            const next = { ...current, ...patch };
            setPreview(next);
            return next;
        });
    };

    const send = async (broadcast: boolean) => {
        setSending(true);
        setError(null);
        setNotice(null);
        try {
            const res = broadcast
                ? await adminApi.broadcastPush({ ...draft })
                : await adminApi.testPush({ ...draft, query });
            if (!res.success) throw new Error(res.message || 'ارسال انجام نشد');
            setNotice(res.message || 'فرستاده شد.');
            await load();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'ارسال انجام نشد');
        } finally {
            setSending(false);
        }
    };

    const saveRule = async (rule: PushRule) => {
        setSavingKey(rule.key);
        setError(null);
        setNotice(null);
        try {
            const res = await adminApi.savePushRule(rule.key, rule);
            if (!res.success) throw new Error(res.message || 'ذخیره قانون ناموفق بود');
            setRules(res.rules || rules);
            setNotice('قانون ذخیره شد.');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'ذخیره قانون ناموفق بود');
        } finally {
            setSavingKey(null);
        }
    };

    if (loading) {
        return <div className="flex h-40 items-center justify-center"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="flex w-full flex-col gap-6">
            <div className="rounded-2xl border border-[#dadce0] bg-white p-4 shadow-sm dark:border-[#333537] dark:bg-[#1e1f20]">
                <h1 className="flex items-center gap-2 text-sm font-bold"><BellRing size={16} /> اعلان پوش</h1>
                <p className="mt-1 max-w-2xl text-xs text-[#86868b]">
                    پیام به دستگاه کاربر می‌رود، حتی اگر سایت باز نباشد. قانون‌های هوشمند خاموش‌اند تا خودت روشن کنی.
                    {subscriberCount > 0 && ` ${subscriberCount} کاربر و ${subscriptionCount} دستگاه ثبت شده.`}
                </p>
                {!ready && (
                    <p className="mt-2 text-xs font-semibold text-amber-600">کتابخانه پوش روی سرور آماده نیست. بقیه پنل کار می‌کند.</p>
                )}
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-600 dark:bg-red-500/10">
                    <AlertCircle size={14} /> {error}
                </div>
            )}
            {notice && (
                <div className="rounded-xl bg-[#e8f0fe] p-3 text-xs font-semibold text-[#1a73e8] dark:bg-[#1a73e8]/10">{notice}</div>
            )}

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="flex flex-col gap-3 rounded-[2rem] border border-[#dadce0] bg-white p-6 shadow-sm dark:border-[#333537] dark:bg-[#1e1f20]">
                    <input value={draft.title} maxLength={160} onChange={(event) => updateDraft({ title: event.target.value })} placeholder="عنوان" className="w-full rounded-xl border border-[#dadce0] bg-[#f8f9fa] px-4 py-3 text-sm dark:border-[#444746] dark:bg-[#131314]" />
                    <textarea value={draft.body} maxLength={500} rows={4} onChange={(event) => updateDraft({ body: event.target.value })} placeholder="متن پیام" className="w-full rounded-xl border border-[#dadce0] bg-[#f8f9fa] px-4 py-3 text-sm dark:border-[#444746] dark:bg-[#131314]" />
                    <input value={draft.icon} onChange={(event) => updateDraft({ icon: event.target.value })} placeholder="آدرس آیکون" className="w-full rounded-xl border border-[#dadce0] bg-[#f8f9fa] px-4 py-3 text-xs dark:border-[#444746] dark:bg-[#131314]" />
                    <input value={draft.image} onChange={(event) => updateDraft({ image: event.target.value })} placeholder="آدرس تصویر" className="w-full rounded-xl border border-[#dadce0] bg-[#f8f9fa] px-4 py-3 text-xs dark:border-[#444746] dark:bg-[#131314]" />
                    <input value={draft.link} onChange={(event) => updateDraft({ link: event.target.value })} placeholder="لینک، مثلاً /practice" className="w-full rounded-xl border border-[#dadce0] bg-[#f8f9fa] px-4 py-3 text-xs dark:border-[#444746] dark:bg-[#131314]" />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="شماره یا نام کاربری برای ارسال آزمایشی" className="w-full rounded-xl border border-[#dadce0] bg-[#f8f9fa] px-4 py-3 text-xs dark:border-[#444746] dark:bg-[#131314]" />
                    <div className="flex flex-wrap gap-2">
                        <button type="button" disabled={sending} onClick={() => void send(false)} className="inline-flex items-center gap-2 rounded-xl bg-[#1a73e8] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60">
                            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                            ارسال آزمایشی
                        </button>
                        <button type="button" disabled={sending} onClick={() => void send(true)} className="rounded-xl border border-[#dadce0] px-4 py-2.5 text-xs font-bold dark:border-[#444746]">
                            ارسال به همه دستگاه‌ها
                        </button>
                    </div>
                </div>
                <DevicePreview draft={preview} />
            </div>

            <div className="flex flex-col gap-3">
                {rules.map((rule) => (
                    <div key={rule.key} className="rounded-[1.5rem] border border-[#dadce0] bg-white p-4 shadow-sm dark:border-[#333537] dark:bg-[#1e1f20]">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-bold">{LABELS[rule.key] || rule.key}</p>
                                <p className="text-[11px] text-[#86868b]">{HINTS[rule.key]}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    const updated = { ...rule, enabled: !rule.enabled };
                                    setRules(rules.map((item) => item.key === rule.key ? updated : item));
                                    setPreview(updated);
                                    void saveRule(updated);
                                }}
                                className={`rounded-full px-3 py-1 text-[11px] font-black ${rule.enabled ? 'bg-emerald-500 text-white' : 'bg-[#f1f3f4] text-[#5f6368] dark:bg-[#333537]'}`}
                            >
                                {rule.enabled ? 'روشن' : 'خاموش'}
                            </button>
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                            <input value={rule.title} onChange={(event) => {
                                const next = { ...rule, title: event.target.value };
                                setRules(rules.map((item) => item.key === rule.key ? next : item));
                                setPreview(next);
                            }} className="rounded-xl border border-[#dadce0] bg-[#f8f9fa] px-3 py-2 text-xs dark:border-[#444746] dark:bg-[#131314]" />
                            <input value={rule.link} onChange={(event) => {
                                const next = { ...rule, link: event.target.value };
                                setRules(rules.map((item) => item.key === rule.key ? next : item));
                            }} placeholder="لینک" className="rounded-xl border border-[#dadce0] bg-[#f8f9fa] px-3 py-2 text-xs dark:border-[#444746] dark:bg-[#131314]" />
                            <textarea value={rule.body} rows={2} onChange={(event) => {
                                const next = { ...rule, body: event.target.value };
                                setRules(rules.map((item) => item.key === rule.key ? next : item));
                                setPreview(next);
                            }} className="rounded-xl border border-[#dadce0] bg-[#f8f9fa] px-3 py-2 text-xs md:col-span-2 dark:border-[#444746] dark:bg-[#131314]" />
                            <input value={rule.icon} onChange={(event) => {
                                const next = { ...rule, icon: event.target.value };
                                setRules(rules.map((item) => item.key === rule.key ? next : item));
                                setPreview(next);
                            }} placeholder="آیکون" className="rounded-xl border border-[#dadce0] bg-[#f8f9fa] px-3 py-2 text-xs dark:border-[#444746] dark:bg-[#131314]" />
                            <input value={rule.image} onChange={(event) => {
                                const next = { ...rule, image: event.target.value };
                                setRules(rules.map((item) => item.key === rule.key ? next : item));
                                setPreview(next);
                            }} placeholder="تصویر" className="rounded-xl border border-[#dadce0] bg-[#f8f9fa] px-3 py-2 text-xs dark:border-[#444746] dark:bg-[#131314]" />
                        </div>
                        <button type="button" disabled={savingKey === rule.key} onClick={() => void saveRule(rule)} className="mt-3 rounded-xl bg-[#1e1f20] px-4 py-2 text-xs font-bold text-white dark:bg-white dark:text-[#1e1f20]">
                            {savingKey === rule.key ? 'در حال ذخیره...' : 'ذخیره این قانون'}
                        </button>
                    </div>
                ))}
            </div>

            {recent.length > 0 && (
                <div className="rounded-[1.5rem] border border-[#dadce0] bg-white p-4 dark:border-[#333537] dark:bg-[#1e1f20]">
                    <p className="mb-3 text-sm font-bold">ارسال‌های اخیر</p>
                    <ul className="flex flex-col gap-2 text-xs">
                        {recent.map((item) => (
                            <li key={item.id} className="flex items-center justify-between gap-3 border-b border-[#dadce0] py-2 last:border-0 dark:border-[#333537]">
                                <span className="min-w-0 truncate">{item.title}</span>
                                <span className="shrink-0 text-[#86868b]">{item.status} · {formatWhen(item.createdAt)} · تهران</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
