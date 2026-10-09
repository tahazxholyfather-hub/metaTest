import { Router } from 'express';
import { env } from '../../config/env';
import { getStorage } from '../../storage/storage.factory';
import { getIO } from '../../socket/io.registry';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
    const storageOk = await getStorage().healthCheck();
    const io = getIO();

    res.status(storageOk ? 200 : 503).json({
        success: storageOk,
        service: 'realtime-lobby-backend',
        status: storageOk ? 'ok' : 'degraded',
        storage: env.STORAGE_DRIVER,
        connections: io?.engine?.clientsCount ?? 0,
        timestamp: new Date().toISOString(),
    });
});
