const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email'
    ],
    index: true
  },
  
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  
  avatar: {
    type: String,
    default: 'https://ui-avatars.com/api/?name=User&background=6366f1&color=fff&size=128'
  },
  
  settings: {
    theme: {
      type: String,
      enum: ['dark', 'light'],
      default: 'dark'
    },
    soundEnabled: {
      type: Boolean,
      default: true
    },
    autosaveEnabled: {
      type: Boolean,
      default: true
    },
    remindersEnabled: {
      type: Boolean,
      default: false
    }
  },
  
  isVerified: {
    type: Boolean,
    default: false
  },
  
  verificationToken: String,
  
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  
  lastActive: {
    type: Date,
    default: Date.now
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.verificationToken;
      delete ret.resetPasswordToken;
      delete ret.resetPasswordExpire;
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.verificationToken;
      delete ret.resetPasswordToken;
      delete ret.resetPasswordExpire;
      delete ret.__v;
      return ret;
    }
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    console.log('🔐 Password hashed automatically for:', this.email);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
};

// Generate JWT token
userSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { 
      userId: this._id, 
      email: this.email,
      name: this.name 
    },
    process.env.JWT_SECRET || 'taskcontroller_secret_786',
    { expiresIn: '7d' }
  );
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
  const resetToken = crypto.randomBytes(20).toString('hex');
  
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
    
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
  
  return resetToken;
};

// Update last active timestamp
userSchema.methods.updateLastActive = async function() {
  this.lastActive = Date.now();
  await this.save();
};

module.exports = mongoose.model('User', userSchema);
