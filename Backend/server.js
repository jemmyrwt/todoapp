require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const path = require('path');
const cors = require('cors');

const app = express();
connectDB();

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/todos', require('./routes/todoRoutes'));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`⭐ Zenith X Pro Live on ${PORT}`));
