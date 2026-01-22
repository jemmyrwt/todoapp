const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  title: {
    type: String,
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters'],
    default: 'Untitled Note'
  },
  
  content: {
    type: String,
    required: [true, 'Please provide note content'],
    trim: true
  },
  
  category: {
    type: String,
    enum: ['Personal', 'Work', 'Ideas', 'Meeting', 'Learning', 'Other'],
    default: 'Personal'
  },
  
  tags: [{
    type: String,
    trim: true
  }],
  
  isPinned: {
    type: Boolean,
    default: false
  },
  
  isArchived: {
    type: Boolean,
    default: false
  },
  
  color: {
    type: String,
    default: '#6366f1'
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

noteSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Note', noteSchema);
