/**
 * Met — the AI tutor's living character.
 *
 * Thin, branded wrapper around the AICell animation engine. Every screen in
 * the AI Teacher module should render `Met`, not `AICell`, so naming, default
 * sizing conventions, chat-status → animation mapping, and subject → color
 * mapping stay in one place.
 */
import { forwardRef } from 'react';
import { AICell } from './cell';
import type { AICellHandle, AICellProps, CellState, CellColorName } from './cell';

export type MetHandle = AICellHandle;
export type MetState = CellState;
export type MetColor = CellColorName;
export type { CellMood } from './cell';

export type MetProps = AICellProps;

export const Met = forwardRef<MetHandle, MetProps>(function Met(props, ref) {
    return <AICell ref={ref} ariaLabel="مِت" {...props} />;
});

/** Chat pipeline status → Met's animated state. */
export type MetChatStatus = 'ready' | 'sending' | 'thinking' | 'generating' | 'error';

export function chatStatusToMetState(status: MetChatStatus): CellState {
    switch (status) {
        case 'sending':
            return 'listening';
        case 'thinking':
            return 'thinking';
        case 'generating':
            return 'speaking';
        case 'error':
            return 'confused';
        default:
            return 'idle';
    }
}

/** Subject → body color theme. Keep in sync with backend subjects.js colors. */
export function subjectToMetColor(subjectKey?: string): MetColor {
    switch (subjectKey) {
        case 'physics':
            return 'blue';
        case 'biology':
            return 'green';
        case 'chemistry':
            return 'pink';
        case 'math':
        default:
            return 'violet';
    }
}

export default Met;
