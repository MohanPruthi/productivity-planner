require('dotenv').config();
const path = require('path');
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const planRoutes = require('./routes/planRoutes');
const dsaRoutes = require('./routes/dsaRoutes');
const pomodoroRoutes = require('./routes/pomodoroRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const studyRoutes = require('./routes/studyRoutes');
const normalTaskRoutes = require('./routes/normalTaskRoutes');
const medsRoutes = require('./routes/medsRoutes');
const hrRoutes = require('./routes/hrRoutes');
const notesRoutes = require('./routes/notesRoutes');
const noteGroupsRoutes = require('./routes/noteGroupsRoutes');
const plansRoutes = require('./routes/plansRoutes');
const assistantRoutes = require('./assistant/routes');
const { migrateLegacyPlans } = require('./controllers/plansController');
const prisma = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend development server
app.use(cors({
  origin: '*', // For local personal use, simple wildcard is fine
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(compression());
app.use(express.json());

// Request logging middleware
if (process.env.NODE_ENV !== 'production') app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/dsa-logs', dsaRoutes);
app.use('/api/pomodoro-sessions', pomodoroRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/study-logs', studyRoutes);
app.use('/api/normal-tasks', normalTaskRoutes);
app.use('/api/meds', medsRoutes);
app.use('/api/hr-contacts', hrRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/note-groups', noteGroupsRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/assistant', assistantRoutes);

// Health check endpoint (never touches the DB, so it stays fast for the host's probes)
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Unknown API paths get a JSON 404 instead of falling through to the React app
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// In production, serve the built React app and let client-side routing handle unknown paths
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  // Hashed build assets never change, so browsers can keep them for a year
  app.use('/assets', express.static(path.join(clientDist, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

function main() {
  // Listen first so the host can route traffic; DB work happens in the background
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    prisma.$connect()
      .then(() => {
        console.log('Successfully connected to the database.');
        return migrateLegacyPlans();
      })
      .catch((error) => console.error('Background startup task failed:', error));
  });
}

main();
