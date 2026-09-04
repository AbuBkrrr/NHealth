import http from 'http';
import { createApp } from './app';
import { initSockets } from './sockets';
import { env } from './config/env';

const app = createApp();
const httpServer = http.createServer(app);

const io = initSockets(httpServer);
app.set('io', io);

httpServer.listen(env.port, () => {
  console.log(`N-Health API listening on port ${env.port} (${env.nodeEnv})`);
});
