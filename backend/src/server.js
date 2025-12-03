const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const studyRoutes = require('./routes/studies');
const reportRoutes = require('./routes/reports');
const proxyRoutes = require('./routes/proxy');
const dicomImagesRoutes = require('./routes/dicomImages');
const settingsRoutes = require('./routes/settings');
const templateRoutes = require('./routes/templates');
const clinicRoutes = require('./routes/clinics');

const app = express();

// CRITICAL: Trust proxy for Docker/Nginx setup
// This allows Express to read X-Forwarded-* headers from Nginx
app.set('trust proxy', true);

// Middleware

// CORS Configuration - Allow multiple origins
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : [
      "http://localhost:3000",
      "https://ris-frontend-mu.vercel.app"
    ];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware (before routes)
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

// Database Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    console.log(`📊 Database: ${process.env.MONGODB_URI.split('@')[1]}`);
    
    await seedDefaultAdmin();
    await require('./utils/initializeDefaultClinic')();
    
    const PORT = process.env.PORT || 5000;
    const isVercel = process.env.VERCEL === '1';

    // Start server (skip on Vercel serverless)
    if (!isVercel) {
      app.listen(PORT, '0.0.0.0', () => {
        console.log('='.repeat(60));
        console.log(`🚀 RIS Backend server running on port ${PORT}`);
        console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔗 Allowed Origins: ${allowedOrigins.join(', ')}`);
        console.log(`🏥 Orthanc URL: ${process.env.ORTHANC_URL || 'Not configured'}`);
        console.log(`⏰ Server started at: ${new Date().toISOString()}`);
        console.log('='.repeat(60));
        console.log('📋 Registered Routes:');
        console.log('   ✅ /api/auth');
        console.log('   ✅ /api/users');
        console.log('   ✅ /api/studies');
        console.log('   ✅ /api/reports');
        console.log('   ✅ /api/proxy (OHIF & DICOMweb)');
        console.log('   ✅ /api/settings');
        console.log('   ✅ /api/templates');
        console.log('   ✅ /api/clinics');
        console.log('='.repeat(60));
      });
    }
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

// Health check (before routes)
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

// Routes - CRITICAL: Proxy routes must be registered FIRST
app.use('/api/proxy', proxyRoutes);
console.log('✅ Proxy routes registered at /api/proxy');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/studies', studyRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/clinics', clinicRoutes);

// 404 handler
app.use((req, res) => {
  console.error(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Export the app for Vercel Serverless
module.exports = app;