const mongoose = require('mongoose');

const focusSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  duration: {
    type: Number,
    required: true
  },
  
  mode: {
    type: String,
    enum: ['pomodoro', 'short_break', 'long_break', 'custom'],
    default: 'pomodoro'
  },
  
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Todo',
    default: null
  },
  
  completed: {
    type: Boolean,
    default: true
  },
  
  interruptions: {
    type: Number,
    default: 0
  },
  
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot be more than 500 characters']
  },
  
  startTime: {
    type: Date,
    required: true
  },
  
  endTime: {
    type: Date,
    required: true
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  }
});

focusSessionSchema.virtual('durationMinutes').get(function() {
  return Math.floor(this.duration / 60);
});

focusSessionSchema.index({ userId: 1, startTime: -1 });
focusSessionSchema.index({ userId: 1, mode: 1 });

module.exports = mongoose.model('FocusSession', focusSessionSchema);
