import { z } from 'zod';

export const createLobbySchema = z.object({
    quizId: z.string().min(1).max(100),
});

export const joinLobbySchema = z.object({
    code: z.string().min(4).max(12),
});

export const startLobbySchema = z.object({
    code: z.string().min(4).max(12),
});

export const leaveLobbySchema = z.object({
    code: z.string().min(4).max(12),
});

export const kickMemberSchema = z.object({
    code: z.string().min(4).max(12),
    targetUserId: z.string().min(1),
});

export const updateProgressSchema = z.object({
    code: z.string().min(4).max(12),
    answeredCount: z.number().int().min(0),
    finished: z.boolean().optional(),
});

export const submitQuizSchema = z.object({
    code: z.string().min(4).max(12),
    answers: z.array(
        z.object({
            questionId: z.string().min(1),
            answer: z.any(),
        }),
    ),
});

export const destroyLobbySchema = z.object({
    code: z.string().min(4).max(12),
});

export type CreateLobbyDto = z.infer<typeof createLobbySchema>;
export type JoinLobbyDto = z.infer<typeof joinLobbySchema>;
export type StartLobbyDto = z.infer<typeof startLobbySchema>;
export type LeaveLobbyDto = z.infer<typeof leaveLobbySchema>;
export type KickMemberDto = z.infer<typeof kickMemberSchema>;
export type UpdateProgressDto = z.infer<typeof updateProgressSchema>;
export type SubmitQuizDto = z.infer<typeof submitQuizSchema>;
export type DestroyLobbyDto = z.infer<typeof destroyLobbySchema>;
