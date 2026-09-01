import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { healthRouter } from './routes/health.route';
import { errorMiddleware } from './middlewares/error.middleware';

export function createApp() {
    const app = express();
    // --- ADD THIS LINE ---
    app.set('trust proxy', 1);
    // ---------------------
    app.use(
        cors({
            origin: env.CORS_ORIGINS,
            credentials: true,
        }),
    );

    app.use(helmet());
    app.use(compression());
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true }));

    app.use(
        rateLimit({
            windowMs: 60 * 1000,
            max: 120,
            standardHeaders: true,
            legacyHeaders: false,
        }),
    );

    app.use('/health', healthRouter);

    app.use(errorMiddleware);

    return app;
}
