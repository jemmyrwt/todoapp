require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

// Middlewares
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("🚀 Zenith Database Connected"))
    .catch(err => console.error("❌ MongoDB Error:", err));

// Routes
app.use('/api/auth', require('./routes/userRoutes')); // Auth routes
app.use('/api/todos', require('./routes/todoRoutes')); // Task routes

// SPA Support
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`⭐ Server active on port ${PORT}`));
