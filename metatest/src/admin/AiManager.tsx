import React, { useEffect, useState } from 'react';
import {
    Bot, Settings, BookOpen, Lightbulb, Library, Coins, Wallet, BarChart3,
    Loader2, AlertCircle, CheckCircle2, Plus, Trash2, Save, RefreshCw, RotateCcw, Brain, MessageSquare
} from 'lucide-react';
import { adminApi } from '../lib/adminApi';

type Tab = 'overview' | 'settings' | 'subjects' | 'knowledge' | 'suggestions' | 'books' | 'pricing' | 'wallets' | 'memory' | 'chats';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'نمای کلی', icon: BarChart3 },
    { id: 'settings', label: 'تنظیمات', icon: Settings },
    { id: 'subjects', label: 'درس‌ها', icon: Bot },
    { id: 'knowledge', label: 'دانش', icon: BookOpen },
    { id: 'suggestions', label: 'پیشنهادها', icon: Lightbulb },
    { id: 'books', label: 'کتاب‌ها', icon: Library },
    { id: 'pricing', label: 'قیمت‌ها', icon: Coins },
    { id: 'wallets', label: 'کیف پول‌ها', icon: Wallet },
    { id: 'memory', label: 'حافظه', icon: Brain },
    { id: 'chats', label: 'گفتگوها', icon: MessageSquare },
];

const inputCls = 'w-full bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#1a73e8]';
const areaCls = `${inputCls} min-h-[120px] resize-y`;
const labelCls = 'text-[10px] font-bold text-[#86868b] uppercase tracking-wider mb-1.5 block';

const FA_LABELS: Record<string, string> = {
    aiEnabled: 'فعال بودن هوش مصنوعی',
    aiAvailable: 'در دسترس بودن',
    chat: 'گفتگو',
    vision: 'دیدن تصویر',
    imageGeneration: 'ساخت تصویر',
    stt: 'گفتار به متن',
    tts: 'متن به گفتار',
    pdfReferences: 'ارجاع PDF',
    memory: 'حافظه',
    knowledgeBase: 'پایگاه دانش',
    tools: 'ابزارها',
    suggestions: 'پیشنهادها',
    embeddings: 'جاسازی',
    free: 'رایگان',
    bronze: 'برنزی',
    silver: 'نقره‌ای',
    golden: 'طلایی',
    diamond: 'الماسی',
    epic: 'حماسی',
    premium: 'ویژه',
    minCharge: 'حداقل کسر',
    minBalanceToStart: 'حداقل موجودی برای شروع',
    defaultReservation: 'رزرو پیش‌فرض',
    usdToIrr: 'نرخ دلار به ریال',
    irrPerCoin: 'ریال هر سکه',
    image: 'تصویر',
    pdfIndex: 'فهرست PDF',
    low_coin_mode: 'حالت سکه کم',
    always_examples: 'همیشه با مثال',
    concise_responses: 'پاسخ کوتاه',
    step_by_step: 'گام‌به‌گام',
    voice_replies: 'پاسخ صوتی',
    memory_enabled: 'حافظه فعال',
    knowledge_enabled: 'دانش فعال',
    pdf_references_enabled: 'ارجاع PDF فعال',
};

function faLabel(key: string) {
    return FA_LABELS[key] || key;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
    return (
        <button type="button" onClick={() => onChange(!checked)} className="flex items-center justify-between gap-3 w-full bg-[#f8f9fa] dark:bg-[#131314] rounded-xl px-4 py-3">
            <span className="text-xs font-semibold">{label}</span>
            <span className={`w-10 h-6 rounded-full relative transition-colors ${checked ? 'bg-[#1a73e8]' : 'bg-gray-300 dark:bg-[#444746]'}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${checked ? 'right-0.5' : 'left-0.5'}`} />
            </span>
        </button>
    );
}

export default function AiManager() {
    const [tab, setTab] = useState<Tab>('overview');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (!success) return;
        const t = setTimeout(() => setSuccess(null), 3500);
        return () => clearTimeout(t);
    }, [success]);

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-3 shadow-sm sticky top-0 z-[40]">
                <div>
                    <h1 className="text-sm font-bold">مدیریت هوش مصنوعی</h1>
                    <p className="text-[11px] text-[#86868b]">تنظیم مت: درس‌ها، دانش، سکه و مدل‌ها. کلید API روی سرور می‌ماند.</p>
                </div>
                <div className="flex flex-wrap gap-1 bg-[#f8f9fa] dark:bg-[#131314] rounded-full p-1">
                    {TABS.map((t) => (
                        <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold ${tab === t.id ? 'bg-[#1a73e8] text-white' : 'text-[#86868b] hover:text-gray-700'}`}>
                            <t.icon size={13} /> <span className="hidden lg:inline">{t.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {error && <Banner tone="err" onClose={() => setError(null)}>{error}</Banner>}
            {success && <Banner tone="ok">{success}</Banner>}

            {tab === 'overview' && <Overview onError={setError} />}
            {tab === 'settings' && <SettingsPanel onError={setError} onSuccess={setSuccess} />}
            {tab === 'subjects' && <SubjectsPanel onError={setError} onSuccess={setSuccess} />}
            {tab === 'knowledge' && <KnowledgePanel onError={setError} onSuccess={setSuccess} />}
            {tab === 'suggestions' && <SuggestionsPanel onError={setError} onSuccess={setSuccess} />}
            {tab === 'books' && <BooksPanel onError={setError} onSuccess={setSuccess} />}
            {tab === 'pricing' && <PricingPanel onError={setError} onSuccess={setSuccess} />}
            {tab === 'wallets' && <WalletsPanel onError={setError} onSuccess={setSuccess} />}
            {tab === 'memory' && <MemoryPanel onError={setError} onSuccess={setSuccess} />}
            {tab === 'chats' && <ChatsPanel onError={setError} onSuccess={setSuccess} />}
        </div>
    );
}

function Banner({ tone, children, onClose }: { tone: 'err' | 'ok'; children: React.ReactNode; onClose?: () => void }) {
    const cls = tone === 'err'
        ? 'bg-red-50 dark:bg-red-500/10 text-red-600 border-red-200'
        : 'bg-green-50 dark:bg-green-500/10 text-green-600 border-green-200';
    return (
        <div className={`flex items-center gap-2 p-3 border rounded-xl text-xs font-semibold ${cls}`}>
            {tone === 'err' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
            <span className="flex-1">{children}</span>
            {onClose && <button onClick={onClose}>×</button>}
        </div>
    );
}

function Overview({ onError }: { onError: (s: string) => void }) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const load = async () => {
        setLoading(true);
        try {
            const [stats, usage, settings] = await Promise.all([adminApi.aiStats(), adminApi.aiUsage(), adminApi.aiSettings()]);
            setData({ stats, usage, settings });
        } catch (e: any) { onError(e.message); }
        finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []);
    if (loading) return <Center />;
    const o = data?.stats?.overview || {};
    const features = data?.settings?.features || {};
    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    ['گفتگوها', o.conversations], ['پیام‌ها', o.messages], ['کاربران هوش مصنوعی', o.users],
                    ['سکه مصرف‌شده', o.coins_spent], ['موارد دانش', o.knowledge_items],
                    ['پیشنهادها', o.suggestions], ['کتاب‌ها', o.books], ['هزینه (تومان)', o.cost_irr],
                ].map(([l, v]) => (
                    <div key={String(l)} className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-4">
                        <p className={labelCls}>{l}</p>
                        <p className="text-2xl font-semibold">{Number(v || 0).toLocaleString()}</p>
                    </div>
                ))}
            </div>
            <Card title="قابلیت‌های فعال">
                <div className="flex flex-wrap gap-2">
                    {Object.entries(features).filter(([, v]) => typeof v === 'boolean').map(([k, v]) => (
                        <span key={k} className={`px-3 py-1 rounded-full text-[11px] font-bold ${v ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{faLabel(k)}{v ? '' : ' خاموش'}</span>
                    ))}
                </div>
                {data?.settings?.unavailableReason && <p className="text-xs text-amber-600 mt-3">در دسترس نیست: {data.settings.unavailableReason}</p>}
                <p className="text-[11px] text-[#86868b] mt-3">سرویس‌دهنده: {data?.settings?.settings?.provider?.name} · کلید {data?.settings?.settings?.provider?.apiKeyConfigured ? 'تنظیم شده' : 'نیست'}</p>
            </Card>
            <Card title="مصرف اخیر">
                <table className="w-full text-xs">
                    <thead className="text-[#86868b]"><tr><th className="text-start py-2">زمان</th><th className="text-start">عملیات</th><th className="text-start">مدل</th><th className="text-end">سکه</th></tr></thead>
                    <tbody>
                        {(data?.usage?.items || []).slice(0, 15).map((r: any) => (
                            <tr key={r.id} className="border-t border-[#dadce0] dark:border-[#333537]">
                                <td className="py-2">{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</td>
                                <td>{r.operation_type}</td>
                                <td className="font-mono">{r.model}</td>
                                <td className="text-end">{r.coin_cost}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
            <div className="grid lg:grid-cols-2 gap-6">
                <Card title="بر اساس درس">
                    {(data?.stats?.bySubject || []).map((r: any) => (
                        <div key={r.subject_key} className="flex justify-between text-xs py-1.5 border-b border-[#dadce0] dark:border-[#333537] last:border-0">
                            <span className="font-semibold">{r.subject_key || '—'}</span>
                            <span className="text-[#86868b]">{Number(r.conversations || 0).toLocaleString()} گفتگو · {Number(r.messages || 0).toLocaleString()} پیام</span>
                        </div>
                    ))}
                    {(data?.stats?.bySubject || []).length === 0 && <p className="text-xs text-[#86868b]">هنوز گفتگویی نیست</p>}
                </Card>
                <Card title="بر اساس عملیات">
                    {(data?.stats?.byOp || []).map((r: any) => (
                        <div key={r.operation_type} className="flex justify-between text-xs py-1.5 border-b border-[#dadce0] dark:border-[#333537] last:border-0">
                            <span className="font-semibold">{r.operation_type}</span>
                            <span className="text-[#86868b]">{Number(r.count || 0).toLocaleString()} · {Number(r.coins || 0).toLocaleString()} سکه</span>
                        </div>
                    ))}
                    {(data?.stats?.byOp || []).length === 0 && <p className="text-xs text-[#86868b]">هنوز گزارشی از مصرف نیست</p>}
                </Card>
            </div>
        </div>
    );
}

function SettingsPanel({ onError, onSuccess }: { onError: (s: string) => void; onSuccess: (s: string) => void }) {
    const [settings, setSettings] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        adminApi.aiSettings().then((r) => setSettings(r.settings)).catch((e) => onError(e.message));
    }, []);
    if (!settings) return <Center />;
    const patch = (bucket: string, key: string, value: any) => {
        setSettings((s: any) => ({ ...s, [bucket]: { ...s[bucket], [key]: value } }));
    };
    const save = async () => {
        setSaving(true);
        try {
            const res = await adminApi.saveAiSettings({
                flags: settings.flags,
                models: settings.models,
                dailyCoins: settings.dailyCoins,
                coinPricing: settings.coinPricing,
                flatCosts: settings.flatCosts,
                contextLimits: settings.contextLimits,
                fileLimits: { ...settings.fileLimits, uploadRoot: undefined },
                rateLimits: settings.rateLimits,
            });
            if (!res.success) throw new Error(res.message);
            setSettings(res.settings);
            onSuccess('تنظیمات هوش مصنوعی ذخیره شد و همین حالا اعمال می‌شود.');
        } catch (e: any) { onError(e.message); }
        finally { setSaving(false); }
    };
    return (
        <div className="flex flex-col gap-6">
            <div className="flex justify-end">
                <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-[#1a73e8] text-white px-5 py-2.5 rounded-xl text-xs font-bold">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} ذخیره تنظیمات
                </button>
            </div>
            <Card title="کلیدهای قابلیت">
                <div className="grid sm:grid-cols-2 gap-2">
                    {Object.entries(settings.flags || {}).map(([k, v]) => (
                        <Toggle key={k} label={faLabel(k)} checked={!!v} onChange={(nv) => patch('flags', k, nv)} />
                    ))}
                </div>
            </Card>
            <Card title="مدل‌ها (بدون کلید API)">
                <div className="grid sm:grid-cols-2 gap-3">
                    {Object.entries(settings.models || {}).map(([k, v]) => (
                        <div key={k}><label className={labelCls}>{faLabel(k)}</label><input className={inputCls} value={String(v ?? '')} onChange={(e) => patch('models', k, e.target.value)} /></div>
                    ))}
                </div>
            </Card>
            <Card title="سکه روزانه هر پلن">
                <div className="grid sm:grid-cols-3 gap-3">
                    {Object.entries(settings.dailyCoins || {}).map(([k, v]) => (
                        <div key={k}><label className={labelCls}>{faLabel(k)}</label><input type="number" className={inputCls} value={Number(v)} onChange={(e) => patch('dailyCoins', k, Number(e.target.value))} /></div>
                    ))}
                </div>
            </Card>
            <div className="grid lg:grid-cols-2 gap-6">
                <Card title="قیمت سکه">
                    {Object.entries(settings.coinPricing || {}).filter(([k]) => k !== 'uploadRoot').map(([k, v]) => (
                        <div key={k} className="mb-3"><label className={labelCls}>{faLabel(k)}</label><input type="number" className={inputCls} value={Number(v)} onChange={(e) => patch('coinPricing', k, Number(e.target.value))} /></div>
                    ))}
                </Card>
                <Card title="هزینه ثابت سکه">
                    {Object.entries(settings.flatCosts || {}).map(([k, v]) => (
                        <div key={k} className="mb-3"><label className={labelCls}>{faLabel(k)}</label><input type="number" className={inputCls} value={Number(v)} onChange={(e) => patch('flatCosts', k, Number(e.target.value))} /></div>
                    ))}
                </Card>
            </div>
            <Card title="محدودیت زمینه، نرخ و فایل">
                <div className="grid sm:grid-cols-3 gap-3">
                    {Object.entries({ ...settings.contextLimits, ...settings.rateLimits, ...Object.fromEntries(Object.entries(settings.fileLimits || {}).filter(([k]) => k !== 'uploadRoot')) }).map(([k, v]) => (
                        <div key={k}><label className={labelCls}>{faLabel(k)}</label><input type="number" className={inputCls} value={Number(v)} onChange={(e) => {
                            if (k in (settings.contextLimits || {})) patch('contextLimits', k, Number(e.target.value));
                            else if (k in (settings.rateLimits || {})) patch('rateLimits', k, Number(e.target.value));
                            else patch('fileLimits', k, Number(e.target.value));
                        }} /></div>
                    ))}
                </div>
            </Card>
        </div>
    );
}

function SubjectsPanel({ onError, onSuccess }: { onError: (s: string) => void; onSuccess: (s: string) => void }) {
    const [items, setItems] = useState<any[]>([]);
    const [sel, setSel] = useState<any>(null);
    const [newKey, setNewKey] = useState('');
    const load = async () => {
        try {
            const res = await adminApi.aiSubjects();
            setItems(res.subjects || []);
            setSel((s: any) => {
                if (s) return (res.subjects || []).find((x: any) => x.key === s.key) || res.subjects?.[0] || null;
                return res.subjects?.[0] || null;
            });
        } catch (e: any) { onError(e.message); }
    };
    useEffect(() => { load(); }, []);
    const save = async () => {
        if (!sel) return;
        try {
            const res = await adminApi.saveAiSubject(sel.key, sel);
            if (!res.success) throw new Error(res.message);
            onSuccess('درس ذخیره شد');
            load();
        } catch (e: any) { onError(e.message); }
    };
    const add = async () => {
        const key = newKey.trim().toLowerCase();
        if (!key) return;
        try {
            await adminApi.saveAiSubject(key, { key, name_fa: key, name_en: key, is_active: 1, sort_order: 50 });
            setNewKey('');
            onSuccess('درس ساخته شد');
            load();
        } catch (e: any) { onError(e.message); }
    };
    const reset = async () => {
        if (!sel) return;
        try {
            const res = await adminApi.resetAiSubjectPrompts(sel.key);
            setSel({ ...sel, general_prompt: res.general_prompt, reference_instructions: res.reference_instructions });
            onSuccess('پرامپت‌ها به حالت پیش‌فرض برگشت');
        } catch (e: any) { onError(e.message); }
    };
    return (
        <div className="grid lg:grid-cols-3 gap-6">
            <Card title="درس‌ها">
                <div className="flex gap-2 mb-3">
                    <input className={inputCls} value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="کلید جدید، مثلاً geology" />
                    <button onClick={add} className="px-3 rounded-xl bg-[#1a73e8] text-white"><Plus size={14} /></button>
                </div>
                <div className="space-y-1 max-h-[60vh] overflow-y-auto">
                    {items.map((s) => (
                        <button key={s.key} onClick={() => setSel(s)} className={`w-full text-start px-3 py-2 rounded-xl text-xs ${sel?.key === s.key ? 'bg-[#e8f0fe] text-[#1a73e8] font-bold' : 'hover:bg-[#f8f9fa] dark:hover:bg-[#131314]'}`}>
                            {s.name_fa} <span className="text-[#86868b]">({s.key})</span>
                        </button>
                    ))}
                </div>
            </Card>
            {sel && (
                <div className="lg:col-span-2 flex flex-col gap-4">
                    <Card title={`ویرایش ${sel.key}`}>
                        <div className="grid sm:grid-cols-2 gap-3">
                            <Field label="نام فارسی" value={sel.name_fa} onChange={(v) => setSel({ ...sel, name_fa: v })} />
                            <Field label="نام انگلیسی" value={sel.name_en} onChange={(v) => setSel({ ...sel, name_en: v })} />
                            <Field label="آیکون" value={sel.icon} onChange={(v) => setSel({ ...sel, icon: v })} />
                            <Field label="رنگ" value={sel.color} onChange={(v) => setSel({ ...sel, color: v })} />
                            <Field label="مدل اختصاصی" value={sel.model || ''} onChange={(v) => setSel({ ...sel, model: v })} />
                            <Field label="حداکثر توکن خروجی" type="number" value={sel.max_output_tokens} onChange={(v) => setSel({ ...sel, max_output_tokens: Number(v) })} />
                            <Field label="ترتیب" type="number" value={sel.sort_order} onChange={(v) => setSel({ ...sel, sort_order: Number(v) })} />
                            <Toggle label="فعال" checked={!!sel.is_active} onChange={(v) => setSel({ ...sel, is_active: v ? 1 : 0 })} />
                        </div>
                        <div className="mt-4"><label className={labelCls}>پرامپت عمومی</label><textarea className={areaCls} value={sel.general_prompt || ''} onChange={(e) => setSel({ ...sel, general_prompt: e.target.value })} /></div>
                        <div className="mt-4"><label className={labelCls}>دستور مرجع</label><textarea className={areaCls} value={sel.reference_instructions || ''} onChange={(e) => setSel({ ...sel, reference_instructions: e.target.value })} /></div>
                        <div className="flex gap-2 mt-4">
                            <button onClick={save} className="flex items-center gap-2 bg-[#1a73e8] text-white px-4 py-2 rounded-xl text-xs font-bold"><Save size={14} /> ذخیره</button>
                            <button onClick={reset} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border border-[#dadce0]"><RotateCcw size={14} /> بازنشانی پرامپت‌ها</button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}

function KnowledgePanel({ onError, onSuccess }: { onError: (s: string) => void; onSuccess: (s: string) => void }) {
    const [items, setItems] = useState<any[]>([]);
    const [q, setQ] = useState('');
    const [form, setForm] = useState<any>({ subject_key: 'math', title: '', content: '', is_active: 1 });
    const load = async () => {
        try {
            const res = await adminApi.aiKnowledge({ q });
            setItems(res.items || []);
        } catch (e: any) { onError(e.message); }
    };
    useEffect(() => { load(); }, []);
    const edit = async (id: number) => {
        const res = await adminApi.aiKnowledgeItem(id);
        setForm(res.item);
    };
    const save = async () => {
        try {
            const res = await adminApi.saveAiKnowledge(form, form.id);
            if (!res.success) throw new Error(res.message);
            onSuccess('دانش ذخیره شد');
            setForm({ subject_key: form.subject_key, title: '', content: '', is_active: 1 });
            load();
        } catch (e: any) { onError(e.message); }
    };
    return (
        <div className="grid lg:grid-cols-2 gap-6">
            <Card title="موارد">
                <div className="flex gap-2 mb-3">
                    <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو..." />
                    <button onClick={load} className="px-3 rounded-xl bg-[#1a73e8] text-white"><RefreshCw size={14} /></button>
                </div>
                <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                    {items.map((it) => (
                        <div key={it.id} className="flex items-start gap-2 p-3 rounded-xl bg-[#f8f9fa] dark:bg-[#131314]">
                            <button className="flex-1 text-start" onClick={() => edit(it.id)}>
                                <p className="text-xs font-bold">{it.title}</p>
                                <p className="text-[10px] text-[#86868b]">{it.subject_key} · {it.chapter || '—'} · {it.grade || '—'}</p>
                            </button>
                            <button onClick={async () => { await adminApi.deleteAiKnowledge(it.id); load(); }} className="text-red-500"><Trash2 size={14} /></button>
                        </div>
                    ))}
                </div>
            </Card>
            <Card title={form.id ? `ویرایش #${form.id}` : 'دانش جدید'}>
                <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="کلید درس" value={form.subject_key} onChange={(v) => setForm({ ...form, subject_key: v })} />
                    <Field label="پایه" value={form.grade || ''} onChange={(v) => setForm({ ...form, grade: v })} />
                    <Field label="فصل" value={form.chapter || ''} onChange={(v) => setForm({ ...form, chapter: v })} />
                    <Field label="مبحث" value={form.topic || ''} onChange={(v) => setForm({ ...form, topic: v })} />
                    <div className="sm:col-span-2"><Field label="عنوان" value={form.title} onChange={(v) => setForm({ ...form, title: v })} /></div>
                    <Field label="کلیدواژه‌ها" value={form.keywords || ''} onChange={(v) => setForm({ ...form, keywords: v })} />
                    <Field label="منبع" value={form.source || ''} onChange={(v) => setForm({ ...form, source: v })} />
                </div>
                <div className="mt-3"><label className={labelCls}>محتوا</label><textarea className={areaCls} value={form.content || ''} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
                <div className="mt-3"><label className={labelCls}>نکات کلیدی</label><textarea className={areaCls} value={form.key_points || ''} onChange={(e) => setForm({ ...form, key_points: e.target.value })} /></div>
                <div className="mt-3"><label className={labelCls}>نمونه‌ها</label><textarea className={areaCls} value={form.examples || ''} onChange={(e) => setForm({ ...form, examples: e.target.value })} /></div>
                <div className="flex items-center gap-3 mt-4">
                    <Toggle label="فعال" checked={!!form.is_active} onChange={(v) => setForm({ ...form, is_active: v ? 1 : 0 })} />
                    <button onClick={save} className="flex items-center gap-2 bg-[#1a73e8] text-white px-4 py-2 rounded-xl text-xs font-bold"><Save size={14} /> ذخیره</button>
                    {form.id && <button onClick={() => setForm({ subject_key: 'math', title: '', content: '', is_active: 1 })} className="text-xs">جدید</button>}
                </div>
            </Card>
        </div>
    );
}

function SuggestionsPanel({ onError, onSuccess }: { onError: (s: string) => void; onSuccess: (s: string) => void }) {
    const [items, setItems] = useState<any[]>([]);
    const [form, setForm] = useState<any>({ subject_key: 'math', title: '', prompt: '', is_active: 1, source: 'seed' });
    const load = async () => {
        try { const res = await adminApi.aiSuggestions(); setItems(res.items || []); }
        catch (e: any) { onError(e.message); }
    };
    useEffect(() => { load(); }, []);
    const save = async () => {
        try {
            const res = await adminApi.saveAiSuggestion(form, form.id);
            if (!res.success) throw new Error(res.message);
            onSuccess('پیشنهاد ذخیره شد');
            setForm({ subject_key: form.subject_key, title: '', prompt: '', is_active: 1, source: 'seed' });
            load();
        } catch (e: any) { onError(e.message); }
    };
    return (
        <div className="grid lg:grid-cols-2 gap-6">
            <Card title="فهرست">
                <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                    {items.map((it) => (
                        <div key={it.id} className="flex gap-2 p-3 rounded-xl bg-[#f8f9fa] dark:bg-[#131314]">
                            <button className="flex-1 text-start" onClick={() => setForm(it)}>
                                <p className="text-xs font-bold">{it.title}</p>
                                <p className="text-[10px] text-[#86868b]">{it.subject_key} · استفاده {it.use_count}</p>
                            </button>
                            <button onClick={async () => { await adminApi.deleteAiSuggestion(it.id); load(); }} className="text-red-500"><Trash2 size={14} /></button>
                        </div>
                    ))}
                </div>
            </Card>
            <Card title={form.id ? `ویرایش #${form.id}` : 'پیشنهاد جدید'}>
                <Field label="کلید درس" value={form.subject_key} onChange={(v) => setForm({ ...form, subject_key: v })} />
                <div className="mt-3"><Field label="عنوان" value={form.title} onChange={(v) => setForm({ ...form, title: v })} /></div>
                <div className="mt-3"><label className={labelCls}>پرامپت</label><textarea className={areaCls} value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} /></div>
                <div className="grid sm:grid-cols-2 gap-3 mt-3">
                    <Field label="راهنما" value={form.hint || ''} onChange={(v) => setForm({ ...form, hint: v })} />
                    <Field label="آیکون" value={form.icon || ''} onChange={(v) => setForm({ ...form, icon: v })} />
                </div>
                <div className="flex gap-3 mt-4">
                    <Toggle label="فعال" checked={!!form.is_active} onChange={(v) => setForm({ ...form, is_active: v ? 1 : 0 })} />
                    <button onClick={save} className="flex items-center gap-2 bg-[#1a73e8] text-white px-4 py-2 rounded-xl text-xs font-bold"><Save size={14} /> ذخیره</button>
                </div>
            </Card>
        </div>
    );
}

function BooksPanel({ onError, onSuccess }: { onError: (s: string) => void; onSuccess: (s: string) => void }) {
    const [items, setItems] = useState<any[]>([]);
    const [form, setForm] = useState<any>({ title: '', is_active: 1, sort_order: 100 });
    const [ingestText, setIngestText] = useState('');
    const [ingesting, setIngesting] = useState(false);
    const load = async () => {
        try { const res = await adminApi.aiBooks(); setItems(res.items || []); }
        catch (e: any) { onError(e.message); }
    };
    useEffect(() => { load(); }, []);
    const save = async () => {
        try {
            const res = await adminApi.saveAiBook(form, form.id);
            if (!res.success) throw new Error(res.message);
            onSuccess('کتاب ذخیره شد');
            load();
        } catch (e: any) { onError(e.message); }
    };
    const ingest = async () => {
        if (!form.id) { onError('اول کتاب را ذخیره کن'); return; }
        setIngesting(true);
        try {
            const res = await adminApi.ingestAiBook(form.id, { contentText: ingestText });
            if (!res.success) throw new Error(res.message);
            onSuccess(`${res.totalChunks} بخش پردازش شد (${res.embedded} جاسازی شد، ${res.skipped} رد شد)`);
            setIngestText('');
            load();
        } catch (e: any) { onError(e.message); }
        finally { setIngesting(false); }
    };
    const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = async () => {
            if (!form.id) { onError('اول کتاب را ذخیره کن'); return; }
            setIngesting(true);
            try {
                const res = await adminApi.ingestAiBook(form.id, { fileData: reader.result });
                if (!res.success) throw new Error(res.message);
                onSuccess(`${res.totalChunks} بخش پردازش شد`);
                load();
            } catch (err: any) { onError(err.message); }
            finally { setIngesting(false); }
        };
        reader.readAsDataURL(f);
    };
    return (
        <div className="grid lg:grid-cols-2 gap-6">
            <Card title="فهرست کتاب‌ها">
                {items.map((b) => (
                    <button key={b.id} onClick={() => setForm(b)} className={`w-full text-start p-3 rounded-xl mb-2 ${form.id === b.id ? 'bg-[#e8f0fe]' : 'bg-[#f8f9fa] dark:bg-[#131314]'}`}>
                        <p className="text-xs font-bold">{b.title}</p>
                        <p className="text-[10px] text-[#86868b]">{b.subject_key} · {b.chunk_count || 0} بخش · {(b.content_chars || 0).toLocaleString()} نویسه</p>
                    </button>
                ))}
                <button onClick={() => setForm({ title: '', is_active: 1, sort_order: 100 })} className="text-xs font-bold text-[#1a73e8]">+ کتاب جدید</button>
            </Card>
            <Card title={form.id ? `ویرایش #${form.id}` : 'کتاب جدید'}>
                <Field label="عنوان" value={form.title || ''} onChange={(v) => setForm({ ...form, title: v })} />
                <div className="grid sm:grid-cols-2 gap-3 mt-3">
                    <Field label="کلید درس" value={form.subject_key || ''} onChange={(v) => setForm({ ...form, subject_key: v })} />
                    <Field label="درس" value={form.subject || ''} onChange={(v) => setForm({ ...form, subject: v })} />
                    <Field label="پایه" value={form.grade || ''} onChange={(v) => setForm({ ...form, grade: v })} />
                    <Field label="ناشر" value={form.publisher || ''} onChange={(v) => setForm({ ...form, publisher: v })} />
                    <Field label="آدرس PDF" value={form.pdf_url || ''} onChange={(v) => setForm({ ...form, pdf_url: v })} />
                    <Field label="ترتیب" type="number" value={form.sort_order || 100} onChange={(v) => setForm({ ...form, sort_order: Number(v) })} />
                </div>
                <div className="mt-3"><label className={labelCls}>خلاصه</label><textarea className={areaCls} value={form.content_summary || ''} onChange={(e) => setForm({ ...form, content_summary: e.target.value })} /></div>
                <Toggle label="فعال" checked={!!form.is_active} onChange={(v) => setForm({ ...form, is_active: v ? 1 : 0 })} />
                <div className="flex gap-2 mt-3">
                    <button onClick={save} className="flex items-center gap-2 bg-[#1a73e8] text-white px-4 py-2 rounded-xl text-xs font-bold"><Save size={14} /> ذخیره</button>
                    {form.id && <button onClick={async () => { await adminApi.deleteAiBook(form.id); setForm({ title: '', is_active: 1 }); load(); }} className="text-red-500 text-xs font-bold">حذف</button>}
                </div>
                {form.id && (
                    <div className="mt-6 pt-4 border-t border-[#dadce0] dark:border-[#333537]">
                        <p className={labelCls}>ورود متن کتاب (تکه‌تکه و جاسازی)</p>
                        <input type="file" accept="application/pdf,.txt" onChange={onFile} className="text-xs mb-3" />
                        <textarea className={areaCls} placeholder="یا متن استخراج‌شده را بچسبان..." value={ingestText} onChange={(e) => setIngestText(e.target.value)} />
                        <button onClick={ingest} disabled={ingesting} className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border">
                            {ingesting ? <Loader2 size={14} className="animate-spin" /> : <Library size={14} />} پردازش متن
                        </button>
                    </div>
                )}
            </Card>
        </div>
    );
}

function PricingPanel({ onError, onSuccess }: { onError: (s: string) => void; onSuccess: (s: string) => void }) {
    const [items, setItems] = useState<any[]>([]);
    const [form, setForm] = useState<any>({ provider: 'gapgpt', model: '', operation_type: 'chat', is_active: 1 });
    const load = async () => {
        try { const res = await adminApi.aiPricing(); setItems(res.items || []); }
        catch (e: any) { onError(e.message); }
    };
    useEffect(() => { load(); }, []);
    const save = async () => {
        try {
            const res = await adminApi.saveAiPricing(form, form.id);
            if (!res.success) throw new Error(res.message);
            onSuccess('قیمت ذخیره شد');
            load();
        } catch (e: any) { onError(e.message); }
    };
    return (
        <div className="grid lg:grid-cols-2 gap-6">
            <Card title="قیمت مدل‌ها">
                {items.map((p) => (
                    <button key={p.id} onClick={() => setForm(p)} className="w-full text-start p-3 rounded-xl bg-[#f8f9fa] dark:bg-[#131314] mb-2 text-xs">
                        <span className="font-bold">{p.model}</span> · {p.operation_type} · in {p.input_usd_per_1m} / out {p.output_usd_per_1m}
                    </button>
                ))}
                <button onClick={() => setForm({ provider: 'gapgpt', model: '', operation_type: 'chat', is_active: 1 })} className="text-xs font-bold text-[#1a73e8]">+ ردیف جدید</button>
            </Card>
            <Card title={form.id ? `ویرایش #${form.id}` : 'قیمت جدید'}>
                <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="سرویس‌دهنده" value={form.provider} onChange={(v) => setForm({ ...form, provider: v })} />
                    <Field label="مدل" value={form.model} onChange={(v) => setForm({ ...form, model: v })} />
                    <Field label="نوع عملیات" value={form.operation_type} onChange={(v) => setForm({ ...form, operation_type: v })} />
                    <Field label="دلار ورودی / یک میلیون" type="number" value={form.input_usd_per_1m || 0} onChange={(v) => setForm({ ...form, input_usd_per_1m: Number(v) })} />
                    <Field label="دلار کش / یک میلیون" type="number" value={form.cached_usd_per_1m || 0} onChange={(v) => setForm({ ...form, cached_usd_per_1m: Number(v) })} />
                    <Field label="دلار خروجی / یک میلیون" type="number" value={form.output_usd_per_1m || 0} onChange={(v) => setForm({ ...form, output_usd_per_1m: Number(v) })} />
                    <Field label="دلار هر واحد" type="number" value={form.unit_usd || 0} onChange={(v) => setForm({ ...form, unit_usd: Number(v) })} />
                    <Field label="سکه ثابت" type="number" value={form.flat_coin_cost ?? ''} onChange={(v) => setForm({ ...form, flat_coin_cost: v === '' ? null : Number(v) })} />
                </div>
                <div className="flex gap-2 mt-4">
                    <button onClick={save} className="flex items-center gap-2 bg-[#1a73e8] text-white px-4 py-2 rounded-xl text-xs font-bold"><Save size={14} /> ذخیره</button>
                    {form.id && <button onClick={async () => { await adminApi.deleteAiPricing(form.id); setForm({ provider: 'gapgpt', model: '', operation_type: 'chat' }); load(); }} className="text-red-500 text-xs font-bold">حذف</button>}
                </div>
            </Card>
        </div>
    );
}

function WalletsPanel({ onError, onSuccess }: { onError: (s: string) => void; onSuccess: (s: string) => void }) {
    const [q, setQ] = useState('');
    const [items, setItems] = useState<any[]>([]);
    const [delta, setDelta] = useState('50');
    const [reason, setReason] = useState('');
    const [settingsUser, setSettingsUser] = useState<number | null>(null);
    const [settings, setSettings] = useState<any>(null);
    const search = async () => {
        try { const res = await adminApi.aiWallets(q); setItems(res.items || []); }
        catch (e: any) { onError(e.message); }
    };
    useEffect(() => { search(); }, []);
    const adjust = async (userId: number, sign: 1 | -1) => {
        try {
            const res = await adminApi.adjustAiWallet(userId, { delta: sign * Math.abs(Number(delta) || 0), reason });
            if (!res.success) throw new Error(res.message);
            onSuccess('کیف پول به‌روز شد');
            search();
        } catch (e: any) { onError(e.message); }
    };
    const openSettings = async (userId: number) => {
        try {
            const res = await adminApi.aiUserSettings(userId);
            setSettingsUser(userId);
            setSettings(res.settings || {
                tone: 'friendly', reasoning_level: 'balanced', verbosity: 'normal', creativity: 50,
                low_coin_mode: 0, always_examples: 1, concise_responses: 0, step_by_step: 1,
                voice_replies: 1, memory_enabled: 1, knowledge_enabled: 1, pdf_references_enabled: 1,
            });
        } catch (e: any) { onError(e.message); }
    };
    const saveSettings = async () => {
        if (!settingsUser) return;
        try {
            const res = await adminApi.saveAiUserSettings(settingsUser, settings);
            if (!res.success) throw new Error(res.message);
            onSuccess('تنظیمات هوش مصنوعی دانش‌آموز ذخیره شد');
            setSettings(res.settings);
        } catch (e: any) { onError(e.message); }
    };
    return (
        <div className="flex flex-col gap-6">
            <Card title="کیف سکه دانش‌آموزان">
                <div className="flex flex-wrap gap-2 mb-4">
                    <input className={`${inputCls} flex-1 min-w-[180px]`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی نام کاربری، موبایل یا شناسه..." />
                    <button onClick={search} className="px-4 rounded-xl bg-[#1a73e8] text-white text-xs font-bold">جستجو</button>
                    <input className={`${inputCls} w-28`} type="number" value={delta} onChange={(e) => setDelta(e.target.value)} />
                    <input className={`${inputCls} w-48`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="دلیل" />
                </div>
                <div className="space-y-2">
                    {items.map((u) => (
                        <div key={u.id} className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-[#f8f9fa] dark:bg-[#131314] text-xs">
                            <div className="flex-1 min-w-[140px]">
                                <p className="font-bold">{u.username} <span className="text-[#86868b]">#{u.id}</span></p>
                                <p className="text-[#86868b]">{u.current_plan} · روزانه {u.daily_balance ?? 0} · خریداری‌شده {u.purchased_balance ?? 0}</p>
                            </div>
                            <button onClick={() => openSettings(u.id)} className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#444746] font-bold">تنظیمات</button>
                            <button onClick={() => adjust(u.id, 1)} className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 font-bold">+ سکه</button>
                            <button onClick={() => adjust(u.id, -1)} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 font-bold">− سکه</button>
                        </div>
                    ))}
                </div>
            </Card>
            {settings && settingsUser && (
                <Card title={`تنظیمات هوش مصنوعی کاربر #${settingsUser}`}>
                    <div className="grid sm:grid-cols-3 gap-3">
                        <Field label="لحن" value={settings.tone} onChange={(v) => setSettings({ ...settings, tone: v })} />
                        <Field label="سطح استدلال" value={settings.reasoning_level} onChange={(v) => setSettings({ ...settings, reasoning_level: v })} />
                        <Field label="میزان توضیح" value={settings.verbosity} onChange={(v) => setSettings({ ...settings, verbosity: v })} />
                        <Field label="خلاقیت" type="number" value={settings.creativity} onChange={(v) => setSettings({ ...settings, creativity: Number(v) })} />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2 mt-3">
                        {(['low_coin_mode', 'always_examples', 'concise_responses', 'step_by_step', 'voice_replies', 'memory_enabled', 'knowledge_enabled', 'pdf_references_enabled'] as const).map((k) => (
                            <Toggle key={k} label={faLabel(k)} checked={!!settings[k]} onChange={(v) => setSettings({ ...settings, [k]: v ? 1 : 0 })} />
                        ))}
                    </div>
                    <button onClick={saveSettings} className="mt-4 flex items-center gap-2 bg-[#1a73e8] text-white px-4 py-2 rounded-xl text-xs font-bold"><Save size={14} /> ذخیره تنظیمات دانش‌آموز</button>
                </Card>
            )}
        </div>
    );
}

function MemoryPanel({ onError, onSuccess }: { onError: (s: string) => void; onSuccess: (s: string) => void }) {
    const [items, setItems] = useState<any[]>([]);
    const [q, setQ] = useState('');
    const [form, setForm] = useState<any>({ user_id: '', memory_type: 'important_fact', content: '', importance: 5, confidence: 70, is_active: 1 });
    const load = async () => {
        try { const res = await adminApi.aiMemory({ q }); setItems(res.items || []); }
        catch (e: any) { onError(e.message); }
    };
    useEffect(() => { load(); }, []);
    const save = async () => {
        try {
            const res = await adminApi.saveAiMemory({ ...form, user_id: Number(form.user_id) }, form.id);
            if (!res.success) throw new Error(res.message);
            onSuccess('حافظه ذخیره شد');
            setForm({ user_id: form.user_id, memory_type: 'important_fact', content: '', importance: 5, confidence: 70, is_active: 1 });
            load();
        } catch (e: any) { onError(e.message); }
    };
    return (
        <div className="grid lg:grid-cols-2 gap-6">
            <Card title="حافظه دانش‌آموز">
                <div className="flex gap-2 mb-3">
                    <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی کاربر، درس یا متن..." />
                    <button onClick={load} className="px-3 rounded-xl bg-[#1a73e8] text-white"><RefreshCw size={14} /></button>
                </div>
                <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                    {items.map((it) => (
                        <div key={it.id} className="flex gap-2 p-3 rounded-xl bg-[#f8f9fa] dark:bg-[#131314]">
                            <button className="flex-1 text-start" onClick={() => setForm(it)}>
                                <p className="text-xs font-bold">{it.username || `user #${it.user_id}`} · {it.memory_type}</p>
                                <p className="text-[10px] text-[#86868b] line-clamp-2">{it.content}</p>
                            </button>
                            <button onClick={async () => { await adminApi.deleteAiMemory(it.id); load(); }} className="text-red-500"><Trash2 size={14} /></button>
                        </div>
                    ))}
                </div>
            </Card>
            <Card title={form.id ? `ویرایش #${form.id}` : 'حافظه جدید'}>
                <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="شناسه کاربر" value={form.user_id} onChange={(v) => setForm({ ...form, user_id: v })} />
                    <Field label="نوع حافظه" value={form.memory_type} onChange={(v) => setForm({ ...form, memory_type: v })} />
                    <Field label="کلید درس" value={form.subject_key || ''} onChange={(v) => setForm({ ...form, subject_key: v })} />
                    <Field label="منبع" value={form.source || 'admin'} onChange={(v) => setForm({ ...form, source: v })} />
                    <Field label="اهمیت ۱ تا ۱۰" type="number" value={form.importance} onChange={(v) => setForm({ ...form, importance: Number(v) })} />
                    <Field label="اطمینان ۰ تا ۱۰۰" type="number" value={form.confidence} onChange={(v) => setForm({ ...form, confidence: Number(v) })} />
                </div>
                <div className="mt-3"><label className={labelCls}>محتوا</label><textarea className={areaCls} value={form.content || ''} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
                <div className="flex gap-3 mt-4">
                    <Toggle label="فعال" checked={!!form.is_active} onChange={(v) => setForm({ ...form, is_active: v ? 1 : 0 })} />
                    <button onClick={save} className="flex items-center gap-2 bg-[#1a73e8] text-white px-4 py-2 rounded-xl text-xs font-bold"><Save size={14} /> ذخیره</button>
                </div>
            </Card>
        </div>
    );
}

function ChatsPanel({ onError, onSuccess }: { onError: (s: string) => void; onSuccess: (s: string) => void }) {
    const [items, setItems] = useState<any[]>([]);
    const [q, setQ] = useState('');
    const [open, setOpen] = useState<any>(null);
    const load = async () => {
        try { const res = await adminApi.aiConversations({ q }); setItems(res.items || []); }
        catch (e: any) { onError(e.message); }
    };
    useEffect(() => { load(); }, []);
    const view = async (id: number) => {
        try { setOpen(await adminApi.aiConversation(id)); }
        catch (e: any) { onError(e.message); }
    };
    return (
        <div className="grid lg:grid-cols-2 gap-6">
            <Card title="گفتگوها">
                <div className="flex gap-2 mb-3">
                    <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی عنوان، کاربر یا شناسه..." />
                    <button onClick={load} className="px-3 rounded-xl bg-[#1a73e8] text-white"><RefreshCw size={14} /></button>
                </div>
                <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                    {items.map((c) => (
                        <div key={c.id} className="flex gap-2 p-3 rounded-xl bg-[#f8f9fa] dark:bg-[#131314]">
                            <button className="flex-1 text-start" onClick={() => view(c.id)}>
                                <p className="text-xs font-bold">{c.title}</p>
                                <p className="text-[10px] text-[#86868b]">{c.username || `#${c.user_id}`} · {c.subject_key} · {c.message_count} پیام</p>
                            </button>
                            <button onClick={async () => {
                                if (!window.confirm('این گفتگو حذف شود؟')) return;
                                await adminApi.deleteAiConversation(c.id);
                                if (open?.conversation?.id === c.id) setOpen(null);
                                onSuccess('گفتگو حذف شد');
                                load();
                            }} className="text-red-500"><Trash2 size={14} /></button>
                        </div>
                    ))}
                </div>
            </Card>
            <Card title={open?.conversation ? `#${open.conversation.id} · ${open.conversation.title}` : 'پیام‌ها'}>
                {!open && <p className="text-xs text-[#86868b]">یک گفتگو را انتخاب کن</p>}
                {open && (
                    <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                        {(open.messages || []).map((m: any) => (
                            <div key={m.id} className={`p-3 rounded-xl text-xs ${m.role === 'assistant' ? 'bg-[#e8f0fe]' : 'bg-[#f8f9fa] dark:bg-[#131314]'}`}>
                                <p className="text-[10px] font-bold text-[#86868b] mb-1">{m.role} · {m.created_at ? new Date(m.created_at).toLocaleString() : ''}</p>
                                <p className="whitespace-pre-wrap">{String(m.content || '').slice(0, 2000)}</p>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[1.5rem] p-6 shadow-sm">
            <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-[0.15em] mb-4 block">{title}</label>
            {children}
        </div>
    );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: any; onChange: (v: string) => void; type?: string }) {
    return (
        <div>
            <label className={labelCls}>{label}</label>
            <input type={type} className={inputCls} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
        </div>
    );
}

function Center() {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#1a73e8]" /></div>;
}
