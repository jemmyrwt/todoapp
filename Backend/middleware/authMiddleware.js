const jwt = require('jsonwebtoken');

// ✅ FIXED: Jaimin ka original JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'jaimin_elite_786';

console.log('🔐 Auth Middleware Loaded');
console.log('🔑 JWT Secret:', JWT_SECRET);

const authMiddleware = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        console.log('🔐 Auth middleware check:');
        console.log('   - Token received:', token ? `Yes (${token.substring(0, 20)}...)` : 'No');
        console.log('   - Request path:', req.path);
        console.log('   - Request method:', req.method);
        
        if (!token) {
            console.log('❌ No token provided');
            return res.status(401).json({
                success: false,
                message: 'No authentication token provided',
                error: 'NO_TOKEN'
            });
        }

        // ✅ FIXED: Jaimin ke JWT secret se token verify
        console.log('🔐 Verifying token with jaimin_elite_786...');
        const decoded = jwt.verify(token, JWT_SECRET);
        
        console.log('✅ Token decoded successfully:');
        console.log('   - User ID:', decoded.userId);
        console.log('   - User email:', decoded.email);
        console.log('   - Expires:', new Date(decoded.exp * 1000).toISOString());
        
        // Check if decoded has userId
        if (!decoded.userId) {
            console.log('❌ Invalid token structure - missing userId');
            return res.status(401).json({
                success: false,
                message: 'Invalid token structure',
                error: 'INVALID_TOKEN_STRUCTURE'
            });
        }
        
        // Check token expiration
        const currentTime = Math.floor(Date.now() / 1000);
        if (decoded.exp && decoded.exp < currentTime) {
            console.log('❌ Token expired');
            return res.status(401).json({
                success: false,
                message: 'Authentication token expired',
                error: 'TOKEN_EXPIRED'
            });
        }
        
        // Attach user info to request
        req.userId = decoded.userId;
        req.userEmail = decoded.email;
        req.userName = decoded.name;
        
        console.log(`✅ Authenticated user: ${decoded.email} (${decoded.userId})`);
        next();
        
    } catch (error) {
        console.error('🔴 Auth middleware error:', error.message);
        console.error('🔴 Error name:', error.name);
        console.error('🔴 Error stack:', error.stack);
        
        // Specific error handling
        if (error.name === 'TokenExpiredError') {
            console.log('❌ Token expired error');
            return res.status(401).json({
                success: false,
                message: 'Authentication token expired, please login again',
                error: 'TOKEN_EXPIRED'
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            console.log('❌ Invalid token error');
            return res.status(401).json({
                success: false,
                message: 'Invalid authentication token',
                error: 'INVALID_TOKEN'
            });
        }
        
        // Generic error
        console.log('❌ Generic auth error');
        res.status(401).json({
            success: false,
            message: 'Authentication failed',
            error: 'AUTH_FAILED'
        });
    }
};

// Test middleware for debugging
const testAuth = (req, res, next) => {
    console.log('🔍 Test middleware - Headers:', req.headers);
    console.log('🔍 Test middleware - Original URL:', req.originalUrl);
    next();
};

module.exports = { authMiddleware, testAuth };
