import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Check, FileText, ImagePlus, Mic, Square, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { errorCode, errorMessage, metApi } from './api';
import type { MetFeatures, MetReference, SubjectKey } from './types';
import type { PendingAttachment, SendInput } from './useMetChat';
import { useRecorder } from './useRecorder';
import { GraySpinner, IconButton, easeOut, faNum, useIsMobile } from './ui';
import { ReferencesPopover } from './References';

export interface ComposerHandle {
    focus: () => void;
    setText: (t: string) => void;
    insertText: (t: string) => void;
}

type Props = {
    features: MetFeatures;
    subjectKey: SubjectKey;
    conversationId: number | null;
    references: MetReference[];
    onReferencesChange: (refs: MetReference[]) => void;
    /** Creates the conversation row when a PDF is attached before the first turn. */
    ensureConversation: () => Promise<number>;
    busy: boolean;
    disabled?: boolean;
    disabledReason?: string;
    onSend: (input: SendInput) => void;
    onStop: () => void;
    onListening: (level: number | null) => void;
    onLowCoins?: () => void;
    ref?: React.Ref<ComposerHandle>;
    className?: string;
};

type Upload = PendingAttachment & { uploading?: boolean; localUrl?: string };

export function Composer({
    features,
    subjectKey,
    conversationId,
    references,
    onReferencesChange,
    ensureConversation,
    busy,
    disabled = false,
    disabledReason,
    onSend,
    onStop,
    onListening,
    onLowCoins,
    ref,
    className = '',
}: Props) {
    const isMobile = useIsMobile();
    const [text, setText] = useState('');
    const [uploads, setUploads] = useState<Upload[]>([]);
    const [transcribing, setTranscribing] = useState(false);
    const [refsOpen, setRefsOpen] = useState(false);
    const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const recorder = useRecorder(120);

    const maxChars = features.limits?.maxMessageChars || 4000;
    const maxAttachments = features.limits?.maxAttachmentsPerMessage || 3;
    const canSend = !disabled && !busy && !transcribing && (text.trim().length > 0 || uploads.some((u) => !u.uploading));
    const nearLimit = text.length > maxChars * 0.85;

    const resize = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = '0px';
        el.style.height = `${Math.min(el.scrollHeight, isMobile ? 140 : 220)}px`;
    }, [isMobile]);

    useEffect(resize, [text, resize]);

    useImperativeHandle(ref, () => ({
        focus: () => textareaRef.current?.focus(),
        setText: (t) => { setText(t); requestAnimationFrame(() => textareaRef.current?.focus()); },
        insertText: (t) => setText((prev) => (prev ? `${prev.replace(/\s+$/, '')} ${t}` : t)),
    }));

    useEffect(() => {
        onListening(recorder.state === 'recording' ? recorder.level : null);
    }, [recorder.state, recorder.level, onListening]);

    /* ── Send ───────────────────────────────────────────────────────────── */
    const submit = () => {
        if (!canSend) return;
        const ready = uploads.filter((u) => !u.uploading);
        onSend({ text, attachments: ready, inputMode });
        setText('');
        setUploads((prev) => { prev.forEach((u) => u.localUrl && URL.revokeObjectURL(u.localUrl)); return []; });
        setInputMode('text');
        requestAnimationFrame(() => textareaRef.current?.focus());
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !isMobile && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
        }
    };

    /* ── Images ─────────────────────────────────────────────────────────── */
    const addImages = async (files: FileList | File[]) => {
        const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
        if (!list.length) return;
        const room = maxAttachments - uploads.length;
        if (room <= 0) return toast.error(`حداکثر ${faNum(maxAttachments)} تصویر در هر پیام`);
        const maxBytes = (features.limits?.maxImageMb || 8) * 1024 * 1024;
        for (const file of list.slice(0, room)) {
            if (file.size > maxBytes) { toast.error(`حجم «${file.name}» بیش از ${faNum(features.limits?.maxImageMb || 8)} مگابایت است`); continue; }
            const localUrl = URL.createObjectURL(file);
            const key = -Date.now() - Math.random();
            setUploads((prev) => [...prev, { fileId: key, type: 'image', url: localUrl, localUrl, uploading: true }]);
            try {
                const up = await metApi.uploadImage(file, conversationId);
                setUploads((prev) => prev.map((u) => (u.fileId === key ? { ...u, fileId: up.fileId, url: up.url, mimeType: up.mimeType, uploading: false } : u)));
            } catch (err) {
                setUploads((prev) => prev.filter((u) => u.fileId !== key));
                URL.revokeObjectURL(localUrl);
                toast.error(errorMessage(err, 'آپلود تصویر ناموفق بود'));
            }
        }
    };

    const removeUpload = (fileId: number) =>
        setUploads((prev) => {
            const target = prev.find((u) => u.fileId === fileId);
            if (target?.localUrl) URL.revokeObjectURL(target.localUrl);
            return prev.filter((u) => u.fileId !== fileId);
        });

    const onPaste = (e: React.ClipboardEvent) => {
        if (!features.vision) return;
        const files = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith('image/'));
        if (files.length) { e.preventDefault(); void addImages(files); }
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (!features.vision || disabled) return;
        if (e.dataTransfer?.files?.length) void addImages(e.dataTransfer.files);
    };

    /* ── Voice ──────────────────────────────────────────────────────────── */
    const startRecording = async () => {
        try {
            await recorder.start();
        } catch {
            toast.error('دسترسی به میکروفون داده نشد');
        }
    };

    const finishRecording = async () => {
        const rec = await recorder.stop();
        if (!rec) return;
        if (rec.durationSeconds < 0.6) return toast.message('ضبط خیلی کوتاه بود');
        setTranscribing(true);
        try {
            const result = await metApi.transcribe(rec.blob, { durationSeconds: rec.durationSeconds, conversationId, mimeType: rec.mimeType });
            setText((prev) => (prev ? `${prev.replace(/\s+$/, '')} ${result.text}` : result.text));
            setInputMode('voice');
            requestAnimationFrame(() => textareaRef.current?.focus());
        } catch (err) {
            if (errorCode(err) === 'INSUFFICIENT_COINS') onLowCoins?.();
            toast.error(errorMessage(err, 'تبدیل صدا ناموفق بود'));
        } finally {
            setTranscribing(false);
        }
    };

    const recording = recorder.state === 'recording' || recorder.state === 'requesting';
    const showMic = features.stt && recorder.supported;
    const showImage = features.vision;
    const showPdf = features.pdfReferences;
    const placeholder = disabled ? disabledReason || 'مِت فعلاً در دسترس نیست' : busy ? 'مِت در حال پاسخ دادن است…' : 'از مِت بپرس…';

    return (
        <div className={`relative ${className}`} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
            <div
                className={`ai-composer-shell rounded-[24px] border transition-colors duration-200 bg-[color-mix(in_srgb,var(--bg-card)_88%,transparent)] ${
                    disabled ? 'border-[var(--border)]/50 opacity-70' : 'border-[var(--border)]/80 focus-within:border-[color-mix(in_srgb,var(--color-primary-500)_45%,var(--border))] focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-primary-500)_10%,transparent)]'
                }`}
            >
                {/* Attachment previews */}
                <AnimatePresence initial={false}>
                    {uploads.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex flex-wrap gap-2 px-3 pt-3"
                        >
                            {uploads.map((u) => (
                                <div key={u.fileId} className="relative w-16 h-16 rounded-[12px] overflow-hidden border border-[var(--border)]/70 bg-[var(--bg-app)]">
                                    <img src={u.url} alt="" className="w-full h-full object-cover" />
                                    {u.uploading && (
                                        <div className="absolute inset-0 grid place-items-center bg-black/40">
                                            <GraySpinner size={16} className="!border-white/40 !border-t-white" />
                                        </div>
                                    )}
                                    {!u.uploading && (
                                        <button
                                            type="button"
                                            onClick={() => removeUpload(u.fileId)}
                                            className="absolute top-1 left-1 w-5 h-5 grid place-items-center rounded-full bg-black/60 text-white"
                                            aria-label="حذف تصویر"
                                        >
                                            <X size={11} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Recording strip */}
                <AnimatePresence initial={false}>
                    {recording && (
                        <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            transition={{ duration: 0.18, ease: easeOut }}
                            className="flex items-center gap-3 px-3 pt-3"
                            dir="rtl"
                        >
                            <span className="relative flex w-2.5 h-2.5">
                                <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-60" />
                                <span className="relative rounded-full w-2.5 h-2.5 bg-rose-500" />
                            </span>
                            <span className="text-[12px] font-bold text-[var(--text-secondary)] tabular-nums">
                                {recorder.state === 'requesting' ? 'دسترسی به میکروفون…' : `در حال ضبط · ${faNum(recorder.seconds)} ثانیه`}
                            </span>
                            <div className="flex-1 flex items-center gap-[3px] h-6" dir="ltr" aria-hidden>
                                {Array.from({ length: 24 }).map((_, i) => (
                                    <span
                                        key={i}
                                        className="flex-1 rounded-full bg-[var(--color-primary-400)]"
                                        style={{
                                            height: `${Math.max(3, Math.min(24, recorder.level * 60 * (0.5 + 0.5 * Math.sin(i * 1.7 + recorder.seconds))))}px`,
                                            opacity: 0.55 + recorder.level * 0.45,
                                            transition: 'height 90ms linear',
                                        }}
                                    />
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex items-end gap-1.5 px-2 py-2">
                    {/* Right side (RTL start): tools */}
                    <div className="flex items-center gap-0.5 shrink-0 pb-0.5">
                        {showImage && (
                            <>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,image/gif"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => { if (e.target.files) void addImages(e.target.files); e.target.value = ''; }}
                                />
                                <IconButton label="افزودن تصویر" size={36} disabled={disabled || busy || recording} onClick={() => fileInputRef.current?.click()}>
                                    <ImagePlus size={19} strokeWidth={1.9} />
                                </IconButton>
                            </>
                        )}
                        {showPdf && (
                            <div className="relative">
                                <IconButton
                                    label="منابع PDF"
                                    size={36}
                                    active={refsOpen || references.length > 0}
                                    disabled={disabled || recording}
                                    onClick={() => setRefsOpen((v) => !v)}
                                >
                                    <FileText size={19} strokeWidth={1.9} />
                                    {references.length > 0 && (
                                        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--color-primary-500)] text-white text-[9.5px] font-extrabold grid place-items-center">
                                            {faNum(references.length)}
                                        </span>
                                    )}
                                </IconButton>
                                <ReferencesPopover
                                    open={refsOpen}
                                    onClose={() => setRefsOpen(false)}
                                    references={references}
                                    onChange={onReferencesChange}
                                    conversationId={conversationId}
                                    ensureConversation={ensureConversation}
                                    maxCount={features.limits?.maxPdfsPerConversation || 4}
                                    maxMb={features.limits?.maxPdfMb || 15}
                                />
                            </div>
                        )}
                    </div>

                    <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={(e) => setText(e.target.value.slice(0, maxChars))}
                        onKeyDown={onKeyDown}
                        onPaste={onPaste}
                        rows={1}
                        disabled={disabled || recording}
                        placeholder={placeholder}
                        aria-label="پیام به مِت"
                        className="flex-1 min-w-0 resize-none bg-transparent border-0 outline-none ring-0 shadow-none focus:outline-none focus:ring-0 text-[14.5px] leading-[1.6] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] py-2 px-1.5 max-h-[220px] chat-scrollbar disabled:cursor-not-allowed"
                        dir="auto"
                    />

                    {/* Left side (RTL end): mic + send/stop */}
                    <div className="flex items-center gap-0.5 shrink-0 pb-0.5">
                        {recording ? (
                            <>
                                <IconButton label="لغو ضبط" size={36} tone="danger" onClick={recorder.cancel}>
                                    <Trash2 size={18} strokeWidth={1.9} />
                                </IconButton>
                                <button
                                    type="button"
                                    onClick={finishRecording}
                                    className="w-9 h-9 rounded-full grid place-items-center bg-[var(--color-primary-500)] text-white shadow-[0_6px_18px_-6px_rgba(139,92,246,0.8)] active:scale-95 transition-transform"
                                    aria-label="پایان ضبط و تبدیل به متن"
                                >
                                    <Check size={18} strokeWidth={2.2} />
                                </button>
                            </>
                        ) : (
                            <>
                                {showMic && !text.trim() && !busy && (
                                    <IconButton label="پیام صوتی" size={36} disabled={disabled || transcribing} onClick={startRecording}>
                                        {transcribing ? <GraySpinner size={16} /> : <Mic size={19} strokeWidth={1.9} />}
                                    </IconButton>
                                )}
                                {busy ? (
                                    <button
                                        type="button"
                                        onClick={onStop}
                                        className="w-9 h-9 rounded-full grid place-items-center bg-[var(--text-primary)] text-[var(--bg-app)] active:scale-95 transition-transform"
                                        aria-label="توقف تولید پاسخ"
                                        title="توقف"
                                    >
                                        <Square size={14} fill="currentColor" />
                                    </button>
                                ) : (
                                    <motion.button
                                        type="button"
                                        onClick={submit}
                                        disabled={!canSend}
                                        animate={{ scale: canSend ? 1 : 0.92, opacity: canSend ? 1 : 0.45 }}
                                        transition={{ duration: 0.15 }}
                                        className={`w-9 h-9 rounded-full grid place-items-center transition-colors ${
                                            canSend ? 'bg-[var(--color-primary-500)] text-white shadow-[0_6px_18px_-6px_rgba(139,92,246,0.8)]' : 'bg-[var(--hover-overlay)] text-[var(--text-muted)]'
                                        } active:scale-95`}
                                        aria-label="ارسال"
                                        title="ارسال (Enter)"
                                    >
                                        <ArrowUp size={18} strokeWidth={2.4} />
                                    </motion.button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between px-3 mt-1.5 min-h-[14px]">
                <span className="text-[10px] text-[var(--text-muted)] truncate">
                    {!disabled && (subjectKey === 'general' ? 'گفتگوی آزاد · پاسخ‌ها ممکن است اشتباه داشته باشند؛ بررسی کن.' : 'مِت فقط در همین درس پاسخ می‌دهد.')}
                </span>
                {nearLimit && (
                    <span className={`text-[10px] tabular-nums ${text.length >= maxChars ? 'text-rose-400' : 'text-[var(--text-muted)]'}`} dir="ltr">
                        {faNum(text.length)} / {faNum(maxChars)}
                    </span>
                )}
            </div>
        </div>
    );
}

export default Composer;
