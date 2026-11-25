import { useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw, AlertCircle, PenLine, FilePlus2 } from 'lucide-react';
import { adminApi } from '../lib/adminApi';

interface AdminWords {
    id: number;
    username: string;
    fullName?: string;
    role: string;
    status?: string;
    isSuper?: boolean;
    wordsInserted: number;
    wordsEdited: number;
    insertEvents: number;
    editEvents: number;
    questionsInserted: number;
    lastActivity?: string | null;
}

interface RecentEvent {
    id: number;
    username: string;
    fullName?: string;
    action: string;
    questionId: number | null;
    wordCount: number;
    source: string;
    createdAt?: string;
}

const fmt = (n: number) => Number(n || 0).toLocaleString();

export default function WordStats() {
    const [admins, setAdmins] = useState<AdminWords[]>([]);
    const [recent, setRecent] = useState<RecentEvent[]>([]);
    const [totals, setTotals] = useState({ wordsInserted: 0, wordsEdited: 0, questionsInserted: 0 });
    const [backfill, setBackfill] = useState<{ complete?: boolean; error?: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const retries = useRef(0);

    const load = async (silent = false) => {
        if (!silent) setLoading(true);
        setError(null);
        try {
            const res = await adminApi.wordStats();
            if (!res.success) throw new Error(res.message || 'Failed to load word activity');
            setAdmins(res.admins || []);
            setRecent(res.recent || []);
            setTotals(res.totals || { wordsInserted: 0, wordsEdited: 0, questionsInserted: 0 });
            setBackfill(res.backfill || { complete: true });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load word activity');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    useEffect(() => {
        if (!backfill || backfill.complete || backfill.error) return;
        if (retries.current >= 8) return;
        retries.current += 1;
        const timer = setTimeout(() => { load(true); }, 700);
        return () => clearTimeout(timer);
    }, [backfill]);

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-4 shadow-sm">
                <div>
                    <h1 className="text-sm font-bold">Word Activity</h1>
                    <p className="text-xs text-[#86868b] mt-0.5 max-w-2xl">
                        Words inserted come from questions each admin created. Words edited are the words added or removed each time question text, options, or the descriptive answer is saved.
                    </p>
                </div>
                <button onClick={() => { retries.current = 0; load(); }} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746]">
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>

            {backfill && !backfill.complete && !backfill.error && (
                <div className="flex items-center gap-2 p-3 bg-[#e8f0fe] dark:bg-[#1a73e8]/10 text-[#1a73e8] rounded-xl text-xs font-semibold">
                    <Loader2 size={14} className="animate-spin" /> Indexing questions that were created before this section existed.
                </div>
            )}
            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-500/10 text-red-600 rounded-xl text-xs font-semibold">
                    <AlertCircle size={14} /> {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-5">
                    <div className="flex items-center gap-2 text-[#86868b] text-[10px] font-bold uppercase tracking-wider"><FilePlus2 size={14} /> Words inserted</div>
                    <p className="text-2xl font-bold mt-2">{fmt(totals.wordsInserted)}</p>
                </div>
                <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-5">
                    <div className="flex items-center gap-2 text-[#86868b] text-[10px] font-bold uppercase tracking-wider"><PenLine size={14} /> Words edited</div>
                    <p className="text-2xl font-bold mt-2">{fmt(totals.wordsEdited)}</p>
                </div>
                <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl p-5">
                    <div className="text-[#86868b] text-[10px] font-bold uppercase tracking-wider">Questions created</div>
                    <p className="text-2xl font-bold mt-2">{fmt(totals.questionsInserted)}</p>
                </div>
            </div>

            <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] overflow-hidden shadow-sm">
                {loading ? (
                    <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1a73e8]" /></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-[#f8f9fa] dark:bg-[#131314] text-[#86868b] uppercase tracking-wider">
                                <tr>
                                    <th className="text-left p-4">Admin</th>
                                    <th className="text-left p-4">Role</th>
                                    <th className="text-right p-4">Questions</th>
                                    <th className="text-right p-4">Words inserted</th>
                                    <th className="text-right p-4">Words edited</th>
                                    <th className="text-right p-4">Edits</th>
                                    <th className="text-left p-4">Last activity</th>
                                </tr>
                            </thead>
                            <tbody>
                                {admins.map((admin) => (
                                    <tr key={admin.id} className="border-t border-[#dadce0] dark:border-[#333537]">
                                        <td className="p-4">
                                            <p className="font-semibold">{admin.fullName || admin.username}</p>
                                            <p className="text-[#86868b]">{admin.username}{admin.isSuper ? ' · main' : ''}{admin.status === 'disabled' ? ' · disabled' : ''}</p>
                                        </td>
                                        <td className="p-4">{admin.isSuper ? 'super' : admin.role}</td>
                                        <td className="p-4 text-right font-mono">{fmt(admin.questionsInserted)}</td>
                                        <td className="p-4 text-right font-mono">{fmt(admin.wordsInserted)}</td>
                                        <td className="p-4 text-right font-mono">{fmt(admin.wordsEdited)}</td>
                                        <td className="p-4 text-right font-mono">{fmt(admin.editEvents)}</td>
                                        <td className="p-4 text-[#86868b]">{admin.lastActivity ? new Date(admin.lastActivity).toLocaleString() : '—'}</td>
                                    </tr>
                                ))}
                                {admins.length === 0 && (
                                    <tr><td colSpan={7} className="p-8 text-center text-[#86868b]">No admins found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[2rem] p-6 shadow-sm">
                <h2 className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider mb-4">Recent changes</h2>
                {recent.length === 0 ? (
                    <p className="text-xs text-[#86868b]">No word activity yet.</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {recent.map((event) => (
                            <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#f8f9fa] dark:bg-[#131314] text-xs">
                                <span className="font-semibold">{event.fullName || event.username || `admin #${event.id}`}</span>
                                <span className="text-[#86868b]">
                                    {event.action === 'insert' ? 'inserted' : 'edited'} {fmt(event.wordCount)} words
                                    {event.questionId ? ` · question ${event.questionId}` : ''}
                                    {event.source === 'backfill' ? ' · indexed' : ''}
                                </span>
                                <span className="text-[#86868b]">{event.createdAt ? new Date(event.createdAt).toLocaleString() : ''}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
