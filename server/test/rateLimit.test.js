import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { Event } from '../src/models/Event.js';

const DASHBOARD = 'http://localhost:3000';
const appWith = (options = {}) => createApp({ dashboardOrigins: [DASHBOARD], ...options });

const event = {
  session_id: 's_rate',
  type: 'page_view',
  page_url: 'http://localhost:4000/demo/',
  timestamp: '2026-10-12T10:00:00.000Z',
  viewport_w: 1440,
  viewport_h: 900,
  doc_w: 1440,
  doc_h: 2400,
};
const post = (app, headers = {}) => request(app).post('/api/events').set(headers).send(event);

describe('POST /api/events rate limit', () => {
  it('allows 120 requests a minute per client by default, and says so in the headers', async () => {
    const res = await post(appWith());
    expect(res.status).toBe(202);
    expect(res.headers['ratelimit-policy']).toMatch(/q=120; w=60/);
    expect(res.headers.ratelimit).toMatch(/r=119/);
  });

  it('answers 429 with a JSON error once the limit is reached, and stores nothing', async () => {
    const app = appWith({ ingestLimit: { windowMs: 60_000, limit: 2 } });
    expect((await post(app)).status).toBe(202);
    expect((await post(app)).status).toBe(202);

    const res = await post(app).set('Origin', 'https://shop.example');
    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: expect.stringMatching(/too many requests/i) });
    expect(res.headers['retry-after']).toMatch(/^\d+$/);
    expect(res.headers['access-control-allow-origin']).toBe('*'); // readable from any site
    expect(await Event.countDocuments()).toBe(2);
  });

  it('leaves the read endpoints alone', async () => {
    const app = appWith({ ingestLimit: { windowMs: 60_000, limit: 1 } });
    await post(app);
    expect((await post(app)).status).toBe(429);
    expect((await request(app).get('/api/pages')).status).toBe(200);
  });

  it('ignores client-sent address headers by default', async () => {
    const app = appWith({ ingestLimit: { windowMs: 60_000, limit: 1 } });
    expect((await post(app, { 'True-Client-IP': '203.0.113.1', 'X-Forwarded-For': '203.0.113.1' })).status).toBe(202);
    expect((await post(app, { 'True-Client-IP': '203.0.113.2', 'X-Forwarded-For': '203.0.113.2' })).status).toBe(429);
  });

  describe('with clientIpHeader (behind an edge that overwrites it)', () => {
    const appBehindEdge = () =>
      appWith({ clientIpHeader: 'true-client-ip', ingestLimit: { windowMs: 60_000, limit: 1 } });

    it('counts each address in the header separately', async () => {
      const app = appBehindEdge();
      expect((await post(app, { 'True-Client-IP': '203.0.113.1' })).status).toBe(202);
      expect((await post(app, { 'True-Client-IP': '203.0.113.2' })).status).toBe(202);
      expect((await post(app, { 'True-Client-IP': '203.0.113.1' })).status).toBe(429);
    });

    it('counts IPv6 addresses in the same /56 as one client', async () => {
      const app = appBehindEdge();
      expect((await post(app, { 'True-Client-IP': '2001:db8:0:1::1' })).status).toBe(202);
      expect((await post(app, { 'True-Client-IP': '2001:db8:0:2::1' })).status).toBe(429);
    });

    it('falls back to the connection address without the header', async () => {
      const app = appBehindEdge();
      expect((await post(app)).status).toBe(202);
      expect((await post(app)).status).toBe(429);
    });
  });
});
