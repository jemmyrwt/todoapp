const mongoose = require('mongoose');

const todoSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  title: {
    type: String,
    required: [true, 'Please provide a task title'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot be more than 1000 characters'],
    default: ''
  },
  
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  
  category: {
    type: String,
    enum: ['Work', 'Personal', 'Finance', 'Health', 'Learning', 'Other'],
    default: 'Work'
  },
  
  dueDate: {
    type: Date,
    default: null
  },
  
  isCompleted: {
    type: Boolean,
    default: false
  },
  
  completedAt: {
    type: Date,
    default: null
  },
  
  tags: [{
    type: String,
    trim: true
  }],
  
  estimatedTime: {
    type: Number, // in minutes
    default: 0
  },
  
  actualTime: {
    type: Number, // in minutes
    default: 0
  },
  
  reminders: [{
    type: Date
  }],
  
  isArchived: {
    type: Boolean,
    default: false
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update updatedAt on save
todoSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes for faster queries
todoSchema.index({ userId: 1, isCompleted: 1 });
todoSchema.index({ userId: 1, dueDate: 1 });
todoSchema.index({ userId: 1, category: 1 });
todoSchema.index({ userId: 1, priority: 1 });

module.exports = mongoose.model('Todo', todoSchema);
