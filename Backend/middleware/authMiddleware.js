const jwt = require('jsonwebtoken');

// ✅ Jaimin's JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'jaimin_elite_786';

console.log('🔐 Auth Middleware Loaded');

const authMiddleware = async (req, res, next) => {
    try {
        // Skip authentication for public routes
        const publicRoutes = ['/api/auth/register', '/api/auth/login', '/api/auth/check-email', '/api/health'];
        if (publicRoutes.includes(req.path)) {
            console.log(`✅ Skipping auth for public route: ${req.path}`);
            return next();
        }

        // Get token from header
        const authHeader = req.headers.authorization || req.headers.Authorization;
        
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: 'No authentication token provided',
                error: 'NO_TOKEN'
            });
        }

        // Extract token from "Bearer <token>"
        const token = authHeader.startsWith('Bearer ') 
            ? authHeader.slice(7).trim() 
            : authHeader.trim();

        if (!token || token === 'null' || token === 'undefined') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token format',
                error: 'INVALID_TOKEN_FORMAT'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Validate decoded token
        if (!decoded || !decoded.userId || !decoded.email) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token payload',
                error: 'INVALID_TOKEN_PAYLOAD'
            });
        }

        // Check token expiration
        if (decoded.exp && decoded.exp * 1000 < Date.now()) {
            return res.status(401).json({
                success: false,
                message: 'Token expired',
                error: 'TOKEN_EXPIRED'
            });
        }

        // Attach user info to request
        req.user = {
            id: decoded.userId,
            email: decoded.email,
            name: decoded.name || 'User'
        };

        req.userId = decoded.userId;
        req.userEmail = decoded.email;
        req.userName = decoded.name || 'User';

        console.log(`✅ Authenticated: ${req.userEmail} (${req.userId})`);
        next();
        
    } catch (error) {
        console.error('🔴 Auth Error:', error.message);
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Session expired. Please login again.',
                error: 'SESSION_EXPIRED'
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid session. Please login again.',
                error: 'INVALID_SESSION'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Authentication failed',
            error: 'AUTH_FAILED'
        });
    }
};

// Test middleware (optional)
const testAuth = (req, res, next) => {
    console.log(`🔍 ${req.method} ${req.path}`);
    next();
};

module.exports = authMiddleware; // ✅ Single export
// OR if you need both:
// module.exports = { authMiddleware, testAuth };
