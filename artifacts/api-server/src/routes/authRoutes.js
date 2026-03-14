const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const { verifyToken } = require('../middleware/auth');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please wait 15 minutes and try again.' },
});

const PASSWORD_MIN = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePassword(password) {
  if (!password || password.length < PASSWORD_MIN) {
    return `Password must be at least ${PASSWORD_MIN} characters`;
  }
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  return null;
}

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const cleanEmail = email.toLowerCase().trim();

    if (!EMAIL_RE.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Invalid email address' });
    }
    if (cleanEmail.length > 255) {
      return res.status(400).json({ success: false, message: 'Email must be 255 characters or fewer' });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ success: false, message: passwordError });
    }

    const { rows: existing } = await pool.query(
      'SELECT id FROM users WHERE email = $1', [cleanEmail]
    );
    if (existing.length) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, role, status)
       VALUES ($1, $2, 'user', 'active')
       RETURNING id, email, role, status`,
      [cleanEmail, hash]
    );

    const user = rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    console.log(`[AUTH] New account registered: ${cleanEmail} (id=${user.id})`);

    res.status(201).json({
      success: true,
      token,
      user: { id: user.id, email: user.email, role: user.role, status: user.status },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const { rows } = await pool.query(
      'SELECT id, email, password_hash, role, status FROM users WHERE email = $1',
      [cleanEmail]
    );
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = rows[0];
    if (user.status !== 'active') {
      console.log(`[AUTH] Blocked login for ${cleanEmail}: account ${user.status}`);
      return res.status(403).json({ success: false, message: 'Account is suspended or banned' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      console.log(`[AUTH] Failed login attempt for ${cleanEmail}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    console.log(`[AUTH] Login: ${cleanEmail} (role=${user.role})`);

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, role: user.role, status: user.status },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;
