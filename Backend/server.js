require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

const app = express();

// 1. Database Connection call
connectDB();

// 2. Middlewares
// JSON data handle karne ke liye
app.use(express.json());
// Cross-Origin Resource Sharing (Frontend-Backend link karne ke liye)
app.use(cors());
// Frontend static files serve karne ke liye
app.use(express.static(path.join(__dirname, 'public')));

// 3. API Routes
// Authentication Routes (Login/Register)
app.use('/api/auth', require('./routes/authRoutes'));
// Todo Routes (Tasks create/delete/update)
app.use('/api/todos', require('./routes/todoRoutes'));

// 4. SPA Support (Frontend Routing)
// Agar koi user direct kisi page par jaye toh index.html serve ho
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 5. Server Port Configuration
// Render automatically PORT provide karta hai, default 10000 rakha hai
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
    console.log(`
    ⭐ Zenith Elite Server is Live!
    🚀 Port: ${PORT}
    🌐 URL: http://localhost:${PORT}
    `);
});

// Unhandled Promise Rejection (Security & Stability)
process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    // Server close karke exit karo agar koi badi dikkat aaye
    // server.close(() => process.exit(1));
});
