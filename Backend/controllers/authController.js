
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const user = await User.create({ name, email, password });
        res.status(201).json({ msg: "User Registered" });
    } catch (err) { res.status(400).json({ error: "Email already exists" }); }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (user && (await bcrypt.compare(password, user.password))) {
        const token = jwt.sign({ id: user._id, name: user.name }, 'secret_key', { expiresIn: '1d' });
        res.json({ token, name: user.name });
    } else {
        res.status(401).json({ error: "Invalid Credentials" });
    }
};
