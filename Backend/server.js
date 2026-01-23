
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import routes
const authRoutes = require('./routes/authRoutes');
const todoRoutes = require('./routes/todoRoutes');
const noteRoutes = require('./routes/noteRoutes');
const focusRoutes = require('./routes/focusRoutes');

const app = express();

// ✅ FIXED: Enhanced CORS Configuration for Render with proper OPTIONS handling
const corsOptions = {
    origin: [
        'https://todoapp-p5hq.onrender.com',
        'http://localhost:10000',
        'http://localhost:3000',
        'http://127.0.0.1:10000',
        'http://127.0.0.1:3000',
        /\.onrender\.com$/ // Allow all Render subdomains
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    credentials: true,
    exposedHeaders: ['Authorization'],
    optionsSuccessStatus: 200,
    preflightContinue: false,
    maxAge: 86400 // 24 hours
};

// Apply CORS middleware
app.use(cors(corsOptions));

// ✅ FIXED: Explicit OPTIONS handler for preflight requests
app.options('*', cors(corsOptions));

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting with Render-specific adjustments
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skip: (req) => req.method === 'OPTIONS' // Skip OPTIONS requests from rate limit
});
app.use('/api/', limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ FIXED: Add request timeout middleware (Render cold starts can be slow)
app.use((req, res, next) => {
    req.setTimeout(30000, () => { // 30 second timeout
        console.log(`⏰ Request timeout: ${req.method} ${req.url}`);
    });
    res.setTimeout(30000);
    next();
});

// ✅ FIXED: MongoDB Connection with retry logic
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://jaiminravat:jaiminravat@todoclust0.g0maq65.mongodb.net/TaskControllerDB?retryWrites=true&w=majority';

console.log('🔗 Connecting to MongoDB Atlas...');
console.log('🔑 MONGODB_URI:', MONGODB_URI ? '✓ Set' : '✗ Missing');
console.log('🔑 JWT_SECRET:', process.env.JWT_SECRET ? '✓ Set' : '✗ Missing');

// Enhanced MongoDB connection with better error handling
const connectWithRetry = () => {
    mongoose.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        retryWrites: true,
        w: 'majority',
        maxPoolSize: 10,
        minPoolSize: 2,
        heartbeatFrequencyMS: 10000
    })
    .then(() => {
        console.log('✅ MongoDB Atlas Connected Successfully');
        console.log(`📊 Database: ${mongoose.connection.name}`);
        console.log(`👤 Host: ${mongoose.connection.host}`);
    })
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err.message);
        console.log('🔄 Retrying connection in 5 seconds...');
        setTimeout(connectWithRetry, 5000);
    });
};

connectWithRetry();

// Connection events
mongoose.connection.on('error', err => {
    console.error('❌ MongoDB Error:', err.message);
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠️  MongoDB disconnected - attempting to reconnect...');
    setTimeout(connectWithRetry, 5000);
});

mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconnected');
});

// ✅ FIXED: Request logging with better formatting
app.use((req, res, next) => {
    const start = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    
    console.log(`[${new Date().toISOString()}] ${requestId} ${req.method} ${req.url}`);
    console.log(`   📡 Origin: ${req.headers.origin || 'None'}`);
    console.log(`   🔑 Auth: ${req.headers.authorization ? 'Present' : 'None'}`);
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${requestId} ${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
    });
    
    next();
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/focus', focusRoutes);

// ✅ FIXED: Health check with database status
app.get('/api/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const memoryUsage = process.memoryUsage();
    
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: dbStatus,
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        memory: {
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`
        },
        node: process.version,
        platform: process.platform
    });
});

// ✅ FIXED: Enhanced test endpoint
app.get('/api/test-auth', (req, res) => {
    res.json({
        success: true,
        message: 'Auth test endpoint working',
        timestamp: new Date().toISOString(),
        server: 'TaskController API',
        version: '8.0',
        cors: 'enabled',
        env: {
            node_env: process.env.NODE_ENV,
            has_jwt_secret: !!process.env.JWT_SECRET,
            has_mongodb_uri: !!process.env.MONGODB_URI
        }
    });
});

// ✅ FIXED: Root endpoint for quick checks
app.get('/api', (req, res) => {
    res.json({
        app: 'TaskController API',
        version: '8.0',
        status: 'running',
        endpoints: {
            auth: '/api/auth',
            todos: '/api/todos',
            notes: '/api/notes',
            focus: '/api/focus',
            health: '/api/health'
        },
        timestamp: new Date().toISOString()
    });
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// ✅ FIXED: Add a warm-up endpoint for Render cold starts
app.get('/api/warmup', (req, res) => {
    console.log('🔥 Warm-up request received');
    res.json({
        success: true,
        message: 'Server is warmed up',
        timestamp: new Date().toISOString()
    });
});

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ✅ FIXED: Enhanced error handling
app.use((err, req, res, next) => {
    console.error('🔥 Server Error:', err.stack);
    console.error('🔥 Error details:', {
        name: err.name,
        message: err.message,
        code: err.code,
        status: err.status,
        path: req.path,
        method: req.method
    });
    
    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Invalid authentication token',
            error: 'TOKEN_INVALID'
        });
    }
    
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Authentication token expired',
            error: 'TOKEN_EXPIRED'
        });
    }
    
    // Mongoose errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Validation Error',
            errors: Object.values(err.errors).map(e => e.message),
            error: 'VALIDATION_ERROR'
        });
    }
    
    if (err.code === 11000) {
        return res.status(400).json({
            success: false,
            message: 'Duplicate field value entered',
            error: 'DUPLICATE_KEY'
        });
    }
    
    // Timeout errors
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
        return res.status(408).json({
            success: false,
            message: 'Request timeout. Please try again.',
            error: 'REQUEST_TIMEOUT'
        });
    }
    
    // Default error
    const statusCode = err.status || 500;
    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error',
        error: err.name || 'SERVER_ERROR',
        path: req.path,
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV !== 'production' && { 
            stack: err.stack
        })
    });
});

const PORT = process.env.PORT || 10000;
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 TaskController Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Server URL: http://0.0.0.0:${PORT}`);
    console.log(`📡 API Base URL: http://0.0.0.0:${PORT}/api`);
    console.log('⚙️  Config check:');
    console.log(`   - MONGODB_URI: ${process.env.MONGODB_URI ? '✓ Set' : '✗ Missing'}`);
    console.log(`   - JWT_SECRET: ${process.env.JWT_SECRET ? '✓ Set' : '✗ Missing'}`);
    console.log(`   - PORT: ${PORT}`);
    console.log(`   - CORS: Enabled for Render`);
});

// ✅ FIXED: Server timeout configuration for Render
server.timeout = 30000; // 30 seconds
server.keepAliveTimeout = 120000; // 120 seconds
server.headersTimeout = 130000; // 130 seconds

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        mongoose.connection.close(false, () => {
            console.log('MongoDB connection closed');
            process.exit(0);
        });
    });
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
