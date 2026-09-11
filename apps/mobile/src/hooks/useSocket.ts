import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../api/client';

// Module-level singleton: every screen that calls useSocket() shares the same
// connection instead of each opening its own. The socket is created once per
// token and torn down when the token disappears (logout).
let sharedSocket: Socket | null = null;
let sharedSocketToken: string | null = null;

function getSharedSocket(token: string): Socket {
  if (sharedSocket && sharedSocketToken === token) return sharedSocket;
  sharedSocket?.disconnect();
  const origin = API_BASE_URL.replace(/\/api\/?$/, '');
  sharedSocket = io(origin, { auth: { token }, transports: ['websocket'] });
  sharedSocketToken = token;
  return sharedSocket;
}

function releaseSharedSocket() {
  sharedSocket?.disconnect();
  sharedSocket = null;
  sharedSocketToken = null;
}

/**
 * Subscribes to real-time events on the shared session socket. Pass listeners
 * to react to server-pushed events (new message, emergency accepted, ambulance
 * location, etc). Listeners are attached/detached per-component so multiple
 * screens can each listen for their own events on the one connection.
 */
export function useSocket(listeners?: Record<string, (payload: any) => void>) {
  const { token } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) {
      releaseSharedSocket();
      socketRef.current = null;
      return;
    }

    const socket = getSharedSocket(token);
    socketRef.current = socket;

    if (listeners) {
      for (const [event, handler] of Object.entries(listeners)) {
        socket.on(event, handler);
      }
    }

    return () => {
      // Only remove this component's listeners - never disconnect the shared
      // socket here, since other mounted screens may still be using it.
      if (listeners) {
        for (const [event, handler] of Object.entries(listeners)) {
          socket.off(event, handler);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return socketRef;
}
