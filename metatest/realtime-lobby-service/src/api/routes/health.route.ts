import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
    res.json({
        success: true,
        service: 'realtime-lobby-backend',
        status: 'ok',
        timestamp: new Date().toISOString(),
    });
});
