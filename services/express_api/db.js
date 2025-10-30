const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
	console.error('Unexpected PG error', err);
	process.exit(-1);
});

const initializeDatabase = async () => {
	const client = await pool.connect();

	try {
		await client.query('BEGIN');

		await client.query(`
			CREATE TABLE IF NOT EXISTS topics (
				id SERIAL PRIMARY KEY,
				title VARCHAR(80) NOT NULL,
				summary TEXT,
				posts_count INTEGER NOT NULL DEFAULT 0,
				locked BOOLEAN NOT NULL DEFAULT FALSE,
				deleted_at TIMESTAMP WITH TIME ZONE,
				created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
				updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
			);
		`);

		await client.query(`
			CREATE TABLE IF NOT EXISTS posts (
				id SERIAL PRIMARY KEY,
				topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
				body TEXT NOT NULL,
				system BOOLEAN NOT NULL DEFAULT FALSE,
				deleted_at TIMESTAMP WITH TIME ZONE,
				created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
				updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
			);
		`);

		await client.query(
			'CREATE INDEX IF NOT EXISTS idx_topics_deleted_at ON topics(deleted_at)'
		);
		await client.query(
			'CREATE INDEX IF NOT EXISTS idx_posts_topic_id ON posts(topic_id)'
		);
		await client.query(
			'CREATE INDEX IF NOT EXISTS idx_posts_deleted_at ON posts(deleted_at)'
		);
		await client.query(`
			ALTER TABLE posts
			ADD CONSTRAINT IF NOT EXISTS posts_body_length CHECK (char_length(body) <= 200);
		`);

		await client.query(`
			UPDATE topics AS t
			SET posts_count = sub.count
			FROM (
				SELECT topic_id, COUNT(*)::int AS count
				FROM posts
				WHERE deleted_at IS NULL
				GROUP BY topic_id
			) AS sub
			WHERE t.id = sub.topic_id
			  AND t.deleted_at IS NULL;
		`);
		await client.query(`
			UPDATE topics
			SET posts_count = 0
			WHERE deleted_at IS NULL
			  AND id NOT IN (
				SELECT DISTINCT topic_id FROM posts WHERE deleted_at IS NULL
			);
		`);

		const existingTopics = await client.query(
			'SELECT COUNT(*)::int AS count FROM topics'
		);
		if (existingTopics.rows[0]?.count === 0) {
			const seedTopic = await client.query(
				`INSERT INTO topics (title, summary, posts_count)
				 VALUES ($1, $2, $3)
				 RETURNING id`,
				[
					'サンプルスレッド',
					'ここは匿名掲示板のサンプルスレッドです。自由に投稿してみてください。',
					0,
				],
			);
			const topicId = seedTopic.rows[0].id;
			const samplePosts = [
				'ようこそ！ここでは気軽にスレッドを立てて会話できます。',
				'投稿は1件あたり200文字まで、50件でスレッドが自動的に締め切られます。',
				'何か不具合があればシステム管理者が削除できます。',
			];
			for (const body of samplePosts) {
				await client.query(
					'INSERT INTO posts (topic_id, body) VALUES ($1, $2)',
					[topicId, body],
				);
			}
			await client.query(
				'UPDATE topics SET posts_count = $2 WHERE id = $1',
				[topicId, samplePosts.length],
			);
		}

		await client.query('COMMIT');
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
};

module.exports = { pool, initializeDatabase };
