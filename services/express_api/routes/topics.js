const express = require('express');
const router = express.Router();
const { pool } = require('../db');

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, title, summary, posts_count, locked, deleted_at FROM topics WHERE deleted_at IS NULL ORDER BY id DESC'
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, summary } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const result = await pool.query(
      'INSERT INTO topics (title, summary) VALUES ($1, $2) RETURNING *',
      [title, summary ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { title, summary, locked } = req.body;
    const r = await pool.query(
        `UPDATE topics
             SET title = COALESCE($1, title),
                summary = COALESCE($2, summary),
                locked = COALESCE($3, locked)
        WHERE id = $4 AND deleted_at IS NULL
        RETURNING *`,
      [title ?? null, summary ?? null, locked ?? null, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not Found' });
    res.json(r.rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const r = await pool.query(
      `UPDATE topics SET deleted_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not Found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

const postsRouter = require('./posts');
router.use('/:id/posts', postsRouter);

module.exports = router;
