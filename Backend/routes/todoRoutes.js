
const express = require('express');
const router = express.Router();
const todoCtrl = require('../controllers/todoController');
const auth = require('../middleware/authMiddleware');

// Sabhi routes ke peeche auth laga diya
router.get('/', auth, todoCtrl.getTodos);
router.post('/', auth, todoCtrl.createTodo);
router.put('/:id', auth, todoCtrl.updateTodo);
router.delete('/:id', auth, todoCtrl.deleteTodo);

module.exports = router;
