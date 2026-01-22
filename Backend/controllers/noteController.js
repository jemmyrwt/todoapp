const Note = require('../models/Note');

// @desc    Get all notes
// @route   GET /api/notes
// @access  Private
exports.getNotes = async (req, res) => {
    try {
        const { 
            category, 
            search, 
            pinned, 
            archived,
            sort = '-updatedAt',
            page = 1,
            limit = 50 
        } = req.query;

        // Build query
        let query = { userId: req.userId };

        // Apply filters
        if (category && category !== 'all') {
            query.category = category;
        }

        if (pinned !== undefined) {
            query.isPinned = pinned === 'true';
        }

        if (archived !== undefined) {
            query.isArchived = archived === 'true';
        }

        // Search
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } },
                { tags: { $regex: search, $options: 'i' } }
            ];
        }

        // Execute query with pagination
        const skip = (page - 1) * limit;
        
        const notes = await Note.find(query)
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Note.countDocuments(query);

        res.json({
            success: true,
            count: notes.length,
            total,
            pages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            notes
        });

    } catch (error) {
        console.error('Get notes error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Get single note
// @route   GET /api/notes/:id
// @access  Private
exports.getNote = async (req, res) => {
    try {
        const note = await Note.findOne({
            _id: req.params.id,
            userId: req.userId
        });

        if (!note) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        res.json({
            success: true,
            note
        });

    } catch (error) {
        console.error('Get note error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Create note
// @route   POST /api/notes
// @access  Private
exports.createNote = async (req, res) => {
    try {
        const {
            title,
            content,
            category,
            tags,
            color,
            isPinned
        } = req.body;

        // Validate required fields
        if (!content) {
            return res.status(400).json({
                success: false,
                message: 'Please provide note content'
            });
        }

        const note = await Note.create({
            userId: req.userId,
            title: title || 'Untitled Note',
            content,
            category: category || 'Personal',
            tags: tags || [],
            color: color || '#6366f1',
            isPinned: isPinned || false
        });

        res.status(201).json({
            success: true,
            message: 'Note created successfully',
            note
        });

    } catch (error) {
        console.error('Create note error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Update note
// @route   PUT /api/notes/:id
// @access  Private
exports.updateNote = async (req, res) => {
    try {
        let note = await Note.findOne({
            _id: req.params.id,
            userId: req.userId
        });

        if (!note) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        // Update fields
        const updateFields = ['title', 'content', 'category', 'tags', 'color', 'isPinned', 'isArchived'];
        
        updateFields.forEach(field => {
            if (req.body[field] !== undefined) {
                note[field] = req.body[field];
            }
        });

        await note.save();

        res.json({
            success: true,
            message: 'Note updated successfully',
            note
        });

    } catch (error) {
        console.error('Update note error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Delete note
// @route   DELETE /api/notes/:id
// @access  Private
exports.deleteNote = async (req, res) => {
    try {
        const note = await Note.findOneAndDelete({
            _id: req.params.id,
            userId: req.userId
        });

        if (!note) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        res.json({
            success: true,
            message: 'Note deleted successfully'
        });

    } catch (error) {
        console.error('Delete note error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Search notes
// @route   GET /api/notes/search/:query
// @access  Private
exports.searchNotes = async (req, res) => {
    try {
        const { query } = req.params;

        const notes = await Note.find({
            userId: req.userId,
            $or: [
                { title: { $regex: query, $options: 'i' } },
                { content: { $regex: query, $options: 'i' } },
                { tags: { $regex: query, $options: 'i' } }
            ]
        }).limit(20);

        res.json({
            success: true,
            count: notes.length,
            notes
        });

    } catch (error) {
        console.error('Search notes error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
