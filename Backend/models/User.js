const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// ✅ FIXED: Jaimin ka original JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'jaimin_elite_786';
const JWT_EXPIRES_IN = '7d';

console.log('👤 User Model Loaded');
console.log('🔑 JWT Secret in User model:', JWT_SECRET ? 'SET' : 'MISSING');

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

// ✅ FIXED: Hash password before saving
userSchema.pre('save', async function(next) {
    console.log('🔐 Pre-save middleware called for:', this.email);
    
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) {
        console.log('   Password not modified, skipping hash');
        return next();
    }
    
    try {
        console.log('   Hashing password for:', this.email);
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        console.log('   ✅ Password hashed successfully');
        next();
    } catch (error) {
        console.error('   ❌ Password hashing error:', error);
        next(error);
    }
});

// ✅ FIXED: Compare password method - YEH IMPORTANT HAI!
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        console.log('🔑 Comparing password for:', this.email);
        console.log('   Candidate password length:', candidatePassword ? candidatePassword.length : 0);
        console.log('   Stored hash exists:', this.password ? 'YES' : 'NO');
        
        if (!this.password) {
            console.log('   ❌ No password hash found for user');
            return false;
        }
        
        if (!candidatePassword) {
            console.log('   ❌ No candidate password provided');
            return false;
        }
        
        // ✅ FIXED: Use bcrypt.compare properly
        const isMatch = await bcrypt.compare(candidatePassword, this.password);
        
        console.log('   Password match result:', isMatch);
        return isMatch;
        
    } catch (error) {
        console.error('❌ Password comparison error:', error);
        console.error('   Error details:', error.message);
        return false;
    }
};

// ✅ FIXED: Generate auth token
userSchema.methods.generateAuthToken = function() {
    try {
        console.log('🔐 Generating auth token for:', this.email);
        
        const token = jwt.sign(
            { 
                userId: this._id.toString(),
                email: this.email,
                name: this.name 
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
        
        console.log('   ✅ Token generated successfully');
        console.log('   Token length:', token.length);
        console.log('   Token first 20 chars:', token.substring(0, 20) + '...');
        
        return token;
    } catch (error) {
        console.error('❌ Token generation error:', error);
        throw error;
    }
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
