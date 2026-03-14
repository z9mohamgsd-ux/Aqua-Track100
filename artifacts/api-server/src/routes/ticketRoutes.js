const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

router.use(verifyToken);

// ── GET /api/tickets ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status, archived, role_filter, priority, from_date, to_date } = req.query;
    const showArchived = archived === 'true';

    let rows;

    if (req.user.role === 'user') {
      // Regular users see only their own tickets
      const statusFilter = showArchived ? ['archived'] : ['open', 'pending_close', 'escalated', 'closed'];
      const { rows: r } = await pool.query(
        `SELECT t.*, u.email AS user_email, a.email AS assigned_email
         FROM tickets t
         JOIN users u ON u.id = t.user_id
         LEFT JOIN users a ON a.id = t.assigned_to
         WHERE t.user_id = $1
           AND t.status = ANY($2::varchar[])
           ${priority && priority !== 'all' ? `AND t.priority = $3` : ''}
         ORDER BY t.updated_at DESC`,
        priority && priority !== 'all'
          ? [req.user.id, status ? [status] : statusFilter, priority]
          : [req.user.id, status ? [status] : statusFilter]
      );
      rows = r;
    } else if (req.user.role === 'admin') {
      // Admins see all non-archived tickets (or archived if requested)
      const statusFilter = showArchived ? ['archived'] : ['open', 'pending_close', 'escalated', 'closed'];
      const { rows: r } = await pool.query(
        `SELECT t.*, u.email AS user_email, a.email AS assigned_email
         FROM tickets t
         JOIN users u ON u.id = t.user_id
         LEFT JOIN users a ON a.id = t.assigned_to
         WHERE t.status = ANY($1::varchar[])
         ORDER BY t.updated_at DESC`,
        [status ? [status] : statusFilter]
      );
      rows = r;
    } else {
      // Owner: full access with rich filters
      const conditions = [];
      const params = [];

      if (showArchived) {
        conditions.push(`t.status = 'archived'`);
      } else {
        const allowedStatuses = status && status !== 'all'
          ? [status]
          : ['open', 'pending_close', 'escalated', 'closed'];
        params.push(allowedStatuses);
        conditions.push(`t.status = ANY($${params.length}::varchar[])`);
      }

      if (role_filter && role_filter !== 'all') {
        params.push(role_filter);
        conditions.push(`t.created_by_role = $${params.length}`);
      }

      if (priority && priority !== 'all') {
        params.push(priority);
        conditions.push(`t.priority = $${params.length}`);
      }

      if (from_date) {
        params.push(from_date);
        conditions.push(`t.created_at >= $${params.length}::timestamptz`);
      }

      if (to_date) {
        params.push(to_date);
        conditions.push(`t.created_at <= $${params.length}::timestamptz + interval '1 day'`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows: r } = await pool.query(
        `SELECT t.*, u.email AS user_email, u.role AS creator_role, a.email AS assigned_email
         FROM tickets t
         JOIN users u ON u.id = t.user_id
         LEFT JOIN users a ON a.id = t.assigned_to
         ${where}
         ORDER BY t.updated_at DESC`,
        params
      );
      rows = r;
    }

    res.json({ success: true, data: rows, count: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── POST /api/tickets ─────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { subject, description, priority = 'normal' } = req.body;
    if (!subject || !description) return res.status(400).json({ success: false, message: 'Subject and description are required' });

    const cleanSubject = subject.trim();
    const cleanDescription = description.trim();
    if (cleanSubject.length > 255) return res.status(400).json({ success: false, message: 'Subject must be 255 characters or fewer' });
    if (cleanDescription.length > 10000) return res.status(400).json({ success: false, message: 'Description must be 10,000 characters or fewer' });

    const validPriorities = ['low', 'normal', 'high', 'urgent'];
    const cleanPriority = validPriorities.includes(priority) ? priority : 'normal';

    // Determine created_by_role (owner creates as 'admin' category since they manage the system)
    const createdByRole = req.user.role === 'user' ? 'user' : 'admin';

    const { rows } = await pool.query(
      `INSERT INTO tickets (user_id, subject, description, priority, created_by_role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, cleanSubject, cleanDescription, cleanPriority, createdByRole]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── GET /api/tickets/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, u.email AS user_email, u.role AS creator_role, a.email AS assigned_email
       FROM tickets t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN users a ON a.id = t.assigned_to
       WHERE t.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Ticket not found' });
    const ticket = rows[0];
    if (req.user.role === 'user' && ticket.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const { rows: messages } = await pool.query(
      `SELECT m.*, u.email AS sender_email, u.role AS sender_role
       FROM ticket_messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.ticket_id = $1
       ORDER BY m.created_at ASC`,
      [req.params.id]
    );
    res.json({ success: true, data: { ...ticket, messages } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── POST /api/tickets/:id/messages ───────────────────────────────────────────
router.post('/:id/messages', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ success: false, message: 'Message is required' });
    if (message.trim().length > 5000) return res.status(400).json({ success: false, message: 'Message must be 5,000 characters or fewer' });

    const { rows: ticketRows } = await pool.query('SELECT * FROM tickets WHERE id = $1', [req.params.id]);
    if (!ticketRows.length) return res.status(404).json({ success: false, message: 'Ticket not found' });
    const ticket = ticketRows[0];

    if (req.user.role === 'user' && ticket.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (['closed', 'archived'].includes(ticket.status)) {
      return res.status(400).json({ success: false, message: 'Cannot message a closed ticket' });
    }

    const { rows } = await pool.query(
      `INSERT INTO ticket_messages (ticket_id, sender_id, message) VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, req.user.id, message.trim()]
    );
    await pool.query('UPDATE tickets SET updated_at = NOW() WHERE id = $1', [req.params.id]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── PATCH /api/tickets/:id/propose-close ─────────────────────────────────────
router.patch('/:id/propose-close', requireRole('admin', 'owner'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE tickets
       SET status = 'pending_close', closure_proposed_at = NOW(), closure_proposed_by = $1, updated_at = NOW()
       WHERE id = $2 AND status IN ('open', 'escalated')
       RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Ticket not found or not closeable' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── PATCH /api/tickets/:id/approve-close ─────────────────────────────────────
router.patch('/:id/approve-close', requireRole('user'), async (req, res) => {
  try {
    const { rows: ticketRows } = await pool.query('SELECT * FROM tickets WHERE id = $1', [req.params.id]);
    if (!ticketRows.length) return res.status(404).json({ success: false, message: 'Ticket not found' });
    const ticket = ticketRows[0];
    if (ticket.user_id !== req.user.id) return res.status(403).json({ success: false, message: 'Access denied' });
    if (ticket.status !== 'pending_close') return res.status(400).json({ success: false, message: 'Ticket is not pending closure' });

    const { rows } = await pool.query(
      `UPDATE tickets SET status = 'closed', closed_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── PATCH /api/tickets/:id/reject-close ──────────────────────────────────────
router.patch('/:id/reject-close', requireRole('user'), async (req, res) => {
  try {
    const { rows: ticketRows } = await pool.query('SELECT * FROM tickets WHERE id = $1', [req.params.id]);
    if (!ticketRows.length) return res.status(404).json({ success: false, message: 'Ticket not found' });
    const ticket = ticketRows[0];
    if (ticket.user_id !== req.user.id) return res.status(403).json({ success: false, message: 'Access denied' });
    if (ticket.status !== 'pending_close') return res.status(400).json({ success: false, message: 'Ticket is not pending closure' });

    const { rows } = await pool.query(
      `UPDATE tickets SET status = 'open', closure_proposed_at = NULL, closure_proposed_by = NULL, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── PATCH /api/tickets/:id/escalate ──────────────────────────────────────────
router.patch('/:id/escalate', requireRole('admin', 'owner'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE tickets SET status = 'escalated', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Ticket not found' });
    console.log(`[TICKET] Escalated ticket #${req.params.id} by ${req.user.email} (${req.user.role})`);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── PATCH /api/tickets/:id/priority ──────────────────────────────────────────
router.patch('/:id/priority', requireRole('admin', 'owner'), async (req, res) => {
  try {
    const { priority } = req.body;
    const valid = ['low', 'normal', 'high', 'urgent'];
    if (!valid.includes(priority)) return res.status(400).json({ success: false, message: 'Invalid priority' });
    const { rows } = await pool.query(
      `UPDATE tickets SET priority = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [priority, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Ticket not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── PATCH /api/tickets/:id/archive ───────────────────────────────────────────
router.patch('/:id/archive', requireRole('owner'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE tickets SET status = 'archived', updated_at = NOW() WHERE id = $1 AND status = 'closed' RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Ticket not found or not closed' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── DELETE /api/tickets/:id ───────────────────────────────────────────────────
router.delete('/:id', requireRole('owner'), async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM tickets WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ success: false, message: 'Ticket not found' });
    res.json({ success: true, message: 'Ticket deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
