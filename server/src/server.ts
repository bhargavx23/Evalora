import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { ENV } from './config/env.js';
import { connectDB } from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import { User } from './models/User.js';
import { seedDatabase } from './utils/seedData.js';
import { seedDefaultPlans } from './config/plans.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import collegeRoutes from './routes/collegeRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import questionRoutes from './routes/questionRoutes.js';
import assessmentRoutes from './routes/assessmentRoutes.js';
import practiceRoutes from './routes/practiceRoutes.js';
import submissionRoutes from './routes/submissionRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import userRoutes from './routes/userRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import domainRoutes from './routes/domainRoutes.js';
import adaptiveRoutes from './routes/adaptiveRoutes.js';
import visualizerRoutes from './routes/visualizerRoutes.js';
import { seedDefaultDomains } from './config/domains.js';
import { seedDefaultVisualizerSamples } from './config/visualizerSamples.js';
import { adaptiveSchedulerJob } from './jobs/index.js';

const app = express();

// Security and utility middlewares
app.use(helmet({
  contentSecurityPolicy: false // Disable CSP for local dev/Monaco workers
}));
app.use(cors({
  origin: [ENV.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (ENV.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Gentle rate limiting for API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api', apiLimiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    platform: 'Evalora'
  });
});

// Mount modular API routes
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/colleges', collegeRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/domains', domainRoutes);
app.use('/api/adaptive', adaptiveRoutes);
app.use('/api/visualizer', visualizerRoutes);

// Centralized error handling
app.use(errorHandler);

// Server startup
async function bootstrap() {
  await connectDB();
  await seedDefaultPlans();
  await seedDefaultDomains();
  await seedDefaultVisualizerSamples();
  adaptiveSchedulerJob.start();

  // Auto-seed if database is blank
  const userCount = await User.countDocuments();
  if (userCount === 0) {
    console.log('[Evalora Server] Blank database detected. Auto-seeding initial colleges and questions...');
    await seedDatabase();
  }

  app.listen(ENV.PORT, () => {
    console.log(`====================================================`);
    console.log(`  EVALORA API SERVER RUNNING ON PORT ${ENV.PORT}`);
    console.log(`  Environment: ${ENV.NODE_ENV}`);
    console.log(`  Client Origin: ${ENV.CLIENT_URL}`);
    console.log(`====================================================`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  bootstrap().catch(err => {
    console.error('Failed to bootstrap server:', err);
    process.exit(1);
  });
}

export default app;
