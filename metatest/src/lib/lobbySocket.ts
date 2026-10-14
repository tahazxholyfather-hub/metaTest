import { io, Socket } from 'socket.io-client';
import { isLocalhost, realtimeUrl } from '../runtime';

const SOCKET_URL = realtimeUrl;

export class LobbySocketService {
    private socket: Socket | null = null;

    public connect() {
        if (!this.socket) {
            this.socket = io(SOCKET_URL, {
                transports: isLocalhost ? ['websocket', 'polling'] : ['polling'],
                upgrade: isLocalhost,
                autoConnect: true,
            });

            this.socket.on('connect', () => {
                console.log('Connected to real-time lobby server:', this.socket?.id);
            });

            this.socket.on('disconnect', () => {
                console.log('Disconnected from lobby server');
            });
        }
        return this.socket;
    }

    public getSocket() {
        if (!this.socket) {
            return this.connect();
        }
        return this.socket;
    }

    public disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }
}

// Export a single instance to be used across the app
export const lobbySocketService = new LobbySocketService();
