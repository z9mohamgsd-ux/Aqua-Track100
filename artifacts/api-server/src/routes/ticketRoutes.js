const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

router.use(verifyToken);

// GET /api/tickets  — list tickets based on role
router.get('/', async (req, res) => {
  try {
    const { status, archived } = req.query;
    let query, params;

    const showArchived = archived === 'true';
    const statusFilter = showArchived ? ['archived'] : ['open', 'pending_close', 'escalated', 'closed'];

    if (req.user.role === 'user') {
      query = `
        SELECT t.*, u.email AS user_email,
               a.email AS assigned_email
        FROM tickets t
        JOIN users u ON u.id = t.user_id
        LEFT JOIN users a ON a.id = t.assigned_to
        WHERE t.user_id = $1
          AND t.status = ANY($2::varchar[])
        ORDER BY t.updated_at DESC
      `;
      params = [req.user.id, status ? [status] : statusFilter];
    } else {
      query = `
        SELECT t.*, u.email AS user_email,
               a.email AS assigned_email
        FROM tickets t
        JOIN users u ON u.id = t.user_id
        LEFT JOIN users a ON a.id = t.assigned_to
        WHERE t.status = ANY($1::varchar[])
        ORDER BY t.updated_at DESC
      `;
      params = [status ? [status] : statusFilter];
    }

    const { rows } = await pool.query(query, params);
    res.json({ success: true, data: rows, count: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/tickets  — create ticket (any authenticated user)
router.post('/', async (req, res) => {
  try {
    const { subject, description } = req.body;
    if (!subject || !description) {
      return res.status(400).json({ success: false, message: 'Subject and description are required' });
    }
    const cleanSubject = subject.trim();
    const cleanDescription = description.trim();
    if (cleanSubject.length > 255) {
      return res.status(400).json({ success: false, message: 'Subject must be 255 characters or fewer' });
    }
    if (cleanDescription.length > 10000) {
      return res.status(400).json({ success: false, message: 'Description must be 10,000 characters or fewer' });
    }
    const { rows } = await pool.query(
      `INSERT INTO tickets (user_id, subject, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.user.id, cleanSubject, cleanDescription]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/tickets/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, u.email AS user_email, a.email AS assigned_email
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
    // Fetch messages
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

// POST /api/tickets/:id/messages
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
      `INSERT INTO ticket_messages (ticket_id, sender_id, message)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, req.user.id, message.trim()]
    );

    await pool.query('UPDATE tickets SET updated_at = NOW() WHERE id = $1', [req.params.id]);

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PATCH /api/tickets/:id/propose-close  — Admin/Owner propose closure (open or escalated)
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

// PATCH /api/tickets/:id/approve-close  — User approves closure
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

// PATCH /api/tickets/:id/reject-close  — User rejects closure
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

// PATCH /api/tickets/:id/escalate  — Admin escalates to Owner
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

// PATCH /api/tickets/:id/archive  — Owner archives a closed ticket manually
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

// DELETE /api/tickets/:id  — Owner only
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
