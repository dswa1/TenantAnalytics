require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Import middleware
const { createTierBasedLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { optionalAuth } = require('./middleware/auth');

// Import routes
const tenantsRoutes = require('./routes/tenants');
const azureRoutes = require('./routes/azure');
const syncRoutes = require('./routes/sync');
const dataRoutes = require('./routes/data');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting (tier-based)
app.use(createTierBasedLimiter());

// Optional authentication for logging
app.use(optionalAuth);

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const user = req.user ? req.user.id : 'anonymous';
  console.log(`[${timestamp}] ${req.method} ${req.path} - User: ${user}`);
  next();
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'M365 Tenant Manager API',
    version: '2.0.0'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'M365 Tenant Manager API',
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// ============================================
// API ROUTES
// ============================================

// Mount route handlers
app.use('/api/tenants', tenantsRoutes);
app.use('/api/azure', azureRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/data', dataRoutes);

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'M365 Tenant Manager API',
    version: '2.0.0',
    description: 'Multi-tenant SaaS platform for Microsoft 365 management and analytics',
    documentation: `${process.env.APP_URL}/docs`,
    endpoints: {
      authentication: {
        login: 'Handled by Supabase Auth',
        signup: 'Handled by Supabase Auth'
      },
      tenants: {
        list: 'GET /api/tenants',
        get: 'GET /api/tenants/:id',
        create: 'POST /api/tenants',
        update: 'PUT /api/tenants/:id',
        delete: 'DELETE /api/tenants/:id',
        members: 'GET /api/tenants/:id/members'
      },
      azure: {
        setup: 'POST /api/azure/setup',
        credentials: 'GET /api/azure/credentials',
        consent_url: 'GET /api/azure/consent-url',
        validate: 'POST /api/azure/validate',
        permissions: 'GET /api/azure/permissions'
      },
      sync: {
        start: 'POST /api/sync/start',
        status: 'GET /api/sync/:id/status',
        history: 'GET /api/sync/history',
        changes: 'GET /api/sync/changes',
        latest: 'GET /api/sync/latest'
      }
    }
  });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler for API routes only
app.use('/api/*', notFoundHandler);

// Global error handler
app.use(errorHandler);

// ============================================
// STATIC FILES (React Frontend)
// ============================================

// Serve static files from React build folder (only in production)
if (process.env.NODE_ENV === 'production') {
  const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'build');
  app.use(express.static(frontendBuildPath));

  // All non-API routes serve the React app (SPA routing)
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
} else {
  // In development, just show a message for non-API routes
  app.get('/', (req, res) => {
    res.json({
      message: 'M365 Tenant Manager API',
      status: 'Backend running in development mode',
      frontend: 'Run frontend separately with: cd frontend && npm start',
      api_docs: '/api'
    });
  });
}

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 M365 Tenant Manager API Server');
  console.log('='.repeat(60));
  console.log(`📍 Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API URL: http://localhost:${PORT}/api`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
  console.log('='.repeat(60));
  console.log('📚 Available endpoints:');
  console.log('   GET  /api/tenants          - List tenants');
  console.log('   POST /api/tenants          - Create tenant');
  console.log('   POST /api/azure/setup      - Setup Azure credentials');
  console.log('   POST /api/sync/start       - Start data sync');
  console.log('   GET  /api/sync/history     - View sync history');
  console.log('   GET  /api/sync/changes     - View data changes');
  console.log('='.repeat(60));

  // Environment variable checks
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_ANON_KEY',
    'ENCRYPTION_KEY'
  ];

  const missingVars = requiredEnvVars.filter(v => !process.env[v]);

  if (missingVars.length > 0) {
    console.warn('⚠️  WARNING: Missing required environment variables:');
    missingVars.forEach(v => console.warn(`   - ${v}`));
    console.warn('   Please configure these in your .env file');
    console.log('='.repeat(60));
  }
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

module.exports = app;
