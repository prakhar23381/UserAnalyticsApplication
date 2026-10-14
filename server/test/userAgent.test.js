import { describe, expect, it } from 'vitest';
import { parseUserAgent } from '../src/lib/userAgent.js';

describe('parseUserAgent', () => {
  it.each([
    ['Chrome', 'macOS', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36'],
    ['Chrome', 'Windows', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36'],
    ['Chrome', 'Android', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36'],
    ['Chrome', 'iOS', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/152.0.0.0 Mobile/15E148 Safari/604.1'],
    ['Chrome', 'Linux', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/152.0.0.0 Safari/537.36'],
    ['Chrome', 'ChromeOS', 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36'],
    ['Safari', 'macOS', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15'],
    ['Safari', 'iOS', 'Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1'],
    ['Firefox', 'Windows', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0'],
    ['Firefox', 'iOS', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/150.0 Mobile/15E148 Safari/605.1.15'],
    ['Edge', 'Windows', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0'],
    ['Opera', 'Windows', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 OPR/120.0.0.0'],
    ['Samsung Internet', 'Android', 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36'],
    ['Other', 'Other', 'curl/8.7.1'],
  ])('%s on %s', (browser, os, ua) => {
    expect(parseUserAgent(ua)).toEqual({ browser, os });
  });

  it('treats a missing user agent as Other', () => {
    expect(parseUserAgent(undefined)).toEqual({ browser: 'Other', os: 'Other' });
    expect(parseUserAgent('')).toEqual({ browser: 'Other', os: 'Other' });
  });
});
