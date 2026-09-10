/* eslint-disable react-refresh/only-export-components -- Met ships its theme helpers alongside the component */
/**
 * Met — the AI's official identity in MetaTest.
 *
 * Thin, branded wrapper around the eyes-only `AICharacter` engine
 * (`./character`, vendored from the `ai-character-eyes` prototype). Every
 * screen that shows the AI must render `Met`, never `AICharacter` directly,
 * so theming, chat-status → animation mapping, and subject → colour mapping
 * live in exactly one place.
 */
import type { CSSProperties, Ref } from 'react';
import { AICharacter } from './character';
import type { AICharacterHandle, AICharacterProps, AICharacterState, Vec2 } from './character';

export type MetHandle = AICharacterHandle;
export type MetState = AICharacterState;

/** Named body themes. Everything is a soft, slightly purple-leaning pastel so black eyes read well on the dark UI. */
export const MET_THEMES = {
    violet: { body: '#C9B8FF', eye: '#171226', accent: '#8B5CF6' },
    blue: { body: '#B9D4FF', eye: '#0E1628', accent: '#3B82F6' },
    green: { body: '#BCE8D3', eye: '#0F1F19', accent: '#10B981' },
    pink: { body: '#FFC3DC', eye: '#241019', accent: '#EC4899' },
    neutral: { body: '#EAE6F7', eye: '#14121C', accent: '#8B5CF6' },
} as const;

export type MetColor = keyof typeof MET_THEMES;

export const MET_COLORS = Object.keys(MET_THEMES) as MetColor[];

export interface MetProps {
    /** Emotional / behavioural state — expressed entirely through the eyes. */
    state?: MetState;
    /** Theme name (preferred) or any CSS colour for the body. */
    color?: MetColor | string;
    /** Eye colour override. Defaults to the theme's eye colour. */
    eyeColor?: string;
    /** CSS size. Numbers are px. Defaults to filling the container width. */
    size?: number | string;
    /** Follow the pointer / finger and react to taps. Keep off for decorative instances. */
    interactive?: boolean;
    /** Force reduced motion. Defaults to the OS preference. */
    reducedMotion?: boolean;
    /** Programmatic gaze (-1..1 each axis, y down). Overrides the pointer. */
    lookAt?: Vec2 | null;
    /** 0..1 loudness that drives the `speaking` rhythm from real audio. */
    audioLevel?: number | null;
    /** 0..1 blend from neutral to the full expression. */
    intensity?: number;
    /** Soft coloured halo behind the body — for the nav rail and hero placements. */
    glow?: boolean;
    className?: string;
    style?: CSSProperties;
    label?: string;
    onBlink?: () => void;
    ref?: Ref<MetHandle>;
}

export function resolveMetTheme(color?: MetColor | string) {
    if (!color) return MET_THEMES.violet;
    if (color in MET_THEMES) return MET_THEMES[color as MetColor];
    return { body: color, eye: MET_THEMES.violet.eye, accent: color };
}

export function Met({
    state = 'idle',
    color = 'violet',
    eyeColor,
    size = '100%',
    interactive = false,
    reducedMotion,
    lookAt = null,
    audioLevel = null,
    intensity = 1,
    glow = false,
    className,
    style,
    label,
    onBlink,
    ref,
}: MetProps) {
    const theme = resolveMetTheme(color);
    const characterProps: AICharacterProps = {
        state,
        interactive,
        size: glow ? '100%' : size,
        color: theme.body,
        eyeColor: eyeColor ?? theme.eye,
        lookAt,
        audioLevel,
        intensity,
        reducedMotion,
        label: label ?? `مِت — ${state}`,
        onBlink,
        ref,
    };

    if (!glow) {
        return <AICharacter {...characterProps} className={className} style={style} />;
    }

    const width = typeof size === 'number' ? `${size}px` : size;
    return (
        <span
            className={className}
            style={{
                display: 'block',
                width,
                aspectRatio: '1 / 1',
                borderRadius: '50%',
                boxShadow: `0 0 0 1px ${theme.accent}22, 0 10px 40px -8px ${theme.accent}66`,
                ...style,
            }}
        >
            <AICharacter {...characterProps} />
        </span>
    );
}

/** Everything the chat pipeline can be doing, from the character's point of view. */
export type MetChatStatus =
    | 'ready'
    | 'listening'
    | 'sending'
    | 'thinking'
    | 'processing'
    | 'generating'
    | 'speaking'
    | 'success'
    | 'error';

export function chatStatusToMetState(status: MetChatStatus): MetState {
    switch (status) {
        case 'listening':
        case 'sending':
            return 'listening';
        case 'thinking':
        case 'processing':
            return 'thinking';
        case 'generating':
        case 'speaking':
            return 'speaking';
        case 'success':
            return 'happy';
        case 'error':
            return 'confused';
        default:
            return 'idle';
    }
}

/** Subject → body theme. Keep in sync with backend `subjects.js` colours. */
export function subjectToMetColor(subjectKey?: string | null): MetColor {
    switch (subjectKey) {
        case 'physics':
            return 'blue';
        case 'biology':
            return 'green';
        case 'chemistry':
            return 'pink';
        case 'math':
        case 'general':
        default:
            return 'violet';
    }
}

export default Met;
