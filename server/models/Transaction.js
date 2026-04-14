const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be positive']
  },
  category: {
    type: String,
    required: true,
    enum: ['food', 'transport', 'academic', 'personal', 'social', 'health', 'subscript', 'other']
  },
  payment: {
    type: String,
    enum: ['UPI', 'Cash', 'Card'],
    default: 'UPI'
  },
  note: { type: String, trim: true, maxlength: 100, default: '' },
  date: { type: Date, default: Date.now },
  month: { type: String, required: true } // format: "2024-01"
});

// Index for fast monthly queries per user
transactionSchema.index({ user: 1, month: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
