import { io, Socket } from 'socket.io-client';
import { getToken } from '@/stores/authStore';

// Define a minimal interface for the socket client to abstract Socket.IO specifics
export interface ISocketClient {
  connect(initialCwd?: string): Promise<void>;
  disconnect(): void;
  emit(event: string, ...args: any[]): void;
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener?: (...args: any[]) => void): void;
  isConnected(): boolean;
}

// Default WebSocket server URL from environment variables
const DEFAULT_WS_SERVER_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3003';

/**
 * Factory function to create and manage Socket.IO client instances.
 * Each client created by this factory is isolated and manages its own connection lifecycle.
 * Supports authentication via JWT token from `authStore`.
 */
export const createSocketClient = (namespace: string = '/'): ISocketClient => {
  let socket: Socket | null = null;
  let connectionPromise: Promise<void> | null = null;

  const getSocket = (): Socket => {
    if (!socket) {
      const token = getToken(); // Get token during socket initialization
      const auth = token ? { token } : undefined; // Pass token if available

      socket = io(`${DEFAULT_WS_SERVER_URL}${namespace}`, {
        autoConnect: false,
        transports: ['websocket'],
        auth,
      });

      socket.on('connect', () => {
        console.log(`Socket connected to ${namespace}. ID: ${socket?.id}`);
      });

      socket.on('disconnect', (reason) => {
        console.log(`Socket disconnected from ${namespace}: ${reason}`);
      });

      socket.on('connect_error', (error) => {
        console.error(`Socket connection error for ${namespace}:`, error.message);
      });
    }
    return socket;
  };

  return {
    async connect(initialCwd?: string): Promise<void> {
      if (connectionPromise) return connectionPromise; // Prevent multiple connection attempts

      const s = getSocket();
      if (s.connected) {
        console.log(`Socket ${namespace} already connected.`);
        return Promise.resolve();
      }

      connectionPromise = new Promise((resolve, reject) => {
        const token = getToken(); // Re-fetch token right before connection attempt
        if (!token) {
          const error = new Error('No authentication token.');
          s.emit('connect_error', error); // Emit a local connect_error event
          connectionPromise = null; // Reset promise
          return reject(error);
        }
        
        // Update auth payload just before connecting if token changed
        s.io.opts.auth = { token };

        // Append initialCwd to handshake query if provided
        if (initialCwd) {
            s.io.opts.query = { initialCwd };
        } else {
            delete s.io.opts.query; // Clear if not needed
        }

        s.once('connect', () => {
          connectionPromise = null;
          resolve();
        });
        s.once('connect_error', (error) => {
          connectionPromise = null;
          reject(error);
        });
        s.connect();
      });
      return connectionPromise;
    },

    disconnect(): void {
      if (socket && socket.connected) {
        socket.disconnect();
        socket = null; // Clear the socket instance on disconnect
      }
      connectionPromise = null; // Reset connection promise
    },

    emit(event: string, ...args: any[]): void {
      if (socket && socket.connected) {
        socket.emit(event, ...args);
      } else {
        console.warn(`Attempted to emit '${event}' but socket ${namespace} is not connected.`);
      }
    },

    on(event: string, listener: (...args: any[]) => void): void {
      getSocket().on(event, listener);
    },

    off(event: string, listener?: (...args: any[]) => void): void {
      if (socket) {
        if (listener) {
          socket.off(event, listener);
        } else {
          // Socket.IO's 'off' with only event name removes all listeners for that event
          socket.off(event);
        }
      }
    },

    isConnected(): boolean {
      return socket ? socket.connected : false;
    },
  };
};
