const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ✅ FIXED: JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'jaimin_elite_786';
const JWT_EXPIRES_IN = '7d';

console.log('🔑 Auth Controller Loaded');
console.log('🔐 JWT Secret Present:', JWT_SECRET ? 'YES' : 'NO');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
    try {
        console.log('📝 Registration attempt for:', req.body.email);
        
        const { name, email, password } = req.body;

        // Validate input
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide name, email and password'
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address'
            });
        }

        // Password validation
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }

        // Check if user exists
        const userExists = await User.findOne({ email: email.toLowerCase() });
        if (userExists) {
            console.log('❌ User already exists:', email);
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        // Create user
        const user = await User.create({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password: password // Password will be hashed by pre-save middleware
        });

        console.log('✅ User created in DB:', {
            id: user._id,
            email: user.email,
            name: user.name
        });

        // ✅ FIXED: Generate JWT token
        const token = jwt.sign(
            { 
                userId: user._id.toString(),
                email: user.email,
                name: user.name 
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        console.log('🔐 Token generated for:', user.email);
        console.log('   Token length:', token.length);

        // Update last active
        user.lastActive = Date.now();
        await user.save();

        // Prepare user response
        const userResponse = {
            id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            settings: user.settings,
            lastActive: user.lastActive
        };

        console.log('✅ Registration successful');
        
        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            token: token,
            user: userResponse
        });

    } catch (error) {
        console.error('❌ Registration error:', error.message);
        
        // Handle duplicate email error
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({
                success: false,
                message: messages.join(', ')
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Server error during registration'
        });
    }
};

// @desc    Login user - ✅ FIXED THIS FUNCTION COMPLETELY
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
    try {
        console.log('🔑 Login attempt for:', req.body.email);
        
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            console.log('❌ Missing email or password');
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        // ✅ FIXED: Check if user exists with password field
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        
        if (!user) {
            console.log('❌ User not found:', email);
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        console.log('✅ User found:', user.email);
        console.log('   User ID:', user._id);

        // ✅ FIXED: Verify password using comparePassword method
        const isPasswordValid = await user.comparePassword(password);
        
        console.log('🔑 Password valid:', isPasswordValid);

        if (!isPasswordValid) {
            console.log('❌ Invalid password for:', user.email);
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        console.log('✅ Password verified for:', user.email);

        // ✅ FIXED: Generate JWT token
        const token = jwt.sign(
            { 
                userId: user._id.toString(),
                email: user.email,
                name: user.name 
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        console.log('🔐 Login token generated');
        console.log('   Token (first 10 chars):', token.substring(0, 10) + '...');

        // Update last active
        user.lastActive = Date.now();
        await user.save();

        // Prepare user response
        const userResponse = {
            id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            settings: user.settings,
            lastActive: user.lastActive
        };

        console.log('✅ Login successful for:', user.email);
        console.log('   Sending response with token...');

        // ✅ FIXED: Send proper response
        res.json({
            success: true,
            message: 'Login successful',
            token: token,
            user: userResponse
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        console.error('❌ Error stack:', error.stack);
        
        res.status(500).json({
            success: false,
            message: 'Server error during login',
            error: error.message
        });
    }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
    try {
        console.log('🔍 Fetching user with ID:', req.userId);
        
        const user = await User.findById(req.userId).select('-password');
        
        if (!user) {
            console.log('❌ User not found in database');
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        console.log('✅ User found:', user.email);
        
        // Update last active
        user.lastActive = Date.now();
        await user.save();
        
        const userResponse = {
            id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            settings: user.settings,
            lastActive: user.lastActive
        };
        
        console.log('✅ Sending user data');

        res.json({
            success: true,
            user: userResponse
        });

    } catch (error) {
        console.error('❌ Get user error:', error);
        
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Update user settings
// @route   PUT /api/auth/settings
// @access  Private
exports.updateSettings = async (req, res) => {
    try {
        const { theme, soundEnabled, autosaveEnabled, remindersEnabled } = req.body;
        
        console.log('⚙️ Updating settings for user:', req.userId);
        
        const user = await User.findById(req.userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update settings
        user.settings = {
            theme: theme || user.settings.theme,
            soundEnabled: soundEnabled !== undefined ? soundEnabled : user.settings.soundEnabled,
            autosaveEnabled: autosaveEnabled !== undefined ? autosaveEnabled : user.settings.autosaveEnabled,
            remindersEnabled: remindersEnabled !== undefined ? remindersEnabled : user.settings.remindersEnabled
        };

        await user.save();

        console.log('✅ Settings updated for:', user.email);
        
        res.json({
            success: true,
            message: 'Settings updated successfully',
            settings: user.settings
        });

    } catch (error) {
        console.error('❌ Update settings error:', error);
        
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res) => {
    try {
        const { name, avatar } = req.body;
        
        console.log('👤 Updating profile for user:', req.userId);
        
        const user = await User.findById(req.userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (name) user.name = name.trim();
        if (avatar) user.avatar = avatar;

        await user.save();

        const userResponse = {
            id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar
        };

        console.log('✅ Profile updated for:', user.email);
        
        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: userResponse
        });

    } catch (error) {
        console.error('❌ Update profile error:', error);
        
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        console.log('🔑 Changing password for user:', req.userId);
        
        const user = await User.findById(req.userId).select('+password');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Validate new password
        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters'
            });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        
        await user.save();

        console.log('✅ Password changed for:', user.email);
        
        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('❌ Change password error:', error);
        
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Check email availability
// @route   POST /api/auth/check-email
// @access  Public
exports.checkEmail = async (req, res) => {
    try {
        const { email } = req.body;
        
        console.log('📧 Checking email availability:', email);
        
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email'
            });
        }

        const userExists = await User.findOne({ email: email.toLowerCase() });
        
        console.log('✅ Email check complete:', email, 'available:', !userExists);
        
        res.json({
            success: true,
            available: !userExists
        });

    } catch (error) {
        console.error('❌ Check email error:', error);
        
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Public
exports.logout = async (req, res) => {
    try {
        console.log('👋 Logout requested');
        
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('❌ Logout error:', error);
        
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
