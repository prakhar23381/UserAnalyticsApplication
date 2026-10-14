import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { elementKey } from '../src/lib/elements.js';
import { clickDoc, eventDoc, HOME, insert, PRODUCTS } from './factories.js';

const DASHBOARD = 'http://localhost:3000';
const app = createApp({ dashboardOrigins: [DASHBOARD] });
const get = (path, query) => request(app).get(path).query(query).set('Origin', DASHBOARD);

const ADD = { tag: 'button', id: 'add-1', classes: 'btn btn-primary', text: 'Add to cart' };
const PHOTO = { tag: 'div', classes: 'product-image tone-2', selector: 'main > article:nth-of-type(2) > div.product-image.tone-2', box: { x: 392, y: 253, w: 221, h: 160 } };
const OLD_PHOTO = { tag: 'div', classes: 'product-image tone-2' }; // recorded before selectors

describe('elementKey', () => {
  it('uses the selector, else #id, else tag, classes and text', () => {
    expect(elementKey(PHOTO)).toBe(PHOTO.selector);
    expect(elementKey(ADD)).toBe('#add-1'); // what the tracker's selector is for an element with an id
    expect(elementKey({ ...ADD, selector: '#add-1' })).toBe('#add-1');
    expect(elementKey(OLD_PHOTO)).toBe('div.product-image.tone-2');
    expect(elementKey({ tag: 'a', text: 'Home' })).toBe('a "Home"');
    expect(elementKey(undefined)).toBe('?');
  });
});

describe('GET /api/elements', () => {
  it("ranks the page's elements by clicks, with shares and sessions", async () => {
    await insert(
      clickDoc({ session_id: 'a', page_url: PRODUCTS, at: 1, target: ADD }),
      clickDoc({ session_id: 'a', page_url: PRODUCTS, at: 2, target: { ...ADD, selector: '#add-1' } }),
      clickDoc({ session_id: 'b', page_url: PRODUCTS, at: 3, target: ADD }),
      clickDoc({ session_id: 'b', page_url: PRODUCTS, at: 4, target: PHOTO }),
      clickDoc({ session_id: 'b', page_url: HOME, at: 5, target: ADD }), // another page
      eventDoc({ session_id: 'b', page_url: PRODUCTS, at: 0 }), // not a click
    );

    const res = await get('/api/elements', { page: PRODUCTS });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      page_url: PRODUCTS,
      device: 'all',
      total_clicks: 4,
      total_elements: 2,
      elements: [
        { rank: 1, key: '#add-1', selector: expect.any(String), tag: 'button', id: 'add-1', classes: 'btn btn-primary', text: 'Add to cart', clicks: 3, share: 0.75, sessions: 2 },
        { rank: 2, key: PHOTO.selector, selector: PHOTO.selector, tag: 'div', id: null, classes: 'product-image tone-2', text: null, clicks: 1, share: 0.25, sessions: 1 },
      ],
    });
  });

  it('gives each heatmap click the same key, and its box when recorded', async () => {
    await insert(clickDoc({ page_url: PRODUCTS, target: PHOTO }), clickDoc({ page_url: PRODUCTS, at: 1, target: OLD_PHOTO }));
    const [heatmap, elements] = await Promise.all([get('/api/heatmap', { page: PRODUCTS }), get('/api/elements', { page: PRODUCTS })]);
    expect(heatmap.body.clicks.map((c) => [c.key, c.box ?? null])).toEqual([
      ['div.product-image.tone-2', null],
      [PHOTO.selector, PHOTO.box],
    ]);
    expect(new Set(elements.body.elements.map((e) => e.key))).toEqual(new Set(heatmap.body.clicks.map((c) => c.key)));
  });

  it('follows the device and the segment', async () => {
    await insert(
      clickDoc({ session_id: 'desk', page_url: HOME, target: ADD }),
      clickDoc({ session_id: 'phone', page_url: HOME, target: PHOTO, device: 'mobile', viewport_w: 375, doc_w: 375 }),
    );
    expect((await get('/api/elements', { page: HOME, device: 'mobile' })).body.elements.map((e) => e.key)).toEqual([PHOTO.selector]);
    expect((await get('/api/elements', { page: HOME, devices: 'desktop' })).body.elements.map((e) => e.key)).toEqual(['#add-1']);
  });

  it('is empty for a page without clicks, and rejects bad input → 400', async () => {
    expect((await get('/api/elements', { page: HOME })).body).toMatchObject({ total_clicks: 0, total_elements: 0, elements: [] });
    expect((await get('/api/elements', {})).status).toBe(400);
    expect((await get('/api/elements', { page: HOME, device: 'watch' })).status).toBe(400);
  });

  it('lets only the dashboard read it (CORS)', async () => {
    const res = await request(app).get('/api/elements').query({ page: HOME }).set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
