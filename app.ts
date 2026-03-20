import express from 'express';
import mongoose from 'mongoose';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import session from 'express-session';
import MongoStore from 'connect-mongo';
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

// Session configuration
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
const sessionConfig: any = {
  secret: process.env.SESSION_SECRET || 'career-counselor-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    secure: isProduction,
    sameSite: isProduction && !process.env.APP_URL?.includes('run.app') ? 'lax' : 'none', // 'none' for iframe, 'lax' for standalone
    httpOnly: true
  }
};

if (MONGODB_URI) {
  try {
    sessionConfig.store = MongoStore.create({
      mongoUrl: MONGODB_URI,
      ttl: 14 * 24 * 60 * 60, // 14 days
      autoRemove: 'native'
    });
    // Handle store errors to prevent app crash
    sessionConfig.store.on('error', (error: any) => {
      console.error('❌ MongoDB Session Store Error:', error.message);
    });
  } catch (error: any) {
    console.error('❌ Failed to initialize MongoDB session store:', error.message);
    console.warn('⚠️ Falling back to in-memory session store.');
  }
}

app.use(session(sessionConfig));

app.use(passport.initialize());
app.use(passport.session());

// Normalize APP_URL to remove trailing slash
// On Vercel, VERCEL_URL is provided but doesn't include https://
const VERCEL_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
const APP_URL = (process.env.APP_URL || VERCEL_URL || 'http://localhost:3000').replace(/\/$/, '');

if (!process.env.APP_URL && !process.env.VERCEL_URL) {
  console.warn('⚠️ APP_URL is not defined. Google OAuth might fail if the environment is not localhost.');
  console.warn(`Current assumed APP_URL: ${APP_URL}`);
}

// Passport Config
if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === 'dummy') {
  console.warn('⚠️ WARNING: GOOGLE_CLIENT_ID is missing or set to dummy. Google Login will fail with "invalid_client".');
}
if (!process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET === 'dummy') {
  console.warn('⚠️ WARNING: GOOGLE_CLIENT_SECRET is missing or set to dummy. Google Login will fail.');
}

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'dummy',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy',
    callbackURL: `${APP_URL}/auth/google/callback`,
    proxy: true
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ googleId: profile.id });
      if (!user) {
        user = await User.create({
          googleId: profile.id,
          email: profile.emails?.[0].value,
          name: profile.displayName,
          avatar: profile.photos?.[0].value,
          goals: [{ 
            title: 'Senior Software Architect', 
            targetDate: '2026-12-01', 
            description: 'Lead large-scale system designs and mentor teams.' 
          }]
        });
      }
      return done(null, user);
    } catch (err) {
      return done(err as Error);
    }
  }
));

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Auth Routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
  (req, res, next) => {
    passport.authenticate('google', (err: any, user: any, info: any) => {
      if (err) {
        console.error('❌ Passport Auth Error:', err);
        return res.status(500).send(`Auth Error: ${err.message}. Check if MongoDB is connected.`);
      }
      if (!user) {
        console.warn('⚠️ No user found/created during auth:', info);
        return res.status(401).send('Access Denied: Google did not return user info or account creation failed.');
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error('❌ Login Session Error:', loginErr);
          return next(loginErr);
        }
        // Success - send the close window script
        res.send(`
          <html>
            <body>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                  window.close();
                } else {
                  window.location.href = '/';
                }
              </script>
              <p>Authentication successful. This window should close automatically.</p>
            </body>
          </html>
        `);
      });
    })(req, res, next);
  }
);

app.get('/api/auth/url', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: 'GOOGLE_CLIENT_ID is not configured in environment variables.' });
  }
  
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${APP_URL}/auth/google/callback`,
    response_type: 'code',
    scope: 'profile email',
  });
  res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
});

app.get('/api/status', (req, res) => {
  res.json({
    mongodb: mongoose.connection.readyState === 1,
    authenticated: !!req.user,
    appUrl: APP_URL,
    env: {
      hasGoogleAuth: !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,
      hasMongo: !!process.env.MONGODB_URI,
      isProduction: process.env.NODE_ENV === 'production'
    }
  });
});

app.get('/api/me', (req, res) => {
  if (req.user) {
    res.json(req.user);
  } else {
    res.status(401).json({ message: 'Not authenticated' });
  }
});

app.post('/api/logout', (req, res) => {
  req.logout(() => {
    res.json({ message: 'Logged out' });
  });
});

// Data Routes
app.post('/api/user/sync', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  const user = req.user as any;
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

app.post('/api/user/profile', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  const user = req.user as any;
  const updateData: any = {};
  if (req.body.name) updateData.name = req.body.name;
  if (req.body.currentRole) updateData.currentRole = req.body.currentRole;
  if (req.body.learningHours !== undefined) updateData.learningHours = req.body.learningHours;
  
  const updatedUser = await User.findByIdAndUpdate(user._id, updateData, { new: true });
  res.json(updatedUser);
});

app.post('/api/user/skills', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  const user = req.user as any;
  const updatedUser = await User.findByIdAndUpdate(user._id, { skills: req.body.skills }, { new: true });
  res.json(updatedUser);
});

app.post('/api/user/goals', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  const user = req.user as any;
  const updatedUser = await User.findByIdAndUpdate(user._id, { goals: req.body.goals }, { new: true });
  res.json(updatedUser);
});

app.post('/api/user/chat', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  const user = req.user as any;
  const updatedUser = await User.findByIdAndUpdate(user._id, { chatMessages: req.body.messages }, { new: true });
  res.json(updatedUser);
});

app.post('/api/user/evaluation', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  const user = req.user as any;
  const updatedUser = await User.findByIdAndUpdate(user._id, { 
    evaluation: req.body.evaluation,
    suggestedCourses: req.body.suggestedCourses,
    roadmap: req.body.roadmap
  }, { new: true });
  res.json(updatedUser);
});

app.post('/api/user/psych', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  const user = req.user as any;
  const updatedUser = await User.findByIdAndUpdate(user._id, { psychEvaluation: req.body.psychEvaluation }, { new: true });
  res.json(updatedUser);
});

app.post('/api/user/proficiency', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  const user = req.user as any;
  const updatedUser = await User.findByIdAndUpdate(user._id, { proficiencyScores: req.body.proficiencyScores }, { new: true });
  res.json(updatedUser);
});

app.post('/api/user/reset', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  const user = req.user as any;
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
