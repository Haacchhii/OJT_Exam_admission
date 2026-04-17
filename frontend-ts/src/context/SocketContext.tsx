import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { getToken } from '../api/client';

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextValue>({ socket: null, isConnected: false });

export function useSocket() {
  return useContext(SocketContext);
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuth();

  const socketEnabled = (() => {
    const raw = String(import.meta.env.VITE_ENABLE_SOCKET || '').trim().toLowerCase();
    if (!raw) return import.meta.env.DEV;
    return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
  })();

  useEffect(() => {
    const token = getToken();

    if (!socketEnabled) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setIsConnected(false);
      return;
    }
    
    if (!user || !token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // Connect to server (adjust base URL if needed based on Vite config/env)
    const backendUrl = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '') || window.location.origin;
    
    const newSocket = io(backendUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Number.MAX_SAFE_INTEGER,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    const emitDataReconcile = () => {
      window.dispatchEvent(new Event('gk:data-changed'));
    };

    newSocket.on('connect', () => {
      setIsConnected(true);
      emitDataReconcile();
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('connect_error', () => {
      setIsConnected(false);
    });

    const onReconnect = () => {
      emitDataReconcile();
    };
    newSocket.io.on('reconnect', onReconnect);

    setSocket(newSocket);

    return () => {
      newSocket.io.off('reconnect', onReconnect);
      newSocket.disconnect();
    };
  }, [user, socketEnabled]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}
