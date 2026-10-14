import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Save, Maximize2, Minimize2, Edit2, ChevronLeft, ChevronRight,
    Filter, CheckCircle2, Circle, X, ChevronDown, Search, Loader2, Image as ImageIcon, AlertCircle
} from 'lucide-react';
import { flowApi } from '../lib/authApi';


// Re-exported so existing imports of MathRenderer from this file keep working.
// The renderer itself now lives in MathRenderer.tsx (self-hosted MathJax v4).
import { MathRenderer } from '../components/ui/MathRenderer';


// --- CUSTOM DROPDOWN COMPONENT ---
// Renders above or below to avoid viewport overflow. Includes a live search
// bar that filters the option list (used for subjects, chapters, mabahes, …).
export interface SelectOption { id: number | string; title: string; }

export const CustomSelect = ({ label, value, options, onChange, placeholder = "Select...", disabled = false, searchable = true }: {
    label?: string, value: number | string | null, options: SelectOption[], onChange: (id: number | string | null) => void, placeholder?: string, disabled?: boolean, searchable?: boolean
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [positionUp, setPositionUp] = useState(false);
    const [query, setQuery] = useState('');
    const selectRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return options;
        return options.filter((opt) => {
            const title = String(opt.title || '').toLowerCase();
            const id = String(opt.id).toLowerCase();
            return title.includes(q) || id.includes(q);
        });
    }, [options, query]);

    useEffect(() => {
        if (isOpen && selectRef.current && dropdownRef.current) {
            const selectRect = selectRef.current.getBoundingClientRect();
            const dropdownHeight = dropdownRef.current.offsetHeight;
            const spaceBelow = window.innerHeight - selectRect.bottom;
            if (spaceBelow < dropdownHeight && selectRect.top > dropdownHeight) {
                setPositionUp(true);
            } else {
                setPositionUp(false);
            }
        }
    }, [isOpen, filtered.length, query]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (selectRef.current && !selectRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            requestAnimationFrame(() => searchRef.current?.focus());
        }
    }, [isOpen]);

    const selectedTitle = options.find(o => o.id === value)?.title || placeholder;

    const pick = (id: number | string | null) => {
        onChange(id);
        setIsOpen(false);
        setQuery('');
    };

    return (
        <div className="space-y-1.5 relative w-full" ref={selectRef}>
            {label && (
                <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider px-1 flex justify-between">
                    <span>{label}</span>
                    {value !== null && !disabled && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); onChange(null); }} className="text-red-500 hover:underline">Clear</button>
                    )}
                </label>
            )}
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-xl px-4 py-3 text-xs font-medium transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[#1a73e8]'}`}
            >
                <span className={`truncate pr-4 ${value === null ? 'text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>
                    {selectedTitle}
                </span>
                <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#1a73e8]' : ''}`} />
            </div>

            {isOpen && !disabled && (
                <div
                    ref={dropdownRef}
                    className={`absolute left-0 right-0 bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-xl shadow-xl z-[9999] animate-in fade-in zoom-in-95 duration-100 overflow-hidden
                    ${positionUp ? 'bottom-[calc(100%+4px)]' : 'top-[calc(100%+4px)]'}`}
                >
                    {searchable && (
                        <div className="p-2 border-b border-[#dadce0] dark:border-[#333537]">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868b] pointer-events-none" />
                                <input
                                    ref={searchRef}
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    autoComplete="off"
                                    onKeyDown={(e) => {
                                        e.stopPropagation();
                                        if (e.key === 'Escape') setIsOpen(false);
                                        if (e.key === 'Enter' && filtered[0]) pick(filtered[0].id);
                                    }}
                                    placeholder="Search options..."
                                    className="w-full bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:border-[#1a73e8]"
                                    dir="auto"
                                />
                            </div>
                        </div>
                    )}
                    <div className="max-h-60 overflow-y-auto custom-scrollbar py-1">
                        <div onClick={() => pick(null)} className="px-4 py-3 text-xs cursor-pointer text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
                            Clear selection
                        </div>
                        {filtered.map(opt => (
                            <div
                                key={opt.id}
                                onClick={() => pick(opt.id)}
                                className={`px-4 py-3 text-xs cursor-pointer hover:bg-[#f8f9fa] dark:hover:bg-[#2b2d2f] transition-colors ${
                                    value === opt.id ? 'bg-[#e8f0fe] text-[#1a73e8] font-bold dark:bg-[#1a73e8]/10' : 'text-gray-700 dark:text-gray-300'
                                }`}
                            >
                                {opt.title}
                            </div>
                        ))}
                        {filtered.length === 0 && (
                            <div className="px-4 py-3 text-xs text-gray-400 text-center">
                                {options.length === 0 ? 'No items available' : 'No matching options'}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};


// --- FILTER SWITCH COMPONENT ---
// Segmented pill switch used for the quick filters (Status / Images).
const FilterSwitch = ({ label, value, options, onChange, disabled = false }: {
    label: string;
    value: string | null;
    options: { id: string | null; title: string }[];
    onChange: (v: string | null) => void;
    disabled?: boolean;
}) => (
    <div className={`flex items-center gap-2.5 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <span className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider whitespace-nowrap">{label}</span>
        <div className="flex items-center bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-full p-1">
            {options.map(opt => (
                <button
                    key={String(opt.id)}
                    onClick={() => onChange(opt.id)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                        value === opt.id
                            ? 'bg-[#1a73e8] text-white shadow-sm'
                            : 'text-[#86868b] hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                >
                    {opt.title}
                </button>
            ))}
        </div>
    </div>
);


// --- TYPES ---
interface Option { id: number; text: string; is_correct: boolean; }
interface QuestionData {
    id: number; text: string; options: Option[]; correctOptionId: number | null;
    descriptiveAnswer: string; images: string[];
    subject: number | null; subject_title: string;
    grade: number | null; grade_title: string;
    chapter: number | null; chapter_title: string;
    mabhas: number | null; mabhas_title: string;
    level: string; status: string;
}


// --- MAIN COMPONENT ---
export default function EditQuestions() {
    const [question, setQuestion] = useState<QuestionData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Filters & Metadata Lists State
    const [filters, setFilters] = useState<{
        subject_id: number | null;
        grade_id: number | null;
        topic_id: number | null;
        chapter_id: number | null;
        status: string | null;
        has_image: string | null;
        search_text: string;
    }>({ subject_id: null, grade_id: null, topic_id: null, chapter_id: null, status: null, has_image: null, search_text: '' });
    const [lists, setLists] = useState<{ subjects: SelectOption[], grades: SelectOption[], chapters: SelectOption[], mabahes: SelectOption[] }>({ subjects: [], grades: [], chapters: [], mabahes: [] });

    // Navigation History
    const [history, setHistory] = useState<number[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // UI State
    const [isEditing, setIsEditing] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [searchId, setSearchId] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const BASE_URL = 'images/questions/';
    // --- STATIC OPTIONS ---
    const levelOptions = [
        { id: 'آسان', title: 'آسان' },
        { id: 'متوسط', title: 'متوسط' },
        { id: 'سخت', title: 'سخت' },
    ];
    const statusOptions = [
        { id: 'فعال', title: 'فعال' },
        { id: 'غیرفعال', title: 'غیرفعال' },
        { id: 'آرشیو', title: 'آرشیو' },
    ];
    const statusSwitchOptions = [
        { id: null, title: 'All' },
        { id: 'فعال', title: 'فعال' },
        { id: 'غیرفعال', title: 'غیرفعال' },
    ];
    const imageSwitchOptions = [
        { id: null, title: 'All' },
        { id: 'with', title: 'With Image' },
        { id: 'without', title: 'No Image' },
    ];

    // --- HELPER & LIFECYCLE HOOKS ---
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch(err => console.log(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`));
        } else {
            document.exitFullscreen();
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // --- FETCH LISTS (Cascading) ---
    const fetchSubjects = async () => {
        try {
            const res: any = await flowApi.dispatch('Admin_get_subjects');
            if (res.success) setLists(prev => ({ ...prev, subjects: res.data?.subjects || res.subjects || [] }));
        } catch (e) { console.error("Failed to fetch subjects", e); }
    };

    const fetchGradesAndChapters = async (subjId: any, gradeId: any = null) => {
        if (!subjId) {
            setLists(prev => ({ ...prev, grades: [], chapters: [] }));
            return;
        };
        try {
            const resGrades: any = await flowApi.dispatch('Admin_get_grades_by_subject', { subject_id: subjId });
            const resChapters: any = await flowApi.dispatch('Admin_get_chapters_by_subject', { subject_id: subjId, grade_id: gradeId });
            setLists(prev => ({
                ...prev,
                grades: resGrades.data?.grades || resGrades.grades || [],
                chapters: resChapters.data?.chapters || resChapters.chapters || []
            }));
        } catch (e) { console.error("Failed to fetch grades/chapters", e); }
    };

    const fetchMabahes = async (chapId: any) => {
        if (!chapId) {
            setLists(prev => ({ ...prev, mabahes: [] }));
            return;
        }
        try {
            const res: any = await flowApi.dispatch('Admin_get_mabahes_by_chapter', { topic_id: chapId });
            setLists(prev => ({ ...prev, mabahes: res.data?.mabahes || res.mabahes || [] }));
        } catch (e) { console.error("Failed to fetch mabahes", e); }
    };

    useEffect(() => { fetchSubjects(); }, []);
    useEffect(() => { fetchGradesAndChapters(filters.subject_id, filters.grade_id); }, [filters.subject_id, filters.grade_id]);
    useEffect(() => { fetchMabahes(filters.topic_id); }, [filters.topic_id]);

    // Fetch lists needed when editing a specific question's metadata
    useEffect(() => {
        if (isEditing && question?.subject) {
            fetchGradesAndChapters(question.subject, question.grade);
            if (question.chapter) fetchMabahes(question.chapter);
        }
    }, [isEditing, question?.subject, question?.grade, question?.chapter]);

    // --- STATE HANDLERS ---
    const handleFilterChange = (key: string, value: any) => {
        setFilters(prev => {
            const newFilters = { ...prev, [key]: value };
            if (key === 'subject_id') { newFilters.grade_id = null; newFilters.topic_id = null; newFilters.chapter_id = null; }
            if (key === 'grade_id') { newFilters.topic_id = null; newFilters.chapter_id = null; }
            if (key === 'topic_id') { newFilters.chapter_id = null; }
            return newFilters;
        });
    };

    const handleMetaChange = (field: string, value: any) => {
        if (!question) return;
        let updatedQuestion: Partial<QuestionData> = { ...question, [field]: value };
        if (field === 'subject') {
            updatedQuestion = { ...updatedQuestion, grade: null, grade_title: '----', chapter: null, chapter_title: '----', mabhas: null, mabhas_title: '----' };
        } else if (field === 'grade') {
            updatedQuestion = { ...updatedQuestion, chapter: null, chapter_title: '----', mabhas: null, mabhas_title: '----' };
        } else if (field === 'chapter') {
            updatedQuestion = { ...updatedQuestion, mabhas: null, mabhas_title: '----' };
        }
        setQuestion(updatedQuestion as QuestionData);
    };

    const mapQuestionData = (q: any): QuestionData => ({
        id: q.id,
        text: q.text || q.question_text || "",
        options: q.options || [],
        correctOptionId: q.options?.find((o: Option) => o.is_correct)?.id || null,
        descriptiveAnswer: q.descriptiveAnswer || "",
        images: q.images || [],
        subject: q.subject || q.subject_id || null,
        subject_title: q.subject_title || '----',
        grade: q.grade || q.grade_id || null,
        grade_title: q.grade_title || '----',
        chapter: q.chapter || q.topic_id || null, // UI "Chapter" is DB "topic_id"
        chapter_title: q.chapter_title || '----',
        mabhas: q.mabhas || q.chapter_id || null, // UI "Mabhas" is DB "chapter_id"
        mabhas_title: q.mabhas_title || '----',
        level: q.level || 'متوسط',
        status: q.status || 'غیرفعال'
    });

    // --- UNIFIED DATA FETCHING LOGIC ---
    const getQuestion = async (payload: {
        question_id?: number;
        direction?: 'next' | 'prev';
        current_id?: number;
        filters?: object;
        resetHistory?: boolean;
    }) => {
        setIsLoading(true);
        setErrorMessage(null);
        setIsEditing(false); // Always exit edit mode on new fetch

        try {
            const response: any = await flowApi.dispatch('Admin_get_question_for_edit', payload);
            const responseData = response.data || response;

            if (responseData.success && responseData.question) {
                const mappedQuestion = mapQuestionData(responseData.question);
                setQuestion(mappedQuestion);

                // --- History Management ---
                const newId = mappedQuestion.id;

                if (payload.resetHistory) {
                    setHistory([newId]);
                    setHistoryIndex(0);
                } else if (payload.direction === 'next' && historyIndex === history.length - 1) {
                    setHistory([...history, newId]);
                    setHistoryIndex(historyIndex + 1);
                } else if (payload.direction === 'prev' && historyIndex === 0) {
                    setHistory([newId, ...history]);
                } else if (payload.question_id && !history.includes(newId)) {
                    const newHistory = history.slice(0, historyIndex + 1);
                    newHistory.push(newId);
                    setHistory(newHistory);
                    setHistoryIndex(newHistory.length - 1);
                }

                return newId;
            } else {
                setQuestion(null);
                setErrorMessage(responseData.message || "No question found matching the criteria.");
                return null;
            }
        } catch (error) {
            console.error("Fetch question error:", error);
            setQuestion(null);
            setErrorMessage("An error occurred while communicating with the server.");
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    // --- INITIAL LOAD ---
    useEffect(() => {
        getQuestion({ resetHistory: true });
    }, []);

    // --- NAVIGATION & ACTION HANDLERS ---
    const handleNext = async () => {
        if (!question || isEditing) return;
        if (historyIndex < history.length - 1) {
            const nextId = history[historyIndex + 1];
            await getQuestion({ question_id: nextId });
            setHistoryIndex(historyIndex + 1);
        } else {
            await getQuestion({ direction: 'next', current_id: question.id, filters });
        }
    };

    const handlePrev = async () => {
        if (!question || isEditing) return;
        if (historyIndex > 0) {
            const prevId = history[historyIndex - 1];
            await getQuestion({ question_id: prevId });
            setHistoryIndex(historyIndex - 1);
        } else {
            await getQuestion({ direction: 'prev', current_id: question.id, filters });
        }
    };

    const handleSearch = async () => {
        const query = searchId.trim();
        if (!query || isEditing) return;

        let id: number | null;
        if (/^\d+$/.test(query)) {
            // Numeric input: direct lookup by question ID
            id = await getQuestion({ question_id: Number(query) });
        } else {
            // Text input: search within the question text (combined with active filters)
            const newFilters = { ...filters, search_text: query };
            setFilters(newFilters);
            id = await getQuestion({ filters: newFilters, resetHistory: true });
        }

        if (id) {
            setIsSearching(false);
            setSearchId('');
        }
    };

    const handleApplyFilters = () => {
        getQuestion({ filters: filters, resetHistory: true });
        setShowFilters(false);
    }

    // Quick filters (Status / Images switches) apply immediately
    const handleQuickFilterChange = (key: 'status' | 'has_image', value: string | null) => {
        const newFilters = { ...filters, [key]: value };
        setFilters(newFilters);
        getQuestion({ filters: newFilters, resetHistory: true });
    };

    // Text search applies on Enter or via the search button
    const handleTextSearchApply = () => {
        getQuestion({ filters: filters, resetHistory: true });
    };

    // --- UPDATE & SAVE HANDLERS ---
    const handleUpdate = (field: string, value: any) => { if (question) setQuestion({ ...question, [field]: value }); };

    const handleOptionUpdate = (id: number, textValue: string) => {
        if (!question) return;
        handleUpdate('options', question.options.map(o => o.id === id ? { ...o, text: textValue } : o));
    };

    const handleSave = async () => {
        if (!question) return;
        setIsSaving(true);
        setErrorMessage(null);
        try {
            const payload = {
                question_id: question.id,
                text: question.text,
                descriptiveAnswer: question.descriptiveAnswer,
                correct_option_id: question.correctOptionId,
                options: question.options.map(o => ({ id: o.id, text: o.text })),
                subject_id: question.subject,
                grade_id: question.grade,
                topic_id: question.chapter, // UI Chapter -> DB topic
                chapter_id: question.mabhas,  // UI Mabhas -> DB chapter
                level: question.level,
                status: question.status
            };
            const response: any = await flowApi.dispatch('Admin_full_update_question', payload);
            const responseData = response.data || response;

            if (responseData.success) {
                setIsEditing(false);
            } else {
                setErrorMessage(responseData.message || "Failed to update the question.");
            }
        } catch (error) {
            console.error("Save error:", error);
            setErrorMessage("An error occurred while saving the question.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div ref={containerRef} className={`flex flex-col gap-6 w-full ${isFullscreen ? 'p-4 md:p-8 bg-[#f8f9fa] dark:bg-[#131314] overflow-y-auto h-screen' : ''}`}>
            {/* TOP TOOLBAR */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-3 shadow-sm lg:sticky top-0 z-[40]">
                {/* Navigation & Search */}
                <div className="flex items-center gap-2 bg-[#f8f9fa] dark:bg-[#131314] rounded-xl px-2 py-1.5 border border-[#dadce0] dark:border-[#444746] flex-1 md:flex-none justify-between md:justify-start">
                    <button onClick={handlePrev} disabled={isLoading || isEditing || (historyIndex === 0 && history.length === 1)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-[#2d3748] rounded-lg transition-colors shrink-0 disabled:opacity-50">
                        <ChevronLeft size={18} />
                    </button>

                    <div className="flex-1 flex justify-center items-center min-w-[120px]">
                        {isSearching ? (
                            <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 w-full px-2">
                                <input autoFocus type="text" placeholder="ID or question text..." className="w-full bg-transparent outline-none text-xs font-bold text-center disabled:opacity-50" value={searchId} onChange={(e) => setSearchId(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} disabled={isEditing} />
                                <button onClick={() => setIsSearching(false)} className="shrink-0 hover:text-red-500 transition-colors"><X size={14} className="text-gray-400" /></button>
                            </div>
                        ) : (
                            <div onClick={() => !isEditing && setIsSearching(true)} className={`flex items-center gap-2 cursor-pointer group px-2 py-1 rounded-lg transition-all ${isEditing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-200 dark:hover:bg-[#2d3748]'}`}>
                                <Search size={14} className="text-gray-400 group-hover:text-[#1a73e8] transition-colors" />
                                <span className="text-xs font-semibold tracking-tighter truncate">ID: {question?.id || '---'}</span>
                            </div>
                        )}
                    </div>

                    <button onClick={handleNext} disabled={isLoading || isEditing} className="p-1.5 hover:bg-gray-200 dark:hover:bg-[#2d3748] rounded-lg transition-colors shrink-0 disabled:opacity-50">
                        <ChevronRight size={18} />
                    </button>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <button disabled={isEditing} onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-3 py-2.5 md:px-4 rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${showFilters ? 'bg-[#e8f0fe] text-[#1a73e8] dark:bg-[#1a73e8]/20' : 'bg-[#f8f9fa] dark:bg-[#131314] text-[#86868b] border border-[#dadce0] dark:border-[#444746] hover:text-gray-700 dark:hover:text-gray-200'}`}>
                                <Filter size={14} /> <span className="hidden sm:inline">Filters</span>
                            </button>

                            {showFilters && !isEditing && (
                                <div className="absolute top-[calc(100%+12px)] right-0 md:left-0 md:right-auto w-[280px] md:w-[320px] bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] p-6 shadow-2xl z-[100] animate-in slide-in-from-top-2">
                                    <div className="flex justify-between items-center mb-6">
                                        <span className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider">Search Filters</span>
                                        <button onClick={() => setShowFilters(false)} className="p-1.5 bg-gray-100 dark:bg-[#2d3748] rounded-full hover:text-red-500 transition-colors"><X size={14}/></button>
                                    </div>
                                    <div className="flex flex-col gap-4 mb-4">
                                        <CustomSelect label="Subject" value={filters.subject_id} options={lists.subjects} onChange={(v) => handleFilterChange('subject_id', v)} placeholder="Select Subject..." />
                                        <CustomSelect label="Grade" value={filters.grade_id} options={lists.grades} onChange={(v) => handleFilterChange('grade_id', v)} placeholder="Select Grade..." disabled={!filters.subject_id} />
                                        <CustomSelect label="Chapter (Topic)" value={filters.topic_id} options={lists.chapters} onChange={(v) => handleFilterChange('topic_id', v)} placeholder="Select Chapter..." disabled={!filters.subject_id} />
                                        <CustomSelect label="Mabhas (Chapter)" value={filters.chapter_id} options={lists.mabahes} onChange={(v) => handleFilterChange('chapter_id', v)} placeholder="Select Mabhas..." disabled={!filters.topic_id} />
                                    </div>
                                    <button onClick={handleApplyFilters} className="w-full bg-[#1a73e8] hover:bg-[#1557b0] text-white py-2.5 rounded-xl text-xs font-bold transition-all">
                                        Apply & Fetch
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="h-6 w-px bg-[#dadce0] dark:bg-[#444746]" />

                        <button onClick={() => setIsEditing(!isEditing)} disabled={!question} className={`flex items-center gap-2 px-3 py-2.5 md:px-4 rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${isEditing ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : 'text-[#86868b] hover:bg-gray-100 dark:hover:bg-[#2b2d2f]'}`}>
                            <Edit2 size={14} /> <span className="hidden sm:inline">{isEditing ? 'Editing Mode' : 'Read Mode'}</span>
                            <span className="sm:hidden">{isEditing ? 'Edit' : 'Read'}</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={toggleFullscreen} className="p-2.5 text-[#86868b] hover:bg-gray-100 dark:hover:bg-[#2b2d2f] rounded-xl transition-all">
                            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>

                        <button disabled={!isEditing || isSaving || !question} onClick={handleSave} className={`flex items-center gap-2 px-4 md:px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md ${isEditing ? 'bg-[#1a73e8] hover:bg-[#1557b0] text-white cursor-pointer' : 'bg-gray-100 dark:bg-[#2b2d2f] text-gray-400 dark:text-gray-500 cursor-not-allowed shadow-none border border-[#dadce0] dark:border-[#333537]'}`}>
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save Changes'}</span>
                            <span className="sm:hidden">Save</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* QUICK FILTERS BAR (Status / Images switches + text search) */}
            <div className={`flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl px-4 py-3 shadow-sm ${isEditing ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex flex-wrap items-center gap-4 md:gap-6">
                    <FilterSwitch
                        label="Status"
                        value={filters.status}
                        options={statusSwitchOptions}
                        onChange={(v) => handleQuickFilterChange('status', v)}
                        disabled={isLoading}
                    />
                    <FilterSwitch
                        label="Images"
                        value={filters.has_image}
                        options={imageSwitchOptions}
                        onChange={(v) => handleQuickFilterChange('has_image', v)}
                        disabled={isLoading}
                    />
                </div>

                <div className="flex items-center gap-2 flex-1 md:flex-none md:w-72 min-w-[200px]">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={filters.search_text}
                            onChange={(e) => handleFilterChange('search_text', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTextSearchApply()}
                            placeholder="Search in question text..."
                            className="w-full bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-xl pr-4 pl-9 py-2.5 text-xs font-medium outline-none focus:border-[#1a73e8] transition-all"
                            dir="auto"
                        />
                        {filters.search_text && (
                            <button
                                onClick={() => { const newFilters = { ...filters, search_text: '' }; setFilters(newFilters); getQuestion({ filters: newFilters, resetHistory: true }); }}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={handleTextSearchApply}
                        disabled={isLoading}
                        className="p-2.5 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-xl transition-all shadow-sm disabled:opacity-50 shrink-0"
                    >
                        <Search size={14} />
                    </button>
                </div>
            </div>

            {/* ERROR / MESSAGE DISPLAY */}
            {errorMessage && (
                <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-[1rem]">
                    <AlertCircle size={20} />
                    <span className="text-sm font-medium">{errorMessage}</span>
                    <button onClick={() => setErrorMessage(null)} className="ml-auto"><X size={16}/></button>
                </div>
            )}

            {/* MAIN CONTENT AREA */}
            <div className="flex flex-col gap-6 w-full relative z-10">
                {isLoading && (
                    <div className="absolute inset-0 bg-white/50 dark:bg-black/50 z-50 flex items-center justify-center rounded-[2rem]">
                        <Loader2 className="animate-spin w-8 h-8 text-[#1a73e8]" />
                    </div>
                )}

                {question && !isLoading && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                        {/* --- LEFT COLUMN --- */}
                        <div className="lg:col-span-2 flex flex-col gap-6">
                            {/* Question Text */}
                            <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-6">
                                <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider mb-3 block">Question Text</label>
                                {isEditing ? (
                                    <textarea value={question.text} onChange={(e) => handleUpdate('text', e.target.value)} className="w-full h-40 bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-xl p-4 text-sm font-medium leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[#1a73e8] custom-scrollbar" />
                                ) : (
                                    <div className="text-sm font-medium leading-relaxed">
                                        <MathRenderer text={question.text} subject={question.subject ?? undefined} />
                                    </div>
                                )}
                            </div>

                            {/* Options */}
                            <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-6">
                                <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider mb-3 block">Options</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {question.options.map((option) => (
                                        <div key={option.id} className="flex items-start gap-3">
                                            <button disabled={!isEditing} onClick={() => handleUpdate('correctOptionId', option.id)} className="mt-1 shrink-0 disabled:cursor-not-allowed">
                                                {question.correctOptionId === option.id ? <CheckCircle2 className="text-green-500" /> : <Circle className="text-gray-300 dark:text-gray-600" />}
                                            </button>
                                            <div className="w-full">
                                                {isEditing ? (
                                                    <textarea value={option.text} onChange={(e) => handleOptionUpdate(option.id, e.target.value)} className="w-full h-24 bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-xl p-3 text-xs font-medium resize-y focus:outline-none focus:ring-2 focus:ring-[#1a73e8] custom-scrollbar" />
                                                ) : (
                                                    <div className="text-xs font-medium p-3 rounded-xl bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] min-h-[4rem]">
                                                        <MathRenderer text={option.text} subject={question.subject ?? undefined} />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Descriptive Answer */}
                            <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-6">
                                <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider mb-3 block">Descriptive Answer</label>
                                {isEditing ? (
                                    <textarea value={question.descriptiveAnswer} onChange={(e) => handleUpdate('descriptiveAnswer', e.target.value)} className="w-full h-32 bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-xl p-4 text-sm font-medium leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[#1a73e8] custom-scrollbar" />
                                ) : (
                                    <div className="text-sm font-medium p-4 rounded-xl bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] min-h-[6rem]">
                                        <MathRenderer text={question.descriptiveAnswer} subject={question.subject ?? undefined} />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* --- RIGHT COLUMN --- */}
                        <div className="lg:col-span-1 flex flex-col gap-6 lg:sticky lg:top-28 self-start">
                            {/* Metadata Card */}
                            <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-6">
                                <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider mb-4 block">
                                    Question Metadata
                                </label>
                                {isEditing ? (
                                    <div className="flex flex-col gap-4">
                                        <CustomSelect label="Subject" value={question.subject} options={lists.subjects} onChange={(v) => handleMetaChange('subject', v)} placeholder="Select Subject..." />
                                        <CustomSelect label="Grade" value={question.grade} options={lists.grades} onChange={(v) => handleMetaChange('grade', v)} placeholder="Select Grade..." disabled={!question.subject} />
                                        <CustomSelect label="Chapter (Topic)" value={question.chapter} options={lists.chapters} onChange={(v) => handleMetaChange('chapter', v)} placeholder="Select Chapter..." disabled={!question.grade} />
                                        <CustomSelect label="Mabhas (Chapter)" value={question.mabhas} options={lists.mabahes} onChange={(v) => handleMetaChange('mabhas', v)} placeholder="Select Mabhas..." disabled={!question.chapter} />
                                        <CustomSelect label="Level" value={question.level} options={levelOptions} onChange={(v) => handleUpdate('level', v)} placeholder="Select Level..." />
                                        <CustomSelect label="Status" value={question.status} options={statusOptions} onChange={(v) => handleUpdate('status', v)} placeholder="Select Status..." />
                                    </div>
                                ) : (
                                    <div className="space-y-3 text-xs font-medium">
                                        {[
                                            { label: 'Subject', value: question.subject_title }, { label: 'Grade', value: question.grade_title },
                                            { label: 'Chapter', value: question.chapter_title }, { label: 'Mabhas', value: question.mabhas_title },
                                            { label: 'Level', value: question.level }, { label: 'Status', value: question.status }
                                        ].map(item => (
                                            <div key={item.label} className="flex justify-between items-center bg-[#f8f9fa] dark:bg-[#131314] p-3 rounded-lg">
                                                <span className="text-gray-500 dark:text-gray-400">{item.label}:</span>
                                                <span className="font-semibold text-gray-800 dark:text-gray-200">{item.value || '----'}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Images Card */}
                            {question.images && question.images.length > 0 && (
                                <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-6">
                                    <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider mb-4 block">
                                        Images
                                    </label>
                                    <div className="flex flex-col gap-4">
                                        {question.images.map((imgUrl, index) => (
                                            <a key={index} href={imgUrl} target="_blank" rel="noopener noreferrer">
                                                <img src={`${BASE_URL}${imgUrl}`} alt={`Question Image ${index + 1}`} className="rounded-lg border border-[#dadce0] dark:border-[#444746] w-full h-auto object-contain hover:opacity-80 transition-opacity" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}