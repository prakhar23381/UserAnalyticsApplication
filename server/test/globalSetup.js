import { MongoMemoryServer } from 'mongodb-memory-server';

// One in-memory mongod for the whole run; each test file gets its own database (setup.js).
export default async function setup({ provide }) {
  const mongod = await MongoMemoryServer.create();
  provide('mongoUri', mongod.getUri());
  return () => mongod.stop();
}
