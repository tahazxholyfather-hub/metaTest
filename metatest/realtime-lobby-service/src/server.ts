import http from 'http';
import { app } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { createSocketServer, shutdownSocketServer } from './socket/socket.server';

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

    let shuttingDown = false;

    const shutdown = async (signal: string) => {
        if (shuttingDown) return;
        shuttingDown = true;

        logger.warn({ signal }, 'Shutdown signal received');

        const forceExit = setTimeout(() => {
            logger.error('Forced shutdown after timeout');
            process.exit(1);
        }, 10_000);
        forceExit.unref?.();

        try {
            await shutdownSocketServer();
        } catch (err) {
            logger.error({ err }, 'Error while closing sockets/storage');
        }

        server.close((err) => {
            if (err) {
                logger.error({ err }, 'Error while closing server');
                process.exit(1);
            }
            logger.info('HTTP server closed');
            process.exit(0);
        });
    };

    process.on('SIGINT', () => {
        void shutdown('SIGINT');
    });
    process.on('SIGTERM', () => {
        void shutdown('SIGTERM');
    });

    process.on('uncaughtException', (err) => {
        logger.fatal({ err }, 'Uncaught exception');
        void shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
        logger.fatal({ reason }, 'Unhandled rejection');
    });
}

void bootstrap();
