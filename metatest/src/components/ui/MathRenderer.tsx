// src/components/MathRenderer.tsx

import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const MATHJAX_SCRIPT_URL = '/mathjax/tex-mml-chtml.js';
const MATHJAX_FONT_PATH = '/mathjax-newcm-font';

declare global {
    interface Window {
        MathJax?: any;
    }
}

// Singleton loader: the script is injected exactly once for the whole app
let mathJaxPromise: Promise<boolean> | null = null;

export const loadMathJax = (): Promise<boolean> => {
    if (mathJaxPromise) return mathJaxPromise;

    mathJaxPromise = new Promise<boolean>((resolve) => {
        // Already fully loaded (e.g. earlier in this session)
        if (window.MathJax?.typesetPromise) {
            resolve(true);
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
        script.onload = () => {
            const startupPromise = window.MathJax?.startup?.promise;
            if (startupPromise) {
                startupPromise.then(() => resolve(true)).catch(() => resolve(false));
            } else {
                resolve(true);
            }
        };
        script.onerror = () => {
            console.error(
                `MathJax could not be loaded from ${MATHJAX_SCRIPT_URL}. ` +
                `Make sure the mathjax v4 package was copied into the public folder (see MathRenderer.tsx header).`
            );
            resolve(false); // fall back to plain-text rendering
        };
        document.head.appendChild(script);
    });

    return mathJaxPromise;
};

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
}

export const MathRenderer: React.FC<MathRendererProps> = ({
                                                              text,
                                                              subject,
                                                              className = '',
                                                              inline = false,
                                                          }) => {
    const containerRef = useRef<HTMLElement | null>(null);
    const [ready, setReady] = useState(false);
    const [trackedText, setTrackedText] = useState(text);
    if (trackedText !== text) {
        setTrackedText(text);
        setReady(false);
    }

    const processedText = useMemo(() => {
        if (!text) return '';
        const normalized = normalizeAssistantText(text);
        return isChemistrySubject(subject) ? formatChemistryText(normalized) : normalized;
    }, [text, subject]);

    useEffect(() => {
        let cancelled = false;
        const element = containerRef.current;
        if (!element || !processedText) return;
        setReady(false);

        const finish = () => {
            if (!cancelled) setReady(true);
        };

        loadMathJax().then((loaded) => {
            if (!loaded || cancelled || !containerRef.current) {
                finish();
                return;
            }
            try {
                // Clear previous typeset state for this element, then typeset only this node
                window.MathJax.typesetClear?.([containerRef.current]);
                window.MathJax
                    .typesetPromise([containerRef.current])
                    .then(finish)
                    .catch((err: any) => {
                        console.error('MathRenderer typeset failed:', err);
                        finish();
                    });
            } catch (err) {
                console.error('MathRenderer typeset failed:', err);
                finish();
            }
        });

        return () => {
            cancelled = true;
            try {
                window.MathJax?.typesetClear?.([element]);
            } catch { /* MathJax not loaded yet — nothing to clear */ }
        };
    }, [processedText]);

    const classes = `whitespace-pre-wrap break-words leading-relaxed math-renderer ${className}`;
    const plainLength = processedText.replace(/[$\\{}]/g, '').trim().length;
    const skeletonWidth = inline
        ? `${Math.min(12, Math.max(2.2, plainLength * 0.45))}em`
        : 'min(100%, 16em)';

    const formula = inline ? (
        <span key={processedText} ref={containerRef as React.RefObject<HTMLSpanElement>} className={`${classes} ${ready ? '' : 'absolute inset-0 opacity-0'}`} dir="auto">
            {processedText}
        </span>
    ) : (
        <div key={processedText} ref={containerRef as React.RefObject<HTMLDivElement>} className={`${classes} ${ready ? '' : 'absolute inset-x-0 top-0 opacity-0'}`} dir="auto">
            {processedText}
        </div>
    );

    return (
        <span className={`relative ${inline ? 'inline-block align-middle' : 'block w-full'}`} aria-busy={!ready}>
            {!ready && processedText && (
                <span
                    className="math-skeleton"
                    style={{ width: skeletonWidth, height: inline ? '0.95em' : '2.3em' }}
                    aria-hidden
                />
            )}
            {formula}
        </span>
    );
};

export default MathRenderer;