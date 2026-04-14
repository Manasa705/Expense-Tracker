require('dotenv').config();
const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');

const app = express();

// ── SECURITY MIDDLEWARE ─────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: ['http://127.0.0.1:5500', 'http://localhost:5500', process.env.CLIENT_URL], credentials: true }));
app.use(express.json({ limit: '10kb' }));

// Rate limiting — 100 requests per 15 min per IP
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Too many requests, please try again later.' }
}));

// Stricter limit on auth routes
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many auth attempts, please try again later.' }
}));

// ── ROUTES ──────────────────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/splits',   require('./routes/splits'));

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// ── DATABASE + START ────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });
