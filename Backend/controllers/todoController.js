const Todo = require('../models/Todo');
exports.getTodos = async (req, res) => {
    try {
        const todos = await Todo.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.json(todos);
    } catch (err) { res.status(500).json({ error: err.message }); }
};
exports.createTodo = async (req, res) => {
    try {
        const newTodo = new Todo({ ...req.body, userId: req.user.id });
        await newTodo.save();
        res.status(201).json(newTodo);
    } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.updateTodo = async (req, res) => {
    try {
        const updated = await Todo.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updated);
    } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.deleteTodo = async (req, res) => {
    try {
        await Todo.findByIdAndDelete(req.params.id);
        res.json({ msg: "Deleted" });
    } catch (err) { res.status(400).json({ error: err.message }); }
};
