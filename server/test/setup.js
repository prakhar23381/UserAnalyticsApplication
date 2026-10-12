import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, inject } from 'vitest';
import { Event } from '../src/models/Event.js';

// A database per test file, so files can run in parallel on the shared in-memory server.
beforeAll(async () => {
  await mongoose.connect(inject('mongoUri'), { dbName: `test_${randomUUID()}` });
  await Event.createIndexes();
});

beforeEach(async () => {
  await Event.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
