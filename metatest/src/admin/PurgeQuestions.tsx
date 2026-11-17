import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Eraser, Loader2, Upload } from 'lucide-react';
import { flowApi } from '../lib/authApi';
import { MathRenderer } from '../components/ui/MathRenderer';
import { adminApi } from '../lib/adminApi';

type History = {
    answers: number;
    favorites: number;
    notes: number;
    reports: number;
    review_later: number;
    sessions: number;
    quizzes: number;
    ai: number;
};

type Copy = {
    id: number;
    status: string;
    insert_type: string;
    created_at: string;
    admin_id: number | null;
    admin_name?: string;
    edit_status: string;
    in_scope: boolean;
    has_history: boolean;
    history: History;
    subject_id: number | null;
    grade_id: number | null;
    topic_id: number | null;
    chapter_id: number | null;
    difficulty_level: string;
};

type Group = {
    text: string;
    options: string[];
    file_names: string[];
    occurrences: number;
    copies: Copy[];
};

type Report = {
    summary: {
        files: number;
        parsed: number;
        matched_groups: number;
        db_rows: number;
        in_scope: number;
        unmatched: number;
        ambiguous: number;
        with_history: number;
        scoped: boolean;
    };
    files: { name: string; parsed: number; matched: number; unmatched: number; ambiguous: number; invalid: number }[];
    groups: Group[];
    unmatched: { file_name: string; index: number; text: string }[];
    ambiguous: { file_name: string; index: number; text: string; candidates: { id: number; status: string; reason: string; created_at: string }[] }[];
};

type LookupQuestion = {
    id: number;
    text: string;
    options: string[];
    status: string;
    insert_type: string;
    created_at: string;
    admin_id: number | null;
    admin_name?: string;
    has_history: boolean;
    history: History;
    copies: Copy[];
    similar: { id: number; status: string; reason: string; created_at: string }[];
};

type AdminRow = { id: number; username: string; fullName?: string };

const EMPTY_FILTERS = { from: '', to: '', adminId: '', insertType: 'اتوماتیک' };

function historyLabel(history: History) {
    const parts: string[] = [];
    if (history.answers) parts.push(`${history.answers} پاسخ کاربر`);
    if (history.favorites) parts.push('علاقه‌مندی');
    if (history.notes) parts.push('یادداشت');
    if (history.reports) parts.push('گزارش');
    if (history.review_later) parts.push('مرور بعدی');
    if (history.sessions) parts.push('جلسه آزمون');
    if (history.quizzes) parts.push('آزمون یا لیست ذخیره‌شده');
    if (history.ai) parts.push('گفتگوی مت');
    return parts.join('، ');
}

function downloadJson(filename: string, value: unknown) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function readAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('خواندن فایل ناموفق بود'));
        reader.readAsDataURL(file);
    });
}

export default function PurgeQuestions() {
    const [admins, setAdmins] = useState<AdminRow[]>([]);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [files, setFiles] = useState<File[]>([]);
    const [parseNotes, setParseNotes] = useState<{ name: string; errors: string[]; message?: string }[]>([]);
    const [progress, setProgress] = useState('');
    const [report, setReport] = useState<Report | null>(null);
    const [selected, setSelected] = useState<number[]>([]);
    const [query, setQuery] = useState('');
    const [visible, setVisible] = useState(40);
    const [showUnmatched, setShowUnmatched] = useState(false);
    const [showAmbiguous, setShowAmbiguous] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [confirmMode, setConfirmMode] = useState<'delete' | 'deactivate' | null>(null);
    const [confirmWord, setConfirmWord] = useState('');
    const [entry, setEntry] = useState<'file' | 'ids'>('file');
    const [idText, setIdText] = useState('');
    const [lookup, setLookup] = useState<LookupQuestion[]>([]);
    const [missingIds, setMissingIds] = useState<number[]>([]);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        adminApi.listAdmins()
            .then((res) => setAdmins((res.admins || []) as AdminRow[]))
            .catch(() => setAdmins([]));
    }, []);

    const selectedSet = useMemo(() => new Set(selected), [selected]);

    const filteredGroups = useMemo(() => {
        const needle = query.trim();
        if (!report) return [];
        if (!needle) return report.groups;
        return report.groups.filter((group) =>
            group.text.includes(needle) || group.options.some((option) => option.includes(needle))
        );
    }, [report, query]);

    const chosenCopies = useMemo(() => {
        if (entry === 'ids') {
            const rows: (Copy & { text: string })[] = [];
            for (const question of lookup) {
                if (selectedSet.has(question.id)) {
                    rows.push({
                        id: question.id,
                        status: question.status,
                        insert_type: question.insert_type,
                        created_at: question.created_at,
                        admin_id: question.admin_id,
                        admin_name: question.admin_name,
                        edit_status: '',
                        in_scope: true,
                        has_history: question.has_history,
                        history: question.history,
                        subject_id: null,
                        grade_id: null,
                        topic_id: null,
                        chapter_id: null,
                        difficulty_level: '',
                        text: question.text,
                    });
                }
                for (const copy of question.copies) {
                    if (selectedSet.has(copy.id)) rows.push({ ...copy, text: question.text });
                }
            }
            return rows;
        }
        if (!report) return [];
        return report.groups.flatMap((group) => group.copies
            .filter((copy) => selectedSet.has(copy.id))
            .map((copy) => ({ ...copy, text: group.text })));
    }, [entry, lookup, report, selectedSet]);

    const toggle = (id: number) => {
        setSelected((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
    };

    const selectInScope = () => {
        if (!report) return;
        setSelected(report.groups.flatMap((group) => group.copies.filter((copy) => copy.in_scope).map((copy) => copy.id)));
    };

    const selectAllCopies = () => {
        if (!report) return;
        setSelected(report.groups.flatMap((group) => group.copies.map((copy) => copy.id)));
    };

    const backupPayload = () => {
        if (!report) return null;
        return {
            exported_at: new Date().toISOString(),
            filters,
            selected: report.groups.flatMap((group) => group.copies.filter((copy) => selectedSet.has(copy.id)).map((copy) => ({
                ...copy,
                text: group.text,
                options: group.options,
                file_names: group.file_names,
            }))),
        };
    };

    const handlePreview = async () => {
        if (files.length === 0) {
            setErrorMessage('حداقل یک فایل ورد انتخاب کن.');
            return;
        }
        setBusy(true);
        setErrorMessage(null);
        setSuccessMessage(null);
        setReport(null);
        setParseNotes([]);
        try {
            const payload = [];
            const notes: { name: string; errors: string[]; message?: string }[] = [];
            for (let index = 0; index < files.length; index += 1) {
                const file = files[index];
                setProgress(`خواندن ${index + 1} از ${files.length}: ${file.name}`);
                const fileData = await readAsDataUrl(file);
                const response: any = await flowApi.dispatch('Admin_parse_questions_docx', {
                    file_data: fileData,
                    file_name: file.name,
                });
                const parsed = response.data || response;
                if (!parsed.success) {
                    notes.push({ name: file.name, errors: [], message: parsed.message || 'خواندن فایل ناموفق بود.' });
                    payload.push({ name: file.name, questions: [], invalid: 0 });
                    continue;
                }
                notes.push({ name: file.name, errors: parsed.errors || [] });
                payload.push({
                    name: file.name,
                    questions: (parsed.questions || []).map((question: any) => ({
                        text: question.text,
                        options: question.options,
                    })),
                });
            }
            setParseNotes(notes.filter((note) => note.message || note.errors.length));
            setProgress('در حال تطبیق با بانک سوال...');
            const response: any = await flowApi.dispatch('Admin_preview_question_purge', {
                files: payload,
                filters: {
                    from: filters.from,
                    to: filters.to,
                    admin_id: filters.adminId,
                    insert_type: filters.insertType,
                },
            });
            const res = response.data || response;
            if (!res.success) {
                setErrorMessage(res.message || 'بررسی ناموفق بود.');
                return;
            }
            const next = res as Report;
            setReport(next);
            setVisible(40);
            setSelected(next.groups.flatMap((group) => group.copies.filter((copy) => copy.in_scope).map((copy) => copy.id)));
        } catch (error: any) {
            setErrorMessage(error?.message || 'هنگام بررسی فایل‌ها خطایی رخ داد.');
        } finally {
            setProgress('');
            setBusy(false);
        }
    };

    const handleLookup = async () => {
        setBusy(true);
        setErrorMessage(null);
        setSuccessMessage(null);
        setLookup([]);
        setMissingIds([]);
        try {
            const response: any = await flowApi.dispatch('Admin_lookup_question_purge', { text: idText });
            const res = response.data || response;
            if (!res.success) {
                setErrorMessage(res.message || 'بررسی شناسه‌ها ناموفق بود.');
                return;
            }
            const questions = (res.questions || []) as LookupQuestion[];
            setLookup(questions);
            setMissingIds(res.missing || []);
            setSelected(questions.map((question) => question.id));
        } catch (error: any) {
            setErrorMessage(error?.message || 'هنگام بررسی شناسه‌ها خطایی رخ داد.');
        } finally {
            setBusy(false);
        }
    };

    const selectExactCopies = () => {
        const ids = lookup.flatMap((question) => [question.id, ...question.copies.map((copy) => copy.id)]);
        setSelected([...new Set(ids)]);
    };

    const handleApply = async (forceUsed = false, ids = selected) => {
        if (!confirmMode || ids.length === 0) return;
        setBusy(true);
        setErrorMessage(null);
        try {
            const response: any = await flowApi.dispatch('Admin_apply_question_purge', {
                mode: confirmMode,
                confirm: 'پاکسازی',
                force_used: forceUsed,
                question_ids: ids,
            });
            const res = response.data || response;
            if (!res.success) {
                setErrorMessage(res.message || 'پاکسازی ناموفق بود.');
                return;
            }
            downloadJson(`purge-${res.log_id || Date.now()}.json`, {
                log_id: res.log_id,
                deleted: res.deleted,
                deactivated: res.deactivated,
                missing: res.missing,
                snapshot: res.snapshot,
            });
            setSuccessMessage(res.message || 'پاکسازی انجام شد. فایل پشتیبان دانلود شد.');
            setConfirmMode(null);
            setConfirmWord('');
            setReport(null);
            setLookup([]);
            setMissingIds([]);
            setSelected([]);
        } catch (error: any) {
            setErrorMessage(error?.message || 'هنگام پاکسازی خطایی رخ داد.');
        } finally {
            setBusy(false);
        }
    };

    const usedCopies = confirmMode === 'delete' ? chosenCopies.filter((copy) => copy.has_history) : [];
    const unusedCopies = confirmMode === 'delete' ? chosenCopies.filter((copy) => !copy.has_history) : [];
    const wordReady = confirmWord.trim() === 'پاکسازی';

    return (
        <div className="flex flex-col gap-6" dir="rtl">
            <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-6">
                <h2 className="text-sm font-bold text-[#1f1f1f] dark:text-[#e3e3e3]">حذف سوالات</h2>
                <p className="text-xs text-[#86868b] mt-2 leading-relaxed">
                    از فایل ورد یا با شناسه سوال را پیدا کن. نسخه‌های عین هم را می‌توانی همراهش انتخاب کنی.
                    اگر دانش‌آموز از سوال استفاده کرده باشد، حذف کامل فقط بعد از دیدن شناسه‌ها و نوشتن «پاکسازی» انجام می‌شود. نمره آزمون قبلی می‌ماند و جای سوال می‌نویسد «این سوال حذف شده است».
                </p>
                <div className="flex gap-2 mt-4">
                    <button type="button" onClick={() => { setEntry('file'); setSelected([]); setConfirmMode(null); }} className={`px-3 py-1.5 rounded-full text-xs font-bold ${entry === 'file' ? 'bg-[#1a73e8] text-white' : 'bg-[#f8f9fa] dark:bg-[#131314]'}`}>از فایل ورد</button>
                    <button type="button" onClick={() => { setEntry('ids'); setSelected([]); setConfirmMode(null); }} className={`px-3 py-1.5 rounded-full text-xs font-bold ${entry === 'ids' ? 'bg-[#1a73e8] text-white' : 'bg-[#f8f9fa] dark:bg-[#131314]'}`}>با شناسه</button>
                </div>
                {entry === 'ids' && (
                    <div className="mt-5 flex flex-col gap-3">
                        <textarea
                            value={idText}
                            onChange={(event) => setIdText(event.target.value)}
                            placeholder="شناسه‌ها را با کاما، فاصله یا هر کدام در یک خط بنویس"
                            className="admin-input min-h-24"
                            dir="ltr"
                        />
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={handleLookup}
                                disabled={busy || !idText.trim()}
                                className="flex items-center justify-center gap-2 bg-[#1a73e8] disabled:bg-gray-200 disabled:text-gray-400 text-white px-5 py-3 rounded-xl text-xs font-bold"
                            >
                                {busy && entry === 'ids' && !confirmMode ? <Loader2 size={16} className="animate-spin" /> : <Eraser size={16} />}
                                بررسی شناسه‌ها
                            </button>
                            {lookup.length > 0 && (
                                <button type="button" onClick={selectExactCopies} className="px-3 py-2 rounded-xl bg-[#e8f0fe] text-[#1a73e8] text-xs font-bold">
                                    انتخاب نسخه‌های عین هم
                                </button>
                            )}
                        </div>
                        {missingIds.length > 0 && (
                            <p className="text-xs text-amber-700">این شناسه‌ها در بانک نیستند: {missingIds.join('، ')}</p>
                        )}
                    </div>
                )}
                {entry === 'file' && (
                <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-5">
                    <label className="text-[10px] font-bold text-[#86868b] flex flex-col gap-1">
                        از تاریخ
                        <input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} className="admin-input" dir="ltr" />
                    </label>
                    <label className="text-[10px] font-bold text-[#86868b] flex flex-col gap-1">
                        تا تاریخ
                        <input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} className="admin-input" dir="ltr" />
                    </label>
                    <label className="text-[10px] font-bold text-[#86868b] flex flex-col gap-1">
                        ادمین
                        <select value={filters.adminId} onChange={(event) => setFilters({ ...filters, adminId: event.target.value })} className="admin-input">
                            <option value="">همه</option>
                            {admins.map((admin) => (
                                <option key={admin.id} value={admin.id}>{admin.fullName || admin.username} (#{admin.id})</option>
                            ))}
                        </select>
                    </label>
                    <label className="text-[10px] font-bold text-[#86868b] flex flex-col gap-1">
                        نوع ورود
                        <select value={filters.insertType} onChange={(event) => setFilters({ ...filters, insertType: event.target.value })} className="admin-input">
                            <option value="اتوماتیک">اتوماتیک</option>
                            <option value="دستی">دستی</option>
                            <option value="all">همه</option>
                        </select>
                    </label>
                </div>
                <div className="flex flex-col md:flex-row gap-3 mt-4">
                    <label className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-[#dadce0] dark:border-[#444746] hover:border-[#1a73e8] rounded-xl px-4 py-5 text-xs font-bold text-[#86868b] cursor-pointer">
                        <Upload size={16} />
                        {files.length ? `${files.length} فایل انتخاب شده` : 'فایل‌های ورد (.docx)'}
                        <input
                            type="file"
                            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            multiple
                            className="hidden"
                            onChange={(event) => {
                                const picked = Array.from(event.target.files || []);
                                const docx = picked.filter((file) => file.name.toLowerCase().endsWith('.docx'));
                                if (docx.length !== picked.length) setErrorMessage('فقط فایل ورد (.docx) پذیرفته می‌شود.');
                                setFiles(docx);
                            }}
                        />
                    </label>
                    <button
                        onClick={handlePreview}
                        disabled={busy || files.length === 0}
                        className="flex items-center justify-center gap-2 bg-[#1a73e8] hover:bg-[#1557b0] disabled:bg-gray-200 disabled:text-gray-400 text-white px-6 py-4 rounded-xl text-xs font-bold"
                    >
                        {busy && !confirmMode ? <Loader2 size={16} className="animate-spin" /> : <Eraser size={16} />}
                        {progress || 'بررسی فایل‌ها'}
                    </button>
                </div>
                {files.length > 0 && (
                    <p className="text-[11px] text-[#86868b] mt-3">{files.map((file) => file.name).join('، ')}</p>
                )}
                </>
                )}
            </div>

            {errorMessage && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 text-red-700 px-4 py-3 rounded-2xl flex items-center gap-2">
                    <AlertCircle size={16} />
                    <span className="text-sm font-medium">{errorMessage}</span>
                </div>
            )}
            {successMessage && (
                <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 text-green-700 px-4 py-3 rounded-2xl flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    <span className="text-sm font-medium">{successMessage}</span>
                </div>
            )}

            {entry === 'ids' && lookup.length > 0 && (
                <>
                    <div className="flex flex-col gap-3">
                        {lookup.map((question) => (
                            <article key={question.id} className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-4">
                                <div className="text-sm leading-relaxed">
                                    <MathRenderer text={question.text} dir="rtl" />
                                </div>
                                <ol className="mt-2 text-xs text-[#5f6368] dark:text-[#c4c7c5] list-decimal pr-4 space-y-1">
                                    {question.options.map((option, index) => <li key={index}><MathRenderer text={option} inline dir="rtl" /></li>)}
                                </ol>
                                <div className="mt-3 flex flex-col gap-2">
                                    <label className="flex items-start gap-3 rounded-xl px-3 py-2 text-xs bg-[#e8f0fe]/60 dark:bg-[#1a73e8]/10">
                                        <input type="checkbox" checked={selectedSet.has(question.id)} onChange={() => toggle(question.id)} className="mt-0.5" />
                                        <span>
                                            <span className="font-bold">#{question.id}</span>
                                            {' · '}{question.status || '—'}
                                            {' · '}{question.insert_type || '—'}
                                            {' · '}{question.created_at || 'بدون تاریخ'}
                                            {' · '}{question.admin_name || (question.admin_id ? `ادمین ${question.admin_id}` : 'بدون ادمین')}
                                            {question.has_history ? ` · سابقه: ${historyLabel(question.history)}` : ' · بدون سابقه کاربر'}
                                        </span>
                                    </label>
                                    {question.copies.map((copy) => (
                                        <label key={copy.id} className="flex items-start gap-3 rounded-xl px-3 py-2 text-xs bg-[#f8f9fa] dark:bg-[#131314]">
                                            <input type="checkbox" checked={selectedSet.has(copy.id)} onChange={() => toggle(copy.id)} className="mt-0.5" />
                                            <span>
                                                <span className="font-bold">نسخه #{copy.id}</span>
                                                {' · '}{copy.status || '—'}
                                                {' · '}{copy.created_at || 'بدون تاریخ'}
                                                {copy.has_history ? ` · سابقه: ${historyLabel(copy.history)}` : ' · بدون سابقه کاربر'}
                                            </span>
                                        </label>
                                    ))}
                                    {question.similar.map((item) => (
                                        <p key={item.id} className="text-[11px] text-[#86868b] pr-3">شبیه و انتخاب‌نشده: #{item.id} · {item.reason} · {item.status}</p>
                                    ))}
                                </div>
                            </article>
                        ))}
                    </div>
                    <div className="sticky bottom-4 flex flex-wrap gap-2 bg-white/90 dark:bg-[#1e1f20]/90 border border-[#dadce0] dark:border-[#333537] rounded-2xl p-3 backdrop-blur">
                        <button disabled={busy || selected.length === 0} onClick={() => { setConfirmWord(''); setConfirmMode('deactivate'); }} className="px-4 py-2 rounded-xl bg-[#f8f9fa] dark:bg-[#131314] text-xs font-bold disabled:opacity-40">غیرفعال کردن {selected.length} سوال</button>
                        <button disabled={busy || selected.length === 0} onClick={() => { setConfirmWord(''); setConfirmMode('delete'); }} className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold disabled:opacity-40">حذف کامل {selected.length} سوال</button>
                    </div>
                </>
            )}

            {parseNotes.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 rounded-2xl p-4 text-xs leading-relaxed">
                    {parseNotes.map((note) => (
                        <p key={note.name}><span className="font-bold">{note.name}: </span>{note.message || note.errors.slice(0, 3).join(' | ')}</p>
                    ))}
                </div>
            )}

            {entry === 'file' && report && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            ['سوال فایل', report.summary.parsed],
                            ['گروه پیدا شده', report.summary.matched_groups],
                            ['ردیف بانک', report.summary.db_rows],
                            ['داخل محدوده', report.summary.in_scope],
                            ['پیدا نشد', report.summary.unmatched],
                            ['مبهم', report.summary.ambiguous],
                            ['دارای سابقه', report.summary.with_history],
                            ['انتخاب شده', selected.length],
                        ].map(([label, value]) => (
                            <div key={String(label)} className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-4">
                                <p className="text-[10px] font-bold text-[#86868b]">{label}</p>
                                <p className="text-xl font-bold mt-1">{value}</p>
                            </div>
                        ))}
                    </div>

                    {!report.summary.scoped && (
                        <p className="text-xs text-amber-700 dark:text-amber-200 leading-relaxed">
                            چون بازه تاریخ یا ادمین مشخص نیست، هیچ ردیفی از قبل انتخاب نشده. محدوده را بگذار و دوباره بررسی کن، یا خودت تیک بزن.
                        </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                        <button onClick={selectInScope} className="px-3 py-2 rounded-xl bg-[#e8f0fe] text-[#1a73e8] text-xs font-bold">انتخاب داخل محدوده</button>
                        <button onClick={selectAllCopies} className="px-3 py-2 rounded-xl bg-[#f8f9fa] dark:bg-[#131314] text-xs font-bold">انتخاب همه کپی‌ها</button>
                        <button onClick={() => setSelected([])} className="px-3 py-2 rounded-xl bg-[#f8f9fa] dark:bg-[#131314] text-xs font-bold">پاک کردن انتخاب</button>
                        <button
                            onClick={() => backupPayload() && downloadJson('purge-preview.json', backupPayload())}
                            className="px-3 py-2 rounded-xl bg-[#f8f9fa] dark:bg-[#131314] text-xs font-bold inline-flex items-center gap-1"
                        >
                            <Download size={14} /> دانلود پشتیبان انتخاب‌شده‌ها
                        </button>
                        <input value={query} onChange={(event) => { setQuery(event.target.value); setVisible(40); }} placeholder="جستجو در متن..." className="admin-input w-full md:w-64" />
                    </div>

                    <div className="flex flex-col gap-3">
                        {filteredGroups.slice(0, visible).map((group) => (
                            <article key={`${group.text}-${group.copies[0]?.id}`} className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-4">
                                <div className="text-sm leading-relaxed">
                                    <MathRenderer text={group.text} dir="rtl" />
                                </div>
                                <ol className="mt-2 text-xs text-[#5f6368] dark:text-[#c4c7c5] list-decimal pr-4 space-y-1">
                                    {group.options.map((option, index) => <li key={index}><MathRenderer text={option} inline dir="rtl" /></li>)}
                                </ol>
                                <p className="text-[10px] text-[#86868b] mt-2">
                                    {group.occurrences} بار در فایل · {group.file_names.join('، ')} · {group.copies.length} ردیف در بانک
                                </p>
                                <div className="mt-3 flex flex-col gap-2">
                                    {group.copies.map((copy) => (
                                        <label key={copy.id} className={`flex items-start gap-3 rounded-xl px-3 py-2 text-xs ${copy.in_scope ? 'bg-[#e8f0fe]/60 dark:bg-[#1a73e8]/10' : 'bg-[#f8f9fa] dark:bg-[#131314]'}`}>
                                            <input type="checkbox" checked={selectedSet.has(copy.id)} onChange={() => toggle(copy.id)} className="mt-0.5" />
                                            <span className="leading-relaxed">
                                                <span className="font-bold">#{copy.id}</span>
                                                {' · '}{copy.status || '—'}
                                                {' · '}{copy.insert_type || '—'}
                                                {' · '}{copy.created_at || 'بدون تاریخ'}
                                                {' · '}{copy.admin_name || (copy.admin_id ? `ادمین ${copy.admin_id}` : 'بدون ادمین')}
                                                {copy.in_scope ? ' · داخل محدوده' : ' · خارج از محدوده'}
                                                {copy.has_history ? ` · سابقه: ${historyLabel(copy.history)}` : ' · بدون سابقه کاربر'}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </article>
                        ))}
                    </div>
                    {filteredGroups.length > visible && (
                        <button onClick={() => setVisible((count) => count + 40)} className="text-xs font-bold text-[#1a73e8]">
                            نمایش ۴۰ مورد بعدی ({filteredGroups.length - visible} مانده)
                        </button>
                    )}

                    <button onClick={() => setShowUnmatched((open) => !open)} className="text-xs font-bold text-right">
                        پیدا نشد ({report.unmatched.length})
                    </button>
                    {showUnmatched && report.unmatched.map((item) => (
                        <p key={`${item.file_name}-${item.index}`} className="text-xs leading-relaxed text-[#5f6368]">
                            {item.file_name} / سوال {item.index}: <MathRenderer text={item.text} inline dir="rtl" />
                        </p>
                    ))}

                    <button onClick={() => setShowAmbiguous((open) => !open)} className="text-xs font-bold text-right">
                        مبهم و انتخاب‌نشده ({report.ambiguous.length})
                    </button>
                    {showAmbiguous && report.ambiguous.map((item) => (
                        <div key={`${item.file_name}-${item.index}`} className="text-xs leading-relaxed">
                            <p>{item.file_name} / سوال {item.index}: <MathRenderer text={item.text} inline dir="rtl" /></p>
                            {item.candidates.map((candidate) => (
                                <p key={candidate.id} className="text-[#86868b] pr-3">#{candidate.id} · {candidate.reason} · {candidate.status} · {candidate.created_at}</p>
                            ))}
                        </div>
                    ))}

                    <div className="sticky bottom-4 flex flex-wrap gap-2 bg-white/90 dark:bg-[#1e1f20]/90 border border-[#dadce0] dark:border-[#333537] rounded-2xl p-3 backdrop-blur">
                        <button
                            disabled={busy || selected.length === 0}
                            onClick={() => { setConfirmWord(''); setConfirmMode('deactivate'); }}
                            className="px-4 py-2 rounded-xl bg-[#f8f9fa] dark:bg-[#131314] text-xs font-bold disabled:opacity-40"
                        >
                            غیرفعال کردن {selected.length} سوال
                        </button>
                        <button
                            disabled={busy || selected.length === 0}
                            onClick={() => { setConfirmWord(''); setConfirmMode('delete'); }}
                            className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold disabled:opacity-40"
                        >
                            حذف کامل {selected.length} سوال
                        </button>
                    </div>
                </>
            )}

            <style>{`
                .admin-input {
                    width: 100%;
                    background: #f8f9fa;
                    border: 1px solid #dadce0;
                    border-radius: 0.75rem;
                    padding: 0.7rem 0.9rem;
                    font-size: 12px;
                    outline: none;
                }
                .dark .admin-input { background: #131314; border-color: #444746; color: #e3e3e3; }
            `}</style>
            {confirmMode && (
                <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-[#1e1f20] rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto" dir="rtl">
                        <h3 className="font-bold text-sm">{confirmMode === 'delete' ? 'حذف کامل' : 'غیرفعال کردن'}</h3>
                        {confirmMode === 'deactivate' && (
                            <p className="text-xs leading-relaxed mt-3 text-[#444746] dark:text-[#c4c7c5]">
                                {chosenCopies.length} سوال غیرفعال می‌شود و در آزمون جدید نمی‌آید. سابقه دانش‌آموز می‌ماند.
                            </p>
                        )}
                        {confirmMode === 'delete' && usedCopies.length === 0 && (
                            <p className="text-xs leading-relaxed mt-3 text-[#444746] dark:text-[#c4c7c5]">
                                {unusedCopies.length} سوال سابقه دانش‌آموز ندارد و حذف می‌شود.
                            </p>
                        )}
                        {confirmMode === 'delete' && usedCopies.length > 0 && (
                            <div className="mt-3 flex flex-col gap-3">
                                <p className="text-xs leading-relaxed text-[#444746] dark:text-[#c4c7c5]">
                                    {unusedCopies.length} سوال بدون استفاده حذف می‌شود. {usedCopies.length} سوال را دانش‌آموز استفاده کرده است. دکمه اول همان شناسه‌ها را در بانک نگه می‌دارد. حذف کامل نمره آزمون قبلی را عوض نمی‌کند.
                                </p>
                                <div className="max-h-52 overflow-y-auto flex flex-col gap-2">
                                    {usedCopies.map((copy) => (
                                        <p key={copy.id} className="text-xs leading-relaxed bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2">
                                            <span className="font-bold">#{copy.id}</span>
                                            {' · '}{historyLabel(copy.history)}
                                            <br />
                                            <MathRenderer text={copy.text} inline dir="rtl" />
                                        </p>
                                    ))}
                                </div>
                                <label className="text-[10px] font-bold text-[#86868b] flex flex-col gap-1">
                                    برای حذف همین شناسه‌ها بنویس پاکسازی
                                    <input value={confirmWord} onChange={(event) => setConfirmWord(event.target.value)} className="admin-input" />
                                </label>
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2 mt-5">
                            {confirmMode === 'deactivate' && (
                                <button onClick={() => handleApply(false, chosenCopies.map((copy) => copy.id))} disabled={busy || chosenCopies.length === 0} className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold disabled:opacity-40">
                                    {busy ? 'در حال اجرا...' : 'تأیید غیرفعال کردن'}
                                </button>
                            )}
                            {confirmMode === 'delete' && unusedCopies.length > 0 && (
                                <button onClick={() => handleApply(false, unusedCopies.map((copy) => copy.id))} disabled={busy} className="px-4 py-2 rounded-xl bg-[#f8f9fa] dark:bg-[#131314] text-xs font-bold disabled:opacity-40">
                                    {usedCopies.length ? 'فقط سوال‌های بدون استفاده حذف شوند' : (busy ? 'در حال اجرا...' : 'تأیید پاکسازی')}
                                </button>
                            )}
                            {confirmMode === 'delete' && usedCopies.length > 0 && (
                                <button onClick={() => handleApply(true, chosenCopies.map((copy) => copy.id))} disabled={busy || !wordReady} className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold disabled:opacity-40">
                                    این شناسه‌ها هم حذف کامل شوند
                                </button>
                            )}
                            <button onClick={() => { setConfirmMode(null); setConfirmWord(''); }} disabled={busy} className="px-4 py-2 rounded-xl bg-[#f8f9fa] dark:bg-[#131314] text-xs font-bold">
                                انصراف
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
