import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, FileText, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage, metApi } from './api';
import type { MetReference } from './types';
import { GraySpinner, easeOut, faNum, glassClass } from './ui';

type Props = {
    open: boolean;
    onClose: () => void;
    references: MetReference[];
    onChange: (refs: MetReference[]) => void;
    conversationId: number | null;
    ensureConversation: () => Promise<number>;
    maxCount: number;
    maxMb: number;
};

/** Per-conversation PDF references (max N). Attached files are chunked server-side and cited in replies. */
export function ReferencesPopover({ open, onClose, references, onChange, conversationId, ensureConversation, maxCount, maxMb }: Props) {
    const [uploading, setUploading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const pollRef = useRef<number | null>(null);

    // Poll while any reference is still being processed.
    useEffect(() => {
        const processing = references.some((r) => r.status === 'processing');
        if (!processing || !conversationId) return;
        pollRef.current = window.setInterval(async () => {
            try {
                const fresh = await metApi.listReferences(conversationId);
                onChange(fresh);
            } catch {
                /* ignore */
            }
        }, 2500);
        return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
    }, [references, conversationId, onChange]);

    const add = async (file: File) => {
        if (references.length >= maxCount) return toast.error(`حداکثر ${faNum(maxCount)} منبع برای هر گفتگو`);
        if (file.size > maxMb * 1024 * 1024) return toast.error(`حجم PDF باید کمتر از ${faNum(maxMb)} مگابایت باشد`);
        setUploading(true);
        try {
            const id = conversationId || (await ensureConversation());
            const ref = await metApi.addReference(id, file);
            onChange([...references, ref]);
            toast.success('منبع اضافه شد؛ در حال پردازش…');
        } catch (err) {
            toast.error(errorMessage(err, 'آپلود منبع ناموفق بود'));
        } finally {
            setUploading(false);
        }
    };

    const remove = async (ref: MetReference) => {
        if (!conversationId) return;
        try {
            await metApi.removeReference(conversationId, ref.id);
            onChange(references.filter((r) => r.id !== ref.id));
        } catch (err) {
            toast.error(errorMessage(err, 'حذف منبع ناموفق بود'));
        }
    };

    return (
        <AnimatePresence>
            {open && (
                <>
                    <div className="fixed inset-0 z-30" onClick={onClose} />
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.98 }}
                        transition={{ duration: 0.18, ease: easeOut }}
                        className={`absolute bottom-full mb-3 right-0 z-40 w-[min(320px,calc(100vw-2rem))] p-3 rounded-[18px] ${glassClass}`}
                        dir="rtl"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-[12.5px] font-extrabold text-[var(--text-primary)]">منابع این گفتگو</div>
                            <span className="text-[10.5px] text-[var(--text-muted)] tabular-nums">
                                {faNum(references.length)} / {faNum(maxCount)}
                            </span>
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed m-0 mb-3">
                            جزوه یا کتاب PDF بده تا مِت از همان منبع پاسخ بدهد و به آن ارجاع کند.
                        </p>

                        <div className="space-y-1.5 max-h-52 overflow-y-auto chat-scrollbar">
                            {references.map((r) => (
                                <div key={r.id} className="flex items-center gap-2.5 p-2 rounded-[12px] bg-[color-mix(in_srgb,var(--text-primary)_3.5%,transparent)] border border-[var(--border)]/50">
                                    <span className="w-8 h-8 rounded-[10px] grid place-items-center bg-[var(--color-primary-500)]/12 text-[var(--color-primary-400)] shrink-0">
                                        {r.status === 'processing' ? <GraySpinner size={14} /> : r.status === 'error' ? <AlertCircle size={15} className="text-rose-400" /> : <FileText size={15} />}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[12px] font-bold text-[var(--text-primary)] truncate">{r.title}</div>
                                        <div className="text-[10px] text-[var(--text-muted)] truncate">
                                            {r.status === 'processing'
                                                ? 'در حال پردازش…'
                                                : r.status === 'error'
                                                  ? r.error || 'پردازش ناموفق'
                                                  : `${r.pages ? `${faNum(r.pages)} صفحه · ` : ''}${faNum(r.chunkCount)} بخش`}
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => remove(r)} className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10" aria-label="حذف منبع">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <input
                            ref={inputRef}
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) void add(f); e.target.value = ''; }}
                        />
                        <button
                            type="button"
                            disabled={uploading || references.length >= maxCount}
                            onClick={() => inputRef.current?.click()}
                            className="mt-2 w-full h-9 rounded-[12px] border border-dashed border-[var(--border-strong)] text-[12px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--color-primary-500)]/50 inline-flex items-center justify-center gap-1.5 disabled:opacity-40 transition-colors"
                        >
                            {uploading ? <GraySpinner size={14} /> : <Plus size={14} />}
                            افزودن PDF
                        </button>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

export default ReferencesPopover;
