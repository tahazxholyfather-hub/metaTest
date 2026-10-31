export function assessReply(
    text: string,
    finishReason?: string | null,
    opts?: { outputTokens?: number; maxTokens?: number; userStopped?: boolean }
): { incomplete: boolean; reason: string };

export function collapseRepeatedParagraphs(text: string): string;

export function continuationInstruction(tail: string): string;

export function endsCleanly(text: string): boolean;

export function hasUnclosedMath(text: string): boolean;

export function isContinuableFinish(finishReason: string | null | undefined, content: string, status?: string | null): boolean;

export function normalizeAssistantText(text: string): string;

export function rewindForPrompt(text: string): string;

export function stitchContinuation(previous: string, addition: string): string;

export function storedFinishReason(assessment: { incomplete: boolean; reason?: string | null }): string;
