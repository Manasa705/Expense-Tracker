const router = require('express').Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const validator = require('validator');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const signAccess  = id => jwt.sign({ id }, process.env.JWT_SECRET,         { expiresIn: '15m' });
const signRefresh = id => jwt.sign({ id }, process.env.JWT_REFRESH_SECRET,  { expiresIn: '7d' });

// ── REGISTER ────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: 'All fields required' });
    if (!validator.isEmail(email))
      return res.status(400).json({ message: 'Invalid email' });
    if (password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    const user = await User.create({ name, email, password });
    const accessToken  = signAccess(user._id);
    const refreshToken = signRefresh(user._id);
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    res.status(201).json({ accessToken, refreshToken, user: { id: user._id, name: user.name, email: user.email, budget: user.budget } });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── LOGIN ───────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password required' });

    const user = await User.findOne({ email }).select('+password +refreshToken');
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: 'Invalid email or password' });

    const accessToken  = signAccess(user._id);
    const refreshToken = signRefresh(user._id);
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    res.json({ accessToken, refreshToken, user: { id: user._id, name: user.name, email: user.email, budget: user.budget } });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── REFRESH TOKEN ───────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ message: 'No refresh token' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user || user.refreshToken !== refreshToken)
      return res.status(401).json({ message: 'Invalid refresh token' });

    const newAccess  = signAccess(user._id);
    const newRefresh = signRefresh(user._id);
    user.refreshToken = newRefresh;
    await user.save({ validateBeforeSave: false });

    res.json({ accessToken: newAccess, refreshToken: newRefresh });
  } catch {
    res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
});

// ── LOGOUT ──────────────────────────────────────────────────────────
router.post('/logout', authMiddleware, async (req, res) => {
  req.user.refreshToken = null;
  await req.user.save({ validateBeforeSave: false });
  res.json({ message: 'Logged out' });
});

// ── FORGOT PASSWORD ─────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email }).select('+resetPasswordToken +resetPasswordExpires');
    if (!user) return res.json({ message: 'If that email exists, a reset link was sent.' });

    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken   = crypto.createHash('sha256').update(token).digest('hex');
    user.resetPasswordExpires = Date.now() + 30 * 60 * 1000; // 30 min
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password.html?token=${token}`;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    await transporter.sendMail({
      from: `"Expense Tracker" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Password Reset Request',
      html: `<p>Hi ${user.name},</p>
             <p>Click the link below to reset your password. It expires in 30 minutes.</p>
             <a href="${resetUrl}">${resetUrl}</a>
             <p>If you didn't request this, ignore this email.</p>`
    });

    res.json({ message: 'If that email exists, a reset link was sent.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not send email', error: err.message });
  }
});

// ── RESET PASSWORD ──────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const hashed = crypto.createHash('sha256').update(req.body.token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashed,
      resetPasswordExpires: { $gt: Date.now() }
    }).select('+resetPasswordToken +resetPasswordExpires');

    if (!user) return res.status(400).json({ message: 'Token invalid or expired' });

    user.password = req.body.password;
    user.resetPasswordToken   = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET PROFILE ─────────────────────────────────────────────────────
router.get('/me', authMiddleware, (req, res) => {
  const { _id, name, email, budget, createdAt } = req.user;
  res.json({ id: _id, name, email, budget, createdAt });
});

// ── UPDATE PROFILE ──────────────────────────────────────────────────
router.patch('/me', authMiddleware, async (req, res) => {
  try {
    const { name, email } = req.body;
    if (name) req.user.name = name;
    if (email) {
      if (!validator.isEmail(email)) return res.status(400).json({ message: 'Invalid email' });
      req.user.email = email;
    }
    await req.user.save();
    res.json({ id: req.user._id, name: req.user.name, email: req.user.email });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── CHANGE PASSWORD ─────────────────────────────────────────────────
router.patch('/change-password', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+password');
    const { currentPassword, newPassword } = req.body;
    if (!(await user.comparePassword(currentPassword)))
      return res.status(400).json({ message: 'Current password incorrect' });
    if (newPassword.length < 6)
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
