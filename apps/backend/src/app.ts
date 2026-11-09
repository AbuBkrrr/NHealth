import 'express-async-errors';
import express from 'express';
import path from 'path';
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
import creditsRoutes from './routes/creditsRoutes';
import webhookRoutes from './routes/webhookRoutes';
import escrowRoutes from './routes/escrowRoutes';
import providerBankRoutes from './routes/providerBankRoutes';
import providerListRoutes from './routes/providerListRoutes';
import platformRoutes from './routes/platformRoutes';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimit';

const DEFAULT_ORIGINS = [
  'https://www.nhealth.com.ng',
  'https://nhealth.com.ng',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:8081',
];

/** CORS_ORIGIN may be "*" (dev only) or a comma-separated allow-list added to the defaults. */
function allowedOrigin(origin: string): boolean {
  const extra = (env.corsOrigin || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (extra.includes('*')) return env.nodeEnv !== 'production' || extra.length === 1;
  return DEFAULT_ORIGINS.includes(origin) || extra.includes(origin) || /^https:\/\/[a-z0-9-]+\.up\.railway\.app$/.test(origin);
}

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // 1. CORS - single, allow-list based. Runs before everything so every response carries headers.
  app.use((req, res, next) => {
    const origin = req.headers.origin as string | undefined;
    if (origin && allowedOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
      res.setHeader('Access-Control-Max-Age', '86400');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(origin && allowedOrigin(origin) ? 204 : 403);
    next();
  });

  // 2. Security headers
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, crossOriginEmbedderPolicy: false }));

  // 3. Webhooks need the exact raw body for signature verification - parse them BEFORE express.json().
  app.use('/api/webhooks', express.raw({ type: '*/*', limit: '2mb' }), (req, _res, next) => {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    req.rawBody = raw;
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
    next();
  }, webhookRoutes);

  // 4. Body parsers (25mb allows base64 images / short videos in chat & documents; storage enforces per-type caps)
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev', { skip: () => env.nodeEnv === 'test' }));

  // Local-disk uploads (dev fallback when Cloudinary is not configured)
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), { maxAge: '7d' }));

  app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

  app.use('/api', apiLimiter);

  // 5. Routes
  app.use('/api/account', accountRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/patient', patientRoutes);
  app.use('/api/doctor', doctorRoutes);
  app.use('/api/ambulance', ambulanceRoutes);
  app.use('/api/lab', labRoutes);
  app.use('/api/nurse', nurseRoutes);
  app.use('/api/pharmacy', pharmacyRoutes);
  app.use('/api/providers', providerListRoutes);
  app.use('/api/providers', providerRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/credits', creditsRoutes);
  app.use('/api/escrow', escrowRoutes);
  app.use('/api/provider', providerBankRoutes);
  app.use('/api', platformRoutes);

  app.use((req, res) => res.status(404).json({ error: `No route for ${req.method} ${req.path}` }));
  app.use(errorHandler);
  return app;
}
