
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

// Database Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("🚀 Zenith Database Connected Successfully"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// Routes Integration
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/todos', require('./routes/todoRoutes'));

// Serve Frontend for all other routes (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Render dynamic port or default 10000
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`⭐ Zenith Server active on port ${PORT}`));
