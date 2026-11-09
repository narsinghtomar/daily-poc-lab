'use strict';
const { openDb } = require('./db');
const { createApp } = require('./app');

const port = Number(process.env.PORT) || 3000;
const db = openDb();
const server = createApp(db).listen(port, () => console.log(`listening on :${port}`));

process.on('SIGTERM', () => server.close(() => db.close()));
