"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRouter = void 0;
const express_1 = require("express");
exports.healthRouter = (0, express_1.Router)();
exports.healthRouter.get('/', (_req, res) => {
    res.json({
        success: true,
        service: 'realtime-lobby-backend',
        status: 'ok',
        timestamp: new Date().toISOString(),
    });
});
