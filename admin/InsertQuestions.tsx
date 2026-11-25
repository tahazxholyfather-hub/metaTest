import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Plus, X, Loader2, AlertCircle, CheckCircle2, Circle, Upload, FileUp,
    PenLine, FileText, CheckSquare, Square, Send, Trash2
} from 'lucide-react';
import { flowApi } from '../lib/authApi';
import { CustomSelect, type SelectOption } from './EditQuestions';
import { MathRenderer } from '../components/ui/MathRenderer';



// --- TYPES ---
interface ParsedQuestion {
    text: string;
    options: string[];
    correct_index: number;
    descriptive: string;
    checked: boolean;
}

interface CurriculumData {
    subjects: { id: number; title: string }[];
    grades: { id: number; title: string }[];
    topics: { id: number; subject_id: number; title: string }[];
    chapters: { id: number; topic_id: number; title: string }[];
}

interface ManualForm {
    text: string;
    options: string[];
    correct_index: number;
    descriptive: string;
}

const EMPTY_MANUAL: ManualForm = { text: '', options: ['', '', '', ''], correct_index: 1, descriptive: '' };

const LEVEL_OPTIONS: SelectOption[] = [
    { id: 'آسان', title: 'آسان' },
    { id: 'متوسط', title: 'متوسط' },
    { id: 'سخت', title: 'سخت' },
];

export default function InsertQuestions() {
    const [mode, setMode] = useState<'manual' | 'auto'>('manual');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Shared curriculum lists (all records, for metadata selects)
    const [curriculum, setCurriculum] = useState<CurriculumData>({ subjects: [], grades: [], topics: [], chapters: [] });

    // Manual mode state
    const [manual, setManual] = useState<ManualForm>(EMPTY_MANUAL);
    const [meta, setMeta] = useState<{ subject_id: number | null; grade_id: number | null; topic_id: number | null; chapter_id: number | null; level: string }>({
        subject_id: null, grade_id: null, topic_id: null, chapter_id: null, level: 'متوسط'
    });
    const [isSavingManual, setIsSavingManual] = useState(false);

    // Auto mode state
    const [file, setFile] = useState<{ data: string; name: string } | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [parsed, setParsed] = useState<ParsedQuestion[]>([]);
    const [parseWarnings, setParseWarnings] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- CURRICULUM DATA ---
    useEffect(() => {
        const fetchCurriculum = async () => {
            try {
                const response: any = await flowApi.dispatch('Admin_get_curriculum');
                const res = response.data || response;
                if (res.success) {
                    setCurriculum({
                        subjects: res.subjects || [],
                        grades: res.grades || [],
                        topics: res.topics || [],
                        chapters: res.chapters || [],
                    });
                }
            } catch (e) { console.error('Failed to fetch curriculum', e); }
        };
        fetchCurriculum();
    }, []);

    // Auto-dismiss success messages
    useEffect(() => {
        if (!successMessage) return;
        const timer = setTimeout(() => setSuccessMessage(null), 4000);
        return () => clearTimeout(timer);
    }, [successMessage]);

    const topicOptions: SelectOption[] = useMemo(
        () => curriculum.topics.filter(t => t.subject_id === meta.subject_id).map(t => ({ id: t.id, title: t.title })),
        [curriculum.topics, meta.subject_id]
    );
    const chapterOptions: SelectOption[] = useMemo(
        () => curriculum.chapters.filter(c => c.topic_id === meta.topic_id).map(c => ({ id: c.id, title: c.title })),
        [curriculum.chapters, meta.topic_id]
    );

    const handleMetaChange = (key: string, value: any) => {
        setMeta(prev => {
            const next = { ...prev, [key]: value };
            if (key === 'subject_id') { next.topic_id = null; next.chapter_id = null; }
            if (key === 'topic_id') { next.chapter_id = null; }
            return next;
        });
    };

    // --- MANUAL MODE ---
    const handleManualOptionChange = (index: number, value: string) => {
        setManual(prev => ({ ...prev, options: prev.options.map((o, i) => i === index ? value : o) }));
    };

    const handleManualSubmit = async () => {
        if (!manual.text.trim()) { setErrorMessage('Question text is required.'); return; }
        if (manual.options.some(o => !o.trim())) { setErrorMessage('All 4 options are required.'); return; }

        setIsSavingManual(true);
        setErrorMessage(null);
        try {
            const response: any = await flowApi.dispatch('Admin_insert_questions', {
                insert_type: 'دستی',
                meta: {
                    subject_id: meta.subject_id,
                    grade_id: meta.grade_id,
                    topic_id: meta.topic_id,
                    chapter_id: meta.chapter_id,
                    level: meta.level,
                },
                questions: [{
                    text: manual.text.trim(),
                    options: manual.options.map(o => o.trim()),
                    correct_index: manual.correct_index,
                    descriptive: manual.descriptive.trim(),
                }],
            });
            const res = response.data || response;

            if (res.success) {
                setSuccessMessage(`Question inserted successfully (ID: ${res.inserted_ids?.[0] ?? '—'}). New questions are inactive until reviewed.`);
                // Keep metadata selections for faster batch entry, reset the content
                setManual(EMPTY_MANUAL);
            } else {
                setErrorMessage(res.message || 'Failed to insert the question.');
            }
        } catch (error) {
            console.error('Manual insert error:', error);
            setErrorMessage('An error occurred while inserting the question.');
        } finally {
            setIsSavingManual(false);
        }
    };

    // --- AUTO MODE ---
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (!selected) return;

        if (!selected.name.toLowerCase().endsWith('.docx')) {
            setErrorMessage('Only Word (.docx) files are supported.');
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = () => setFile({ data: reader.result as string, name: selected.name });
        reader.onerror = () => setErrorMessage('Failed to read the selected file.');
        reader.readAsDataURL(selected);
    };

    const handleParse = async () => {
        if (!file) { setErrorMessage('Please select a Word (.docx) file first.'); return; }

        setIsParsing(true);
        setErrorMessage(null);
        setParsed([]);
        setParseWarnings([]);
        try {
            const response: any = await flowApi.dispatch('Admin_parse_questions_docx', {
                file_data: file.data,
                file_name: file.name,
            });
            const res = response.data || response;

            if (res.success) {
                setParsed((res.questions || []).map((q: any) => ({ ...q, checked: true })));
                setParseWarnings(res.errors || []);
                if ((res.questions || []).length === 0) {
                    setErrorMessage('No valid questions could be extracted from the file.');
                }
            } else {
                setErrorMessage(res.message || 'Failed to parse the Word file.');
            }
        } catch (error) {
            console.error('Parse docx error:', error);
            setErrorMessage('An error occurred while parsing the file.');
        } finally {
            setIsParsing(false);
        }
    };

    const checkedCount = parsed.filter(q => q.checked).length;
    const allChecked = parsed.length > 0 && checkedCount === parsed.length;

    const toggleQuestion = (index: number) => {
        setParsed(prev => prev.map((q, i) => i === index ? { ...q, checked: !q.checked } : q));
    };

    const toggleAll = () => {
        const target = !allChecked;
        setParsed(prev => prev.map(q => ({ ...q, checked: target })));
    };

    const handleAutoSubmit = async () => {
        const selected = parsed.filter(q => q.checked);
        if (selected.length === 0) { setErrorMessage('No questions selected.'); return; }

        setIsSubmitting(true);
        setErrorMessage(null);
        try {
            const response: any = await flowApi.dispatch('Admin_insert_questions', {
                insert_type: 'اتوماتیک',
                // Optional metadata applied to ALL extracted questions in this batch
                meta: {
                    subject_id: meta.subject_id,
                    grade_id: meta.grade_id,
                    topic_id: meta.topic_id,
                    chapter_id: meta.chapter_id,
                    level: meta.level,
                },
                questions: selected.map(q => ({
                    text: q.text,
                    options: q.options,
                    correct_index: q.correct_index,
                    descriptive: q.descriptive,
                })),
            });
            const res = response.data || response;

            if (res.success) {
                setSuccessMessage(`${res.inserted_ids?.length ?? selected.length} question(s) inserted successfully as inactive.`);
                // Keep only unchecked questions in the review table
                setParsed(prev => prev.filter(q => !q.checked));
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
            } else {
                setErrorMessage(res.message || 'Failed to insert the selected questions.');
            }
        } catch (error) {
            console.error('Auto insert error:', error);
            setErrorMessage('An error occurred while inserting the questions.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full">
            {/* TOP TOOLBAR */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-3 shadow-sm sticky top-0 z-[40]">
                {/* Mode Switch */}
                <div className="flex items-center bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-full p-1">
                    <button
                        onClick={() => setMode('manual')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                            mode === 'manual' ? 'bg-[#1a73e8] text-white shadow-sm' : 'text-[#86868b] hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                    >
                        <PenLine size={14} /> Manual
                    </button>
                    <button
                        onClick={() => setMode('auto')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                            mode === 'auto' ? 'bg-[#1a73e8] text-white shadow-sm' : 'text-[#86868b] hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                    >
                        <FileUp size={14} /> Auto (Word)
                    </button>
                </div>

                {/* Primary Action */}
                {mode === 'manual' ? (
                    <button
                        onClick={handleManualSubmit}
                        disabled={isSavingManual}
                        className="flex items-center gap-2 bg-[#1a73e8] hover:bg-[#1557b0] disabled:bg-[#1a73e8]/70 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md"
                    >
                        {isSavingManual ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                        <span className="hidden sm:inline">{isSavingManual ? 'Inserting...' : 'Insert Question'}</span>
                        <span className="sm:hidden">Insert</span>
                    </button>
                ) : (
                    <button
                        onClick={handleAutoSubmit}
                        disabled={isSubmitting || checkedCount === 0}
                        className="flex items-center gap-2 bg-[#1a73e8] hover:bg-[#1557b0] disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-[#2b2d2f] dark:disabled:text-gray-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md"
                    >
                        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        <span className="hidden sm:inline">{isSubmitting ? 'Submitting...' : `Submit Selected (${checkedCount})`}</span>
                        <span className="sm:hidden">Submit ({checkedCount})</span>
                    </button>
                )}
            </div>

            {/* MESSAGES */}
            {errorMessage && (
                <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-[1rem]">
                    <AlertCircle size={20} />
                    <span className="text-sm font-medium">{errorMessage}</span>
                    <button onClick={() => setErrorMessage(null)} className="mr-auto"><X size={16} /></button>
                </div>
            )}
            {successMessage && (
                <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/20 rounded-[1rem]">
                    <CheckCircle2 size={20} />
                    <span className="text-sm font-medium">{successMessage}</span>
                </div>
            )}

            {/* ============ MANUAL MODE ============ */}
            {mode === 'manual' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                    {/* LEFT COLUMN: content */}
                    <div className="lg:col-span-2 flex flex-col gap-6">
                        {/* Question Text */}
                        <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-6">
                            <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider mb-3 block">Question Text *</label>
                            <textarea
                                value={manual.text}
                                onChange={(e) => setManual(prev => ({ ...prev, text: e.target.value }))}
                                placeholder="Write the question text here..."
                                className="w-full h-40 bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-xl p-4 text-sm font-medium leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[#1a73e8] custom-scrollbar"
                                dir="auto"
                            />
                        </div>

                        {/* Options */}
                        <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-6">
                            <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider mb-3 block">
                                Options * (click the circle to mark the correct answer)
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {manual.options.map((optionText, index) => (
                                    <div key={index} className="flex items-start gap-3">
                                        <button onClick={() => setManual(prev => ({ ...prev, correct_index: index + 1 }))} className="mt-1 shrink-0">
                                            {manual.correct_index === index + 1
                                                ? <CheckCircle2 className="text-green-500" />
                                                : <Circle className="text-gray-300 dark:text-gray-600" />}
                                        </button>
                                        <textarea
                                            value={optionText}
                                            onChange={(e) => handleManualOptionChange(index, e.target.value)}
                                            placeholder={`Option ${index + 1}...`}
                                            className="w-full h-24 bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-xl p-3 text-xs font-medium resize-y focus:outline-none focus:ring-2 focus:ring-[#1a73e8] custom-scrollbar"
                                            dir="auto"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Descriptive Answer */}
                        <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-6">
                            <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider mb-3 block">Descriptive Answer (optional)</label>
                            <textarea
                                value={manual.descriptive}
                                onChange={(e) => setManual(prev => ({ ...prev, descriptive: e.target.value }))}
                                placeholder="Explanation / detailed solution..."
                                className="w-full h-32 bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-xl p-4 text-sm font-medium leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[#1a73e8] custom-scrollbar"
                                dir="auto"
                            />
                        </div>
                    </div>

                    {/* RIGHT COLUMN: metadata */}
                    <div className="lg:col-span-1 flex flex-col gap-6 lg:sticky lg:top-28 self-start w-full">
                        <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-6">
                            <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider mb-4 block">Question Metadata (optional)</label>
                            <div className="flex flex-col gap-4">
                                <CustomSelect label="Subject" value={meta.subject_id} options={curriculum.subjects.map(s => ({ id: s.id, title: s.title }))} onChange={(v) => handleMetaChange('subject_id', v)} placeholder="Select Subject..." />
                                <CustomSelect label="Grade" value={meta.grade_id} options={curriculum.grades.map(g => ({ id: g.id, title: g.title }))} onChange={(v) => handleMetaChange('grade_id', v)} placeholder="Select Grade..." />
                                <CustomSelect label="Chapter (Topic)" value={meta.topic_id} options={topicOptions} onChange={(v) => handleMetaChange('topic_id', v)} placeholder="Select Chapter..." disabled={!meta.subject_id} />
                                <CustomSelect label="Mabhas (Chapter)" value={meta.chapter_id} options={chapterOptions} onChange={(v) => handleMetaChange('chapter_id', v)} placeholder="Select Mabhas..." disabled={!meta.topic_id} />
                                <CustomSelect label="Level" value={meta.level} options={LEVEL_OPTIONS} onChange={(v) => handleMetaChange('level', v || 'متوسط')} placeholder="Select Level..." />
                            </div>
                            <p className="text-[10px] text-[#86868b] mt-4 leading-relaxed">
                                New questions are always inserted as <span className="font-bold">غیرفعال (inactive)</span> and must be activated from Edit Questions.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ============ AUTO MODE ============ */}
            {mode === 'auto' && (
                <div className="flex flex-col gap-6">
                    {/* Upload Card */}
                    <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-6">
                        <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider mb-3 block">Word File (.docx)</label>
                        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                            <input ref={fileInputRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFileSelect} className="hidden" />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-[#dadce0] dark:border-[#444746] hover:border-[#1a73e8] rounded-xl px-4 py-5 text-xs font-bold text-[#86868b] hover:text-[#1a73e8] transition-all"
                            >
                                <FileText size={16} />
                                {file ? file.name : 'Click to select a Word (.docx) file'}
                            </button>
                            <button
                                onClick={handleParse}
                                disabled={!file || isParsing}
                                className="flex items-center justify-center gap-2 bg-[#1a73e8] hover:bg-[#1557b0] disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-[#2b2d2f] dark:disabled:text-gray-500 text-white px-6 py-4 rounded-xl text-xs font-bold transition-all shadow-md shrink-0"
                            >
                                {isParsing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                {isParsing ? 'Extracting...' : 'Upload & Extract'}
                            </button>
                        </div>
                        <p className="text-[10px] text-[#86868b] mt-3 leading-relaxed" dir="ltr">
                            Expected format inside the document: <code className="font-mono">&lt;q&gt;...&lt;/q&gt; &lt;o1&gt;...&lt;/o1&gt; ... &lt;o4&gt;...&lt;/o4&gt; &lt;ans&gt;1-4&lt;/ans&gt; &lt;desc&gt;...&lt;/desc&gt;</code> (desc is optional).
                        </p>
                    </div>

                    {/* Batch Metadata (optional, applied to all extracted questions) */}
                    <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-6">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                            <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider">
                                Batch Metadata (optional — applied to all extracted questions)
                            </label>
                            {(meta.subject_id || meta.grade_id || meta.topic_id || meta.chapter_id) && (
                                <button
                                    onClick={() => setMeta(prev => ({ ...prev, subject_id: null, grade_id: null, topic_id: null, chapter_id: null }))}
                                    className="text-[10px] font-bold text-red-500 hover:underline"
                                >
                                    Clear All
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                            <CustomSelect label="Subject" value={meta.subject_id} options={curriculum.subjects.map(s => ({ id: s.id, title: s.title }))} onChange={(v) => handleMetaChange('subject_id', v)} placeholder="Select Subject..." />
                            <CustomSelect label="Grade" value={meta.grade_id} options={curriculum.grades.map(g => ({ id: g.id, title: g.title }))} onChange={(v) => handleMetaChange('grade_id', v)} placeholder="Select Grade..." />
                            <CustomSelect label="Chapter (Topic)" value={meta.topic_id} options={topicOptions} onChange={(v) => handleMetaChange('topic_id', v)} placeholder="Select Chapter..." disabled={!meta.subject_id} />
                            <CustomSelect label="Mabhas (Chapter)" value={meta.chapter_id} options={chapterOptions} onChange={(v) => handleMetaChange('chapter_id', v)} placeholder="Select Mabhas..." disabled={!meta.topic_id} />
                        </div>
                    </div>

                    {/* Parse warnings */}
                    {parseWarnings.length > 0 && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 rounded-[1rem]">
                            <div className="flex items-center gap-2 mb-2 text-sm font-bold">
                                <AlertCircle size={16} /> {parseWarnings.length} block(s) skipped:
                            </div>
                            <ul className="text-xs font-medium space-y-1 pr-6 list-disc" dir="ltr">
                                {parseWarnings.map((w, i) => <li key={i}>{w}</li>)}
                            </ul>
                        </div>
                    )}

                    {/* Review Table */}
                    {parsed.length > 0 && (
                        <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl overflow-hidden">
                            {/* Table toolbar */}
                            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-[#dadce0] dark:border-[#333537]">
                                <div className="flex flex-col gap-2">
                                    <span className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider">
                                        Review Extracted Questions — {checkedCount} of {parsed.length} selected
                                    </span>
                                    {(meta.subject_id || meta.grade_id || meta.topic_id || meta.chapter_id) && (
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="text-[10px] font-bold text-[#86868b]">Will be applied to all:</span>
                                            {[
                                                curriculum.subjects.find(s => s.id === meta.subject_id)?.title,
                                                curriculum.grades.find(g => g.id === meta.grade_id)?.title,
                                                curriculum.topics.find(t => t.id === meta.topic_id)?.title,
                                                curriculum.chapters.find(c => c.id === meta.chapter_id)?.title,
                                            ].filter(Boolean).map((title, i) => (
                                                <span key={i} className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[#e8f0fe] text-[#1a73e8] dark:bg-[#1a73e8]/10" dir="auto">
                                                    {title}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={toggleAll}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-[#1a73e8] bg-[#e8f0fe] dark:bg-[#1a73e8]/10 hover:bg-[#d2e3fc] dark:hover:bg-[#1a73e8]/20 transition-all"
                                >
                                    {allChecked ? <Square size={14} /> : <CheckSquare size={14} />}
                                    {allChecked ? 'Uncheck All' : 'Check All'}
                                </button>
                            </div>

                            {/* Rows */}
                            {parsed.map((q, index) => (
                                <div
                                    key={index}
                                    className={`flex gap-4 px-6 py-5 border-b border-[#f1f3f4] dark:border-[#2b2d2f] last:border-0 transition-colors ${
                                        q.checked ? '' : 'opacity-50'
                                    }`}
                                >
                                    {/* Checkbox */}
                                    <button onClick={() => toggleQuestion(index)} className="shrink-0 self-start mt-0.5">
                                        {q.checked
                                            ? <CheckSquare size={20} className="text-[#1a73e8]" />
                                            : <Square size={20} className="text-gray-300 dark:text-gray-600" />}
                                    </button>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 flex flex-col gap-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-relaxed" dir="auto">
                                                <span className="text-[#86868b] font-bold ml-2">{index + 1}.</span>
                                                <MathRenderer text={q.text} subject={meta.subject_id ?? undefined} inline />
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {q.options.map((opt, optIdx) => (
                                                <div
                                                    key={optIdx}
                                                    className={`flex items-start gap-2 text-xs font-medium p-2.5 rounded-lg border ${
                                                        q.correct_index === optIdx + 1
                                                            ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-400'
                                                            : 'bg-[#f8f9fa] dark:bg-[#131314] border-[#dadce0] dark:border-[#444746] text-gray-600 dark:text-gray-300'
                                                    }`}
                                                    dir="auto"
                                                >
                                                    {q.correct_index === optIdx + 1
                                                        ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                                                        : <Circle size={14} className="shrink-0 mt-0.5 text-gray-300 dark:text-gray-600" />}
                                                    <MathRenderer text={opt} subject={meta.subject_id ?? undefined} />
                                                </div>
                                            ))}
                                        </div>

                                        {q.descriptive && (
                                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-lg p-3" dir="auto">
                                                <span className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider block mb-1">Descriptive Answer</span>
                                                <MathRenderer text={q.descriptive} subject={meta.subject_id ?? undefined} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Bottom submit */}
                            <div className="flex justify-end px-6 py-4 border-t border-[#dadce0] dark:border-[#333537]">
                                <button
                                    onClick={handleAutoSubmit}
                                    disabled={isSubmitting || checkedCount === 0}
                                    className="flex items-center gap-2 bg-[#1a73e8] hover:bg-[#1557b0] disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-[#2b2d2f] dark:disabled:text-gray-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md"
                                >
                                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                    {isSubmitting ? 'Submitting...' : `Submit Selected (${checkedCount})`}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}