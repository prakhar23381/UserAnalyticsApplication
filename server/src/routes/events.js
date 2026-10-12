import express from 'express';
import { validateEvent } from '../lib/validateEvent.js';
import { Event } from '../models/Event.js';

export const MAX_BATCH = 50;
const MAX_REPORTED_ERRORS = 10;

const router = express.Router();

// sendBeacon can't send application/json without a CORS preflight, so the
// tracker sends its JSON as text/plain. express.json() ignores that type.
router.post('/', express.text({ type: 'text/plain', limit: '64kb' }), async (req, res) => {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Body is not valid JSON' });
    }
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Expected { "events": [...] } or a single event object' });
  }

  // The tracker sends batches; a single event object is accepted for curl.
  const items = Array.isArray(body.events) ? body.events : [body];
  if (items.length === 0) {
    return res.status(400).json({ error: 'No events in the request' });
  }
  if (items.length > MAX_BATCH) {
    return res.status(413).json({ error: `At most ${MAX_BATCH} events per request` });
  }

  const userAgent = req.get('user-agent')?.slice(0, 512);
  const valid = [];
  const errors = [];
  items.forEach((item, index) => {
    const result = validateEvent(item);
    if (result.ok) valid.push({ ...result.value, user_agent: userAgent });
    else errors.push({ index, error: result.error });
  });

  const report = errors.length > 0 ? { errors: errors.slice(0, MAX_REPORTED_ERRORS) } : {};
  if (valid.length === 0) {
    return res.status(400).json({ error: 'No valid events', accepted: 0, rejected: errors.length, ...report });
  }

  // validateEvent mirrors the schema, so a schema rejection here is a bug: fail loudly.
  await Event.insertMany(valid, { ordered: false, throwOnValidationError: true });
  res.status(202).json({ accepted: valid.length, rejected: errors.length, ...report });
});

export default router;
