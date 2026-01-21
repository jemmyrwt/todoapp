const express = require('express');
const router = express.Router();
const focusController = require('../controllers/focusController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes protected
router.use(authMiddleware);

// Session management
router.post('/start', focusController.startSession);
router.put('/end/:id', focusController.endSession);
router.get('/sessions', focusController.getSessions);

// Statistics
router.get('/stats', focusController.getFocusStats);
router.get('/leaderboard', focusController.getLeaderboard);

module.exports = router;
