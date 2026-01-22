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

// ✅ FIXED: Enhanced CORS Configuration for Render
app.use(cors({
    origin: [
        'https://todoapp-p5hq.onrender.com',
        'http://localhost:10000',
        'http://localhost:3000',
        'http://127.0.0.1:10000',
        'http://127.0.0.1:3000'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    credentials: true,
    exposedHeaders: ['Authorization'],
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

// Handle preflight requests properly
app.options('*', cors());

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false
});
app.use('/api/', limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ FIXED: MongoDB Connection with Render environment
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://jaiminravat:jaiminravat@todoclust0.g0maq65.mongodb.net/TaskControllerDB?retryWrites=true&w=majority';

console.log('🔗 Connecting to MongoDB Atlas...');
console.log('🔑 Using MONGODB_URI:', MONGODB_URI ? 'Present' : 'Missing');
console.log('🔑 JWT_SECRET:', process.env.JWT_SECRET ? 'Present' : 'Missing');

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    retryWrites: true,
    w: 'majority'
})
.then(() => {
    console.log('✅ MongoDB Atlas Connected Successfully');
    console.log(`📊 Database: ${mongoose.connection.name}`);
    console.log(`👤 Host: ${mongoose.connection.host}`);
})
.catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    console.error('❌ Error details:', err);
    console.log('⚠️  Retrying connection in 10 seconds...');
    setTimeout(() => {
        mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
    }, 10000);
});

// Connection events
mongoose.connection.on('error', err => {
    console.error('❌ MongoDB Error:', err.message);
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠️  MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconnected');
});

// Log all incoming requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    console.log('📡 Headers:', req.headers);
    next();
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/focus', focusRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        memory: process.memoryUsage()
    });
});

// ✅ FIXED: Test endpoint for debugging
app.get('/api/test-auth', (req, res) => {
    res.json({
        success: true,
        message: 'Auth test endpoint working',
        timestamp: new Date().toISOString(),
        env: {
            node_env: process.env.NODE_ENV,
            has_jwt_secret: !!process.env.JWT_SECRET,
            has_mongodb_uri: !!process.env.MONGODB_URI
        }
    });
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

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
        status: err.status
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
    
    // Default error
    const statusCode = err.status || 500;
    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error',
        error: err.name || 'SERVER_ERROR',
        ...(process.env.NODE_ENV !== 'production' && { 
            stack: err.stack,
            details: err
        })
    });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 TaskController Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Server URL: http://0.0.0.0:${PORT}`);
    console.log(`📡 API Base URL: http://0.0.0.0:${PORT}/api`);
    console.log('⚙️  Config check:');
    console.log(`   - MONGODB_URI: ${process.env.MONGODB_URI ? '✓ Set' : '✗ Missing'}`);
    console.log(`   - JWT_SECRET: ${process.env.JWT_SECRET ? '✓ Set' : '✗ Missing'}`);
    console.log(`   - PORT: ${PORT}`);
});
