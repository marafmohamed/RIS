const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const studyRoutes = require('./routes/studies');
const reportRoutes = require('./routes/reports');
const proxyRoutes = require('./routes/proxy');
const dicomImagesRoutes = require('./routes/dicomImages');
const settingsRoutes = require('./routes/settings');

const app = express();

// Middleware
app.use(morgan('dev'));

// CORS Configuration - Allow multiple origins
const allowedOrigins = [
  'http://localhost:3000',
  'https://ris-frontend-mu.vercel.app',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Database Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Connected to MongoDB');
  seedDefaultAdmin();
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Seed default admin user
async function seedDefaultAdmin() {
  const User = require('./models/User');
  try {
    const adminExists = await User.findOne({ email: 'admin@ris.com' });
    if (!adminExists) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await User.create({
        email: 'admin@ris.com',
        password: hashedPassword,
        fullName: 'System Administrator',
        role: 'ADMIN'
      });
      console.log('✅ Default admin user created: admin@ris.com / admin123');
      console.log('⚠️  Please change the default password after first login!');
    }
  } catch (error) {
    console.error('Error seeding admin:', error);
  }
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/studies', studyRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/proxy', proxyRoutes);
app.use('/api/proxy', dicomImagesRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'RIS Backend is running',
    timestamp: new Date().toISOString(),
    cors: {
      allowedOrigins: allowedOrigins
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 RIS Backend server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
});

module.exports = app;
