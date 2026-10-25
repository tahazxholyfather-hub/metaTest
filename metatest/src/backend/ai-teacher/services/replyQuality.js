'use strict';

/**
 * Pure helpers for Met replies: truncation, continuation stitching,
 * duplicate suppression, and MathJax v4 text that keeps Persian out of math.
 * No I/O. Used by the chat controller and the chat renderer.
 */

const PERSIAN_CHAR = '[\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF\\u200c]';
const PERSIAN_RE = /[\u0600-\u06FF]/;
const LRI = '\u2066';
const RLI = '\u2067';
const PDI = '\u2069';

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function trailingWord(text) {
    const match = String(text || '').match(/([\p{L}\p{N}_]{1,40})$/u);
    if (!match) return null;
    return { word: match[1], index: match.index };
}

/** Drop a 1–3 letter fragment so the model can rewrite the cut word cleanly. */
function rewindForPrompt(text) {
    const raw = String(text || '');
    const end = raw.trimEnd();
    const cut = trailingWord(end);
    if (!cut || cut.word.length > 3) return raw;
    if (/[.!?؟…:؛»"'’)\]}]$/.test(end)) return raw;
    return end.slice(0, cut.index);
}

function continuationInstruction(tail) {
    const ending = String(tail || '').replace(/\s+/g, ' ').trim().slice(-180);
    return [
        'پاسخ قبلی ناتمام ماند و دقیقاً همان‌جا قطع شد.',
        'فقط ادامه‌ی همان پاسخ را بنویس. هیچ جمله‌، بند یا فرمول قبلی را تکرار نکن.',
        'اگر آخرین واژه نیمه‌کاره است، اول همان واژه را کامل بنویس و بعد ادامه بده.',
        'به فارسی ساده و خودمانی ادامه بده. توضیح را انگلیسی نکن.',
        ending ? `آخر متن این است: «${ending}»` : '',
    ].filter(Boolean).join('\n');
}

function stripContinuationPreamble(text) {
    return String(text || '').replace(
        /^(?:حتماً|البته|باشه)[،!\s]+ادامه[^:\n]{0,30}[:：]\s*/u,
        ''
    );
}

/**
 * Join a continuation onto text that already streamed.
 * Drops repeated endings, restarts, and the «پت» + «اسید پتاسیم» cut.
 */
function stitchContinuation(previous, addition) {
    let prev = String(previous || '');
    let next = stripContinuationPreamble(String(addition || '')).replace(/^\s+/, '');
    if (!next) return prev;

    const anchor = prev.trimEnd().slice(-40);
    if (anchor.length >= 12) {
        const at = next.indexOf(anchor);
        if (at >= 0 && at < 800) next = next.slice(at + anchor.length).replace(/^\s+/, '');
    }
    if (!next) return prev;

    const end = prev.trimEnd();
    const cut = trailingWord(end);
    if (cut && !/[.!?؟…:؛»"'’)\]}]$/.test(end)) {
        const first = next.match(/^[\p{L}\p{N}_]+/u)?.[0] || '';
        if (first && first.startsWith(cut.word) && first.length > cut.word.length) {
            prev = end.slice(0, cut.index);
        } else if (first && first === cut.word) {
            next = next.slice(first.length).replace(/^\s+/, '');
        } else if (cut.word.length <= 3 && first && !first.startsWith(cut.word)) {
            const found = new RegExp(escapeRegExp(cut.word) + '[\\p{L}\\p{N}_]{1,24}', 'u').exec(next.slice(0, 80));
            const gap = found ? next.slice(0, found.index) : '';
            if (found && found.index <= 16 && !gap.includes('\n') && !/[.!?؟]/.test(gap)) {
                prev = end.slice(0, cut.index);
                next = next.slice(found.index);
            }
        }
    }

    const max = Math.min(prev.length, next.length, 400);
    let overlap = 0;
    for (let size = max; size >= 8; size -= 1) {
        if (prev.slice(-size) === next.slice(0, size)) {
            overlap = size;
            break;
        }
    }
    if (overlap) next = next.slice(overlap).replace(/^\s+/, '');
    if (!next) return prev;

    const prevWord = trailingWord(prev.trimEnd());
    const nextWord = next.match(/^[\p{L}\p{N}_]+/u)?.[0] || '';
    // Glue only a short suffix onto a long cut token («هیدروکس» + «ید»). A new word gets a space.
    const midWord = !!(
        prevWord
        && prevWord.word.length > 3
        && nextWord
        && nextWord.length <= 4
        && /[\p{L}\p{N}]$/u.test(prev)
        && /^[\p{L}\p{N}]/u.test(next)
    );
    if (midWord) return prev + next;
    if (prev && !/\s$/.test(prev)) return `${prev} ${next}`;
    return prev + next;
}

function collapseRepeatedParagraphs(text) {
    const parts = String(text || '').split(/\n{2,}/);
    const kept = [];
    let previous = '';
    for (const part of parts) {
        const key = part.replace(/\s+/g, ' ').trim();
        if (key && key === previous) continue;
        kept.push(part);
        previous = key;
    }
    return kept.join('\n\n');
}

function endsCleanly(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return true;
    return /[.!?؟…»"'’)\]}]$/.test(trimmed) || /\$\$\s*$/.test(trimmed) || /\$[^$\n]+\$\s*$/.test(trimmed);
}

function hasUnclosedMath(text) {
    const body = String(text || '').replace(/```[\s\S]*?```/g, '');
    const displays = body.match(/\$\$/g);
    if (displays && displays.length % 2 === 1) return true;
    const singles = body.replace(/\$\$[\s\S]*?\$\$/g, '').replace(/\\\$/g, '').match(/\$/g);
    return !!(singles && singles.length % 2 === 1);
}

/**
 * Distinguish a finished answer from one the student should be able to continue.
 * A normal model stop is complete even without a final period.
 */
function assessReply(text, finishReason, opts = {}) {
    const reason = finishReason || null;
    if (reason === 'length') return { incomplete: true, reason: 'length' };
    if (reason === 'timeout') return { incomplete: true, reason: 'timeout' };
    if (reason === 'incomplete') return { incomplete: true, reason: 'incomplete' };
    if (hasUnclosedMath(text)) return { incomplete: true, reason: 'incomplete' };
    const maxTokens = Number(opts.maxTokens || 0);
    const outputTokens = Number(opts.outputTokens || 0);
    // Only when the provider never said why it stopped. A real "stop" is complete
    // even if the summed continuation is longer than one request's budget.
    if (!reason && !opts.userStopped && maxTokens > 0 && outputTokens >= maxTokens && !endsCleanly(text)) {
        return { incomplete: true, reason: 'length' };
    }
    if (opts.userStopped && String(text || '').trim() && !endsCleanly(text)) {
        return { incomplete: true, reason: 'incomplete' };
    }
    return { incomplete: false, reason: reason || 'stop' };
}

function isContinuableFinish(finishReason, content, status) {
    if (status === 'error') return false;
    return assessReply(content, finishReason, {
        userStopped: status === 'stopped' && finishReason !== 'timeout' && finishReason !== 'length',
    }).incomplete;
}

function polishPersianRun(run) {
    return String(run || '')
        .replace(/\\!-\\!/g, '-')
        .replace(/\\!/g, '\u200c')
        .replace(/\\[,;:]/g, ' ')
        .replace(/~/g, ' ')
        .replace(/\s*-\s*/g, '-')
        .replace(/[ \t]{2,}/g, ' ');
}

function unwrapPersianWrappers(source) {
    const text = String(source || '');
    let out = '';
    for (let i = 0; i < text.length; i += 1) {
        const match = text.slice(i).match(/^\\(?:mathrm|text|mbox|operatorname|ce)\{/);
        if (!match) {
            out += text[i];
            continue;
        }
        const start = i + match[0].length;
        let depth = 1;
        let j = start;
        for (; j < text.length && depth > 0; j += 1) {
            if (text[j] === '{' && text[j - 1] !== '\\') depth += 1;
            else if (text[j] === '}' && text[j - 1] !== '\\') depth -= 1;
        }
        if (depth > 0) {
            out += text[i];
            continue;
        }
        const body = text.slice(start, j - 1);
        if (PERSIAN_RE.test(body)) {
            out += unwrapPersianWrappers(body);
            i = j - 1;
        } else {
            out += text[i];
        }
    }
    return out;
}

function splitPersianRuns(source) {
    const text = String(source || '');
    // LaTeX writes the hyphen in تری\!-\!گلیسرید as \! - \! (two thin spaces around a hyphen).
    const run = new RegExp(`${PERSIAN_CHAR}+(?:(?:\\\\!-\\\\!|\\\\!|\\\\[,;:]|~|\\s*-\\s*)${PERSIAN_CHAR}+)*`, 'g');
    const parts = [];
    let last = 0;
    for (const match of text.matchAll(run)) {
        const index = match.index ?? 0;
        const math = text.slice(last, index).trim();
        if (math) parts.push({ type: 'math', value: math });
        const words = polishPersianRun(match[0]).trim();
        if (words) parts.push({ type: 'text', value: words });
        last = index + match[0].length;
    }
    const tail = text.slice(last).trim();
    if (tail) parts.push({ type: 'math', value: tail });
    return parts;
}

function isolateEquation(parts) {
    const line = parts
        .map((part) => {
            if (part.type === 'text') return `${RLI}${part.value}${PDI}`;
            const body = part.value.trim();
            return body ? `$${body}$` : '';
        })
        .filter(Boolean)
        .join(' ')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
    return `${LRI}${line}${PDI}`;
}

function rewriteMath(inner, display) {
    if (!PERSIAN_RE.test(inner)) return display ? `$$${inner}$$` : `$${inner}$`;
    const parts = splitPersianRuns(unwrapPersianWrappers(inner));
    if (!parts.some((part) => part.type === 'text')) return display ? `$$${inner}$$` : `$${inner}$`;
    return isolateEquation(parts);
}

function replaceClosedMath(text) {
    const source = String(text || '');
    let out = '';
    let i = 0;
    while (i < source.length) {
        if (source.startsWith('$$', i)) {
            const end = source.indexOf('$$', i + 2);
            if (end === -1) {
                out += source.slice(i);
                break;
            }
            out += rewriteMath(source.slice(i + 2, end), true);
            i = end + 2;
            continue;
        }
        if (source[i] === '$') {
            const end = source.indexOf('$', i + 1);
            const inner = end === -1 ? '' : source.slice(i + 1, end);
            if (end === -1 || inner.includes('\n')) {
                out += source[i];
                i += 1;
                continue;
            }
            out += rewriteMath(inner, false);
            i = end + 1;
            continue;
        }
        out += source[i];
        i += 1;
    }
    return out;
}

/** Convert alternate delimiters, then lift Persian out of math into bidi isolates. */
function normalizeAssistantText(text) {
    const source = String(text || '')
        .replace(/\\\[([\s\S]*?)\\\]/g, (_, body) => `$$${body}$$`)
        .replace(/\\\(([\s\S]*?)\\\)/g, (_, body) => `$${body}$`);
    const chunks = source.split(/(```[\s\S]*?```)/g);
    return chunks.map((chunk, index) => (index % 2 === 1 ? chunk : replaceClosedMath(chunk))).join('');
}

function storedFinishReason(assessment) {
    if (!assessment?.incomplete) return assessment?.reason === 'stop' || !assessment?.reason ? 'stop' : assessment.reason;
    if (assessment.reason === 'timeout') return 'timeout';
    if (assessment.reason === 'length') return 'length';
    return 'incomplete';
}

module.exports = {
    assessReply,
    collapseRepeatedParagraphs,
    continuationInstruction,
    endsCleanly,
    hasUnclosedMath,
    isContinuableFinish,
    normalizeAssistantText,
    rewindForPrompt,
    stitchContinuation,
    storedFinishReason,
};
