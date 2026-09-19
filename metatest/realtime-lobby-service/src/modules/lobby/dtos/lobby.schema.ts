import { z } from 'zod';

const codeSchema = z.string().trim().min(4).max(16);
const userIdSchema = z.union([z.string().min(1), z.number()]);

export const createLobbySchema = z.object({
    quizId: z.string().min(1).max(100),
    code: codeSchema,
    maxMembers: z.number().int().min(2).max(200).optional(),
});

export const joinLobbySchema = z.object({
    code: codeSchema,
});

export const rejoinLobbySchema = z.object({
    code: codeSchema,
});

export const startLobbySchema = z.object({
    code: codeSchema,
});

export const leaveLobbySchema = z.object({
    code: codeSchema,
});

export const kickMemberSchema = z
    .object({
        code: codeSchema,
        targetUserId: userIdSchema.optional(),
        userId: userIdSchema.optional(),
    })
    .refine((value) => value.targetUserId !== undefined || value.userId !== undefined, {
        message: 'targetUserId is required',
    })
    .transform((value) => ({
        code: value.code,
        targetUserId: value.targetUserId ?? value.userId!,
    }));

export const updateProgressSchema = z.object({
    code: codeSchema,
    answeredCount: z.number().int().min(0),
    finished: z.boolean().optional(),
});

export const submitQuizSchema = z.object({
    code: codeSchema,
    quizId: z.union([z.string(), z.number()]).optional(),
    userId: userIdSchema.optional(),
    answers: z.record(z.string(), z.number()),
    questionIds: z.array(z.number()).optional(),
    timeSpent: z.number().optional(),
    questionTimes: z.record(z.string(), z.number()).optional(),
    selectionLog: z
        .array(
            z.object({
                questionId: z.number(),
                optionId: z.number(),
                timeSpentMs: z.number(),
                timestamp: z.number(),
            }),
        )
        .optional(),
});

export const destroyLobbySchema = z.object({
    code: codeSchema,
});

export const setReadySchema = z.object({
    code: codeSchema,
    isReady: z.boolean(),
});

export const notifyLobbySchema = z.object({
    code: codeSchema,
    message: z.string().trim().min(1).max(200),
    type: z.enum(['info', 'warning', 'error', 'success']).default('info'),
});

export type CreateLobbyDto = z.infer<typeof createLobbySchema>;
export type JoinLobbyDto = z.infer<typeof joinLobbySchema>;
export type RejoinLobbyDto = z.infer<typeof rejoinLobbySchema>;
export type StartLobbyDto = z.infer<typeof startLobbySchema>;
export type LeaveLobbyDto = z.infer<typeof leaveLobbySchema>;
export type KickMemberDto = z.infer<typeof kickMemberSchema>;
export type UpdateProgressDto = z.infer<typeof updateProgressSchema>;
export type SubmitQuizDto = z.infer<typeof submitQuizSchema>;
export type DestroyLobbyDto = z.infer<typeof destroyLobbySchema>;
export type SetReadyDto = z.infer<typeof setReadySchema>;
export type NotifyLobbyDto = z.infer<typeof notifyLobbySchema>;
