const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  name:    { type: String, required: true },
  share:   { type: Number, required: true },  // amount they owe
  settled: { type: Boolean, default: false },
  settledAt: { type: Date }
}, { _id: false });

const splitSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  description:  { type: String, required: true, trim: true },
  totalAmount:  { type: Number, required: true },
  paidBy:       { type: String, required: true },  // "me" or a friend's name
  participants: [participantSchema],               // everyone splitting (excluding payer)
  dueDate:      { type: Date },
  mode:         { type: String, enum: ['split-ipaid','split-theypaid','lend','borrow'], default: 'split-ipaid' },
  createdAt:    { type: Date, default: Date.now }
});

splitSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Split', splitSchema);
