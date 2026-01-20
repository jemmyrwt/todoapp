
const Todo = require('../models/Todo');

exports.getTodos = async (req, res) => {
    try {
        // Sirf wahi tasks lo jo is logged-in user ke hain
        const todos = await Todo.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.json(todos);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createTodo = async (req, res) => {
    try {
        const newTodo = new Todo({
            ...req.body,
            userId: req.user.id // Task ko user se connect kar diya
        });
        await newTodo.save();
        res.status(201).json(newTodo);
    } catch (err) { res.status(400).json({ error: err.message }); }
};

// ... Baaki update/delete logic same rahega
