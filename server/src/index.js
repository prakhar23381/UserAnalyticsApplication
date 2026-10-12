import { createApp } from './app.js';
import { config } from './config.js';
import { connect, disconnect } from './db.js';
import { Event } from './models/Event.js';

await connect(config.mongodbUri);
await Event.createIndexes();
console.log('Connected to MongoDB; indexes are in place');

const app = createApp(config);
const server = app.listen(config.port, (err) => {
  if (err) throw err;
  console.log(`API listening on http://localhost:${config.port}`);
});

// Render sends SIGTERM on every deploy and restart.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => {
    server.close(async () => {
      await disconnect();
      process.exit(0);
    });
  });
}
