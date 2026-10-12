import { describe, expect, it } from 'vitest';
import { normalizeUrl } from '../src/lib/normalizeUrl.js';

describe('normalizeUrl', () => {
  it.each([
    ['drops the query', 'http://localhost:4000/demo/products.html?utm_source=ad&utm_medium=cpc', 'http://localhost:4000/demo/products.html'],
    ['drops the hash', 'https://shop.example/about#team', 'https://shop.example/about'],
    ['drops a trailing slash', 'https://shop.example/demo/', 'https://shop.example/demo'],
    ['drops index.html', 'https://shop.example/demo/index.html', 'https://shop.example/demo'],
    ['drops index.htm in any case', 'https://shop.example/demo/INDEX.HTM', 'https://shop.example/demo'],
    ['keeps the root as /', 'https://shop.example', 'https://shop.example/'],
    ['turns a root index.html into /', 'https://shop.example/index.html', 'https://shop.example/'],
    ['lowercases the host but not the path', 'https://Shop.EXAMPLE/Demo', 'https://shop.example/Demo'],
    ['drops a default port', 'https://shop.example:443/a', 'https://shop.example/a'],
    ['keeps a non-default port', 'http://localhost:4000/', 'http://localhost:4000/'],
  ])('%s', (_, raw, expected) => {
    expect(normalizeUrl(raw)).toBe(expected);
  });

  it('treats /demo, /demo/ and /demo/index.html as one page', () => {
    const variants = ['/demo', '/demo/', '/demo/index.html', '/demo/?ref=nav#top'].map((path) =>
      normalizeUrl(`http://localhost:4000${path}`),
    );
    expect(new Set(variants)).toEqual(new Set(['http://localhost:4000/demo']));
  });

  it('throws on something that is not a URL', () => {
    expect(() => normalizeUrl('not a url')).toThrow();
  });
});
