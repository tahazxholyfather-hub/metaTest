"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.destroyLobbySchema = exports.submitQuizSchema = exports.updateProgressSchema = exports.kickMemberSchema = exports.leaveLobbySchema = exports.startLobbySchema = exports.joinLobbySchema = exports.createLobbySchema = void 0;
const zod_1 = require("zod");
exports.createLobbySchema = zod_1.z.object({
    quizId: zod_1.z.string().min(1).max(100),
});
exports.joinLobbySchema = zod_1.z.object({
    code: zod_1.z.string().min(4).max(12),
});
exports.startLobbySchema = zod_1.z.object({
    code: zod_1.z.string().min(4).max(12),
});
exports.leaveLobbySchema = zod_1.z.object({
    code: zod_1.z.string().min(4).max(12),
});
exports.kickMemberSchema = zod_1.z.object({
    code: zod_1.z.string().min(4).max(12),
    targetUserId: zod_1.z.string().min(1),
});
exports.updateProgressSchema = zod_1.z.object({
    code: zod_1.z.string().min(4).max(12),
    answeredCount: zod_1.z.number().int().min(0),
    finished: zod_1.z.boolean().optional(),
});
exports.submitQuizSchema = zod_1.z.object({
    code: zod_1.z.string().min(4).max(12),
    answers: zod_1.z.array(zod_1.z.object({
        questionId: zod_1.z.string().min(1),
        answer: zod_1.z.any(),
    })),
});
exports.destroyLobbySchema = zod_1.z.object({
    code: zod_1.z.string().min(4).max(12),
});
