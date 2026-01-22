const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ✅ FIXED: Jaimin ka original JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'jaimin_elite_786';
const JWT_EXPIRES_IN = '7d';

console.log('🔑 Auth Controller Loaded');
console.log('🔐 JWT Secret:', JWT_SECRET);

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
    try {
        console.log('📝 Registration attempt:', { ...req.body, password: '***' });
        
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
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const user = await User.create({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password: hashedPassword
        });

        console.log('✅ User created:', user.email);

        // ✅ FIXED: Jaimin ke JWT secret se token generate
        const token = jwt.sign(
            { 
                userId: user._id, 
                email: user.email,
                name: user.name 
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

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

        console.log('✅ Registration successful for:', user.email);
        console.log('🔐 Token generated:', token.substring(0, 20) + '...');

        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            token,
            user: userResponse
        });

    } catch (error) {
        console.error('❌ Registration error:', error);
        console.error('❌ Error details:', error.message);
        
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

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
    try {
        console.log('🔑 Login attempt:', { ...req.body, password: '***' });
        
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        // Check if user exists
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        
        if (!user) {
            console.log('❌ User not found:', email);
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        console.log('🔍 User found:', user.email);

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        
        console.log('✅ Password valid:', isMatch);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        console.log('🎉 Login successful for:', user.email);

        // ✅ FIXED: Jaimin ke JWT secret se token generate
        const token = jwt.sign(
            { 
                userId: user._id, 
                email: user.email,
                name: user.name 
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

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

        console.log('✅ Login successful, token generated');
        console.log('👤 User data:', userResponse.email);

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: userResponse
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        console.error('❌ Error details:', error.message);
        
        res.status(500).json({
            success: false,
            message: 'Server error during login'
        });
    }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
    try {
        console.log('🔍 Fetching user with ID:', req.userId);
        console.log('👤 User email:', req.userEmail);
        
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
        
        console.log('✅ User data prepared for response');

        res.json({
            success: true,
            user: userResponse
        });

    } catch (error) {
        console.error('❌ Get user error:', error);
        console.error('❌ Error details:', error.message);
        
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
        console.log('📝 Settings data:', { theme, soundEnabled, autosaveEnabled, remindersEnabled });
        
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
        console.error('❌ Error details:', error.message);
        
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
        console.log('📝 Profile data:', { name, avatar });
        
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
        console.error('❌ Error details:', error.message);
        
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
        const isMatch = await bcrypt.compare(currentPassword, user.password);
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
        console.error('❌ Error details:', error.message);
        
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
        console.error('❌ Error details:', error.message);
        
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
        console.error('❌ Error details:', error.message);
        
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
