import React, { useState, useEffect, useMemo } from 'react';
import {
    Plus, Edit2, Trash2, X, Loader2, AlertCircle, Search, RefreshCw,
    BookOpen, GraduationCap, Layers, ListTree, CheckCircle2
} from 'lucide-react';
import { flowApi } from '../lib/authApi';
import { CustomSelect, type SelectOption } from './EditQuestions';
import type { User } from './AuthView';

// --- TYPES ---
// UI naming reminder (same convention as EditQuestions):
//   UI "Chapter" -> topics_tam24   (parent: subject)
//   UI "Mabhas"  -> chapters_tam24 (parent: topic)
type CurriculumType = 'subject' | 'grade' | 'topic' | 'chapter';

interface CurriculumItem {
    id: number;
    title: string;
    icon?: string | null;
    subject_id?: number;
    topic_id?: number;
}

interface CurriculumData {
    subjects: CurriculumItem[];
    grades: CurriculumItem[];
    topics: CurriculumItem[];
    chapters: CurriculumItem[];
}

interface FormState {
    id: number | null;
    title: string;
    parent_id: number | null;
    icon: string;
}

const EMPTY_FORM: FormState = { id: null, title: '', parent_id: null, icon: '' };

const TYPE_CONFIG: Record<CurriculumType, { label: string; singular: string; icon: React.ElementType; parentLabel?: string }> = {
    subject: { label: 'Subjects', singular: 'Subject', icon: BookOpen },
    grade: { label: 'Grades', singular: 'Grade', icon: GraduationCap },
    topic: { label: 'Chapters (Topics)', singular: 'Chapter', icon: Layers, parentLabel: 'Subject' },
    chapter: { label: 'Mabahes', singular: 'Mabhas', icon: ListTree, parentLabel: 'Chapter (Topic)' },
};

interface CurriculumManagerProps {
    user: User;
}

export default function CurriculumManager({ user }: CurriculumManagerProps) {
    const canDelete = user.id === 1;

    const [data, setData] = useState<CurriculumData>({ subjects: [], grades: [], topics: [], chapters: [] });
    const [activeType, setActiveType] = useState<CurriculumType>('subject');
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal / form state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [isSaving, setIsSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    // --- DATA FETCHING ---
    const fetchCurriculum = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const response: any = await flowApi.dispatch('Admin_get_curriculum');
            const res = response.data || response;
            if (res.success) {
                setData({
                    subjects: res.subjects || [],
                    grades: res.grades || [],
                    topics: res.topics || [],
                    chapters: res.chapters || [],
                });
            } else {
                setErrorMessage(res.message || 'Failed to load curriculum data.');
            }
        } catch (error) {
            console.error('Fetch curriculum error:', error);
            setErrorMessage('An error occurred while communicating with the server.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchCurriculum(); }, []);

    // Auto-dismiss success messages
    useEffect(() => {
        if (!successMessage) return;
        const timer = setTimeout(() => setSuccessMessage(null), 3000);
        return () => clearTimeout(timer);
    }, [successMessage]);

    // --- DERIVED LISTS ---
    const itemsForType = (type: CurriculumType): CurriculumItem[] => {
        switch (type) {
            case 'subject': return data.subjects;
            case 'grade': return data.grades;
            case 'topic': return data.topics;
            case 'chapter': return data.chapters;
        }
    };

    const parentOptions: SelectOption[] = useMemo(() => {
        if (activeType === 'topic') {
            return data.subjects.map(s => ({ id: s.id, title: s.title }));
        }
        if (activeType === 'chapter') {
            // Show topics with their subject for clarity
            return data.topics.map(t => {
                const subject = data.subjects.find(s => s.id === t.subject_id);
                return { id: t.id, title: subject ? `${subject.title} — ${t.title}` : t.title };
            });
        }
        return [];
    }, [activeType, data]);

    const parentTitle = (item: CurriculumItem): string => {
        if (activeType === 'topic') {
            return data.subjects.find(s => s.id === item.subject_id)?.title || '----';
        }
        if (activeType === 'chapter') {
            const topic = data.topics.find(t => t.id === item.topic_id);
            if (!topic) return '----';
            const subject = data.subjects.find(s => s.id === topic.subject_id);
            return subject ? `${subject.title} — ${topic.title}` : topic.title;
        }
        return '';
    };

    const filteredItems = useMemo(() => {
        const items = itemsForType(activeType);
        const term = searchTerm.trim().toLowerCase();
        if (!term) return items;
        return items.filter(item =>
            item.title.toLowerCase().includes(term) ||
            String(item.id).includes(term) ||
            parentTitle(item).toLowerCase().includes(term)
        );
    }, [activeType, data, searchTerm]);

    const hasParent = activeType === 'topic' || activeType === 'chapter';
    const config = TYPE_CONFIG[activeType];

    // --- HANDLERS ---
    const openAddModal = () => {
        setForm(EMPTY_FORM);
        setIsModalOpen(true);
    };

    const openEditModal = (item: CurriculumItem) => {
        setForm({
            id: item.id,
            title: item.title,
            parent_id: activeType === 'topic' ? (item.subject_id ?? null) : activeType === 'chapter' ? (item.topic_id ?? null) : null,
            icon: item.icon || '',
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.title.trim()) { setErrorMessage('Title is required.'); return; }
        if (hasParent && !form.parent_id) { setErrorMessage(`Please select a ${config.parentLabel}.`); return; }

        setIsSaving(true);
        setErrorMessage(null);
        try {
            const payload: any = {
                type: activeType,
                title: form.title.trim(),
            };
            if (form.id) payload.id = form.id;
            if (hasParent) payload.parent_id = form.parent_id;
            if (activeType === 'subject') payload.icon = form.icon.trim() || null;

            const response: any = await flowApi.dispatch('Admin_save_curriculum_item', payload);
            const res = response.data || response;

            if (res.success) {
                setIsModalOpen(false);
                setSuccessMessage(form.id ? `${config.singular} updated successfully.` : `${config.singular} created successfully.`);
                await fetchCurriculum();
            } else {
                setErrorMessage(res.message || 'Failed to save the item.');
            }
        } catch (error) {
            console.error('Save curriculum item error:', error);
            setErrorMessage('An error occurred while saving.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (item: CurriculumItem) => {
        if (!canDelete) return;
        if (!window.confirm(`Delete "${item.title}" (ID: ${item.id})? This cannot be undone.`)) return;

        setDeletingId(item.id);
        setErrorMessage(null);
        try {
            const response: any = await flowApi.dispatch('Admin_delete_curriculum_item', { type: activeType, id: item.id });
            const res = response.data || response;

            if (res.success) {
                setSuccessMessage(`${config.singular} deleted successfully.`);
                await fetchCurriculum();
            } else {
                setErrorMessage(res.message || 'Failed to delete the item.');
            }
        } catch (error) {
            console.error('Delete curriculum item error:', error);
            setErrorMessage('An error occurred while deleting.');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full">
            {/* TOP TOOLBAR */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-3 shadow-sm sticky top-0 z-[40]">
                {/* Type Tabs */}
                <div className="flex items-center gap-1 bg-[#f8f9fa] dark:bg-[#131314] rounded-xl p-1 border border-[#dadce0] dark:border-[#444746] overflow-x-auto">
                    {(Object.keys(TYPE_CONFIG) as CurriculumType[]).map((type) => {
                        const { label, icon: Icon } = TYPE_CONFIG[type];
                        const isActive = activeType === type;
                        return (
                            <button
                                key={type}
                                onClick={() => { setActiveType(type); setSearchTerm(''); }}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                                    isActive
                                        ? 'bg-[#e8f0fe] text-[#1a73e8] dark:bg-[#1a73e8]/20 dark:text-[#8ab4f8]'
                                        : 'text-[#86868b] hover:text-gray-700 dark:hover:text-gray-200'
                                }`}
                            >
                                <Icon size={14} /> <span className="hidden sm:inline">{label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 flex-1 md:flex-none justify-end">
                    <div className="relative flex-1 md:flex-none md:w-56">
                        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={`Search ${config.label.toLowerCase()}...`}
                            className="w-full bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-xl pr-9 pl-4 py-2.5 text-xs font-medium outline-none focus:border-[#1a73e8] transition-all"
                            dir="auto"
                        />
                    </div>

                    <button onClick={fetchCurriculum} disabled={isLoading} className="p-2.5 text-[#86868b] hover:bg-gray-100 dark:hover:bg-[#2b2d2f] rounded-xl transition-all disabled:opacity-50">
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    </button>

                    <button onClick={openAddModal} className="flex items-center gap-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md">
                        <Plus size={16} /> <span className="hidden sm:inline">Add {config.singular}</span>
                        <span className="sm:hidden">Add</span>
                    </button>
                </div>
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

            {/* LIST */}
            <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl overflow-hidden relative min-h-[200px]">
                {isLoading && (
                    <div className="absolute inset-0 bg-white/50 dark:bg-black/50 z-50 flex items-center justify-center">
                        <Loader2 className="animate-spin w-8 h-8 text-[#1a73e8]" />
                    </div>
                )}

                {/* Table header */}
                <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-[#dadce0] dark:border-[#333537] text-[10px] font-bold text-[#86868b] uppercase tracking-wider">
                    <div className="col-span-1">ID</div>
                    <div className={hasParent ? 'col-span-4' : 'col-span-8'}>Title</div>
                    {hasParent && <div className="col-span-4">{config.parentLabel}</div>}
                    <div className="col-span-3 text-left">Actions</div>
                </div>

                {filteredItems.map((item) => (
                    <div key={item.id} className="grid grid-cols-12 gap-4 px-6 py-3.5 items-center border-b border-[#f1f3f4] dark:border-[#2b2d2f] last:border-0 hover:bg-[#f8f9fa] dark:hover:bg-[#131314]/60 transition-colors">
                        <div className="col-span-1 text-xs font-bold text-[#86868b]">#{item.id}</div>
                        <div className={`${hasParent ? 'col-span-4' : 'col-span-8'} text-xs font-semibold text-gray-800 dark:text-gray-200 truncate`} dir="auto">
                            {item.title}
                        </div>
                        {hasParent && (
                            <div className="col-span-4 text-xs font-medium text-gray-500 dark:text-gray-400 truncate" dir="auto">
                                {parentTitle(item)}
                            </div>
                        )}
                        <div className="col-span-3 flex items-center justify-start gap-2">
                            <button
                                onClick={() => openEditModal(item)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-[#1a73e8] bg-[#e8f0fe] dark:bg-[#1a73e8]/10 hover:bg-[#d2e3fc] dark:hover:bg-[#1a73e8]/20 transition-all"
                            >
                                <Edit2 size={12} /> Edit
                            </button>
                            {canDelete && (
                                <button
                                    onClick={() => handleDelete(item)}
                                    disabled={deletingId === item.id}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-red-600 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all disabled:opacity-50"
                                >
                                    {deletingId === item.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete
                                </button>
                            )}
                        </div>
                    </div>
                ))}

                {!isLoading && filteredItems.length === 0 && (
                    <div className="py-16 text-center text-xs font-medium text-gray-400">
                        No {config.label.toLowerCase()} found.
                    </div>
                )}
            </div>

            {/* ADD / EDIT MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isSaving && setIsModalOpen(false)} />
                    <div className="relative w-full max-w-md bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                {form.id ? `Edit ${config.singular} #${form.id}` : `Add New ${config.singular}`}
                            </span>
                            <button onClick={() => !isSaving && setIsModalOpen(false)} className="p-1.5 bg-gray-100 dark:bg-[#2d3748] rounded-full hover:text-red-500 transition-colors">
                                <X size={14} />
                            </button>
                        </div>

                        <div className="flex flex-col gap-4 mb-6">
                            {hasParent && (
                                <CustomSelect
                                    label={config.parentLabel}
                                    value={form.parent_id}
                                    options={parentOptions}
                                    onChange={(v) => setForm(prev => ({ ...prev, parent_id: v as number | null }))}
                                    placeholder={`Select ${config.parentLabel}...`}
                                />
                            )}

                            <div className="space-y-1.5 w-full">
                                <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider px-1">Title</label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                    placeholder={`${config.singular} title...`}
                                    autoFocus
                                    className="w-full bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-xl px-4 py-3 text-xs font-medium outline-none focus:border-[#1a73e8] transition-all"
                                    dir="auto"
                                />
                            </div>

                            {activeType === 'subject' && (
                                <div className="space-y-1.5 w-full">
                                    <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider px-1">Icon (optional)</label>
                                    <input
                                        type="text"
                                        value={form.icon}
                                        onChange={(e) => setForm(prev => ({ ...prev, icon: e.target.value }))}
                                        placeholder="Icon name or URL..."
                                        className="w-full bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-xl px-4 py-3 text-xs font-medium outline-none focus:border-[#1a73e8] transition-all"
                                        dir="ltr"
                                    />
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-full flex items-center justify-center gap-2 bg-[#1a73e8] hover:bg-[#1557b0] disabled:bg-[#1a73e8]/70 text-white py-3 rounded-xl text-xs font-bold transition-all shadow-md"
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                            {isSaving ? 'Saving...' : form.id ? 'Save Changes' : `Create ${config.singular}`}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}