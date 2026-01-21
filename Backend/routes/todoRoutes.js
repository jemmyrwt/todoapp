const express = require('express');
const router = express.Router();
const todoController = require('../controllers/todoController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes protected
router.use(authMiddleware);

// CRUD operations
router.get('/', todoController.getTodos);
router.get('/:id', todoController.getTodo);
router.post('/', todoController.createTodo);
router.put('/:id', todoController.updateTodo);
router.delete('/:id', todoController.deleteTodo);

// Bulk operations
router.put('/bulk/update', todoController.bulkUpdate);
router.delete('/bulk/delete', todoController.bulkDelete);

// Analytics
router.get('/analytics/stats', todoController.getTodoStats);

module.exports = router;
