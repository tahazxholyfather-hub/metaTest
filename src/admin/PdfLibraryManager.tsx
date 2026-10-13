import React, { useState, useEffect, useRef } from 'react';
import {
    Plus, Edit2, Trash2, X, Loader2, AlertCircle, Search, RefreshCw,
    FileText, Upload, Download, CheckCircle2, Eye, EyeOff
} from 'lucide-react';
import { flowApi } from '../lib/authApi';
import { CustomSelect } from './EditQuestions';
import type { User } from './AuthView';

// --- TYPES ---
interface PdfItem {
    id: number;
    title: string;
    description: string | null;
    category: 'pamphlet' | 'exam' | 'guide';
    category_label: string;
    subject: string;
    grade: string;
    file_size: string;
    pages: number;
    download_url: string;
    uploaded_at: string;
    is_active: number;
    download_count: number;
}

interface PdfFormState {
    id: number | null;
    title: string;
    description: string;
    category: 'pamphlet' | 'exam' | 'guide';
    category_label: string;
    subject: string;
    grade: string;
    pages: string;
    is_active: boolean;
    file_data: string | null;
    file_name: string | null;
}

const EMPTY_FORM: PdfFormState = {
    id: null, title: '', description: '', category: 'pamphlet', category_label: 'جزوه',
    subject: '', grade: '', pages: '', is_active: true, file_data: null, file_name: null,
};

const CATEGORY_OPTIONS = [
    { id: 'pamphlet', title: 'جزوه (Pamphlet)' },
    { id: 'exam', title: 'نمونه سوال (Exam)' },
    { id: 'guide', title: 'راهنما (Guide)' },
];

const CATEGORY_DEFAULT_LABELS: Record<string, string> = {
    pamphlet: 'جزوه',
    exam: 'نمونه سوال',
    guide: 'راهنما',
};

const MAX_FILE_SIZE_MB = 30;

interface PdfLibraryManagerProps {
    user: User;
}

export default function PdfLibraryManager({ user }: PdfLibraryManagerProps) {
    const canDelete = user.id === 1;

    const [pdfs, setPdfs] = useState<PdfItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

    // Modal / form state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState<PdfFormState>(EMPTY_FORM);
    const [isSaving, setIsSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- DATA FETCHING ---
    const fetchPdfs = async (search = searchTerm, category = categoryFilter) => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const response: any = await flowApi.dispatch('Admin_get_pdfs', {
                search: search.trim() || undefined,
                category: category || undefined,
            });
            const res = response.data || response;
            if (res.success) {
                setPdfs(res.pdfs || []);
            } else {
                setErrorMessage(res.message || 'Failed to load the PDF library.');
            }
        } catch (error) {
            console.error('Fetch PDFs error:', error);
            setErrorMessage('An error occurred while communicating with the server.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchPdfs(); }, []);

    // Refetch when the category filter changes
    useEffect(() => { fetchPdfs(searchTerm, categoryFilter); }, [categoryFilter]);

    // Auto-dismiss success messages
    useEffect(() => {
        if (!successMessage) return;
        const timer = setTimeout(() => setSuccessMessage(null), 3000);
        return () => clearTimeout(timer);
    }, [successMessage]);

    // --- HANDLERS ---
    const openAddModal = () => {
        setForm(EMPTY_FORM);
        setIsModalOpen(true);
    };

    const openEditModal = (pdf: PdfItem) => {
        setForm({
            id: pdf.id,
            title: pdf.title,
            description: pdf.description || '',
            category: pdf.category,
            category_label: pdf.category_label,
            subject: pdf.subject,
            grade: pdf.grade,
            pages: String(pdf.pages || ''),
            is_active: pdf.is_active === 1,
            file_data: null,
            file_name: null,
        });
        setIsModalOpen(true);
    };

    const handleCategoryChange = (value: string | number | null) => {
        const category = (value || 'pamphlet') as PdfFormState['category'];
        setForm(prev => ({
            ...prev,
            category,
            // Only auto-fill the label if it's still a default one
            category_label: Object.values(CATEGORY_DEFAULT_LABELS).includes(prev.category_label) || !prev.category_label
                ? CATEGORY_DEFAULT_LABELS[category]
                : prev.category_label,
        }));
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            setErrorMessage('Only PDF files are allowed.');
            e.target.value = '';
            return;
        }
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            setErrorMessage(`File is too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.`);
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setForm(prev => ({ ...prev, file_data: reader.result as string, file_name: file.name }));
        };
        reader.onerror = () => setErrorMessage('Failed to read the selected file.');
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (!form.title.trim()) { setErrorMessage('Title is required.'); return; }
        if (!form.subject.trim()) { setErrorMessage('Subject is required.'); return; }
        if (!form.grade.trim()) { setErrorMessage('Grade is required.'); return; }
        if (!form.id && !form.file_data) { setErrorMessage('Please select a PDF file to upload.'); return; }

        setIsSaving(true);
        setErrorMessage(null);
        try {
            const payload: any = {
                title: form.title.trim(),
                description: form.description.trim() || null,
                category: form.category,
                category_label: form.category_label.trim() || CATEGORY_DEFAULT_LABELS[form.category],
                subject: form.subject.trim(),
                grade: form.grade.trim(),
                pages: parseInt(form.pages, 10) || 0,
                is_active: form.is_active,
            };
            if (form.id) payload.id = form.id;
            if (form.file_data) {
                payload.file_data = form.file_data;
                payload.file_name = form.file_name;
            }

            const response: any = await flowApi.dispatch('Admin_save_pdf', payload);
            const res = response.data || response;

            if (res.success) {
                setIsModalOpen(false);
                setSuccessMessage(form.id ? 'PDF updated successfully.' : 'PDF uploaded successfully.');
                await fetchPdfs();
            } else {
                setErrorMessage(res.message || 'Failed to save the PDF.');
            }
        } catch (error) {
            console.error('Save PDF error:', error);
            setErrorMessage('An error occurred while saving. Large files may exceed the server limit.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (pdf: PdfItem) => {
        if (!canDelete) return;
        if (!window.confirm(`Delete "${pdf.title}" (ID: ${pdf.id})? This cannot be undone.`)) return;

        setDeletingId(pdf.id);
        setErrorMessage(null);
        try {
            const response: any = await flowApi.dispatch('Admin_delete_pdf', { pdf_id: pdf.id });
            const res = response.data || response;

            if (res.success) {
                setSuccessMessage('PDF deleted successfully.');
                await fetchPdfs();
            } else {
                setErrorMessage(res.message || 'Failed to delete the PDF.');
            }
        } catch (error) {
            console.error('Delete PDF error:', error);
            setErrorMessage('An error occurred while deleting.');
        } finally {
            setDeletingId(null);
        }
    };

    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString('fa-IR');
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full">
            {/* TOP TOOLBAR */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-3 shadow-sm sticky top-0 z-[40]">
                <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                    <div className="relative flex-1 max-w-xs">
                        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && fetchPdfs()}
                            placeholder="Search title, subject, grade..."
                            className="w-full bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-xl pr-9 pl-4 py-2.5 text-xs font-medium outline-none focus:border-[#1a73e8] transition-all"
                            dir="auto"
                        />
                    </div>
                    <div className="w-44">
                        <CustomSelect
                            value={categoryFilter}
                            options={CATEGORY_OPTIONS}
                            onChange={(v) => setCategoryFilter(v as string | null)}
                            placeholder="All Categories"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={() => fetchPdfs()} disabled={isLoading} className="p-2.5 text-[#86868b] hover:bg-gray-100 dark:hover:bg-[#2b2d2f] rounded-xl transition-all disabled:opacity-50">
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={openAddModal} className="flex items-center gap-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md">
                        <Plus size={16} /> <span className="hidden sm:inline">Add PDF</span>
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

            {/* PDF GRID */}
            <div className="relative min-h-[200px]">
                {isLoading && (
                    <div className="absolute inset-0 bg-white/50 dark:bg-black/50 z-50 flex items-center justify-center rounded-[2rem]">
                        <Loader2 className="animate-spin w-8 h-8 text-[#1a73e8]" />
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {pdfs.map((pdf) => (
                        <div key={pdf.id} className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
                            {/* Card header */}
                            <div className="flex items-start justify-between gap-3">
                                <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-500 shrink-0">
                                    <FileText size={20} />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-[#e8f0fe] text-[#1a73e8] dark:bg-[#1a73e8]/10">
                                        {pdf.category_label}
                                    </span>
                                    <span className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg ${
                                        pdf.is_active === 1
                                            ? 'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400'
                                            : 'bg-gray-100 text-gray-500 dark:bg-gray-500/10 dark:text-gray-400'
                                    }`}>
                                        {pdf.is_active === 1 ? <Eye size={10} /> : <EyeOff size={10} />}
                                        {pdf.is_active === 1 ? 'Active' : 'Hidden'}
                                    </span>
                                </div>
                            </div>

                            {/* Title & description */}
                            <div className="flex-1">
                                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-1" dir="auto">{pdf.title}</h3>
                                {pdf.description && (
                                    <p className="text-xs text-[#86868b] line-clamp-2" dir="auto">{pdf.description}</p>
                                )}
                            </div>

                            {/* Meta */}
                            <div className="grid grid-cols-2 gap-2 text-[11px] font-medium">
                                <div className="flex justify-between bg-[#f8f9fa] dark:bg-[#131314] px-3 py-2 rounded-lg">
                                    <span className="text-gray-400">Subject</span>
                                    <span className="text-gray-700 dark:text-gray-300 truncate mr-2" dir="auto">{pdf.subject}</span>
                                </div>
                                <div className="flex justify-between bg-[#f8f9fa] dark:bg-[#131314] px-3 py-2 rounded-lg">
                                    <span className="text-gray-400">Grade</span>
                                    <span className="text-gray-700 dark:text-gray-300 truncate mr-2" dir="auto">{pdf.grade}</span>
                                </div>
                                <div className="flex justify-between bg-[#f8f9fa] dark:bg-[#131314] px-3 py-2 rounded-lg">
                                    <span className="text-gray-400">Size</span>
                                    <span className="text-gray-700 dark:text-gray-300">{pdf.file_size}</span>
                                </div>
                                <div className="flex justify-between bg-[#f8f9fa] dark:bg-[#131314] px-3 py-2 rounded-lg">
                                    <span className="text-gray-400">Pages</span>
                                    <span className="text-gray-700 dark:text-gray-300">{pdf.pages}</span>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between pt-1 border-t border-[#f1f3f4] dark:border-[#2b2d2f]">
                                <div className="flex items-center gap-3 text-[10px] font-bold text-[#86868b] pt-3">
                                    <span className="flex items-center gap-1"><Download size={11} /> {pdf.download_count}</span>
                                    <span>{formatDate(pdf.uploaded_at)}</span>
                                </div>
                                <div className="flex items-center gap-2 pt-3">
                                    <a
                                        href={pdf.download_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 rounded-lg text-[#86868b] hover:bg-gray-100 dark:hover:bg-[#2b2d2f] transition-all"
                                        title="Open PDF"
                                    >
                                        <Download size={14} />
                                    </a>
                                    <button
                                        onClick={() => openEditModal(pdf)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-[#1a73e8] bg-[#e8f0fe] dark:bg-[#1a73e8]/10 hover:bg-[#d2e3fc] dark:hover:bg-[#1a73e8]/20 transition-all"
                                    >
                                        <Edit2 size={12} /> Edit
                                    </button>
                                    {canDelete && (
                                        <button
                                            onClick={() => handleDelete(pdf)}
                                            disabled={deletingId === pdf.id}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-red-600 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all disabled:opacity-50"
                                        >
                                            {deletingId === pdf.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {!isLoading && pdfs.length === 0 && (
                    <div className="py-16 text-center text-xs font-medium text-gray-400 bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl">
                        No PDFs found in the library.
                    </div>
                )}
            </div>

            {/* ADD / EDIT MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isSaving && setIsModalOpen(false)} />
                    <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                {form.id ? `Edit PDF #${form.id}` : 'Add New PDF'}
                            </span>
                            <button onClick={() => !isSaving && setIsModalOpen(false)} className="p-1.5 bg-gray-100 dark:bg-[#2d3748] rounded-full hover:text-red-500 transition-colors">
                                <X size={14} />
                            </button>
                        </div>

                        <div className="flex flex-col gap-4 mb-6">
                            {/* Title */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider px-1">Title *</label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="PDF title..."
                                    autoFocus
                                    className="w-full bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-xl px-4 py-3 text-xs font-medium outline-none focus:border-[#1a73e8] transition-all"
                                    dir="auto"
                                />
                            </div>

                            {/* Description */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider px-1">Description</label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Short description..."
                                    className="w-full h-20 bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-xl px-4 py-3 text-xs font-medium resize-y outline-none focus:border-[#1a73e8] transition-all custom-scrollbar"
                                    dir="auto"
                                />
                            </div>

                            {/* Category + Label */}
                            <div className="grid grid-cols-2 gap-4">
                                <CustomSelect
                                    label="Category *"
                                    value={form.category}
                                    options={CATEGORY_OPTIONS}
                                    onChange={handleCategoryChange}
                                    placeholder="Select Category..."
                                />
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider px-1">Category Label</label>
                                    <input
                                        type="text"
                                        value={form.category_label}
                                        onChange={(e) => setForm(prev => ({ ...prev, category_label: e.target.value }))}
                                        placeholder="جزوه"
                                        className="w-full bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-xl px-4 py-3 text-xs font-medium outline-none focus:border-[#1a73e8] transition-all"
                                        dir="auto"
                                    />
                                </div>
                            </div>

                            {/* Subject + Grade */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider px-1">Subject *</label>
                                    <input
                                        type="text"
                                        value={form.subject}
                                        onChange={(e) => setForm(prev => ({ ...prev, subject: e.target.value }))}
                                        placeholder="e.g. ریاضی"
                                        className="w-full bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-xl px-4 py-3 text-xs font-medium outline-none focus:border-[#1a73e8] transition-all"
                                        dir="auto"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider px-1">Grade *</label>
                                    <input
                                        type="text"
                                        value={form.grade}
                                        onChange={(e) => setForm(prev => ({ ...prev, grade: e.target.value }))}
                                        placeholder="e.g. دهم"
                                        className="w-full bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-xl px-4 py-3 text-xs font-medium outline-none focus:border-[#1a73e8] transition-all"
                                        dir="auto"
                                    />
                                </div>
                            </div>

                            {/* Pages + Active */}
                            <div className="grid grid-cols-2 gap-4 items-end">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider px-1">Pages</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={form.pages}
                                        onChange={(e) => setForm(prev => ({ ...prev, pages: e.target.value }))}
                                        placeholder="0"
                                        className="w-full bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-xl px-4 py-3 text-xs font-medium outline-none focus:border-[#1a73e8] transition-all"
                                    />
                                </div>
                                <button
                                    onClick={() => setForm(prev => ({ ...prev, is_active: !prev.is_active }))}
                                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold transition-all border ${
                                        form.is_active
                                            ? 'bg-green-50 text-green-600 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20'
                                            : 'bg-gray-100 text-gray-500 border-[#dadce0] dark:bg-[#131314] dark:text-gray-400 dark:border-[#444746]'
                                    }`}
                                >
                                    {form.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                                    {form.is_active ? 'Active (Visible)' : 'Inactive (Hidden)'}
                                </button>
                            </div>

                            {/* File upload */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider px-1">
                                    PDF File {form.id ? '(leave empty to keep the current file)' : '*'}
                                </label>
                                <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" onChange={handleFileSelect} className="hidden" />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-[#dadce0] dark:border-[#444746] hover:border-[#1a73e8] rounded-xl px-4 py-5 text-xs font-bold text-[#86868b] hover:text-[#1a73e8] transition-all"
                                >
                                    <Upload size={16} />
                                    {form.file_name ? form.file_name : `Click to select a PDF file (max ${MAX_FILE_SIZE_MB} MB)`}
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-full flex items-center justify-center gap-2 bg-[#1a73e8] hover:bg-[#1557b0] disabled:bg-[#1a73e8]/70 text-white py-3 rounded-xl text-xs font-bold transition-all shadow-md"
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : form.id ? <Edit2 size={16} /> : <Upload size={16} />}
                            {isSaving ? 'Saving...' : form.id ? 'Save Changes' : 'Upload PDF'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}