import React, { useMemo } from 'react';
import { MathRenderer } from '../../components/ui/MathRenderer';

/**
 * Lightweight markdown renderer for Met replies: headings → bold, **bold**,
 * `inline code`, ``` blocks, bullet / numbered lists, and $…$ / $$…$$ math
 * delegated to the app's KaTeX renderer. Intentionally small — the prompt
 * asks the model for plain, exam-friendly formatting.
 */

const MATH_RE = /\$\$[\s\S]+?\$\$|\$[^$\n]+\$/g;

function inlineNodes(text: string, keyBase: string): React.ReactNode[] {
    const out: React.ReactNode[] = [];
    let k = 0;
    let last = 0;
    const pushPlain = (chunk: string) => {
        if (!chunk) return;
        const parts = chunk.split(/(\*\*[^*]+?\*\*|`[^`\n]+`)/g);
        for (const part of parts) {
            if (!part) continue;
            const bold = part.match(/^\*\*([^*]+)\*\*$/);
            const code = part.match(/^`([^`]+)`$/);
            if (bold) out.push(<strong key={`${keyBase}-${k++}`} className="font-extrabold text-[var(--text-primary)]">{bold[1]}</strong>);
            else if (code)
                out.push(
                    <code key={`${keyBase}-${k++}`} dir="ltr" className="px-1.5 py-0.5 rounded-md bg-[var(--hover-overlay)] text-[13px] font-mono text-[var(--color-primary-300)]">
                        {code[1]}
                    </code>
                );
            else out.push(<React.Fragment key={`${keyBase}-${k++}`}>{part}</React.Fragment>);
        }
    };
    for (const m of text.matchAll(MATH_RE)) {
        const idx = m.index ?? 0;
        if (idx > last) pushPlain(text.slice(last, idx));
        out.push(<MathRenderer key={`${keyBase}-${k++}`} text={m[0]} inline className="!inline !m-0 !leading-[1.7] !text-[14.5px]" />);
        last = idx + m[0].length;
    }
    if (last < text.length) pushPlain(text.slice(last));
    return out;
}

type Block =
    | { kind: 'p'; lines: string[] }
    | { kind: 'ul'; items: string[] }
    | { kind: 'ol'; items: string[] }
    | { kind: 'code'; lang: string; body: string }
    | { kind: 'math'; body: string };

function parseBlocks(raw: string): Block[] {
    const lines = String(raw || '').replace(/\r\n/g, '\n').split('\n');
    const blocks: Block[] = [];
    let i = 0;
    const flushPara = (buf: string[]) => {
        if (buf.length) blocks.push({ kind: 'p', lines: [...buf] });
        buf.length = 0;
    };
    const para: string[] = [];

    while (i < lines.length) {
        const line = lines[i];
        const fence = line.match(/^\s*```(\w*)\s*$/);
        if (fence) {
            flushPara(para);
            const body: string[] = [];
            i++;
            while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) body.push(lines[i++]);
            i++;
            blocks.push({ kind: 'code', lang: fence[1] || '', body: body.join('\n') });
            continue;
        }
        if (/^\s*\$\$\s*$/.test(line)) {
            flushPara(para);
            const body: string[] = [];
            i++;
            while (i < lines.length && !/^\s*\$\$\s*$/.test(lines[i])) body.push(lines[i++]);
            i++;
            blocks.push({ kind: 'math', body: `$$${body.join('\n')}$$` });
            continue;
        }
        if (/^\s*[-*•]\s+/.test(line)) {
            flushPara(para);
            const items: string[] = [];
            while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*•]\s+/, ''));
            blocks.push({ kind: 'ul', items });
            continue;
        }
        if (/^\s*[\d۰-۹]+[.)]\s+/.test(line)) {
            flushPara(para);
            const items: string[] = [];
            while (i < lines.length && /^\s*[\d۰-۹]+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[\d۰-۹]+[.)]\s+/, ''));
            blocks.push({ kind: 'ol', items });
            continue;
        }
        if (!line.trim()) {
            flushPara(para);
            i++;
            continue;
        }
        // Headings read as emphasised lines — never raw hashes.
        para.push(line.replace(/^[ \t]{0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/, '**$1**'));
        i++;
    }
    flushPara(para);
    return blocks;
}

export function RichText({ text, className = '' }: { text: string; className?: string }) {
    const blocks = useMemo(() => parseBlocks(text), [text]);
    return (
        <div className={`met-rich text-[14.5px] leading-[1.75] text-[var(--text-primary)] break-words ${className}`} dir="auto">
            {blocks.map((b, bi) => {
                if (b.kind === 'code')
                    return (
                        <pre key={bi} dir="ltr" className="my-2 p-3 rounded-[12px] bg-[color-mix(in_srgb,var(--text-primary)_5%,var(--bg-app))] border border-[var(--border)]/60 overflow-x-auto text-[12.5px] leading-relaxed font-mono text-left">
                            <code>{b.body}</code>
                        </pre>
                    );
                if (b.kind === 'math') return <MathRenderer key={bi} text={b.body} className="my-2 overflow-x-auto" />;
                if (b.kind === 'ul' || b.kind === 'ol') {
                    const Tag = b.kind;
                    return (
                        <Tag key={bi} className={`my-1.5 pr-5 space-y-1 ${b.kind === 'ul' ? 'list-disc' : 'list-decimal'} marker:text-[var(--text-muted)]`}>
                            {b.items.map((it, ii) => (
                                <li key={ii}>{inlineNodes(it, `${bi}-${ii}`)}</li>
                            ))}
                        </Tag>
                    );
                }
                return (
                    <p key={bi} className="my-1.5 whitespace-pre-wrap m-0">
                        {b.lines.map((l, li) => (
                            <React.Fragment key={li}>
                                {inlineNodes(l, `${bi}-${li}`)}
                                {li < b.lines.length - 1 && <br />}
                            </React.Fragment>
                        ))}
                    </p>
                );
            })}
        </div>
    );
}
