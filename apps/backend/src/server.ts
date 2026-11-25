import http from 'http';
import { createApp } from './app';
import { initSockets } from './sockets';
import { env } from './config/env';
import { prisma, initializeDatabase } from './config/prisma';
import { bindIo } from './services/notify';
import { startScheduler } from './services/scheduler';
import { ensureReferenceData } from './services/referenceData';

async function start() {
  await initializeDatabase();
  console.log('Database ready');
  await ensureReferenceData().catch((e) => console.error('[reference-data]', e));

  const app = createApp();
  const httpServer = http.createServer(app);
  const io = initSockets(httpServer);
  app.set('io', io);
  bindIo(io);
  startScheduler();

  httpServer.listen(env.port, () => {
    console.log(`N-Health API listening on port ${env.port} (${env.nodeEnv})`);
  });

  const shutdown = () => {
    console.log('Shutting down...');
    httpServer.close(() => prisma.$disconnect().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
