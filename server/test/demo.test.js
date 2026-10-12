import { readFileSync } from 'node:fs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const app = createApp({ dashboardOrigins: ['http://localhost:3000'] });
const PAGES = ['index.html', 'products.html', 'about.html'];
const read = (file) => readFileSync(new URL(`../public/demo/${file}`, import.meta.url), 'utf8');

describe('demo pages', () => {
  it.each(['/demo/', ...PAGES.map((page) => `/demo/${page}`)])('serves %s with the tracker', async (path) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/html/);
    expect(res.text).toContain('<script src="/tracker.js" defer></script>');
  });

  it('redirects /demo to /demo/', async () => {
    const res = await request(app).get('/demo');
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('/demo/');
  });

  it.each(['demo.css', 'demo.js'])('serves %s', async (file) => {
    const res = await request(app).get(`/demo/${file}`);
    expect(res.status).toBe(200);
  });

  // The server's CSP is script-src 'self' + script-src-attr 'none' + img-src 'self' data:.
  // These would be blocked in the browser without any error on the server.
  it.each(PAGES)('%s uses nothing the CSP would block', (page) => {
    const html = read(page);
    expect(html).not.toMatch(/<script(?![^>]*\ssrc=)[^>]*>/i); // inline <script>
    expect(html).not.toMatch(/\son[a-z]+\s*=/i); // onclick= and friends
    expect(html).not.toMatch(/<img[^>]+src=["']https?:/i); // images from other hosts
  });

  it.each(PAGES)('%s links to the other demo pages', (page) => {
    const html = read(page);
    for (const href of ['./', 'products.html', 'about.html']) {
      expect(html).toContain(`href="${href}"`);
    }
  });
});
