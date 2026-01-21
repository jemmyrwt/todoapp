const Todo = require('../models/Todo');

// @desc    Get all todos
// @route   GET /api/todos
// @access  Private
exports.getTodos = async (req, res) => {
  try {
    const { 
      category, 
      priority, 
      completed, 
      search, 
      sort = '-createdAt',
      page = 1,
      limit = 50 
    } = req.query;

    // Build query
    let query = { userId: req.userId, isArchived: false };

    // Apply filters
    if (category && category !== 'all') {
      query.category = category;
    }

    if (priority && priority !== 'all') {
      query.priority = priority;
    }

    if (completed !== undefined) {
      query.isCompleted = completed === 'true';
    }

    // Search
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    
    const todos = await Todo.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Todo.countDocuments(query);

    // Calculate stats
    const stats = await Todo.aggregate([
      { $match: { userId: req.userId, isArchived: false } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$isCompleted", true] }, 1, 0] } },
          highPriority: { $sum: { $cond: [{ $eq: ["$priority", "high"] }, 1, 0] } },
          mediumPriority: { $sum: { $cond: [{ $eq: ["$priority", "medium"] }, 1, 0] } },
          lowPriority: { $sum: { $cond: [{ $eq: ["$priority", "low"] }, 1, 0] } }
        }
      }
    ]);

    res.json({
      success: true,
      count: todos.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      stats: stats[0] || { total: 0, completed: 0, highPriority: 0, mediumPriority: 0, lowPriority: 0 },
      todos
    });

  } catch (error) {
    console.error('Get todos error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get single todo
// @route   GET /api/todos/:id
// @access  Private
exports.getTodo = async (req, res) => {
  try {
    const todo = await Todo.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!todo) {
      return res.status(404).json({
        success: false,
        message: 'Todo not found'
      });
    }

    res.json({
      success: true,
      todo
    });

  } catch (error) {
    console.error('Get todo error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Create todo
// @route   POST /api/todos
// @access  Private
exports.createTodo = async (req, res) => {
  try {
    const {
      title,
      description,
      priority,
      category,
      dueDate,
      tags,
      estimatedTime
    } = req.body;

    const todo = await Todo.create({
      userId: req.userId,
      title,
      description: description || '',
      priority: priority || 'medium',
      category: category || 'Work',
      dueDate: dueDate || null,
      tags: tags || [],
      estimatedTime: estimatedTime || 0
    });

    res.status(201).json({
      success: true,
      message: 'Todo created successfully',
      todo
    });

  } catch (error) {
    console.error('Create todo error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update todo
// @route   PUT /api/todos/:id
// @access  Private
exports.updateTodo = async (req, res) => {
  try {
    let todo = await Todo.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!todo) {
      return res.status(404).json({
        success: false,
        message: 'Todo not found'
      });
    }

    // Update fields
    const updateFields = ['title', 'description', 'priority', 'category', 'dueDate', 'tags', 'estimatedTime'];
    
    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        todo[field] = req.body[field];
      }
    });

    // Handle completion
    if (req.body.isCompleted !== undefined) {
      todo.isCompleted = req.body.isCompleted;
      todo.completedAt = req.body.isCompleted ? new Date() : null;
    }

    // Handle archive
    if (req.body.isArchived !== undefined) {
      todo.isArchived = req.body.isArchived;
    }

    // Update actual time
    if (req.body.actualTime !== undefined) {
      todo.actualTime = req.body.actualTime;
    }

    await todo.save();

    res.json({
      success: true,
      message: 'Todo updated successfully',
      todo
    });

  } catch (error) {
    console.error('Update todo error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete todo
// @route   DELETE /api/todos/:id
// @access  Private
exports.deleteTodo = async (req, res) => {
  try {
    const todo = await Todo.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });

    if (!todo) {
      return res.status(404).json({
        success: false,
        message: 'Todo not found'
      });
    }

    res.json({
      success: true,
      message: 'Todo deleted successfully'
    });

  } catch (error) {
    console.error('Delete todo error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Bulk update todos
// @route   PUT /api/todos/bulk/update
// @access  Private
exports.bulkUpdate = async (req, res) => {
  try {
    const { ids, updates } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide todo IDs'
      });
    }

    const result = await Todo.updateMany(
      {
        _id: { $in: ids },
        userId: req.userId
      },
      updates
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} todos updated successfully`,
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Bulk delete todos
// @route   DELETE /api/todos/bulk/delete
// @access  Private
exports.bulkDelete = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide todo IDs'
      });
    }

    const result = await Todo.deleteMany({
      _id: { $in: ids },
      userId: req.userId
    });

    res.json({
      success: true,
      message: `${result.deletedCount} todos deleted successfully`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get todo analytics
// @route   GET /api/todos/analytics/stats
// @access  Private
exports.getTodoStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const matchQuery = { userId: req.userId };
    
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    // Daily completion stats
    const dailyStats = await Todo.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          created: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$isCompleted", true] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 30 }
    ]);

    // Category distribution
    const categoryStats = await Todo.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$isCompleted", true] }, 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Priority distribution
    const priorityStats = await Todo.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$isCompleted", true] }, 1, 0] }
          }
        }
      }
    ]);

    // Completion rate over time
    const completionRate = await Todo.aggregate([
      { $match: { userId: req.userId, isCompleted: true } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$completedAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 30 }
    ]);

    res.json({
      success: true,
      dailyStats,
      categoryStats,
      priorityStats,
      completionRate
    });

  } catch (error) {
    console.error('Get todo stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
