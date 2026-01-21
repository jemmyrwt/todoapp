const mongoose = require('mongoose');
const TodoSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    prio: { type: String, default: 'low' },
    cat: { type: String, default: 'Work' },
    date: { type: String, default: 'No Deadline' },
    done: { type: Boolean, default: false }
}, { timestamps: true });
module.exports = mongoose.model('Todo', TodoSchema);
