import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { Event } from '../src/models/Event.js';

const app = createApp({ dashboardOrigins: ['http://localhost:3000'] });

const event = (overrides = {}) => ({
  session_id: 's_123',
  type: 'page_view',
  page_url: 'http://localhost:4000/demo/products.html?utm_source=ad',
  timestamp: '2026-10-12T10:00:00.000Z',
  viewport_w: 1440,
  viewport_h: 900,
  doc_w: 1440,
  doc_h: 2400,
  ...overrides,
});
const click = (overrides = {}) => event({ type: 'click', x: 420, y: 880, ...overrides });

const post = (body) => request(app).post('/api/events').send(body);
const postText = (text) =>
  request(app).post('/api/events').set('Content-Type', 'text/plain').send(text);

describe('POST /api/events', () => {
  it('stores a single JSON event with the server-side fields added', async () => {
    const res = await post(event()).set('User-Agent', 'vitest-agent');
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ accepted: 1, rejected: 0 });

    const [stored] = await Event.find().lean();
    expect(stored).toMatchObject({
      session_id: 's_123',
      type: 'page_view',
      page_url: 'http://localhost:4000/demo/products.html',
      raw_url: 'http://localhost:4000/demo/products.html?utm_source=ad',
      device: 'desktop',
      user_agent: 'vitest-agent',
    });
    expect(stored.timestamp).toEqual(new Date('2026-10-12T10:00:00.000Z'));
    expect(Date.now() - stored.received_at.getTime()).toBeLessThan(10_000);
  });

  it('parses a text/plain batch, as sent by sendBeacon', async () => {
    const res = await postText(JSON.stringify({ events: [event(), click()] }));
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ accepted: 2, rejected: 0 });
    expect(await Event.countDocuments()).toBe(2);
  });

  it('stores the valid events of a batch and reports the invalid ones', async () => {
    const res = await post({ events: [event(), click(), click({ x: undefined })] });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({
      accepted: 2,
      rejected: 1,
      errors: [{ index: 2, error: expect.stringContaining('x and y') }],
    });
    expect(await Event.countDocuments()).toBe(2);
  });

  it('ignores server-owned fields sent by the client', async () => {
    await post(event({ received_at: '2000-01-01T00:00:00Z', device: 'mobile', user_agent: 'spoofed' }));
    const stored = await Event.findOne().lean();
    expect(stored.received_at.getFullYear()).not.toBe(2000);
    expect(stored.device).toBe('desktop');
    expect(stored.user_agent).not.toBe('spoofed');
  });

  it('rejects a request with no valid events → 400', async () => {
    const res = await post(click({ y: undefined }));
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'No valid events', accepted: 0, rejected: 1 });
    expect(await Event.countDocuments()).toBe(0);
  });

  it.each([
    ['unparseable text/plain', () => postText('{"events": [')],
    ['unparseable JSON', () => request(app).post('/api/events').set('Content-Type', 'application/json').send('{oops')],
    ['an empty batch', () => post({ events: [] })],
    ['a top-level array', () => post([event()])],
    ['no body', () => request(app).post('/api/events')],
  ])('answers %s with 400', async (_, send) => {
    const res = await send();
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
  });

  it('rejects more than 50 events → 413, storing none', async () => {
    const res = await post({ events: Array.from({ length: 51 }, () => event()) });
    expect(res.status).toBe(413);
    expect(await Event.countDocuments()).toBe(0);
  });

  it('rejects a body over 64kb → 413', async () => {
    const res = await postText(JSON.stringify({ events: [event({ referrer: 'x'.repeat(70_000) })] }));
    expect(res.status).toBe(413);
  });

  it('accepts requests from any origin (open CORS)', async () => {
    const preflight = await request(app)
      .options('/api/events')
      .set('Origin', 'https://some-shop.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(preflight.status).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe('*');
    expect(preflight.headers['access-control-allow-methods']).toBe('POST');

    const res = await post(event()).set('Origin', 'https://some-shop.example');
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });
});
