import { useEffect, useState, type CSSProperties } from 'react';
import { flowApi } from './authApi';
import {
    emptyDocument,
    resolveSurface,
    toCssVars,
    type QuestionSurface,
} from '../backend/questionDisplay.js';

let cached: Promise<ReturnType<typeof emptyDocument>> | null = null;

export function loadQuestionDisplay() {
    if (!cached) {
        cached = flowApi.dispatch('get_question_display')
            .then((res: { success?: boolean; document?: unknown }) => (
                res?.success && res.document ? res.document : emptyDocument()
            ))
            .catch(() => emptyDocument()) as Promise<ReturnType<typeof emptyDocument>>;
    }
    return cached;
}

export function clearQuestionDisplayCache() {
    cached = null;
}

export function useQuestionDisplay(surface: QuestionSurface): CSSProperties {
    const [document, setDocument] = useState(() => emptyDocument());

    useEffect(() => {
        let live = true;
        loadQuestionDisplay().then((next) => {
            if (live) setDocument(next);
        });
        return () => {
            live = false;
        };
    }, []);

    return toCssVars(resolveSurface(document, surface)) as CSSProperties;
}
