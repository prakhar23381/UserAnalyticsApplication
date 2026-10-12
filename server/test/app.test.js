import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { Event } from '../src/models/Event.js';

const DASHBOARD = 'http://localhost:3000';
const app = createApp({ dashboardOrigins: [DASHBOARD] });

describe('app', () => {
  it('GET /health → 200 { ok: true }', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('answers unknown routes with a JSON 404', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('answers malformed JSON with a JSON 400', async () => {
    const res = await request(app)
      .post('/anything')
      .set('Content-Type', 'application/json')
      .send('{"events": [');
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
  });

  it('lets the dashboard frame pages and other sites load files', async () => {
    const res = await request(app).get('/health');
    const csp = res.headers['content-security-policy'];
    expect(csp).toContain(`frame-ancestors 'self' ${DASHBOARD}`);
    expect(csp).not.toContain('upgrade-insecure-requests');
    expect(res.headers['x-frame-options']).toBeUndefined();
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('keeps upgrade-insecure-requests in production', async () => {
    const prod = createApp({ dashboardOrigins: [DASHBOARD], isProduction: true });
    const res = await request(prod).get('/health');
    expect(res.headers['content-security-policy']).toContain('upgrade-insecure-requests');
  });
});

describe('errorHandler', () => {
  function run(isProduction, err) {
    const res = { headersSent: false, status: vi.fn().mockReturnThis(), json: vi.fn() };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    errorHandler({ isProduction })(err, {}, res, vi.fn());
    return res;
  }

  it('hides the message of a 500 in production', () => {
    const res = run(true, new Error('connection string leaked'));
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });

  it('shows the message of a 500 in development', () => {
    const res = run(false, new Error('boom'));
    expect(res.json).toHaveBeenCalledWith({ error: 'boom' });
  });

  it('keeps a client error status and message in production', () => {
    const res = run(true, Object.assign(new Error('request entity too large'), { status: 413 }));
    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({ error: 'request entity too large' });
  });
});

describe('Event indexes', () => {
  it('has an index for every query shape', async () => {
    const keys = (await Event.listIndexes()).map((index) => index.key);
    expect(keys).toContainEqual({ session_id: 1, timestamp: 1 });
    expect(keys).toContainEqual({ page_url: 1, type: 1, device: 1 });
    expect(keys).toContainEqual({ timestamp: -1 });
  });
});
