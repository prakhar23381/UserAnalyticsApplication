import { describe, expect, it } from 'vitest';
import { deviceFor } from '../src/lib/device.js';
import { validateEvent } from '../src/lib/validateEvent.js';

const base = {
  session_id: 'b7e0c2d4-1f3a-4c5e-9a7b-2d8e6f1a3c5b',
  page_url: 'http://localhost:4000/demo/products.html?utm_source=ad#top',
  timestamp: '2026-10-12T10:00:00.000Z',
  viewport_w: 1440,
  viewport_h: 900,
  doc_w: 1440,
  doc_h: 2400,
};
const pageView = { ...base, type: 'page_view', referrer: 'https://www.google.com/' };
const click = {
  ...base,
  type: 'click',
  x: 420,
  y: 880,
  target: { tag: 'button', id: 'add-1', classes: 'btn primary', text: '  Add to cart  ' },
};

describe('validateEvent', () => {
  it('accepts a page_view and shapes it for storage', () => {
    const result = validateEvent(pageView);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({
      session_id: base.session_id,
      type: 'page_view',
      page_url: 'http://localhost:4000/demo/products.html',
      raw_url: base.page_url,
      timestamp: new Date(base.timestamp),
      viewport_w: 1440,
      viewport_h: 900,
      doc_w: 1440,
      doc_h: 2400,
      device: 'desktop',
      referrer: 'https://www.google.com/',
    });
  });

  it('accepts a click with coordinates and a cleaned-up target', () => {
    const result = validateEvent(click);
    expect(result.ok).toBe(true);
    expect(result.value).toMatchObject({
      type: 'click',
      x: 420,
      y: 880,
      target: { tag: 'button', id: 'add-1', classes: 'btn primary', text: 'Add to cart' },
    });
  });

  it('keeps a selector and a box, dropping a selector over 256 characters and a box with a bad side', () => {
    const box = { x: 10.4, y: 20, w: 300, h: 54 };
    const target = (extra) => validateEvent({ ...click, target: { tag: 'div', ...extra } }).value.target;
    expect(target({ selector: ' #shop > div ', box })).toEqual({ tag: 'div', selector: '#shop > div', box: { x: 10, y: 20, w: 300, h: 54 } });
    expect(target({ selector: 'a'.repeat(257) })).toEqual({ tag: 'div' });
    expect(target({ box: { ...box, w: -1 } })).toEqual({ tag: 'div' });
    expect(target({ box: [1, 2, 3, 4] })).toEqual({ tag: 'div' });
  });

  it('keeps dead: true on a click only, and rejects a dead flag that is not a boolean', () => {
    expect(validateEvent({ ...click, dead: true }).value.dead).toBe(true);
    expect(validateEvent({ ...click, dead: false }).value).not.toHaveProperty('dead');
    expect(validateEvent({ ...pageView, dead: true }).value).not.toHaveProperty('dead');
    expect(validateEvent({ ...click, dead: 'yes' })).toEqual({ ok: false, error: 'dead must be true or false' });
  });

  it('drops unknown fields and never trusts a client-sent device', () => {
    const result = validateEvent({ ...pageView, device: 'mobile', is_admin: true, x: 5, y: 5 });
    expect(result.value.device).toBe('desktop');
    expect(result.value).not.toHaveProperty('is_admin');
    expect(result.value).not.toHaveProperty('x'); // coordinates belong to clicks only
  });

  it('truncates target text to 80 characters', () => {
    const result = validateEvent({ ...click, target: { tag: 'p', text: 'a'.repeat(500) } });
    expect(result.value.target.text).toHaveLength(80);
  });

  it.each([
    ['a non-object', null],
    ['an array', [pageView]],
    ['an unknown type', { ...pageView, type: 'scroll' }],
    ['a missing session_id', { ...pageView, session_id: undefined }],
    ['a session_id with odd characters', { ...pageView, session_id: 'abc{$ne:1}' }],
    ['a session_id over 64 characters', { ...pageView, session_id: 'a'.repeat(65) }],
    ['a page_url that is not a URL', { ...pageView, page_url: 'products.html' }],
    ['a non-http page_url', { ...pageView, page_url: 'javascript:alert(1)' }],
    ['a page_url over 2048 characters', { ...pageView, page_url: `https://a.example/${'x'.repeat(2048)}` }],
    ['an unparseable timestamp', { ...pageView, timestamp: 'yesterday' }],
    ['a numeric timestamp', { ...pageView, timestamp: 1760263200000 }],
    ['a timestamp 2 days in the future', { ...pageView, timestamp: new Date(Date.now() + 2 * 86_400_000).toISOString() }],
    ['a missing viewport_w', { ...pageView, viewport_w: undefined }],
    ['a negative doc_h', { ...pageView, doc_h: -1 }],
    ['an absurd doc_h', { ...pageView, doc_h: 1e9 }],
    ['a click without x', { ...click, x: undefined }],
    ['a click with a string y', { ...click, y: '880' }],
  ])('rejects %s', (_, input) => {
    const result = validateEvent(input);
    expect(result.ok).toBe(false);
    expect(result.error).toEqual(expect.any(String));
  });
});

describe('deviceFor', () => {
  it.each([
    [375, 'mobile'],
    [767, 'mobile'],
    [768, 'tablet'],
    [1023, 'tablet'],
    [1024, 'desktop'],
    [1920, 'desktop'],
  ])('%i px → %s', (width, device) => {
    expect(deviceFor(width)).toBe(device);
  });
});
