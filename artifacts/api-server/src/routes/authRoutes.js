import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import pool from '../db.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please wait 15 minutes and try again.' },
});

const PASSWORD_MIN = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePassword(password) {
  if (!password || password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters`;
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  return null;
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// ── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });

    const cleanEmail = email.toLowerCase().trim();
    if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ success: false, message: 'Invalid email address' });
    if (cleanEmail.length > 255) return res.status(400).json({ success: false, message: 'Email must be 255 characters or fewer' });

    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ success: false, message: passwordError });

    const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (existing.length) return res.status(409).json({ success: false, message: 'An account with this email already exists' });

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, role, status, provider)
       VALUES ($1, $2, 'user', 'active', 'local')
       RETURNING id, email, role, status`,
      [cleanEmail, hash]
    );

    const user = rows[0];
    console.log(`[AUTH] New account registered: ${cleanEmail} (id=${user.id})`);

    res.status(201).json({
      success: true,
      token: signToken(user),
      user: { id: user.id, email: user.email, role: user.role, status: user.status },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });

    const cleanEmail = email.toLowerCase().trim();
    const { rows } = await pool.query(
      'SELECT id, email, password_hash, role, status FROM users WHERE email = $1 AND provider = $2',
      [cleanEmail, 'local']
    );
    if (!rows.length) return res.status(401).json({ success: false, message: 'Invalid email or password' });

    const user = rows[0];
    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Account is suspended or banned' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      console.log(`[AUTH] Failed login attempt for ${cleanEmail}`);
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    console.log(`[AUTH] Login: ${cleanEmail} (role=${user.role})`);

    res.json({
      success: true,
      token: signToken(user),
      user: { id: user.id, email: user.email, role: user.role, status: user.status },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Build the public-facing base URL (works behind Replit's proxy)
function getPublicBaseUrl(req) {
  // REPLIT_DEV_DOMAIN is the actual public hostname injected by Replit
  const replitDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0];
  if (replitDomain) return `https://${replitDomain}`;
  // Fallback: trust the forwarded host header
  const host = req.get('x-forwarded-host') || req.get('host');
  const proto = req.get('x-forwarded-proto') || req.protocol;
  return `${proto}://${host}`;
}

// ── GET /api/auth/google ─────────────────────────────────────────────────────
router.get('/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(503).json({ success: false, message: 'Google Sign-In is not configured' });
  }

  const callbackUrl = `${getPublicBaseUrl(req)}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// ── GET /api/auth/google/callback ────────────────────────────────────────────
router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;

  const redirectBase = process.env.FRONTEND_URL || getPublicBaseUrl(req);

  if (error || !code) {
    return res.redirect(`${redirectBase}/?auth_error=google_denied`);
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const callbackUrl = `${getPublicBaseUrl(req)}/api/auth/google/callback`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokens.access_token) throw new Error('Failed to exchange code for token');

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();

    if (!profile.id || !profile.email) throw new Error('Failed to get Google profile');

    let user;
    const existing = await pool.query(
      'SELECT id, email, role, status FROM users WHERE google_id = $1 OR email = $2',
      [profile.id, profile.email.toLowerCase()]
    );

    if (existing.rows.length) {
      user = existing.rows[0];
      await pool.query(
        'UPDATE users SET google_id = $1, provider = $2 WHERE id = $3',
        [profile.id, 'google', user.id]
      );
    } else {
      const { rows } = await pool.query(
        `INSERT INTO users (email, password_hash, role, status, google_id, provider)
         VALUES ($1, '', 'user', 'active', $2, 'google')
         RETURNING id, email, role, status`,
        [profile.email.toLowerCase(), profile.id]
      );
      user = rows[0];
      console.log(`[AUTH] New Google account: ${user.email} (id=${user.id})`);
    }

    if (user.status !== 'active') {
      return res.redirect(`${redirectBase}/?auth_error=account_suspended`);
    }

    const token = signToken(user);
    console.log(`[AUTH] Google login: ${user.email} (role=${user.role})`);

    res.redirect(`${redirectBase}/?auth_token=${token}`);
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    res.redirect(`${redirectBase}/?auth_error=server_error`);
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', verifyToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

export default router;
