import { createApp } from './app.js';
import { config } from './config.js';
import { connect, disconnect } from './db.js';
import { ensureSessions } from './lib/sessionStore.js';
import { Event } from './models/Event.js';
import { Session } from './models/Session.js';

await connect(config.mongodbUri);
await Event.createIndexes();
await Session.createIndexes();
console.log('Connected to MongoDB; indexes are in place');
// Once, on the first start with a sessions collection: build it from the stored events.
const rebuilt = await ensureSessions();
if (rebuilt !== null) console.log(`Built the sessions collection from events: ${rebuilt} sessions`);

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
