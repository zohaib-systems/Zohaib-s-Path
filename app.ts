import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { User } from './backend/models/User.js'; 

dotenv.config();

const app = express();
const PORT = 3000;

// Trust proxy for secure cookies behind nginx
app.set('trust proxy', 1);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple health check at the top
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.warn('⚠️ MONGODB_URI is not defined. Cloud sync features will be disabled.');
  console.warn('To enable cloud sync, please provide a MONGODB_URI in the Secrets panel.');
} else {
  console.log('⏳ Attempting to connect to MongoDB...');
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => {
      console.error('❌ MongoDB connection error:', err.message);
      
      if (err.message.includes('bad auth') || err.message.includes('authentication failed')) {
        console.error('👉 FIX: Authentication failed. Please check your database username and password.');
        console.error('👉 IMPORTANT: If your password contains special characters (@, #, $, etc.), they MUST be URL-encoded.');
        console.error('   Example: Replace "@" with "%40", "#" with "%23", "$" with "%24".');
      } else if (err.message.includes('EBADNAME')) {
        console.error('👉 FIX: Your connection string format is invalid. Ensure it follows the mongodb+srv://... format.');
      } else if (err.message.includes('whitelist') || err.message.includes('Could not connect to any servers')) {
        console.error('👉 FIX: You need to whitelist your IP in MongoDB Atlas.');
        console.error('   Go to "Network Access" in Atlas and click "Allow Access from Anywhere" (0.0.0.0/0).');
      } else if (err.message.includes('ECONNREFUSED')) {
        console.error('👉 FIX: It looks like you are trying to connect to a local MongoDB. Please use a cloud-hosted MongoDB Atlas URI.');
      }
    });
}

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "img-src": ["'self'", "data:", "https://picsum.photos", "https://*.googleusercontent.com", "https://*.picsum.photos"],
      "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Needed for Vite/React
    },
  },
}));

// Rate limiting for API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { message: 'Too many requests from this IP, please try again after 15 minutes' }
});
app.use('/api/', apiLimiter);

app.use(express.json());

// Profile ID Middleware - Extracts profile ID from headers for cross-device sync
const profileMiddleware = async (req: any, res: any, next: any) => {
  const profileId = req.headers['x-profile-id'] || 'default-global-user';
  
  try {
    let user = await User.findOne({ profileId });
    if (!user) {
      user = await User.create({
        profileId,
        name: 'Guest User',
        goals: [{ 
          title: 'Senior Software Architect', 
          targetDate: '2026-12-01', 
          description: 'Lead large-scale system designs and mentor teams.' 
        }]
      });
    }
    req.currentUser = user;
    next();
  } catch (err: any) {
    console.error('❌ Profile Middleware Error:', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
};

app.use('/api/user', profileMiddleware);
app.use('/api/me', profileMiddleware);

// Normalize APP_URL to remove trailing slash
// On Vercel, VERCEL_URL is provided but doesn't include https://
const VERCEL_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
const APP_URL = (process.env.APP_URL || VERCEL_URL || 'http://localhost:3000').replace(/\/$/, '');

app.get('/api/status', (req, res) => {
  res.json({
    mongodb: mongoose.connection.readyState === 1,
    authenticated: true,
    appUrl: APP_URL,
    env: {
      hasGoogleAuth: false,
      hasMongo: !!process.env.MONGODB_URI,
      isProduction: process.env.NODE_ENV === 'production'
    }
  });
});

app.get('/api/me', (req: any, res) => {
  res.json(req.currentUser);
});

app.post('/api/logout', (req, res) => {
  res.json({ message: 'Logged out' });
});

// Data Routes
app.post('/api/user/sync', async (req: any, res) => {
  const user = req.currentUser;
  try {
    const updatedUser = await User.findByIdAndUpdate(user._id, { 
      ...req.body 
    }, { new: true });
    res.json(updatedUser);
  } catch (err: any) {
    console.error('❌ Sync Error:', err);
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/user/profile', async (req: any, res) => {
  const user = req.currentUser;
  const updateData: any = {};
  if (req.body.name) updateData.name = req.body.name;
  if (req.body.currentRole) updateData.currentRole = req.body.currentRole;
  if (req.body.learningHours !== undefined) updateData.learningHours = req.body.learningHours;
  
  const updatedUser = await User.findByIdAndUpdate(user._id, updateData, { new: true });
  res.json(updatedUser);
});

app.post('/api/user/skills', async (req: any, res) => {
  const user = req.currentUser;
  const updatedUser = await User.findByIdAndUpdate(user._id, { skills: req.body.skills }, { new: true });
  res.json(updatedUser);
});

app.post('/api/user/goals', async (req: any, res) => {
  const user = req.currentUser;
  const updatedUser = await User.findByIdAndUpdate(user._id, { goals: req.body.goals }, { new: true });
  res.json(updatedUser);
});

app.post('/api/user/chat', async (req: any, res) => {
  const user = req.currentUser;
  const updatedUser = await User.findByIdAndUpdate(user._id, { chatMessages: req.body.messages }, { new: true });
  res.json(updatedUser);
});

app.post('/api/user/evaluation', async (req: any, res) => {
  const user = req.currentUser;
  const updatedUser = await User.findByIdAndUpdate(user._id, { 
    evaluation: req.body.evaluation,
    suggestedCourses: req.body.suggestedCourses,
    roadmap: req.body.roadmap
  }, { new: true });
  res.json(updatedUser);
});

app.post('/api/user/psych', async (req: any, res) => {
  const user = req.currentUser;
  const updatedUser = await User.findByIdAndUpdate(user._id, { psychEvaluation: req.body.psychEvaluation }, { new: true });
  res.json(updatedUser);
});

app.post('/api/user/proficiency', async (req: any, res) => {
  const user = req.currentUser;
  const updatedUser = await User.findByIdAndUpdate(user._id, { proficiencyScores: req.body.proficiencyScores }, { new: true });
  res.json(updatedUser);
});

app.post('/api/user/reset', async (req: any, res) => {
  const user = req.currentUser;
  const updatedUser = await User.findByIdAndUpdate(user._id, { 
    skills: [],
    goals: [{ 
      title: 'Senior Software Architect', 
      targetDate: '2026-12-01', 
      description: 'Lead large-scale system designs and mentor teams.' 
    }],
    psychEvaluation: null,
    chatMessages: [{ role: 'model', text: `Hello ${user.name}! I've reset your data. How can I help you start fresh?` }],
    roadmap: [],
    evaluation: '',
    suggestedCourses: [],
    proficiencyScores: {
      Frontend: 0,
      Backend: 0,
      DevOps: 0,
      DataScience: 0,
      MachineLearning: 0
    }
  }, { new: true });
  res.json(updatedUser);
});

// 404 Handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'A server error occurred',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Vite Middleware for Development
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else if (!process.env.VERCEL) {
  // Only serve static files if NOT on Vercel (Vercel handles static serving)
  const distPath = path.resolve(__dirname, 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
}

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
