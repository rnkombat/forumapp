const express = require('express');
const router = express.Router({ mergeParams: true });
const { pool } = require('../db');

router.get('/', async (req, res, next) => {
  try {
    const topicId = req.params.id;
    const limit = Math.min(parseInt(req.query.limit ?? '50', 10), 100); // 上限100
    const offset = Math.max(parseInt(req.query.offset ?? '0', 10), 0);

    const r = await pool.query(
      `SELECT id, topic_id, body, created_at
         FROM posts
        WHERE topic_id = $1
        ORDER BY id ASC
        LIMIT $2 OFFSET $3`,
      [topicId, limit, offset]
    );

    const c = await pool.query(
      'SELECT COUNT(*)::int AS total FROM posts WHERE topic_id=$1',
      [topicId]
    );

    res.json({ items: r.rows, total: c.rows[0].total, limit, offset });
  } catch (e) { next(e); }
});


// posts.js
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const topicId = Number(req.params.id);
    const { body } = req.body || {};
    const MAX_POSTS = Number(process.env.MAX_POSTS_PER_TOPIC ?? '50');

    if (!Number.isInteger(topicId) || topicId <= 0) {
      return res.status(400).json({ error: 'invalid topic id' });
    }
    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'body is required' });
    }

    await client.query('BEGIN');

    // 該当トピックをロックして同時投稿での超過を防ぐ
    const t = await client.query(
      'SELECT id, locked, deleted_at, posts_count FROM topics WHERE id = $1 FOR UPDATE',
      [topicId]
    );
    if (t.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Topic Not Found' });
    }
    const topic = t.rows[0];
    if (topic.deleted_at) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Topic Deleted' });
    }
    if (topic.locked) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Topic Locked' });
    }
    if (topic.posts_count >= MAX_POSTS) {
      await client.query('ROLLBACK');
      return res
        .status(409) // Conflict
        .json({ error: `topic reached max posts (${MAX_POSTS})` });
    }

    // 追加
    const ins = await client.query(
      'INSERT INTO posts (topic_id, body) VALUES ($1, $2) RETURNING *',
      [topicId, body.trim()]
    );

    // カウントを +1（厳密にやるなら COUNT(*) 再計算でもOK）
    await client.query(
      'UPDATE topics SET posts_count = posts_count + 1 WHERE id = $1',
      [topicId]
    );

    await client.query('COMMIT');
    return res.status(201).json(ins.rows[0]);
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    next(e);
  } finally {
    client.release();
  }
});


router.get('/:postId', async (req, res, next) => {
  try {
    const { id: topicId, postId } = req.params;
    const r = await pool.query(
      `SELECT id, topic_id, body, created_at
         FROM posts
        WHERE topic_id = $1 AND id = $2`,
      [topicId, postId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Post Not Found' });
    res.json(r.rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:postId', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id: topicId, postId } = req.params;

    await client.query('BEGIN');
    const r = await client.query(
      'DELETE FROM posts WHERE id=$1 AND topic_id=$2 RETURNING topic_id',
      [postId, topicId]
    );
    if (!r.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Post Not Found' });
    }

    await client.query(
      `UPDATE topics
          SET posts_count = (SELECT COUNT(*)::int FROM posts WHERE topic_id=$1)
        WHERE id=$1`,
      [topicId]
    );
    await client.query('COMMIT');
    res.status(204).end();
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    next(e);
  } finally {
    client.release();
  }
});


module.exports = router;
