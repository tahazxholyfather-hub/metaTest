import { useEffect, useState, type CSSProperties } from 'react';
import { Loader2, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { flowApi } from '../lib/authApi';
import { clearQuestionDisplayCache } from '../lib/useQuestionDisplay';
import { MathRenderer } from '../components/ui/MathRenderer';
import {
    SURFACE_DEFAULTS,
    editorBlocks,
    emptyDocument,
    forceDisplayMode,
    resolveSurface,
    sanitizeDocument,
    toCssVars,
    type DisplayField,
    type QuestionDisplayDocument,
    type QuestionSurface,
} from '../backend/questionDisplay.js';

type Scope = 'base' | QuestionSurface;

const TABS: { id: Scope; label: string }[] = [
    { id: 'base', label: 'پایه' },
    { id: 'practice', label: 'تمرین' },
    { id: 'exam', label: 'آزمون' },
    { id: 'examReview', label: 'مرور نتیجه' },
];

const PREVIEW_SURFACES: { id: QuestionSurface; label: string }[] = [
    { id: 'practice', label: 'تمرین' },
    { id: 'exam', label: 'آزمون' },
    { id: 'examReview', label: 'مرور' },
];

const WEIGHT_LABEL: Record<number, string> = {
    500: 'متوسط',
    600: 'نیمه‌بولد',
    700: 'بولد',
};

const SAMPLE = {
    stem: 'اگر $2x+1=7$ باشد، مقدار $x$ کدام است؟',
    options: ['$2$', '$3$', '$4$', '$5$'],
    explanation: 'از دو طرف یکی کم می‌کنیم. در واکنش $\\ce{2H2 + O2 -> 2H2O}$ هم ضریب‌ها به همین شکل جمع می‌شوند.',
};

function cloneDocument(document: QuestionDisplayDocument): QuestionDisplayDocument {
    return sanitizeDocument(JSON.parse(JSON.stringify(document)));
}

function bagOf(document: QuestionDisplayDocument, scope: Scope) {
    return scope === 'base' ? document.base : document.surfaces[scope];
}

function hasOverride(document: QuestionDisplayDocument, scope: Scope, block: string, key: string) {
    const blockBag = bagOf(document, scope)[block];
    return Boolean(blockBag && Object.prototype.hasOwnProperty.call(blockBag, key));
}

function writeOverride(document: QuestionDisplayDocument, scope: Scope, block: string, key: string, value: number) {
    const next = cloneDocument(document);
    const bag = bagOf(next, scope);
    bag[block] = { ...(bag[block] || {}), [key]: value };
    return sanitizeDocument(next);
}

function clearOverride(document: QuestionDisplayDocument, scope: Scope, block: string, key: string) {
    const next = cloneDocument(document);
    const bag = bagOf(next, scope);
    if (!bag[block]) return next;
    delete bag[block][key];
    if (!Object.keys(bag[block]).length) delete bag[block];
    return sanitizeDocument(next);
}

export default function QuestionDisplaySettings() {
    const [document, setDocument] = useState<QuestionDisplayDocument>(() => emptyDocument());
    const [saved, setSaved] = useState('');
    const [scope, setScope] = useState<Scope>('base');
    const [previewSurface, setPreviewSurface] = useState<QuestionSurface>('practice');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let live = true;
        flowApi.dispatch('Admin_get_question_display')
            .then((res: { success?: boolean; document?: unknown; message?: string }) => {
                if (!live) return;
                if (!res?.success) throw new Error(res?.message || 'خطا در دریافت تنظیمات');
                const next = sanitizeDocument(res.document);
                setDocument(next);
                setSaved(JSON.stringify(next));
            })
            .catch((err: Error) => {
                if (live) toast.error(err.message || 'خطا در دریافت تنظیمات نمایش');
            })
            .finally(() => {
                if (live) setLoading(false);
            });
        return () => {
            live = false;
        };
    }, []);

    const dirty = JSON.stringify(document) !== saved;
    const blocks = editorBlocks(scope);
    const shownSurface: QuestionSurface = scope === 'base' ? previewSurface : scope;

    const selectScope = (next: Scope) => {
        setScope(next);
        if (next !== 'base') setPreviewSurface(next);
    };

    const enable = (block: string, field: DisplayField) => {
        const seedSurface: QuestionSurface = scope === 'base' ? 'practice' : scope;
        const current = resolveSurface(document, seedSurface)[block]?.[field.key];
        const fallback = SURFACE_DEFAULTS[seedSurface][block][field.key];
        setDocument((prev) => writeOverride(prev, scope, block, field.key, Number(current ?? fallback)));
    };

    const save = async () => {
        setSaving(true);
        try {
            const res: { success?: boolean; document?: unknown; message?: string } = await flowApi.dispatch(
                'Admin_update_question_display',
                { document },
            );
            if (!res?.success) throw new Error(res?.message || 'خطا در ذخیره تنظیمات');
            const next = sanitizeDocument(res.document || document);
            setDocument(next);
            setSaved(JSON.stringify(next));
            clearQuestionDisplayCache();
            toast.success('تنظیمات نمایش ذخیره شد.');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'خطا در ذخیره تنظیمات');
        } finally {
            setSaving(false);
        }
    };

    const resetScope = () => {
        setDocument((prev) => {
            const next = cloneDocument(prev);
            if (scope === 'base') next.base = {};
            else next.surfaces[scope] = {};
            return next;
        });
    };

    if (loading) {
        return (
            <div className="flex justify-center py-24">
                <Loader2 className="animate-spin text-[#1a73e8]" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6" dir="rtl">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-3xl">
                    <h2 className="text-base font-bold">نمایش سوالات</h2>
                    <p className="mt-1 text-xs leading-6 text-[#86868b]">
                        سایز متن سوال، گزینه‌ها، پاسخ تشریحی، تصویر و فاصله‌ها.
                        پایه روی تمرین، آزمون و مرور نتیجه می‌نشیند.
                        هر سطح فقط فیلدی را عوض می‌کند که جدا برایش روشن شده باشد.
                        تا وقتی چیزی ذخیره نشده، هر سطح همان ظاهر فعلی خودش را دارد.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setDocument(emptyDocument())}
                        className="rounded-xl border border-[#dadce0] px-3 py-2 text-xs font-bold text-[#86868b] dark:border-[#444746]"
                    >
                        پیش‌فرض کد
                    </button>
                    <button
                        type="button"
                        onClick={resetScope}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#dadce0] px-3 py-2 text-xs font-bold dark:border-[#444746]"
                    >
                        <RotateCcw size={14} /> بازنشانی این سطح
                    </button>
                    <button
                        type="button"
                        onClick={save}
                        disabled={!dirty || saving}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#1a73e8] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        ذخیره
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => selectScope(tab.id)}
                        className={`rounded-full px-4 py-2 text-xs font-bold ${scope === tab.id ? 'bg-[#e8f0fe] text-[#1a73e8]' : 'bg-white text-[#444746] dark:bg-[#1e1f20] dark:text-[#c4c7c5]'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
                <div className="flex flex-col gap-4">
                    {blocks.map((block) => (
                        <section key={block.block} className="rounded-2xl border border-[#dadce0] bg-white p-4 dark:border-[#333537] dark:bg-[#1e1f20]">
                            <h3 className="mb-3 text-sm font-bold">{block.label}</h3>
                            <div className="flex flex-col gap-4">
                                {block.fields.map((field) => (
                                    <FieldEditor
                                        key={field.key}
                                        document={document}
                                        scope={scope}
                                        block={block.block}
                                        field={field}
                                        onEnable={() => enable(block.block, field)}
                                        onChange={(value) => setDocument((prev) => writeOverride(prev, scope, block.block, field.key, value))}
                                        onClear={() => setDocument((prev) => clearOverride(prev, scope, block.block, field.key))}
                                    />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
                <Preview
                    document={document}
                    surface={shownSurface}
                    canSwitch={scope === 'base'}
                    onSwitch={setPreviewSurface}
                />
            </div>
        </div>
    );
}

function FieldEditor({
    document,
    scope,
    block,
    field,
    onEnable,
    onChange,
    onClear,
}: {
    document: QuestionDisplayDocument;
    scope: Scope;
    block: string;
    field: DisplayField;
    onEnable: () => void;
    onChange: (value: number) => void;
    onClear: () => void;
}) {
    const enabled = hasOverride(document, scope, block, field.key);
    const stored = bagOf(document, scope)[block]?.[field.key];

    let source = 'پیش‌فرض این سطح';
    if (scope === 'base') source = enabled ? 'روی سطح‌هایی که جدا نشده‌اند' : 'مقدار فعلی هر سطح';
    else if (enabled) source = 'تنظیم جدا';
    else if (hasOverride(document, 'base', block, field.key)) source = 'از پایه';

    return (
        <div className="border-t border-[#dadce0] pt-3 first:border-t-0 first:pt-0 dark:border-[#333537]">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <p className="text-xs font-bold">{field.label}</p>
                    <p className="text-[11px] text-[#86868b]">{source}</p>
                </div>
                <button
                    type="button"
                    onClick={enabled ? onClear : onEnable}
                    aria-pressed={enabled}
                    className={`rounded-full px-3 py-1 text-[11px] font-bold ${enabled ? 'bg-[#e8f0fe] text-[#1a73e8]' : 'bg-[#f1f3f4] text-[#444746] dark:bg-[#333537] dark:text-[#c4c7c5]'}`}
                >
                    {scope === 'base'
                        ? (enabled ? 'یکسان است' : 'یکسان برای همه')
                        : (enabled ? 'جدا شده' : 'جدا برای این بخش')}
                </button>
            </div>
            {enabled && stored !== undefined ? (
                <ValueControl field={field} value={stored} onChange={onChange} />
            ) : (
                <InheritedValues scope={scope} block={block} fieldKey={field.key} document={document} />
            )}
        </div>
    );
}

function InheritedValues({
    scope,
    block,
    fieldKey,
    document,
}: {
    scope: Scope;
    block: string;
    fieldKey: string;
    document: QuestionDisplayDocument;
}) {
    if (scope !== 'base') {
        const value = resolveSurface(document, scope)[block][fieldKey];
        return <p className="text-xs font-bold text-[#86868b]">{formatValue(fieldKey, value)}</p>;
    }
    const practice = formatValue(fieldKey, resolveSurface(document, 'practice')[block][fieldKey]);
    const review = formatValue(fieldKey, resolveSurface(document, 'examReview')[block][fieldKey]);
    if (block === 'explanation') {
        return (
            <p className="text-[11px] leading-6 text-[#86868b]">
                تمرین {practice} · مرور {review}. در خود آزمون پاسخ تشریحی نشان داده نمی‌شود.
            </p>
        );
    }
    const exam = formatValue(fieldKey, resolveSurface(document, 'exam')[block][fieldKey]);
    return (
        <p className="text-[11px] leading-6 text-[#86868b]">
            تمرین {practice} · آزمون {exam} · مرور {review}
        </p>
    );
}

function formatValue(key: string, value: number) {
    if (key === 'weight') return WEIGHT_LABEL[value] || String(value);
    if (key === 'optionColumns') return value === 1 ? 'یک ستون' : 'دو ستون';
    if (key === 'lineHeight') return value.toFixed(2);
    return `${value}px`;
}

function ValueControl({ field, value, onChange }: { field: DisplayField; value: number; onChange: (value: number) => void }) {
    if (field.kind === 'weight') {
        return (
            <div className="flex flex-wrap gap-2">
                {[500, 600, 700].map((weight) => (
                    <button
                        key={weight}
                        type="button"
                        onClick={() => onChange(weight)}
                        className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${value === weight ? 'bg-[#1a73e8] text-white' : 'bg-[#f1f3f4] dark:bg-[#333537]'}`}
                    >
                        {WEIGHT_LABEL[weight]}
                    </button>
                ))}
            </div>
        );
    }
    if (field.kind === 'columns') {
        return (
            <div className="flex gap-2">
                {[1, 2].map((columns) => (
                    <button
                        key={columns}
                        type="button"
                        onClick={() => onChange(columns)}
                        className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${value === columns ? 'bg-[#1a73e8] text-white' : 'bg-[#f1f3f4] dark:bg-[#333537]'}`}
                    >
                        {columns === 1 ? 'یک ستون' : 'دو ستون'}
                    </button>
                ))}
            </div>
        );
    }
    return (
        <label className="flex items-center gap-3">
            <input
                type="range"
                min={field.min}
                max={field.max}
                step={field.step}
                value={value}
                onChange={(event) => onChange(Number(event.target.value))}
                className="min-w-0 flex-1"
            />
            <input
                type="number"
                min={field.min}
                max={field.max}
                step={field.step}
                value={value}
                onChange={(event) => onChange(Number(event.target.value))}
                className="w-20 rounded-lg border border-[#dadce0] bg-transparent px-2 py-1 text-center text-xs font-bold dark:border-[#444746]"
            />
        </label>
    );
}

function Preview({
    document,
    surface,
    canSwitch,
    onSwitch,
}: {
    document: QuestionDisplayDocument;
    surface: QuestionSurface;
    canSwitch: boolean;
    onSwitch: (surface: QuestionSurface) => void;
}) {
    const vars = toCssVars(resolveSurface(document, surface));
    return (
        <aside className="rounded-2xl border border-[#dadce0] bg-white p-4 dark:border-[#333537] dark:bg-[#1e1f20] xl:sticky xl:top-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold">پیش‌نمایش</h3>
                {canSwitch && (
                    <div className="flex gap-1">
                        {PREVIEW_SURFACES.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => onSwitch(item.id)}
                                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${surface === item.id ? 'bg-[#e8f0fe] text-[#1a73e8]' : 'text-[#86868b]'}`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div className="grid gap-3">
                <PreviewFrame label="موبایل" vars={forceDisplayMode(vars, 'mobile')} surface={surface} width={280} />
                <PreviewFrame label="دسکتاپ" vars={forceDisplayMode(vars, 'desktop')} surface={surface} />
            </div>
        </aside>
    );
}

function PreviewFrame({
    label,
    vars,
    surface,
    width,
}: {
    label: string;
    vars: Record<string, string>;
    surface: QuestionSurface;
    width?: number;
}) {
    return (
        <div>
            <p className="mb-1 text-[11px] font-bold text-[#86868b]">{label}</p>
            <div
                className="q-display overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-app)] p-3"
                style={{ ...vars, maxWidth: width } as CSSProperties}
            >
                {surface === 'exam' && (
                    <div className="q-stack">
                        <div className="flex items-start gap-2">
                            <span className="text-2xl font-black text-[var(--accent)]">۰۱</span>
                            <div className="q-stem min-w-0 flex-1 text-zinc-900 dark:text-zinc-100">
                                <MathRenderer text={SAMPLE.stem} inline />
                            </div>
                        </div>
                        <PreviewImage />
                        <PreviewOptions />
                    </div>
                )}
                {surface !== 'exam' && (
                    <div className="q-stack">
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
                            <div className="q-stem text-[var(--text-primary)]">
                                <MathRenderer text={SAMPLE.stem} inline />
                            </div>
                            <PreviewImage />
                        </div>
                        <PreviewOptions />
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-element)] p-3">
                            <p className="mb-2 text-xs font-black text-[var(--accent)]">پاسخ تشریحی</p>
                            <div className="q-explain text-[var(--text-primary)]">
                                <MathRenderer text={SAMPLE.explanation} inline />
                            </div>
                        </div>
                    </div>
                )}
                {surface === 'exam' && <hr className="q-question-gap border-[var(--border)]" />}
            </div>
        </div>
    );
}

function PreviewOptions() {
    return (
        <div className="q-options grid gap-2">
            {SAMPLE.options.map((option) => (
                <div key={option} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2">
                    <div className="q-option text-[var(--text-primary)]">
                        <MathRenderer text={option} inline />
                    </div>
                </div>
            ))}
        </div>
    );
}

function PreviewImage() {
    return (
        <div className="q-image mt-3 flex items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[#e8f0fe] text-[11px] font-bold text-[#1a73e8] dark:bg-[#1a73e8]/10" style={{ width: '100%', aspectRatio: '4 / 3' }}>
            تصویر سوال
        </div>
    );
}
