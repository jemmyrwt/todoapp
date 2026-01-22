const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// ✅ FIXED: Jaimin ka original JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'jaimin_elite_786';
const JWT_EXPIRES_IN = '7d';

console.log('👤 User Model Loaded');
console.log('🔑 JWT Secret in User model:', JWT_SECRET);

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
        console.log('🔐 Password hashed for:', this.email);
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

// ✅ FIXED: Jaimin ke JWT secret se token generate
userSchema.methods.generateAuthToken = function() {
    const token = jwt.sign(
        { 
            userId: this._id, 
            email: this.email,
            name: this.name 
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
    
    console.log('🔐 Token generated for:', this.email);
    console.log('   - Token (first 20 chars):', token.substring(0, 20) + '...');
    
    return token;
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
    const resetToken = crypto.randomBytes(20).toString('hex');
    
    this.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
        
    this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    
    return resetToken;
};

// Update last active timestamp
userSchema.methods.updateLastActive = async function() {
    this.lastActive = Date.now();
    await this.save();
};

module.exports = mongoose.model('User', userSchema);
