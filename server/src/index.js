require('dotenv').config();
const express = require('express');
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
const prisma = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend development server
app.use(cors({
  origin: '*', // For local personal use, simple wildcard is fine
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', database: 'connected' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

async function main() {
  try {
    // Verify database connection
    await prisma.$connect();
    console.log('Successfully connected to the database.');
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to connect to the database:', error);
    process.exit(1);
  }
}

main();
