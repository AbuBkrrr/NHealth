import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import { env } from '../config/env';

export function initSockets(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.corsOrigin },
  });

  // Every socket must present the same JWT used for REST calls.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('Missing auth token'));
    try {
      const payload = verifyToken(token);
      socket.data.userId = payload.userId;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error('Invalid auth token'));
    }
  });

  io.on('connection', (socket) => {
    const { userId, role } = socket.data;
    // Personal room: direct messages and per-user notifications.
    socket.join(`user:${userId}`);
    // Role room: broadcasts like "new emergency request" to all ambulances.
    socket.join(`role:${role}`);

    socket.on('ambulance:location', (data: { lat: number; lng: number }) => {
      if (role !== 'AMBULANCE') return;
      // Broadcast this ambulance's live location to anyone tracking it
      // (e.g. the patient who requested it).
      socket.broadcast.emit('ambulance:location', { userId, ...data });
    });

    socket.on('disconnect', () => {
      // No explicit cleanup needed; Socket.io removes room memberships automatically.
    });
  });

  return io;
}
