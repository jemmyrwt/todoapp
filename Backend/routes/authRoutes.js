const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// ✅ REMOVE authMiddleware from logout (logout public hona chahiye)
router.post('/logout', authController.logout); // ❌ authMiddleware hata do

// Protected routes
router.get('/me', authMiddleware, authController.getMe);
router.put('/settings', authMiddleware, authController.updateSettings);
router.put('/profile', authMiddleware, authController.updateProfile);
router.put('/change-password', authMiddleware, authController.changePassword);

module.exports = router;
