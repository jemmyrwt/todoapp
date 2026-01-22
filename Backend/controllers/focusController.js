// FIXED VERSION WITH OPTIMIZATIONS:

const FocusSession = require('../models/FocusSession');
const Todo = require('../models/Todo');

// @desc    Start focus session
// @route   POST /api/focus/start
// @access  Private
exports.startSession = async (req, res) => {
  try {
    const { duration, mode, taskId, notes } = req.body;

    // Validate duration
    if (!duration || typeof duration !== 'number' || duration <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid duration'
      });
    }

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + (duration * 1000));

    const session = await FocusSession.create({
      userId: req.userId,
      duration,
      mode: mode || 'pomodoro',
      taskId: taskId || null,
      notes: notes || '',
      startTime,
      endTime
    });

    // If task is associated, update its actual time
    if (taskId) {
      await Todo.findByIdAndUpdate(
        taskId,
        { $inc: { actualTime: Math.floor(duration / 60) } },
        { new: true }
      );
    }

    res.status(201).json({
      success: true,
      message: 'Focus session started',
      session
    });

  } catch (error) {
    console.error('Start session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    End focus session
// @route   PUT /api/focus/end/:id
// @access  Private
exports.endSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { interruptions, notes } = req.body;

    // Validate session ID
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    const session = await FocusSession.findOne({
      _id: id,
      userId: req.userId
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Calculate actual duration
    const actualDuration = Math.floor((new Date() - session.startTime) / 1000);
    
    // Update session
    session.endTime = new Date();
    session.duration = actualDuration;
    session.interruptions = interruptions || 0;
    
    if (notes !== undefined) {
      session.notes = notes;
    }

    await session.save();

    res.json({
      success: true,
      message: 'Focus session ended',
      session
    });

  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get focus sessions
// @route   GET /api/focus/sessions
// @access  Private
exports.getSessions = async (req, res) => {
  try {
    const { 
      mode, 
      startDate, 
      endDate, 
      sort = '-startTime',
      page = 1,
      limit = 50 
    } = req.query;

    // Build query
    let query = { userId: req.userId };

    // Apply filters
    if (mode && mode !== 'all') {
      query.mode = mode;
    }

    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) query.startTime.$gte = new Date(startDate);
      if (endDate) query.startTime.$lte = new Date(endDate);
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const sessions = await FocusSession.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('taskId', 'title priority category');

    const total = await FocusSession.countDocuments(query);

    res.json({
      success: true,
      count: sessions.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      sessions
    });

  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get focus statistics
// @route   GET /api/focus/stats
// @access  Private
exports.getFocusStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const matchQuery = { userId: req.userId };
    
    if (startDate || endDate) {
      matchQuery.startTime = {};
      if (startDate) matchQuery.startTime.$gte = new Date(startDate);
      if (endDate) matchQuery.startTime.$lte = new Date(endDate);
    }

    // Total focus time
    const totalStats = await FocusSession.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          totalDuration: { $sum: "$duration" },
          totalInterruptions: { $sum: "$interruptions" },
          avgDuration: { $avg: "$duration" }
        }
      }
    ]);

    // Daily focus time (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const dailyStats = await FocusSession.aggregate([
      { 
        $match: { 
          userId: req.userId,
          startTime: { $gte: sevenDaysAgo }
        } 
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$startTime" }
          },
          sessions: { $sum: 1 },
          duration: { $sum: "$duration" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Mode distribution
    const modeStats = await FocusSession.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$mode",
          sessions: { $sum: 1 },
          duration: { $sum: "$duration" }
        }
      }
    ]);

    // Weekly pattern
    const weeklyStats = await FocusSession.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $dayOfWeek: "$startTime" },
          sessions: { $sum: 1 },
          duration: { $sum: "$duration" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Map day numbers to names
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const formattedWeeklyStats = weeklyStats.map(stat => ({
      day: dayNames[stat._id - 1],
      sessions: stat.sessions,
      duration: stat.duration
    }));

    // Streak calculation
    const streak = await calculateStreak(req.userId);

    res.json({
      success: true,
      totalStats: totalStats[0] || { 
        totalSessions: 0, 
        totalDuration: 0, 
        totalInterruptions: 0,
        avgDuration: 0
      },
      dailyStats,
      modeStats,
      weeklyStats: formattedWeeklyStats,
      streak
    });

  } catch (error) {
    console.error('Get focus stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Helper function to calculate streak
async function calculateStreak(userId) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let streak = 0;
    let currentDate = new Date(today);
    
    while (streak < 365) {
      const startOfDay = new Date(currentDate);
      const endOfDay = new Date(currentDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      const hasSession = await FocusSession.findOne({
        userId,
        startTime: { $gte: startOfDay, $lte: endOfDay }
      });
      
      if (hasSession) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }
    
    return streak;
  } catch (error) {
    console.error('Calculate streak error:', error);
    return 0;
  }
}

// @desc    Get leaderboard
// @route   GET /api/focus/leaderboard
// @access  Private
exports.getLeaderboard = async (req, res) => {
  try {
    const userStats = await FocusSession.aggregate([
      { $match: { userId: req.userId } },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          totalDuration: { $sum: "$duration" },
          averageDuration: { $avg: "$duration" },
          totalDays: {
            $addToSet: {
              $dateToString: { format: "%Y-%m-%d", date: "$startTime" }
            }
          }
        }
      },
      {
        $project: {
          totalSessions: 1,
          totalDuration: 1,
          averageDuration: 1,
          totalDaysCount: { $size: "$totalDays" }
        }
      }
    ]);

    const stats = userStats[0] || { 
      totalSessions: 0, 
      totalDuration: 0, 
      averageDuration: 0,
      totalDaysCount: 0
    };

    res.json({
      success: true,
      leaderboard: [{
        userId: req.userId,
        totalSessions: stats.totalSessions,
        totalDuration: stats.totalDuration,
        averageDuration: Math.round(stats.averageDuration || 0),
        totalDays: stats.totalDaysCount,
        rank: 1
      }]
    });

  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
