import 'express-async-errors';
import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import accountRoutes from './routes/accountRoutes';
import authRoutes from './routes/authRoutes';
import patientRoutes from './routes/patientRoutes';
import ambulanceRoutes from './routes/ambulanceRoutes';
import doctorRoutes from './routes/doctorRoutes';
import labRoutes from './routes/labRoutes';
import nurseRoutes from './routes/nurseRoutes';
import pharmacyRoutes from './routes/pharmacyRoutes';
import providerRoutes from './routes/providerRoutes';
import messageRoutes from './routes/messageRoutes';
import paymentRoutes from './routes/paymentRoutes';
import adminRoutes from './routes/adminRoutes';
import { errorHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json());
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

  // Serves uploaded avatars back out as plain static files.
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/account', accountRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/patient', patientRoutes);
  app.use('/api/doctor', doctorRoutes);
  app.use('/api/ambulance', ambulanceRoutes);
  app.use('/api/lab', labRoutes);
  app.use('/api/nurse', nurseRoutes);
  app.use('/api/pharmacy', pharmacyRoutes);
  app.use('/api/providers', providerRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/admin', adminRoutes);

  // 404 fallback
  app.use((req, res) => res.status(404).json({ error: `No route for ${req.method} ${req.path}` }));

  app.use(errorHandler);

  return app;
}
