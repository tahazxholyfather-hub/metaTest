import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Brain, ChevronDown, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage, metApi } from './api';
import type { MetFeatures, MetMemory, MetSettings } from './types';
import { AiSwitch, EmptyHint, GraySpinner, SectionLabel, Segmented, easeOut, faNum, formatRelativeDay } from './ui';

type Props = {
    settings: MetSettings;
    features: MetFeatures;
    onChange: (next: MetSettings) => void;
    className?: string;
};

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
                <div className="text-[12.5px] font-bold text-[var(--text-primary)]">{title}</div>
                {hint && <div className="text-[10.5px] text-[var(--text-muted)] mt-0.5 leading-snug">{hint}</div>}
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    );
}

export function SettingsPanel({ settings, features, onChange, className = '' }: Props) {
    const [saving, setSaving] = useState<string | null>(null);
    const [memoryOpen, setMemoryOpen] = useState(false);
    const [memories, setMemories] = useState<MetMemory[] | null>(null);
    const [memoryLoading, setMemoryLoading] = useState(false);

    const patch = async <K extends keyof MetSettings>(key: K, value: MetSettings[K]) => {
        const optimistic = { ...settings, [key]: value };
        onChange(optimistic);
        setSaving(key);
        try {
            const saved = await metApi.updateSettings({ [key]: value } as Partial<MetSettings>);
            onChange(saved);
        } catch (err) {
            onChange(settings);
            toast.error(errorMessage(err, 'ذخیره تنظیمات ناموفق بود'));
        } finally {
            setSaving(null);
        }
    };

    useEffect(() => {
        if (!memoryOpen || memories) return;
        setMemoryLoading(true);
        metApi
            .listMemory()
            .then(setMemories)
            .catch(() => setMemories([]))
            .finally(() => setMemoryLoading(false));
    }, [memoryOpen, memories]);

    const forget = async (id: number) => {
        try {
            await metApi.forgetMemory(id);
            setMemories((prev) => (prev || []).filter((m) => m.id !== id));
        } catch (err) {
            toast.error(errorMessage(err, 'حذف ناموفق بود'));
        }
    };

    const clearAll = async () => {
        try {
            const n = await metApi.clearMemory();
            setMemories([]);
            toast.success(n ? `${faNum(n)} مورد پاک شد` : 'حافظه خالی بود');
        } catch (err) {
            toast.error(errorMessage(err, 'پاک‌سازی ناموفق بود'));
        }
    };

    return (
        <div className={`flex flex-col min-h-0 overflow-y-auto chat-scrollbar px-1 ${className}`} dir="rtl">
            <SectionLabel className="mt-1 mb-1.5">سبک پاسخ</SectionLabel>
            <div className="space-y-3">
                <div>
                    <div className="text-[11.5px] text-[var(--text-secondary)] mb-1.5">لحن</div>
                    <Segmented
                        value={settings.tone}
                        disabled={saving === 'tone'}
                        onChange={(v) => patch('tone', v)}
                        options={[
                            { value: 'friendly', label: 'دوستانه' },
                            { value: 'formal', label: 'رسمی' },
                            { value: 'playful', label: 'بازیگوش' },
                        ]}
                    />
                </div>
                <div>
                    <div className="text-[11.5px] text-[var(--text-secondary)] mb-1.5">طول پاسخ</div>
                    <Segmented
                        value={settings.verbosity}
                        disabled={saving === 'verbosity'}
                        onChange={(v) => patch('verbosity', v)}
                        options={[
                            { value: 'short', label: 'کوتاه' },
                            { value: 'normal', label: 'معمولی' },
                            { value: 'detailed', label: 'مفصل' },
                        ]}
                    />
                </div>
                <div>
                    <div className="text-[11.5px] text-[var(--text-secondary)] mb-1.5">عمق استدلال</div>
                    <Segmented
                        value={settings.reasoningLevel}
                        disabled={saving === 'reasoningLevel'}
                        onChange={(v) => patch('reasoningLevel', v)}
                        options={[
                            { value: 'fast', label: 'سریع' },
                            { value: 'balanced', label: 'متعادل' },
                            { value: 'deep', label: 'عمیق' },
                        ]}
                    />
                    <div className="text-[10px] text-[var(--text-muted)] mt-1">عمیق‌تر = دقیق‌تر ولی سکه‌ی بیشتر.</div>
                </div>
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11.5px] text-[var(--text-secondary)]">خلاقیت</span>
                        <span className="text-[10.5px] text-[var(--text-muted)] tabular-nums">{faNum(settings.creativity)}٪</span>
                    </div>
                    <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={settings.creativity}
                        onChange={(e) => onChange({ ...settings, creativity: Number(e.target.value) })}
                        onPointerUp={(e) => patch('creativity', Number((e.target as HTMLInputElement).value))}
                        onKeyUp={(e) => patch('creativity', Number((e.target as HTMLInputElement).value))}
                        className="w-full accent-[var(--color-primary-500)]"
                        dir="ltr"
                        aria-label="خلاقیت"
                    />
                </div>
            </div>

            <SectionLabel className="mt-5 mb-0.5">رفتار</SectionLabel>
            <div className="divide-y divide-[var(--border)]/50">
                <Row title="حل قدم‌به‌قدم" hint="مسئله‌ها را مرحله‌به‌مرحله توضیح می‌دهد">
                    <AiSwitch checked={settings.stepByStep} onChange={(v) => patch('stepByStep', v)} label="حل قدم‌به‌قدم" />
                </Row>
                <Row title="همیشه با مثال" hint="هر مفهوم را با یک مثال روشن می‌کند">
                    <AiSwitch checked={settings.alwaysExamples} onChange={(v) => patch('alwaysExamples', v)} label="همیشه با مثال" />
                </Row>
                <Row title="پاسخ‌های فشرده" hint="بدون مقدمه و حاشیه">
                    <AiSwitch checked={settings.conciseMode} onChange={(v) => patch('conciseMode', v)} label="پاسخ‌های فشرده" />
                </Row>
                <Row title="حالت کم‌مصرف" hint="مدل سریع‌تر و ارزان‌تر؛ سکه‌ی کمتر">
                    <AiSwitch checked={settings.efficientMode} onChange={(v) => patch('efficientMode', v)} label="حالت کم‌مصرف" />
                </Row>
            </div>

            <SectionLabel className="mt-5 mb-0.5">قابلیت‌ها</SectionLabel>
            <div className="divide-y divide-[var(--border)]/50">
                {features.tts && (
                    <Row title="پاسخ صوتی" hint="دکمه‌ی پخش کنار پاسخ‌های مِت">
                        <AiSwitch checked={settings.voiceReplies} onChange={(v) => patch('voiceReplies', v)} label="پاسخ صوتی" />
                    </Row>
                )}
                {features.knowledgeBase && (
                    <Row title="دانش درسی متاتست" hint="استفاده از نکات و منابع تأییدشده">
                        <AiSwitch checked={settings.knowledgeEnabled} onChange={(v) => patch('knowledgeEnabled', v)} label="دانش درسی" />
                    </Row>
                )}
                {features.pdfReferences && (
                    <Row title="منابع PDF" hint="استفاده از جزوه‌هایی که خودت اضافه می‌کنی">
                        <AiSwitch checked={settings.pdfReferencesEnabled} onChange={(v) => patch('pdfReferencesEnabled', v)} label="منابع PDF" />
                    </Row>
                )}
                {features.memory && (
                    <>
                        <Row title="حافظه‌ی مِت" hint="نقاط قوت و ضعفت را به یاد می‌آورد">
                            <AiSwitch checked={settings.memoryEnabled} onChange={(v) => patch('memoryEnabled', v)} label="حافظه" />
                        </Row>
                        <button
                            type="button"
                            onClick={() => setMemoryOpen((v) => !v)}
                            className="w-full flex items-center justify-between py-2.5 text-[12px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                            <span className="inline-flex items-center gap-2"><Brain size={14} /> آنچه مِت از تو می‌داند</span>
                            <ChevronDown size={14} className={`transition-transform ${memoryOpen ? 'rotate-180' : ''}`} />
                        </button>
                        <AnimatePresence initial={false}>
                            {memoryOpen && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2, ease: easeOut }}
                                    className="overflow-hidden"
                                >
                                    {memoryLoading || memories === null ? (
                                        <div className="py-6 grid place-items-center"><GraySpinner size={16} /></div>
                                    ) : memories.length === 0 ? (
                                        <EmptyHint title="هنوز چیزی ذخیره نشده" body="بعد از چند گفتگو، مِت نکات مهم دربارهٴ یادگیری‌ات را اینجا نگه می‌دارد." />
                                    ) : (
                                        <ul className="space-y-1.5 m-0 p-0 list-none pb-2">
                                            {memories.map((m) => (
                                                <li key={m.id} className="flex items-start gap-2 p-2 rounded-[12px] bg-[color-mix(in_srgb,var(--text-primary)_3.5%,transparent)] border border-[var(--border)]/50">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-[12px] text-[var(--text-primary)] leading-relaxed">{m.content}</div>
                                                        <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{formatRelativeDay(m.updatedAt || m.createdAt)}</div>
                                                    </div>
                                                    <button type="button" onClick={() => forget(m.id)} className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 shrink-0" aria-label="فراموش کن">
                                                        <Trash2 size={13} />
                                                    </button>
                                                </li>
                                            ))}
                                            <li>
                                                <button type="button" onClick={clearAll} className="w-full h-8 rounded-[10px] text-[11.5px] font-bold text-rose-400 hover:bg-rose-500/10">
                                                    پاک‌کردن همه‌ی حافظه
                                                </button>
                                            </li>
                                        </ul>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </>
                )}
            </div>
            <div className="h-3" />
        </div>
    );
}

export default SettingsPanel;
