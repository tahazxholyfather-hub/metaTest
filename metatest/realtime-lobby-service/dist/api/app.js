"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const env_1 = require("../config/env");
const health_route_1 = require("./routes/health.route");
const error_middleware_1 = require("./middlewares/error.middleware");
function createApp() {
    const app = (0, express_1.default)();
    // --- ADD THIS LINE ---
    app.set('trust proxy', 1);
    // ---------------------
    app.use((0, cors_1.default)({
        origin: env_1.env.CORS_ORIGINS,
        credentials: true,
    }));
    app.use((0, helmet_1.default)());
    app.use((0, compression_1.default)());
    app.use(express_1.default.json({ limit: '1mb' }));
    app.use(express_1.default.urlencoded({ extended: true }));
    app.use((0, express_rate_limit_1.default)({
        windowMs: 60 * 1000,
        max: 120,
        standardHeaders: true,
        legacyHeaders: false,
    }));
    app.use('/health', health_route_1.healthRouter);
    app.use(error_middleware_1.errorMiddleware);
    return app;
}
