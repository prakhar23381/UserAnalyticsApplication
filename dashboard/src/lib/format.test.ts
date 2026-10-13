import { describe, expect, it } from 'vitest';
import { describeTarget, formatDuration, formatOffset, pathOf, shortId, timeAgo } from './format';

describe('shortId', () => {
  it('cuts long ids to 13 characters', () => {
    expect(shortId('3f2b8c1e-9d4a-4e7b-8f6a-1c2d3e4f5a6b')).toBe('3f2b8c1e-9d4a…');
    expect(shortId('seed_ab12cd34ef56')).toBe('seed_ab12cd34…');
  });

  it('leaves short ids alone', () => {
    expect(shortId('s_1')).toBe('s_1');
    expect(shortId('seed_ab12cd34')).toBe('seed_ab12cd34');
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0s'],
    [45_000, '45s'],
    [59_600, '1m 00s'],
    [185_000, '3m 05s'],
    [3_720_000, '1h 02m'],
    [-5_000, '0s'],
  ])('%i ms → %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});

describe('formatOffset', () => {
  it.each([
    [0, '+00:00'],
    [83_900, '+01:23'],
    [3_723_000, '+1:02:03'],
  ])('%i ms → %s', (ms, text) => {
    expect(formatOffset(ms)).toBe(text);
  });
});

describe('timeAgo', () => {
  const now = Date.parse('2026-10-13T12:00:00.000Z');
  const before = (seconds: number) => new Date(now - seconds * 1000).toISOString();

  it.each([
    [3, 'just now'],
    [-120, 'just now'], // a visitor's clock running ahead
    [45, '45 seconds ago'],
    [5 * 60, '5 minutes ago'],
    [60 * 60, '1 hour ago'],
    [26 * 3600, 'yesterday'],
    [3 * 86_400, '3 days ago'],
  ])('%i s before → %s', (seconds, text) => {
    expect(timeAgo(before(seconds), now)).toBe(text);
  });
});

describe('pathOf', () => {
  it('keeps only the path', () => {
    expect(pathOf('http://localhost:4000/demo')).toBe('/demo');
    expect(pathOf('https://example.com/demo/products.html')).toBe('/demo/products.html');
  });

  it('returns anything that is not a URL unchanged', () => {
    expect(pathOf('not a url')).toBe('not a url');
  });
});

describe('describeTarget', () => {
  it('names the tag, id and text', () => {
    expect(describeTarget({ tag: 'button', id: 'add-espresso', classes: 'btn', text: 'Add to cart' })).toBe(
      'button#add-espresso "Add to cart"',
    );
  });

  it('falls back to the first class when there is no id', () => {
    expect(describeTarget({ tag: 'a', classes: 'btn btn-primary', text: 'Shop now' })).toBe('a.btn "Shop now"');
  });

  it('leaves out what was not recorded', () => {
    expect(describeTarget({ tag: 'img' })).toBe('img');
    expect(describeTarget({})).toBe('element');
    expect(describeTarget(undefined)).toBe('unknown element');
  });

  it('shortens long text', () => {
    const text = 'Subscribe to our newsletter and get ten percent off';
    expect(describeTarget({ tag: 'button', text })).toBe(`button "${text.slice(0, 39)}…"`);
  });
});
