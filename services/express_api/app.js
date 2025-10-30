const { pool, initializeDatabase } = require('./db');

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const topicsRouter = require('./routes/topics');

const app = express();

	initializeDatabase().catch((err) => {
		console.error('Failed to initialize database', err);
		process.exit(1);
	});

app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api/topics', topicsRouter);

app.get('/health', async (req, res, next) => {
  try {
    const r = await pool.query('SELECT 1 AS ok');
    res.json({ ok: r.rows[0].ok === 1, at: new Date().toISOString() });
  } catch (e) {
    console.error('DB connection error:', e);
    next(e);
  }
});

app.use((req, res, next) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});


module.exports = app;
