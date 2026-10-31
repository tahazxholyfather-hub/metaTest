import type { Server } from 'socket.io';
import type Redis from 'ioredis';

let io: Server | null = null;
const adapterClients: Redis[] = [];

export function setIO(server: Server): void {
    io = server;
}

export function getIO(): Server | null {
    return io;
}

export function registerAdapterClient(client: Redis): void {
    adapterClients.push(client);
}

export async function closeSocketResources(): Promise<void> {
    if (io) {
        await new Promise<void>((resolve) => {
            io?.close(() => resolve());
        });
        io = null;
    }

    await Promise.all(
        adapterClients.splice(0).map(async (client) => {
            try {
                client.disconnect();
            } catch {
                // ignore
            }
        }),
    );
}
