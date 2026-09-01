import http from 'http';
import { app } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { createSocketServer } from './socket/socket.server';

async function bootstrap() {
    const server = http.createServer(app);

    createSocketServer(server);

    server.listen(env.PORT, () => {
        logger.info(
            {
                port: env.PORT,
                nodeEnv: env.NODE_ENV,
            },
            'Realtime lobby backend started',
        );
    });

    const shutdown = (signal: string) => {
        logger.warn({ signal }, 'Shutdown signal received');
        server.close((err) => {
            if (err) {
                logger.error({ err }, 'Error while closing server');
                process.exit(1);
            }
            logger.info('HTTP server closed');
            process.exit(0);
        });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    process.on('uncaughtException', (err) => {
        logger.fatal({ err }, 'Uncaught exception');
    });

    process.on('unhandledRejection', (reason) => {
        logger.fatal({ reason }, 'Unhandled rejection');
    });
}

bootstrap();
