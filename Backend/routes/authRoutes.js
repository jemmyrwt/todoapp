const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// ✅ FIXED: Add test route for debugging
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Auth route is working',
        timestamp: new Date().toISOString()
    });
});

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/check-email', authController.checkEmail);

// Protected routes
router.get('/me', authMiddleware, authController.getMe);
router.put('/settings', authMiddleware, authController.updateSettings);
router.put('/profile', authMiddleware, authController.updateProfile);
router.put('/change-password', authMiddleware, authController.changePassword);

module.exports = router;
