import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Flag, Search } from 'lucide-react';
import { adminApi } from '../lib/adminApi';
import EditQuestions from './EditQuestions';

interface ReportRow {
    id: number;
    questionId: number;
    issue: string;
    reportText: string;
    questionSnippet: string;
    reporter: string;
    reporterName: string;
    status: string;
    date: number | null;
    note: string;
}

const STATUSES = [
    { id: 'all', title: 'All' },
    { id: 'pending', title: 'Pending' },
    { id: 'investigating', title: 'Investigating' },
    { id: 'resolved', title: 'Resolved' },
    { id: 'rejected', title: 'Rejected' },
];

const ISSUE_LABELS: Record<string, string> = {
    technical: 'Technical',
    appearance: 'Appearance',
    wrong_info: 'Wrong info',
    other: 'Other',
};

export default function ReportsManager() {
    const [reports, setReports] = useState<ReportRow[]>([]);
    const [status, setStatus] = useState('pending');
    const [query, setQuery] = useState('');
    const [appliedQuery, setAppliedQuery] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
    const [notes, setNotes] = useState<Record<number, string>>({});

    const load = async (nextPage = page, nextStatus = status, nextQuery = appliedQuery) => {
        setLoading(true);
        setError(null);
        try {
            const res = await adminApi.listReports({
                status: nextStatus,
                q: nextQuery,
                page: nextPage,
            });
            if (!res.success) throw new Error(res.message || 'Failed to load reports');
            const rows = (res.reports || []) as ReportRow[];
            setReports(rows);
            setTotal(Number(res.total) || 0);
            setNotes(Object.fromEntries(rows.map((row) => [row.id, row.note || ''])));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load reports');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load(1, 'pending', '');
        // Initial fetch only.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        if (!success) return;
        const timer = setTimeout(() => setSuccess(null), 3000);
        return () => clearTimeout(timer);
    }, [success]);

    const applySearch = () => {
        setPage(1);
        setAppliedQuery(query.trim());
        load(1, status, query.trim());
    };

    const changeStatusFilter = (next: string) => {
        setStatus(next);
        setPage(1);
        load(1, next, appliedQuery);
    };

    const update = async (report: ReportRow, patch: { status?: string; note?: string }) => {
        const res = await adminApi.updateReport(report.id, patch);
        if (!res.success) { setError(res.message || 'Failed to update report'); return; }
        setSuccess('Report updated');
        setReports((prev) => prev.map((row) => row.id === report.id ? { ...row, ...patch, note: patch.note ?? row.note } : row));
    };

    const pageSize = 20;
    const pages = Math.max(1, Math.ceil(total / pageSize));

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-4 shadow-sm">
                <div>
                    <h1 className="text-sm font-bold flex items-center gap-2"><Flag size={16} /> Reports</h1>
                    <p className="text-xs text-[#86868b] mt-0.5">Review question reports, leave a note, and edit the question that was reported.</p>
                </div>
                <button onClick={() => load()} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746]">
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-500/10 text-red-600 rounded-xl text-xs font-semibold">
                    <AlertCircle size={14} /> {error}
                </div>
            )}
            {success && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-500/10 text-green-600 rounded-xl text-xs font-semibold">
                    <CheckCircle2 size={14} /> {success}
                </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap items-center bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] rounded-full p-1">
                    {STATUSES.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => changeStatusFilter(item.id)}
                            className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${status === item.id ? 'bg-[#1a73e8] text-white' : 'text-[#86868b]'}`}
                        >
                            {item.title}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                        placeholder="Search report or question id"
                        className="admin-input"
                    />
                    <button onClick={applySearch} className="p-3 bg-[#1a73e8] text-white rounded-xl"><Search size={14} /></button>
                </div>
            </div>

            <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] overflow-hidden shadow-sm">
                {loading ? (
                    <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1a73e8]" /></div>
                ) : (
                    <div className="flex flex-col">
                        {reports.map((report) => (
                            <div key={report.id} className={`p-5 border-b border-[#dadce0] dark:border-[#333537] ${editingQuestionId === report.questionId ? 'bg-[#e8f0fe]/40 dark:bg-[#1a73e8]/5' : ''}`}>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-bold">
                                            #{report.id} · question {report.questionId} · {ISSUE_LABELS[report.issue] || report.issue}
                                        </p>
                                        <p className="text-[11px] text-[#86868b] mt-1">
                                            {report.reporterName} · {report.reporter} · {report.date ? new Date(report.date).toLocaleString() : '—'}
                                        </p>
                                        <p className="text-sm mt-2 whitespace-pre-wrap">{report.reportText}</p>
                                        {report.questionSnippet && (
                                            <p className="text-xs text-[#86868b] mt-2 line-clamp-2">{report.questionSnippet}</p>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-2 w-full sm:w-56">
                                        <select
                                            value={report.status}
                                            onChange={(e) => update(report, { status: e.target.value })}
                                            className="admin-input"
                                        >
                                            {STATUSES.filter((item) => item.id !== 'all').map((item) => (
                                                <option key={item.id} value={item.id}>{item.title}</option>
                                            ))}
                                        </select>
                                        <textarea
                                            value={notes[report.id] ?? ''}
                                            onChange={(e) => setNotes((prev) => ({ ...prev, [report.id]: e.target.value }))}
                                            placeholder="Admin note"
                                            className="admin-input min-h-16 resize-y"
                                        />
                                        <div className="flex gap-2">
                                            <button onClick={() => update(report, { note: notes[report.id] || '' })} className="flex-1 px-3 py-2 rounded-xl text-[11px] font-bold bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746]">
                                                Save note
                                            </button>
                                            <button
                                                onClick={() => setEditingQuestionId(report.questionId)}
                                                className="flex-1 px-3 py-2 rounded-xl text-[11px] font-bold bg-[#1a73e8] text-white"
                                            >
                                                Edit question
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {reports.length === 0 && <p className="p-8 text-center text-xs text-[#86868b]">No reports match this filter.</p>}
                    </div>
                )}
                <div className="flex items-center justify-between p-4 text-xs">
                    <span className="text-[#86868b]">{total} report{total === 1 ? '' : 's'}</span>
                    <div className="flex items-center gap-2">
                        <button
                            disabled={page <= 1 || loading}
                            onClick={() => { const next = page - 1; setPage(next); load(next); }}
                            className="px-3 py-1.5 rounded-lg border border-[#dadce0] dark:border-[#444746] disabled:opacity-40"
                        >
                            Previous
                        </button>
                        <span>{page} / {pages}</span>
                        <button
                            disabled={page >= pages || loading}
                            onClick={() => { const next = page + 1; setPage(next); load(next); }}
                            className="px-3 py-1.5 rounded-lg border border-[#dadce0] dark:border-[#444746] disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {editingQuestionId && (
                <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] p-4 shadow-sm">
                    <div className="flex items-center justify-between px-2 pb-2">
                        <h2 className="text-sm font-bold">Edit question {editingQuestionId}</h2>
                        <button onClick={() => setEditingQuestionId(null)} className="text-xs font-bold text-[#86868b]">Close</button>
                    </div>
                    <EditQuestions key={editingQuestionId} focusQuestionId={editingQuestionId} embedded startEditing />
                </div>
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
        </div>
    );
}
