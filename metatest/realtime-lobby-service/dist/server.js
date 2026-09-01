"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const app_1 = require("./app");
const env_1 = require("./config/env");
const logger_1 = require("./config/logger");
const socket_server_1 = require("./socket/socket.server");
async function bootstrap() {
    const server = http_1.default.createServer(app_1.app);
    (0, socket_server_1.createSocketServer)(server);
    server.listen(env_1.env.PORT, () => {
        logger_1.logger.info({
            port: env_1.env.PORT,
            nodeEnv: env_1.env.NODE_ENV,
        }, 'Realtime lobby backend started');
    });
    const shutdown = (signal) => {
        logger_1.logger.warn({ signal }, 'Shutdown signal received');
        server.close((err) => {
            if (err) {
                logger_1.logger.error({ err }, 'Error while closing server');
                process.exit(1);
            }
            logger_1.logger.info('HTTP server closed');
            process.exit(0);
        });
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('uncaughtException', (err) => {
        logger_1.logger.fatal({ err }, 'Uncaught exception');
    });
    process.on('unhandledRejection', (reason) => {
        logger_1.logger.fatal({ reason }, 'Unhandled rejection');
    });
}
bootstrap();
