const express = require('express');
const router = express.Router({ mergeParams: true });
const { pool } = require('../db');

// 投稿やスレッドの運用ルールは定数としてまとめ、環境変数で調整できるようにする
const MAX_POSTS_PER_TOPIC = Number(process.env.MAX_POSTS_PER_TOPIC ?? '50');
const MAX_POST_BODY_LENGTH = Number(process.env.MAX_POST_BODY_LENGTH ?? '200');
const LIMIT_NOTICE_MESSAGE = 'このスレッドは上限に達したので新しいスレッドを立ててください';

router.get('/', async (req, res, next) => {
	try {
		const topicId = req.params.id;
		// 画面仕様に合わせ、1 ページあたり 10 件を上限として返す
		const requestedLimit = parseInt(req.query.limit ?? '10', 10);
		const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
			? Math.min(requestedLimit, 10)
			: 10;
		const offset = Math.max(parseInt(req.query.offset ?? '0', 10) || 0, 0);

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
		const trimmed = typeof body === 'string' ? body.trim() : '';

		if (!Number.isInteger(topicId) || topicId <= 0) {
			return res.status(400).json({ error: 'invalid topic id' });
		}
		if (!trimmed) {
			return res.status(400).json({ error: 'body is required' });
		}
		if (trimmed.length > MAX_POST_BODY_LENGTH) {
			// バックエンド側で 200 文字制限を厳格に守る
			return res
				.status(400)
				.json({ error: `body must be ${MAX_POST_BODY_LENGTH} characters or less` });
		}

		await client.query('BEGIN');

		// 該当トピックをロックして同時投稿時の上限超過を防止する
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
		if (topic.posts_count >= MAX_POSTS_PER_TOPIC) {
			await client.query('ROLLBACK');
			return res
				.status(409)
				.json({ error: `topic reached max posts (${MAX_POSTS_PER_TOPIC})` });
		}

		// この投稿で上限に到達するかどうかを事前に判定しておく
		const shouldAppendLimitNotice = topic.posts_count + 1 >= MAX_POSTS_PER_TOPIC;

		const ins = await client.query(
			'INSERT INTO posts (topic_id, body) VALUES ($1, $2) RETURNING *',
			[topicId, trimmed]
		);

		await client.query(
			'UPDATE topics SET posts_count = posts_count + 1 WHERE id = $1',
			[topicId]
		);

		if (shouldAppendLimitNotice) {
			// 上限に達したタイミングで自動メッセージを 1 件追加し、スレッドをロックする
			await client.query(
				'INSERT INTO posts (topic_id, body, system) VALUES ($1, $2, TRUE)',
				[topicId, LIMIT_NOTICE_MESSAGE]
			);
			await client.query(
				'UPDATE topics SET posts_count = posts_count + 1, locked = TRUE WHERE id = $1',
				[topicId]
			);
		}

		await client.query('COMMIT');
		return res.status(201).json(ins.rows[0]);
	} catch (e) {
		try { await client.query('ROLLBACK'); } catch (_) {
			// ignore
		}
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
