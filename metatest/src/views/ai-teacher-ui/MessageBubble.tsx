import React, { useMemo } from 'react';
import { Copy, Check, Flag } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { MathRenderer } from '../../components/ui/MathRenderer';
import type { AiMessage } from './types';
import { easeOut } from './ui';

type Props = {
    message: AiMessage;
    teacherAvatar?: string;
    teacherName?: string;
    isGroupEnd?: boolean;
    isGroupStart?: boolean;
    onReport?: (message: AiMessage) => void;
};

function formatMsgTime(iso?: string) {
    if (!iso) {
        return new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    }
    try {
        return new Date(iso).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
}

/** Turn markdown headings into bold so `### سؤال ۱` never renders as a raw hash title. */
export function normalizeAssistantMarkdown(text: string) {
    return String(text || '').replace(
        /^[ \t]{0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm,
        '**$1**'
    );
}

function parseTeacherMarkdown(raw: string): React.ReactNode[] {
    const text = normalizeAssistantMarkdown(raw);
    const MATH_RE = /\$\$[\s\S]+?\$\$|\$[^$\n]+\$/g;
    const nodes: React.ReactNode[] = [];
    let key = 0;
    let last = 0;

    const pushText = (chunk: string) => {
        if (!chunk) return;
        const parts = chunk.split(/(\*\*[^*]+?\*\*)/g);
        for (const part of parts) {
            if (!part) continue;
            const bold = part.match(/^\*\*([^*]+)\*\*$/);
            if (bold) {
                nodes.push(
                    <strong key={key++} className="font-extrabold text-[var(--text-primary)]">
                        {bold[1]}
                    </strong>
                );
            } else {
                nodes.push(<React.Fragment key={key++}>{part}</React.Fragment>);
            }
        }
    };

    for (const match of text.matchAll(MATH_RE)) {
        const idx = match.index ?? 0;
        if (idx > last) pushText(text.slice(last, idx));
        nodes.push(
            <MathRenderer
                key={key++}
                text={match[0]}
                inline
                className="!inline !m-0 !leading-[1.6] !text-[14.5px]"
            />
        );
        last = idx + match[0].length;
    }
    if (last < text.length) pushText(text.slice(last));
    return nodes.length ? nodes : [text];
}

function TeacherRichText({ text }: { text: string }) {
    const nodes = useMemo(() => parseTeacherMarkdown(text), [text]);
    return (
        <div className="whitespace-pre-wrap break-words leading-[1.6] text-[14.5px] m-0" dir="auto">
            {nodes}
        </div>
    );
}

export function MessageBubble({
    message,
    teacherAvatar,
    teacherName,
    isGroupEnd = true,
    isGroupStart = true,
    onReport,
}: Props) {
    const [copied, setCopied] = React.useState(false);
    const isUser = message.role === 'user';
    const time = formatMsgTime(message.createdAt);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(message.content || '');
            setCopied(true);
            toast.success('کپی شد');
            setTimeout(() => setCopied(false), 1200);
        } catch {
            toast.error('کپی انجام نشد');
        }
    };

    const handleReport = (e: React.MouseEvent) => {
        e.stopPropagation();
        onReport?.(message);
        toast.message('گزارش ثبت شد', { description: 'از بازخورد شما متشکریم.' });
    };

    /* User — compact, distinct, no cartoon tail */
    if (isUser) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: easeOut }}
                className={`flex w-full justify-start ${isGroupStart ? 'mt-4' : 'mt-1'}`}
            >
                <div className="max-w-[78%] sm:max-w-[62%] group">
                    <div
                        className="px-3.5 py-2.5 text-[14.5px] leading-[1.55] text-white break-words rounded-[16px] rounded-br-[6px]"
                        style={{ background: 'var(--color-primary-500)' }}
                        dir="auto"
                    >
                        <p className="whitespace-pre-wrap m-0">{message.content}</p>
                    </div>
                    <div className="flex items-center gap-2.5 mt-1 px-0.5 opacity-50 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] text-[var(--text-muted)] tabular-nums">{time}</span>
                        <button type="button" onClick={handleCopy} className="p-0.5 text-[var(--text-muted)]" aria-label="کپی">
                            {copied ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                        <button type="button" onClick={handleReport} className="p-0.5 text-[var(--text-muted)]" aria-label="گزارش">
                            <Flag size={12} />
                        </button>
                    </div>
                </div>
            </motion.div>
        );
    }

    /* Assistant — editorial block with identity */
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: easeOut }}
            className={`flex w-full justify-end gap-2.5 ${isGroupStart ? 'mt-4' : 'mt-1'}`}
        >
            <div className="max-w-[85%] sm:max-w-[72%] min-w-0 group">
                {isGroupStart && (
                    <div className="flex items-center gap-2 mb-1.5 justify-end" dir="rtl">
                        <span className="text-[11px] font-bold text-[var(--text-secondary)] truncate">
                            {teacherName || 'معلم'}
                        </span>
                    </div>
                )}

                <div
                    className="px-3.5 py-2.5 text-[14.5px] leading-[1.6] text-[var(--text-primary)] break-words rounded-[16px] rounded-bl-[6px] bg-[color-mix(in_srgb,var(--text-primary)_5.5%,var(--bg-card))] border border-[var(--border)]/50"
                    dir="auto"
                >
                    {message.streaming ? (
                        <p className="whitespace-pre-wrap m-0">
                            {normalizeAssistantMarkdown(message.content || '')}
                            <span className="inline-block w-[2px] h-[1em] align-[-0.15em] mr-0.5 bg-[var(--color-primary-400)] animate-pulse" />
                        </p>
                    ) : (
                        <TeacherRichText text={message.content || ''} />
                    )}
                </div>

                {!message.streaming && !!message.content && (
                    <div className="flex items-center justify-end gap-2.5 mt-1 px-0.5 opacity-45 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={handleReport} className="p-0.5 text-[var(--text-muted)]" aria-label="گزارش مشکل">
                            <Flag size={12} />
                        </button>
                        <button type="button" onClick={handleCopy} className="p-0.5 text-[var(--text-muted)]" aria-label="کپی">
                            {copied ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                        {!!message.coinCost && (
                            <span className="text-[10px] text-[var(--text-muted)] tabular-nums">
                                −{Number(message.coinCost).toLocaleString('fa-IR')} انرژی
                            </span>
                        )}
                        <span className="text-[10px] text-[var(--text-muted)] tabular-nums">{time}</span>
                    </div>
                )}
            </div>

            <div className="w-8 shrink-0 self-end mb-5">
                {isGroupEnd ? (
                    <img
                        src={teacherAvatar || '/avatars/user_default.png'}
                        alt={teacherName || ''}
                        className="w-8 h-8 rounded-full object-cover ring-1 ring-[var(--border)]"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/avatars/user_default.png'; }}
                    />
                ) : null}
            </div>
        </motion.div>
    );
}
