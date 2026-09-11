import http from 'http';
import { createApp } from './app';
import { initSockets } from './sockets';
import { env } from './config/env';
import { prisma, initializeDatabase } from './config/prisma';

async function start() {
  try {
    console.log('Initializing database...');
    await initializeDatabase();
    console.log('Database ready!');
  } catch (error) {
    console.error('Database error:', error);
  }

  const app = createApp();
  const httpServer = http.createServer(app);

  const io = initSockets(httpServer);
  app.set('io', io);

  httpServer.listen(env.port, () => {
    console.log(`N-Health API listening on port ${env.port} (${env.nodeEnv})`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
