import creditsRoutes from './routes/creditsRoutes';
import webhookRoutes from './routes/webhookRoutes'
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
import escrowRoutes from './routes/escrowRoutes';
import providerBankRoutes from './routes/providerBankRoutes';
import providerListRoutes from './routes/providerListRoutes';

export function createApp() {
  const app = express();

  // [GLOBAL BODY PARSERS - MUST BE FIRST]
  // These MUST run before any route to parse JSON bodies
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/providers', providerListRoutes);
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  // [/GLOBAL BODY PARSERS]


  // [BULLETPROOF CORS — inserted by fix-cors-top.cjs]
  // Runs FIRST — before any other middleware. Sets CORS headers on EVERY request
  // and handles OPTIONS preflight immediately with 204.
app.use('/api/escrow', escrowRoutes);
app.use('/api/provider', providerBankRoutes);
  app.use((req: any, res: any, next: any) => {
    const origin = req.headers.origin;

    // Always echo back the origin (Bearer tokens don't need credentials flag)
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Vary', 'Origin');

    // Handle preflight IMMEDIATELY
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    next();
  });
  // [/BULLETPROOF CORS]

  // [BODY PARSERS — must run BEFORE any route]
  // Raw body for webhook signature verification
app.use('/api/webhooks', express.raw({ type: 'application/json', limit: '2mb' }), (req: any, res, next) => {
  if (req.body && Buffer.isBuffer(req.body)) {
    req.rawBody = req.body.toString('utf8');
    try { req.body = JSON.parse(req.rawBody); } catch (e) { req.body = {}; }
  }
  next();
});



  // ==================================================
  // 1. EXPLICIT CORS HANDLER — MUST BE FIRST
  //    This runs before any other middleware and sets
  //    headers on every response, including OPTIONS.
  // ==================================================
app.use('/api/webhooks', webhookRoutes);
app.use('/api/credits', creditsRoutes);  
app.use((req, res, next) => {
    const origin = req.headers.origin;

    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) {
      return next();
    }

    const allowedOrigins = [
      'https://www.nhealth.com.ng',
      'https://nhealth.com.ng',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8081',
    ];

    // Check if origin is allowed (exact match or env var '*')
    const isAllowed =
      env.corsOrigin === '*' ||
      allowedOrigins.includes(origin) ||
      env.corsOrigin === origin;

    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
      res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    } else {
      console.log('❌ CORS blocked origin:', origin);
    }

    // Handle preflight OPTIONS request immediately
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    next();
  });

  // ==================================================
  // 2. Helmet (AFTER CORS headers are set)
  // ==================================================
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  }));

  // ==================================================
  // 3. Body parsers and loggers
  // ==================================================

  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

  // Serves uploaded avatars back out as plain static files.
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // ==================================================
  // 4. Routes
  // ==================================================
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