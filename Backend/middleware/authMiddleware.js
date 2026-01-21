const jwt = require('jsonwebtoken');

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error();
    }

    // ✅ CHANGE THIS LINE - Match with User.js
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jaimin_elite_786');
    
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    res.status(401).json({
      success: false,
      message: 'Please authenticate'
    });
  }
};

module.exports = authMiddleware;
