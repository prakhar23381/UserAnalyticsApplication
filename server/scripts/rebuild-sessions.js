// Recomputes the whole sessions collection from the events (lib/sessionStore.js).
// The API builds it by itself on its first start with sessions; this is for
// after a change to how sessions are summarized.
//
//   npm -w server run sessions:rebuild                    MONGODB_URI from server/.env
//   npm -w server run sessions:rebuild -- --allow-remote  a database that isn't on localhost
//
// Only the sessions collection is written; events are read, never changed.
import { parseArgs } from 'node:util';
import { connect, disconnect } from '../src/db.js';
import { rebuildAllSessions } from '../src/lib/sessionStore.js';
import { Session } from '../src/models/Session.js';
import { isLocalUri } from './seed.js';

const { values } = parseArgs({ options: { 'allow-remote': { type: 'boolean', default: false } } });
const { config } = await import('../src/config.js');
const target = config.mongodbUri.replace(/\/\/[^@/]*@/, '//').replace(/\?.*$/, '');

try {
  if (!isLocalUri(config.mongodbUri) && !values['allow-remote']) {
    throw new Error(`refusing to write to ${target}: it isn't on localhost. Pass --allow-remote if you mean it.`);
  }
  await connect(config.mongodbUri);
  try {
    await Session.createIndexes();
    const count = await rebuildAllSessions();
    console.log(`Rebuilt ${count} sessions in ${target}`);
  } finally {
    await disconnect();
  }
} catch (err) {
  console.error(`sessions:rebuild: ${err.message}`);
  process.exitCode = 1;
}
