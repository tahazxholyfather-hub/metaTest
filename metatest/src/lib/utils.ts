import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* -------------------------------------------------------------------------- */
/*                               Shared Helpers                                */
/* -------------------------------------------------------------------------- */

export type QuizResumeConfig = Record<string, unknown>;

export type QuizResumeHistoryItem = {
  id: string;
  timestamp: string;
  config: QuizResumeConfig;
  currentQuestionCount: number;
  totalQuestions: number;
  sessionId?: number | null;
  elapsedSeconds?: number | null;
  remainingSeconds?: number | null;
};

export type ActiveQuizTimerState = {
  mode: "elapsed" | "remaining";
  elapsedSeconds?: number | null;
  remainingSeconds?: number | null;
  savedAt: string;
};

export type ActiveQuizState = {
  id: string;
  timestamp: string;
  config: QuizResumeConfig;
  sessionId: number | null;

  currentQuestionCount: number;
  totalQuestions: number;

  historyIndex: number;

  question: unknown | null;
  history: unknown[];

  selectedOptionId: number | null;
  isAnswered: boolean;
  isCorrect: boolean | null;
  correctOptionId: number | null;
  descriptiveAnswer: string | null;
  optionStats: unknown[];

  isFavorite: boolean;
  isReviewLater: boolean;
  noteText: string;

  timer: ActiveQuizTimerState | null;
};

const QUIZ_HISTORY_STORAGE_KEY = "quiz_resume_history";
const ACTIVE_QUIZ_STATES_STORAGE_KEY = "active_quiz_states";
const MAX_QUIZ_HISTORY_ITEMS = 20;

const isBrowser = typeof window !== "undefined";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};

const safeSortObject = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(safeSortObject);
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = safeSortObject((value as Record<string, unknown>)[key]);
          return acc;
        }, {});
  }

  return value;
};

export const getConfigKey = (config: QuizResumeConfig): string => {
  return JSON.stringify(safeSortObject(config));
};

const sortByNewest = <T extends { timestamp: string }>(items: T[]): T[] => {
  return [...items].sort(
      (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
};

/* -------------------------------------------------------------------------- */
/*                           Validation Helpers                                */
/* -------------------------------------------------------------------------- */

const isValidQuizResumeHistoryItem = (
    value: unknown
): value is QuizResumeHistoryItem => {
  if (!isRecord(value)) return false;

  return (
      typeof value.id === "string" &&
      typeof value.timestamp === "string" &&
      isRecord(value.config) &&
      typeof value.currentQuestionCount === "number" &&
      typeof value.totalQuestions === "number" &&
      (value.sessionId === undefined ||
          value.sessionId === null ||
          typeof value.sessionId === "number") &&
      (value.elapsedSeconds === undefined ||
          value.elapsedSeconds === null ||
          typeof value.elapsedSeconds === "number") &&
      (value.remainingSeconds === undefined ||
          value.remainingSeconds === null ||
          typeof value.remainingSeconds === "number")
  );
};

const isValidActiveQuizTimerState = (
    value: unknown
): value is ActiveQuizTimerState => {
  if (!isRecord(value)) return false;

  return (
      (value.mode === "elapsed" || value.mode === "remaining") &&
      typeof value.savedAt === "string" &&
      (value.elapsedSeconds === undefined ||
          value.elapsedSeconds === null ||
          typeof value.elapsedSeconds === "number") &&
      (value.remainingSeconds === undefined ||
          value.remainingSeconds === null ||
          typeof value.remainingSeconds === "number")
  );
};

const isValidActiveQuizState = (value: unknown): value is ActiveQuizState => {
  if (!isRecord(value)) return false;

  return (
      typeof value.id === "string" &&
      typeof value.timestamp === "string" &&
      isRecord(value.config) &&
      (value.sessionId === null || typeof value.sessionId === "number") &&
      typeof value.currentQuestionCount === "number" &&
      typeof value.totalQuestions === "number" &&
      typeof value.historyIndex === "number" &&
      Array.isArray(value.history) &&
      (value.question === null || typeof value.question === "object") &&
      (value.selectedOptionId === null || typeof value.selectedOptionId === "number") &&
      typeof value.isAnswered === "boolean" &&
      (value.isCorrect === null || typeof value.isCorrect === "boolean") &&
      (value.correctOptionId === null || typeof value.correctOptionId === "number") &&
      (value.descriptiveAnswer === null || typeof value.descriptiveAnswer === "string") &&
      Array.isArray(value.optionStats) &&
      typeof value.isFavorite === "boolean" &&
      typeof value.isReviewLater === "boolean" &&
      typeof value.noteText === "string" &&
      (value.timer === null || isValidActiveQuizTimerState(value.timer))
  );
};

/* -------------------------------------------------------------------------- */
/*                               History API                                   */
/* -------------------------------------------------------------------------- */

export const getQuizResumeHistory = (): QuizResumeHistoryItem[] => {
  if (!isBrowser) return [];

  try {
    const raw = window.localStorage.getItem(QUIZ_HISTORY_STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return sortByNewest(parsed.filter(isValidQuizResumeHistoryItem));
  } catch (error) {
    console.error("Failed to read quiz history:", error);
    return [];
  }
};

export const saveQuizResumeHistory = (
    items: QuizResumeHistoryItem[]
): void => {
  if (!isBrowser) return;

  try {
    const normalized = sortByNewest(
        items.filter(isValidQuizResumeHistoryItem)
    ).slice(0, MAX_QUIZ_HISTORY_ITEMS);

    window.localStorage.setItem(
        QUIZ_HISTORY_STORAGE_KEY,
        JSON.stringify(normalized)
    );
  } catch (error) {
    console.error("Failed to save quiz history:", error);
  }
};

export const upsertQuizResumeHistoryItem = (
    item: Omit<QuizResumeHistoryItem, "timestamp">
): QuizResumeHistoryItem | null => {
  if (!isBrowser) return null;

  try {
    const existing = getQuizResumeHistory();

    const nextItem: QuizResumeHistoryItem = {
      ...item,
      timestamp: new Date().toISOString(),
    };

    const updated = [
      nextItem,
      ...existing.filter((entry) => entry.id !== nextItem.id),
    ];

    saveQuizResumeHistory(updated);
    return nextItem;
  } catch (error) {
    console.error("Failed to upsert quiz history item:", error);
    return null;
  }
};

export const deleteQuizResumeHistoryItem = (id: string): void => {
  if (!isBrowser) return;

  try {
    const existing = getQuizResumeHistory();
    saveQuizResumeHistory(existing.filter((item) => item.id !== id));
  } catch (error) {
    console.error("Failed to delete quiz history item:", error);
  }
};

export const deleteQuizResumeHistoryByConfig = (
    config: QuizResumeConfig
): void => {
  if (!isBrowser) return;

  try {
    const configKey = getConfigKey(config);
    const existing = getQuizResumeHistory();

    saveQuizResumeHistory(
        existing.filter((item) => getConfigKey(item.config) !== configKey)
    );
  } catch (error) {
    console.error("Failed to delete quiz history by config:", error);
  }
};

export const clearQuizResumeHistory = (): void => {
  if (!isBrowser) return;

  try {
    window.localStorage.removeItem(QUIZ_HISTORY_STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear quiz history:", error);
  }
};

/* -------------------------------------------------------------------------- */
/*                           Active Quiz States API                            */
/* -------------------------------------------------------------------------- */

export const getActiveQuizStates = (): ActiveQuizState[] => {
  if (!isBrowser) return [];

  try {
    const raw = window.localStorage.getItem(ACTIVE_QUIZ_STATES_STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return sortByNewest(parsed.filter(isValidActiveQuizState)).slice(
        0,
        MAX_QUIZ_HISTORY_ITEMS
    );
  } catch (error) {
    console.error("Failed to read active quiz states:", error);
    return [];
  }
};

export const saveActiveQuizStates = (states: ActiveQuizState[]): void => {
  if (!isBrowser) return;

  try {
    const normalized = sortByNewest(
        states.filter(isValidActiveQuizState)
    ).slice(0, MAX_QUIZ_HISTORY_ITEMS);

    window.localStorage.setItem(
        ACTIVE_QUIZ_STATES_STORAGE_KEY,
        JSON.stringify(normalized)
    );
  } catch (error) {
    console.error("Failed to save active quiz states:", error);
  }
};

export const getActiveQuizStateById = (id: string): ActiveQuizState | null => {
  const states = getActiveQuizStates();
  return states.find((item) => item.id === id) ?? null;
};

export const getActiveQuizStateByConfig = (
    config: QuizResumeConfig
): ActiveQuizState | null => {
  const configKey = getConfigKey(config);
  const states = getActiveQuizStates();

  return states.find((item) => getConfigKey(item.config) === configKey) ?? null;
};

export const upsertActiveQuizState = (
    state: Omit<ActiveQuizState, "timestamp">
): ActiveQuizState | null => {
  if (!isBrowser) return null;

  try {
    const existing = getActiveQuizStates();

    const nextState: ActiveQuizState = {
      ...state,
      timestamp: new Date().toISOString(),
    };

    const updated = [
      nextState,
      ...existing.filter((item) => item.id !== nextState.id),
    ];

    saveActiveQuizStates(updated);

    upsertQuizResumeHistoryItem({
      id: nextState.id,
      config: nextState.config,
      currentQuestionCount: nextState.currentQuestionCount,
      totalQuestions: nextState.totalQuestions,
      sessionId: nextState.sessionId,
      elapsedSeconds: nextState.timer?.elapsedSeconds ?? null,
      remainingSeconds: nextState.timer?.remainingSeconds ?? null,
    });

    return nextState;
  } catch (error) {
    console.error("Failed to upsert active quiz state:", error);
    return null;
  }
};

export const deleteActiveQuizStateById = (id: string): void => {
  if (!isBrowser) return;

  try {
    const existing = getActiveQuizStates();
    saveActiveQuizStates(existing.filter((item) => item.id !== id));
    deleteQuizResumeHistoryItem(id);
  } catch (error) {
    console.error("Failed to delete active quiz state by id:", error);
  }
};

export const deleteActiveQuizStateByConfig = (
    config: QuizResumeConfig
): void => {
  if (!isBrowser) return;

  try {
    const configKey = getConfigKey(config);
    const existing = getActiveQuizStates();

    const matched = existing.filter(
        (item) => getConfigKey(item.config) === configKey
    );

    saveActiveQuizStates(
        existing.filter((item) => getConfigKey(item.config) !== configKey)
    );

    matched.forEach((item) => deleteQuizResumeHistoryItem(item.id));
  } catch (error) {
    console.error("Failed to delete active quiz state by config:", error);
  }
};

export const clearActiveQuizStates = (): void => {
  if (!isBrowser) return;

  try {
    window.localStorage.removeItem(ACTIVE_QUIZ_STATES_STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear active quiz states:", error);
  }
};

export const clearAllQuizResumeData = (): void => {
  clearQuizResumeHistory();
  clearActiveQuizStates();
};

/* -------------------------------------------------------------------------- */
/*                              Timer Helpers                                  */
/* -------------------------------------------------------------------------- */

export const getResumedElapsedSeconds = (
    timer: ActiveQuizTimerState | null
): number | null => {
  if (!timer || timer.mode !== "elapsed") return null;
  if (typeof timer.elapsedSeconds !== "number") return null;

  return timer.elapsedSeconds;
};

export const getResumedRemainingSeconds = (
    timer: ActiveQuizTimerState | null
): number | null => {
  if (!timer || timer.mode !== "remaining") return null;
  if (typeof timer.remainingSeconds !== "number") return null;

  return timer.remainingSeconds;
};
