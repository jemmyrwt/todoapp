const jwt = require('jsonwebtoken');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    console.log('🔐 Token received:', token ? 'Yes' : 'No');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'taskcontroller_secret_786');
    
    console.log('✅ Token decoded:', decoded);
    
    if (!decoded.userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token structure'
      });
    }
    
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.userName = decoded.name;
    
    console.log(`✅ Authenticated user: ${decoded.email} (${decoded.userId})`);
    next();
    
  } catch (error) {
    console.error('🔴 Auth middleware error:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired, please login again'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

module.exports = authMiddleware;
