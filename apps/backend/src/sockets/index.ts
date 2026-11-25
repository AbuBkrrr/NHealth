import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import { env } from '../config/env';
import { prisma } from '../config/prisma';

export function initSockets(httpServer: HttpServer) {
  const origins = (env.corsOrigin || '').split(',').map((s) => s.trim()).filter(Boolean);
  const io = new Server(httpServer, {
    cors: { origin: origins.includes('*') ? true : ['https://www.nhealth.com.ng', 'https://nhealth.com.ng', 'http://localhost:5173', ...origins] },
  });

  // Every socket must present the same JWT used for REST calls.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('Missing auth token'));
    try {
      const payload = verifyToken(token, env.jwtSecret);
      socket.data.userId = payload.userId;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error('Invalid auth token'));
    }
  });

  io.on('connection', (socket) => {
    const { userId, role } = socket.data;
    socket.join(`user:${userId}`);
    socket.join(`role:${role}`);

    // Ambulance live location: persisted, and sent ONLY to the patient(s) whose active emergency
    // this ambulance is serving - never broadcast to everyone.
    socket.on('ambulance:location', async (data: { lat: number; lng: number }) => {
      if (role !== 'AMBULANCE' || typeof data?.lat !== 'number' || typeof data?.lng !== 'number') return;
      try {
        const amb = await prisma.ambulanceProfile.update({
          where: { userId }, data: { currentLat: data.lat, currentLng: data.lng, lastLocationAt: new Date() },
        });
        const active = await prisma.emergencyRequest.findMany({
          where: { ambulanceId: amb.id, status: { in: ['ACCEPTED', 'EN_ROUTE', 'ARRIVED'] } },
          include: { patient: { select: { userId: true } } },
        });
        active.forEach((r) => io.to(`user:${r.patient.userId}`).emit('ambulance:location', { requestId: r.id, lat: data.lat, lng: data.lng, at: Date.now() }));
      } catch { /* ignore */ }
    });

    // Typing indicator for chat
    socket.on('message:typing', (data: { to: string }) => {
      if (data?.to) io.to(`user:${data.to}`).emit('message:typing', { from: userId });
    });
  });

  return io;
}
