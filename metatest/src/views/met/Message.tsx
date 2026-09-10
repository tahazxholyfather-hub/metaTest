import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Check, Copy, ImageOff, Mic, RefreshCw, Square, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage } from './api';
import { Met, type MetColor } from '../../components/met';
import type { MetMessage } from './types';
import { RichText } from './RichText';
import { GraySpinner, easeOut, faNum, formatTime } from './ui';
import { playSharedAudio, stopSharedAudio } from './audio';

type Props = {
    message: MetMessage;
    metColor: MetColor;
    isGroupStart?: boolean;
    isGroupEnd?: boolean;
    canSpeak?: boolean;
    canRegenerate?: boolean;
    busy?: boolean;
    /** Resolve (and bill once) the spoken version of this message; returns the audio URL. */
    onSpeak?: (messageId: number) => Promise<string | null>;
    onRegenerate?: (messageId: number) => void;
    onRetry?: (message: MetMessage) => void;
};

function AttachmentGallery({ attachments, align }: { attachments: MetMessage['attachments']; align: 'start' | 'end' }) {
    const images = (attachments || []).filter((a) => (a.type === 'image' || a.type === 'generated_image') && a.url);
    if (!images.length) return null;
    return (
        <div className={`flex flex-wrap gap-1.5 mt-2 ${align === 'end' ? 'justify-end' : 'justify-start'}`}>
            {images.map((img, i) => (
                <a
                    key={`${img.url}-${i}`}
                    href={img.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-[14px] overflow-hidden border border-[var(--border)]/60 bg-[var(--bg-app)] max-w-[260px]"
                >
                    <img
                        src={img.url}
                        alt={img.promptUsed || ''}
                        loading="lazy"
                        className="block max-h-72 w-auto object-cover"
                        onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
                    />
                    {img.type === 'generated_image' && img.promptUsed && (
                        <div className="px-2.5 py-1.5 text-[10.5px] text-[var(--text-muted)] truncate">{img.promptUsed}</div>
                    )}
                </a>
            ))}
        </div>
    );
}

function VoiceNote({ url, seconds }: { url: string; seconds?: number | null }) {
    const [playing, setPlaying] = useState(false);
    useEffect(() => () => { if (playing) stopSharedAudio(); }, [playing]);
    return (
        <button
            type="button"
            onClick={() => {
                if (playing) return stopSharedAudio();
                setPlaying(true);
                playSharedAudio(url, () => setPlaying(false));
            }}
            className="inline-flex items-center gap-2 mb-1.5 px-2.5 h-8 rounded-full bg-white/12 text-white text-[11.5px] font-bold"
            aria-label={playing ? 'توقف' : 'پخش پیام صوتی'}
        >
            {playing ? <Square size={12} /> : <Mic size={12} />}
            پیام صوتی{seconds ? ` · ${faNum(Math.round(seconds))}ث` : ''}
        </button>
    );
}

export function Message({
    message,
    metColor,
    isGroupStart = true,
    isGroupEnd = true,
    canSpeak = false,
    canRegenerate = false,
    busy = false,
    onSpeak,
    onRegenerate,
    onRetry,
}: Props) {
    const [copied, setCopied] = useState(false);
    const [speech, setSpeech] = useState<'idle' | 'loading' | 'playing'>('idle');
    const isUser = message.role === 'user';
    const numericId = typeof message.id === 'number' ? message.id : Number(message.id);
    const persisted = Number.isFinite(numericId) && numericId > 0;
    const time = formatTime(message.createdAt);

    useEffect(() => () => { if (speech === 'playing') stopSharedAudio(); }, [speech]);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(message.content || '');
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        } catch {
            toast.error('کپی انجام نشد');
        }
    };

    const speak = async () => {
        if (speech === 'playing') return stopSharedAudio();
        if (speech === 'loading') return;
        const cached = (message.attachments || []).find((a) => a.type === 'audio' && a.url)?.url || null;
        try {
            let url = cached;
            if (!url && onSpeak) {
                setSpeech('loading');
                url = await onSpeak(numericId);
            }
            if (!url) return setSpeech('idle');
            setSpeech('playing');
            playSharedAudio(url, () => setSpeech('idle'));
        } catch (err) {
            setSpeech('idle');
            toast.error(errorMessage(err, 'پخش صدا ناموفق بود'));
        }
    };

    /* ── User bubble ─────────────────────────────────────────────────────── */
    if (isUser) {
        const voice = (message.attachments || []).find((a) => a.type === 'audio' && a.url);
        return (
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: easeOut }}
                className={`flex w-full justify-start ${isGroupStart ? 'mt-5' : 'mt-1.5'}`}
            >
                <div className="max-w-[82%] sm:max-w-[64%] group">
                    <div
                        className="px-3.5 py-2.5 text-[14.5px] leading-[1.6] text-white break-words rounded-[18px] rounded-br-[6px] shadow-[0_8px_24px_-12px_rgba(139,92,246,0.7)]"
                        style={{ background: 'linear-gradient(135deg, var(--color-primary-500), color-mix(in srgb, var(--color-primary-500) 78%, #4c1d95))' }}
                        dir="auto"
                    >
                        {voice?.url && <VoiceNote url={voice.url} seconds={voice.durationSeconds} />}
                        {!!message.content && <p className="whitespace-pre-wrap m-0">{message.content}</p>}
                        <AttachmentGallery attachments={message.attachments} align="start" />
                    </div>
                    <div className="flex items-center gap-2.5 mt-1 px-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <span className="text-[10px] text-[var(--text-muted)] tabular-nums">{time}</span>
                        {!!message.content && (
                            <button type="button" onClick={copy} className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]" aria-label="کپی">
                                {copied ? <Check size={12} /> : <Copy size={12} />}
                            </button>
                        )}
                        {message.error && onRetry && (
                            <button type="button" onClick={() => onRetry(message)} className="inline-flex items-center gap-1 text-[10.5px] text-rose-400 font-bold">
                                <RefreshCw size={11} /> ارسال دوباره
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>
        );
    }

    /* ── Met — editorial block ───────────────────────────────────────────── */
    const empty = !message.streaming && !message.content && !message.attachments?.length;
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: easeOut }}
            className={`flex w-full justify-end gap-2.5 ${isGroupStart ? 'mt-5' : 'mt-1.5'}`}
        >
            <div className="max-w-[92%] sm:max-w-[76%] min-w-0 group flex-1">
                {isGroupStart && (
                    <div className="flex items-center gap-2 mb-1 justify-end pr-1" dir="rtl">
                        <span className="text-[11px] font-extrabold text-[var(--text-secondary)]">مِت</span>
                        {message.status === 'stopped' && <span className="text-[10px] text-[var(--text-muted)]">· متوقف شد</span>}
                    </div>
                )}

                <div
                    className={`px-4 py-3 rounded-[18px] rounded-tr-[6px] border ${
                        message.error
                            ? 'bg-rose-500/6 border-rose-500/25'
                            : 'bg-[color-mix(in_srgb,var(--text-primary)_4.5%,var(--bg-card))] border-[var(--border)]/50'
                    }`}
                >
                    {message.error ? (
                        <div className="flex items-start gap-2.5 text-[13px] text-[var(--text-secondary)] leading-relaxed" dir="rtl">
                            <AlertCircle size={16} className="text-rose-400 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                                <p className="m-0">{message.error}</p>
                                {onRetry && (
                                    <button type="button" onClick={() => onRetry(message)} className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--color-primary-400)]">
                                        <RefreshCw size={12} /> تلاش دوباره
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : message.streaming ? (
                        <RichText
                            text={message.content}
                            streaming
                            trailing={<span className="inline-block w-[2px] h-[1em] align-[-0.15em] mr-0.5 bg-[var(--color-primary-400)] animate-pulse" />}
                        />
                    ) : (
                        <>
                            {!!message.content && <RichText text={message.content} />}
                            <AttachmentGallery attachments={message.attachments} align="end" />
                            {empty && (
                                <p className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] m-0">
                                    <ImageOff size={13} /> پاسخی دریافت نشد.
                                </p>
                            )}
                        </>
                    )}
                </div>

                {!message.streaming && !message.error && !!message.content && (
                    <div className="flex items-center justify-end gap-1 mt-1 pr-1 opacity-60 group-hover:opacity-100 focus-within:opacity-100 transition-opacity" dir="rtl">
                        <span className="text-[10px] text-[var(--text-muted)] tabular-nums ml-1">{time}</span>
                        {!!message.coinCost && (
                            <span className="text-[10px] text-[var(--text-muted)] tabular-nums ml-1" title="سکه‌ی مصرف‌شده">
                                {faNum(message.coinCost)} سکه
                            </span>
                        )}
                        <button type="button" onClick={copy} className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-overlay)]" aria-label="کپی">
                            {copied ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                        {canSpeak && persisted && (
                            <button
                                type="button"
                                onClick={speak}
                                className={`p-1 rounded-md hover:bg-[var(--hover-overlay)] ${speech === 'playing' ? 'text-[var(--color-primary-400)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                                aria-label={speech === 'playing' ? 'توقف پخش' : 'پخش صوتی پاسخ'}
                            >
                                {speech === 'loading' ? <GraySpinner size={13} /> : speech === 'playing' ? <Square size={13} /> : <Volume2 size={13} />}
                            </button>
                        )}
                        {canRegenerate && persisted && onRegenerate && (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => onRegenerate(numericId)}
                                className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] disabled:opacity-40"
                                aria-label="تولید دوباره پاسخ"
                            >
                                <RefreshCw size={13} />
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="w-7 shrink-0 self-start mt-6">
                {isGroupEnd && (
                    <div className="w-7 h-7">
                        <Met size="100%" state={message.error ? 'sad' : 'idle'} color={metColor} reducedMotion />
                    </div>
                )}
            </div>
        </motion.div>
    );
}

export default React.memo(Message);
