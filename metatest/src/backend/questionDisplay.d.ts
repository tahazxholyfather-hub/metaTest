export type QuestionSurface = 'practice' | 'exam' | 'examReview';

export interface DisplayField {
    key: string;
    label: string;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    kind?: 'weight' | 'columns';
}

export interface DisplayBlock {
    block: string;
    label: string;
    fields: DisplayField[];
}

export interface QuestionDisplayDocument {
    version: number;
    base: Record<string, Record<string, number>>;
    surfaces: Record<QuestionSurface, Record<string, Record<string, number>>>;
}

export function editorBlocks(scope: 'base' | QuestionSurface): DisplayBlock[];
export function emptyDocument(): QuestionDisplayDocument;
export function forceDisplayMode(vars: Record<string, string>, mode: 'mobile' | 'desktop'): Record<string, string>;
export function resolveSurface(document: unknown, surface: QuestionSurface): Record<string, Record<string, number>>;
export function sanitizeDocument(input: unknown): QuestionDisplayDocument;
export function toCssVars(resolved: Record<string, Record<string, number>>): Record<string, string>;

export const SURFACES: QuestionSurface[];
export const SURFACE_DEFAULTS: Record<QuestionSurface, Record<string, Record<string, number>>>;
export const WEIGHTS: number[];
