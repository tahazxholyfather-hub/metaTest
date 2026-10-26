export const EXIT_NOTICE: string;
export const EXIT_WINDOW_MS: number;

export type HistoryEntry =
    | { kind: 'view'; view: string; path?: string }
    | { kind: 'practice'; step: number; path?: string }
    | { kind: 'tests'; screen: string; path?: string }
    | { kind: 'route'; path: string };

export function applyRouterNote(entry: HistoryEntry, type: string): unknown;
export function armRootBack(now: number): 'pop' | 'trap' | 'leave';
export function bindAppHistory(handlers: {
    onPracticeBack?: () => void;
    onTestScreen?: (screen: string) => void;
    onTrap?: (notice: string) => void;
    onChange?: () => void;
    onCustomNavigate?: (detail: {
        replace: boolean;
        kind: string;
        step?: number;
        screen?: string;
    }) => void;
}): () => void;
export function bootstrapHistory(root: HistoryEntry): unknown;
export function canGoBack(): boolean;
export function entryForPath(pathname: string): HistoryEntry;
export function getLiveHistory(): { stack: HistoryEntry[]; guardOnTop: boolean; armedUntil: number } | null;
export function recordForward(entry: HistoryEntry, replaceGuard?: boolean): unknown;
export function sameEntry(a?: HistoryEntry | null, b?: HistoryEntry | null): boolean;
