const router  = require('express').Router();
const Split   = require('../models/Split');
const auth    = require('../middleware/auth');

router.use(auth);

// ── GET ALL SPLITS ──────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const splits = await Split.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(splits);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── CREATE SPLIT ────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { description, totalAmount, paidBy, participants, dueDate, mode } = req.body;
    if (!description || !totalAmount || !paidBy || !participants?.length)
      return res.status(400).json({ message: 'Missing required fields' });

    // Auto-calculate equal share per participant
    const share = parseFloat((totalAmount / (participants.length + (paidBy === 'me' ? 0 : 1))).toFixed(2));
    const parts = participants.map(name => ({ name, share, settled: false }));

    const split = await Split.create({
      user: req.user._id, description, totalAmount, paidBy, participants: parts,
      dueDate: dueDate ? new Date(dueDate) : undefined, mode
    });
    res.status(201).json(split);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── MARK PARTICIPANT AS SETTLED ─────────────────────────────────────
router.patch('/:id/settle/:name', async (req, res) => {
  try {
    const split = await Split.findOne({ _id: req.params.id, user: req.user._id });
    if (!split) return res.status(404).json({ message: 'Split not found' });

    const participant = split.participants.find(p => p.name === req.params.name);
    if (!participant) return res.status(404).json({ message: 'Participant not found' });

    participant.settled   = true;
    participant.settledAt = new Date();
    await split.save();
    res.json(split);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE SPLIT ────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await Split.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET BALANCES SUMMARY ────────────────────────────────────────────
// Returns net balance per person across all unsettled splits
router.get('/balances', async (req, res) => {
  try {
    const splits  = await Split.find({ user: req.user._id });
    const balances = {}; // positive = they owe me, negative = I owe them

    splits.forEach(split => {
      split.participants.forEach(p => {
        if (p.settled) return;
        if (!balances[p.name]) balances[p.name] = 0;

        if (split.paidBy === 'me') {
          // I paid → they owe me
          balances[p.name] += p.share;
        } else if (split.paidBy === p.name) {
          // They paid → I owe them my share
          // find my share — equal split so same value
          balances[p.name] -= p.share;
        }
      });
    });

    res.json(balances);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
