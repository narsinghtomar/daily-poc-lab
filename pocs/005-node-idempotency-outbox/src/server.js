'use strict';
const { openDb } = require('./db');
const { createApp } = require('./app');
const { createRelay } = require('./relay');

const port = Number(process.env.PORT) || 3000;
const db = openDb();
const server = createApp(db).listen(port, () => console.log(`listening on :${port}`));

// Stand-in publisher: swap for a broker client (Kafka, SNS, RabbitMQ) in production.
const relay = createRelay(db, {
  publish: async (event) => console.log(`published ${event.type} ${event.id}`),
});
relay.start();

process.on('SIGTERM', () => {
  server.close(async () => {
    await relay.stop();
    db.close();
  });
});
