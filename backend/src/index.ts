import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/api';
import { DatabaseService } from './services/DatabaseService';
import { AutomationService } from './services/AutomationService';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Enable CORS with credentials for local cookies
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());

// Basic logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Mount routes
app.use('/api', apiRouter);

// Global Error Handler
app.use(errorHandler);

// Bootstrap
async function startServer() {
  try {
    // 1. Initialize Database
    await DatabaseService.initialize();
    
    // 2. Initialize Automations
    await AutomationService.startAll();

    // 3. Start Listening
    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(` JARVIS AI BACKEND RUNNING ON PORT ${PORT} `);
      console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error('Critical: Failed to start JARVIS server:', err);
    process.exit(1);
  }
}

// Graceful Shutdown
const shutdown = async () => {
  console.log('\nShutting down JARVIS services...');
  AutomationService.stopAll();
  await DatabaseService.close();
  console.log('JARVIS services stopped. Exiting.');
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startServer();
