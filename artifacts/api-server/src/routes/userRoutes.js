import { Router } from 'express';
import pool from '../db.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);

// GET /api/users  — Owner only: list all users
router.get('/', requireRole('owner'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, role, status, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows, count: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PATCH /api/users/:id/status  — Owner: ban or suspend or reactivate
router.patch('/:id/status', requireRole('owner'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended', 'banned'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot change your own status' });
    }
    const { rows } = await pool.query(
      'UPDATE users SET status = $1 WHERE id = $2 RETURNING id, email, role, status',
      [status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'User not found' });
    console.log(`[USER] ${req.user.email} set status=${status} for user id=${req.params.id} (${rows[0].email})`);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PATCH /api/users/:id/role  — Owner: promote to admin or demote to user
router.patch('/:id/role', requireRole('owner'), async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Can only set role to admin or user' });
    }
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot change your own role' });
    }
    const { rows } = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 AND role != $3 RETURNING id, email, role, status',
      [role, req.params.id, 'owner']
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'User not found or is an owner' });
    console.log(`[USER] ${req.user.email} set role=${role} for user id=${req.params.id} (${rows[0].email})`);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
