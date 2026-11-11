// src/components/MathRenderer.tsx

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { normalizeAssistantText } from '../../backend/ai-teacher/services/replyQuality.js';

// =====================================================================
// MathRenderer — self-contained MathJax v4 renderer (fully local/offline)
// =====================================================================
//
// This ONE component handles everything MathJax related. Do NOT keep the
// old mathjax.ts / mathjax-config.ts / loadMathJax.ts files or any MathJax
// <script> tag in index.html — remove them (and any `import './mathjax'`
// in main.tsx). Having multiple competing configs was the source of the
// v3 issues: whichever module ran first won, so extensions were sometimes
// missing and startup.promise was awaited before the script created it.
//
// What this component does:
//   - loads MathJax v4 exactly once, from LOCAL files (no CDN at all)
//   - $...$ / $$...$$ (and \(...\) / \[...\]) delimiters
//   - full chemistry support via mhchem (\ce, \pu) + auto-\ce wrapping
//     for chemistry-subject texts
//   - physics, cancel, color, bbox, braket, enclose, unicode, ... loaded
//     up front or autoloaded on demand — always from the local package
//   - font glyph ranges resolved from the local font package via an
//     explicit fontPath — never from cdn.jsdelivr.net
//   - safe re-typesetting when text changes (keyed remount, no stale DOM)
//
// ---------------------------------------------------------------------
// One-time setup (run in the FRONTEND project root):
//
//   npm install mathjax@4
//   rm -rf public/mathjax public/mathjax-newcm-font
//   cp -r node_modules/mathjax public/mathjax
//   cp -r node_modules/@mathjax/mathjax-newcm-font public/mathjax-newcm-font
// ---------------------------------------------------------------------

// Word stores Persian quotation marks as HTML entities. The quiz screen
// already decodes them; the answer sheet has to do the same or "&laquo;"
// shows up as a stray "&".
const decodeWordEntities = (value: string) => value
    .replace(/&laquo;|&#171;/gi, '«')
    .replace(/&raquo;|&#187;/gi, '»')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&zwnj;|&#8204;/gi, '\u200c')
    .replace(/&zwj;|&#8205;/gi, '\u200d')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;|&#60;/gi, '<')
    .replace(/&gt;|&#62;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;|&#38;/gi, '&');

const MATHJAX_SCRIPT_URL = '/mathjax/tex-mml-chtml.js';
const MATHJAX_FONT_PATH = '/mathjax-newcm-font';

declare global {
    interface Window {
        MathJax?: any;
    }
}

// Singleton loader: the script is injected exactly once for the whole app.
// The app also injects MathJax from utils/mathjax at startup. A second config
// written while that script is still downloading (common on a phone) leaves
// startup.promise pending forever, and every formula stays a skeleton.
let mathJaxPromise: Promise<boolean> | null = null;

const mathJaxIsReady = () => typeof window.MathJax?.typesetPromise === 'function';

export const loadMathJax = (): Promise<boolean> => {
    if (mathJaxPromise) return mathJaxPromise;

    mathJaxPromise = new Promise<boolean>((resolve) => {
        let settled = false;
        const arm = (ok: boolean) => {
            if (settled) return;
            settled = true;
            resolve(ok);
        };
        const waitForStartup = () => {
            const pending = window.MathJax?.startup?.promise;
            if (pending && typeof pending.then === 'function') {
                pending.then(() => arm(mathJaxIsReady())).catch(() => arm(false));
                return;
            }
            arm(mathJaxIsReady());
        };

        if (mathJaxIsReady()) {
            arm(true);
            return;
        }

        const existing = document.querySelector('script[src*="mathjax"]') as HTMLScriptElement | null;
        if (existing) {
            if (window.MathJax?.startup?.promise) {
                waitForStartup();
                return;
            }
            existing.addEventListener('load', () => waitForStartup(), { once: true });
            existing.addEventListener('error', () => arm(false), { once: true });
            return;
        }

        // The configuration MUST exist before the MathJax script executes
        window.MathJax = {
            loader: {
                // Everything is resolved relative to the local script URL,
                // so no CDN is ever contacted. physics is included explicitly
                // because it is never autoloaded (it redefines core macros).
                load: [
                    '[tex]/mhchem',
                    '[tex]/physics',
                    '[tex]/cancel',
                    '[tex]/color',
                    '[tex]/bbox',
                    '[tex]/boldsymbol',
                    '[tex]/braket',
                    '[tex]/enclose',
                    '[tex]/extpfeil',
                    '[tex]/html',
                    '[tex]/unicode',
                    '[tex]/verb',
                ],
            },
            tex: {
                packages: {
                    '[+]': [
                        'mhchem', 'physics', 'cancel', 'color', 'bbox', 'boldsymbol',
                        'braket', 'enclose', 'extpfeil', 'html', 'unicode', 'verb',
                    ],
                },
                inlineMath: [['$', '$'], ['\\(', '\\)']],
                displayMath: [['$$', '$$'], ['\\[', '\\]']],
                processEscapes: true,
                processEnvironments: true,
            },
            output: {
                // Explicit local font + path: dynamic glyph ranges are loaded
                // from our own server instead of cdn.jsdelivr.net
                font: 'mathjax-newcm',
                fontPath: MATHJAX_FONT_PATH,
            },
            options: {
                enableMenu: false, // no right-click MathJax menu
            },
            startup: {
                typeset: false, // we typeset per-component, not the whole page
            },
        };

        const script = document.createElement('script');
        script.src = MATHJAX_SCRIPT_URL;
        script.async = true;
        script.onload = () => waitForStartup();
        script.onerror = () => {
            console.error(
                `MathJax could not be loaded from ${MATHJAX_SCRIPT_URL}. ` +
                `Make sure the mathjax v4 package was copied into the public folder (see MathRenderer.tsx header).`
            );
            arm(false); // fall back to plain-text rendering
        };
        document.head.appendChild(script);
    });

    return mathJaxPromise;
};

// One shared queue. A review of 70 questions mounts hundreds of formulas at
// once; firing typesetPromise for each of them stalls MathJax's internal
// chain on a phone, and the skeleton never goes away.
type TypesetJob = {
    el: HTMLElement;
    cancelled: boolean;
    done: () => void;
};

const typesetQueue: TypesetJob[] = [];
let typesetPump: Promise<void> | null = null;

const kickTypeset = () => {
    if (typesetPump) return;
    typesetPump = pumpTypeset().finally(() => {
        typesetPump = null;
        if (typesetQueue.length) kickTypeset();
    });
};

const scheduleTypeset = (el: HTMLElement) => {
    let settled = false;
    let markDone = () => {};
    const finished = new Promise<void>((resolve) => {
        markDone = () => {
            if (settled) return;
            settled = true;
            resolve();
        };
    });
    const job: TypesetJob = { el, cancelled: false, done: markDone };
    typesetQueue.push(job);
    kickTypeset();
    return {
        finished,
        cancel() {
            job.cancelled = true;
            job.done();
        },
    };
};

const pumpTypeset = async () => {
    const loaded = await loadMathJax();
    while (typesetQueue.length) {
        const batch = typesetQueue.splice(0, 4);
        const live = batch.filter((job) => !job.cancelled && job.el.isConnected);
        batch.forEach((job) => {
            if (!live.includes(job)) job.done();
        });
        if (!loaded || !mathJaxIsReady() || live.length === 0) {
            live.forEach((job) => job.done());
            continue;
        }
        try {
            await window.MathJax.typesetPromise(live.map((job) => job.el));
        } catch (err) {
            console.error('MathRenderer typeset failed:', err);
        }
        live.forEach((job) => job.done());
        await new Promise((resolve) => window.setTimeout(resolve, 16));
    }
};

const containsMath = (value: string) => /[$\\]/.test(value);

/**
 * Subject ids from the database (subjects_tam24)
 */
const SUBJECT_MAP: Record<number, string> = {
    1: 'math',
    2: 'physics',
    3: 'chemistry',
    4: 'biology',
};

const isChemistrySubject = (subject?: number | string): boolean =>
    SUBJECT_MAP[Number(subject)] === 'chemistry';

/**
 * Automatically wrap chemistry formulas:
 *   $H2O + CO2 -> H2CO3$  becomes  $\ce{H2O + CO2 -> H2CO3}$
 * Already-wrapped formulas are left untouched.
 */
const EASTERN_DIGITS = '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩';

// mhchem only accepts ASCII digits after _ and ^. A Persian coefficient
// such as ۲NO or H_۲ is read as a subscript with no argument, which is the
// red "Missing superscript or subscript argument" message.
const toAsciiDigits = (value: string) => value.replace(/[۰-۹٠-٩]/g, (ch) => {
    const index = EASTERN_DIGITS.indexOf(ch);
    return index < 0 ? ch : String(index % 10);
});

// A Word run boundary often leaves a space or zero-width mark between _/^ and
// the digit. TeX then sees a subscript with no argument and replaces the
// whole formula with "Missing superscript or subscript argument".
const cleanMathChunk = (chunk: string) => {
    const digits = toAsciiDigits(chunk);
    return digits.replace(/([_^])[\s\u200c\u200d\u200e\u200f\ufeff]+/g, '$1');
};

const asciiDigitsInMath = (text: string) => text.replace(
    /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$(?:\\\$|[^$])+\$|\\\([\s\S]*?\\\)|\\ce\{[^{}]*\}/g,
    (chunk) => cleanMathChunk(chunk),
);

const shouldWrapCe = (formula: string) => !/\\/.test(formula) && !/[\u0600-\u06FF]/.test(formula);

const formatChemistryText = (text: string): string => {
    if (!text) return '';
    let result = text;
    // Display math $$...$$. Commands and Persian stay as written; mhchem only wraps plain formulas.
    result = result.replace(/\$\$(?!\s*\\ce\{)([\s\S]*?)\$\$/g, (all, formula) => (
        shouldWrapCe(formula) ? `$$\\ce{${formula.trim()}}$$` : all
    ));
    // Inline math $...$
    result = result.replace(/\$(?!\$|\s*\\ce\{)(.*?)\$/g, (all, formula) => (
        shouldWrapCe(formula) ? `$\\ce{${formula.trim()}}$` : all
    ));
    return result;
};

// --- COMPONENT ---
export interface MathRendererProps {
    text: string;
    subject?: number | string;
    className?: string;
    inline?: boolean;
    /** auto follows the first strong letter. rtl keeps Persian lines on the right. */
    dir?: 'auto' | 'rtl' | 'ltr';
}

export const MathRenderer: React.FC<MathRendererProps> = ({
                                                              text,
                                                              subject,
    className = '',
    inline = false,
    dir = 'auto',
}) => {
    const containerRef = useRef<HTMLElement | null>(null);
    const wrapperRef = useRef<HTMLSpanElement | null>(null);

    const processedText = useMemo(() => {
        if (!text) return '';
        // Digits must become ASCII before Persian text is lifted out of math.
        // Otherwise $L_۱$ is split into $L_$ plus the digit, and MathJax reports
        // a missing subscript.
        const decoded = asciiDigitsInMath(decodeWordEntities(text));
        const normalized = normalizeAssistantText(decoded);
        return isChemistrySubject(subject) ? formatChemistryText(normalized) : normalized;
    }, [text, subject]);

    const expectsMath = containsMath(processedText);
    const [trackedText, setTrackedText] = useState(processedText);
    const [ready, setReady] = useState(!expectsMath || !processedText);
    if (trackedText !== processedText) {
        setTrackedText(processedText);
        setReady(!containsMath(processedText) || !processedText);
    }

    // Text is written imperatively so a later render (checkbox toggle, the
    // ready flag) cannot put the raw string back over MathJax's DOM.
    useLayoutEffect(() => {
        const element = containerRef.current;
        const wrapper = wrapperRef.current;
        if (!element) return;
        if (!processedText) {
            element.textContent = '';
            setReady(true);
            return;
        }
        let cancelled = false;
        element.textContent = processedText;

        const reveal = () => {
            if (!cancelled) setReady(true);
        };
        // Never leave the words behind the skeleton. MathJax may still
        // upgrade the text after this; the reader is not blocked on it.
        const revealTimer = window.setTimeout(reveal, expectsMath ? 800 : 0);

        let cancelJob = () => {};
        const start = () => {
            if (cancelled || !expectsMath) {
                reveal();
                return;
            }
            const job = scheduleTypeset(element);
            cancelJob = job.cancel;
            job.finished.then(reveal);
        };

        let observer: IntersectionObserver | null = null;
        if (!expectsMath) {
            start();
        } else if (typeof IntersectionObserver === 'function' && wrapper) {
            observer = new IntersectionObserver((entries) => {
                if (!entries.some((entry) => entry.isIntersecting)) return;
                observer?.disconnect();
                start();
            }, { rootMargin: '280px' });
            observer.observe(wrapper);
        } else {
            start();
        }

        return () => {
            cancelled = true;
            window.clearTimeout(revealTimer);
            observer?.disconnect();
            cancelJob();
        };
    }, [processedText, expectsMath]);

    const classes = `whitespace-pre-wrap break-words leading-relaxed math-renderer max-w-full ${className}`;
    const plainLength = processedText.replace(/[$\\{}]/g, '').trim().length;
    const skeletonWidth = inline
        ? `${Math.min(18, Math.max(4, plainLength * 0.42))}em`
        : '100%';

    // Stay in normal flow so a phone lays the question out at full width.
    // Opacity only covers the wait; the words are revealed even if MathJax never finishes.
    const hidden = ready ? '' : 'opacity-0';
    const formula = inline ? (
        <span key={processedText} ref={containerRef as React.RefObject<HTMLSpanElement>} className={`${classes} ${hidden}`} dir={dir} />
    ) : (
        <div key={processedText} ref={containerRef as React.RefObject<HTMLDivElement>} className={`${classes} ${hidden}`} dir={dir} />
    );

    return (
        <span ref={wrapperRef} className={`relative max-w-full ${inline ? 'inline-block align-middle' : 'block w-full'}`} aria-busy={!ready}>
            {!ready && processedText && (
                <span
                    className="math-skeleton absolute inset-x-0 top-0"
                    style={{ width: skeletonWidth, height: inline ? '0.95em' : '1.35em' }}
                    aria-hidden
                />
            )}
            {formula}
        </span>
    );
};

export default MathRenderer;