const router = require('express').Router();
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

// All routes protected
router.use(authMiddleware);

// ── GET TRANSACTIONS (current month or ?month=2024-01) ──────────────
router.get('/', async (req, res) => {
  try {
    const month = req.query.month || currentMonthKey();
    const transactions = await Transaction.find({ user: req.user._id, month }).sort({ date: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── ADD TRANSACTION ─────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { amount, category, payment, note, date } = req.body;
    if (!amount || !category) return res.status(400).json({ message: 'Amount and category required' });

    const txDate = date ? new Date(date) : new Date();
    const month  = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;

    const tx = await Transaction.create({
      user: req.user._id, amount, category, payment, note, date: txDate, month
    });
    res.status(201).json(tx);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── DELETE TRANSACTION ──────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const tx = await Transaction.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET MONTHLY SUMMARY (last 6 months) ────────────────────────────
router.get('/summary', async (req, res) => {
  try {
    const months = getLast6Months();
    const data = await Transaction.aggregate([
      { $match: { user: req.user._id, month: { $in: months } } },
      { $group: { _id: { month: '$month', category: '$category' }, total: { $sum: '$amount' } } },
      { $sort: { '_id.month': 1 } }
    ]);
    res.json({ months, data });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── UPDATE BUDGET ───────────────────────────────────────────────────
router.patch('/budget', async (req, res) => {
  try {
    const { monthly, categories } = req.body;
    if (monthly !== undefined) req.user.budget.monthly = monthly;
    if (categories) {
      Object.keys(categories).forEach(k => {
        if (req.user.budget.categories[k] !== undefined)
          req.user.budget.categories[k] = categories[k];
      });
    }
    req.user.markModified('budget');
    await req.user.save();
    res.json(req.user.budget);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── CLEAR MONTH ─────────────────────────────────────────────────────
router.delete('/month/:month', async (req, res) => {
  try {
    await Transaction.deleteMany({ user: req.user._id, month: req.params.month });
    res.json({ message: 'Month cleared' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── HELPERS ─────────────────────────────────────────────────────────
function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getLast6Months() {
  const months = [];
  const d = new Date();
  for (let i = 0; i < 6; i++) {
    months.unshift(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() - 1);
  }
  return months;
}

module.exports = router;
