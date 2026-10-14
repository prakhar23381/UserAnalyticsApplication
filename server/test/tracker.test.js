import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { validateEvent } from '../src/lib/validateEvent.js';

const ORIGIN = 'http://localhost:4000';
const PAGE = `${ORIGIN}/demo/products.html?utm_source=ad`;
const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const SESSION_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MINUTE = 60_000;

const windows = [];
afterEach(async () => {
  await Promise.all(windows.splice(0).map((win) => win.happyDOM.close()));
});

function newWindow(url) {
  const win = new Window({
    url,
    width: 1440,
    height: 900,
    settings: {
      enableJavaScriptEvaluation: true,
      suppressInsecureJavaScriptEnvironmentWarning: true, // only our own tracker runs
      fetch: { virtualServers: [{ url: `${ORIGIN}/`, directory: PUBLIC_DIR }] },
    },
  });
  windows.push(win);
  win.document.body.innerHTML = `
    <button id="add" class="btn  primary"><span>Add to cart</span></button>
    <a href="#about">About us</a>
    <p id="copy">Write to jane@example.com</p>
    <input id="email" value="jane@example.com">`;
  return win;
}

/**
 * Opens a page in a fresh emulated browser and loads the real public/tracker.js
 * through a <script src>, as a site would. Beacons and timers are captured so
 * tests can read the one and fire the other.
 */
async function openPage({ url = PAGE, endpoint, prepare } = {}) {
  const win = newWindow(url);
  const beacons = [];
  win.navigator.sendBeacon = (to, blob) => beacons.push({ to, blob }) > 0;
  const timers = [];
  win.setTimeout = (fn, ms) => timers.push({ fn, ms, cleared: false });
  win.clearTimeout = (id) => {
    if (timers[id - 1]) timers[id - 1].cleared = true;
  };
  const errors = [];
  win.addEventListener('error', (e) => errors.push(e.error ?? e.message));
  prepare?.(win);

  const script = win.document.createElement('script');
  script.src = `${ORIGIN}/tracker.js`;
  if (endpoint) script.setAttribute('data-endpoint', endpoint);
  win.document.head.appendChild(script);
  await win.happyDOM.waitUntilComplete();

  return {
    win,
    beacons,
    timers,
    errors,
    flush: () => win.__cfTracker.flush(),
    pendingTimers: () => timers.filter((t) => !t.cleared),
    // Fires the pending timers, or only those set for `ms` (1000: dead-click verdicts).
    runTimers(ms) {
      for (const t of timers.filter((t) => !t.cleared && (ms === undefined || t.ms === ms))) {
        t.cleared = true;
        t.fn();
      }
    },
    async sent() {
      const bodies = await Promise.all(beacons.map((b) => b.blob.text()));
      return bodies.flatMap((body) => JSON.parse(body).events);
    },
    // happy-dom has no layout, so pageX/pageY are set by hand. detail 0 = keyboard.
    click(selector, { x = 0, y = 0, detail = 1 } = {}) {
      const event = new win.MouseEvent('click', { bubbles: true, cancelable: true, detail });
      Object.defineProperties(event, { pageX: { value: x }, pageY: { value: y } });
      win.document.querySelector(selector).dispatchEvent(event);
    },
  };
}

describe('tracker.js', () => {
  describe('events', () => {
    it('sends a page_view with the page and viewport, as text/plain to the script origin', async () => {
      const page = await openPage();
      expect(page.beacons).toHaveLength(0); // queued, not sent yet
      page.flush();

      expect(page.beacons).toHaveLength(1);
      expect(page.beacons[0].to).toBe(`${ORIGIN}/api/events`);
      expect(page.beacons[0].blob.type).toBe('text/plain');
      const [event] = await page.sent();
      expect(event).toEqual({
        session_id: expect.stringMatching(SESSION_ID_RE),
        type: 'page_view',
        page_url: PAGE,
        timestamp: expect.any(String),
        viewport_w: 1440,
        viewport_h: 900,
        doc_w: expect.any(Number),
        doc_h: expect.any(Number),
      });
      expect(new Date(event.timestamp).toISOString()).toBe(event.timestamp);
    });

    it('sends to data-endpoint when the script tag sets one', async () => {
      const page = await openPage({ endpoint: 'https://api.example/api/events' });
      page.flush();
      expect(page.beacons[0].to).toBe('https://api.example/api/events');
    });

    it('records a click with document coordinates and the element clicked', async () => {
      const page = await openPage();
      page.click('#add span', { x: 420.4, y: 880.6 });
      page.flush();

      const [pageView, click] = await page.sent();
      expect(click).toMatchObject({
        type: 'click',
        session_id: pageView.session_id,
        x: 420,
        y: 881,
        target: { tag: 'button', id: 'add', classes: 'btn primary', text: 'Add to cart' },
      });
    });

    it('still sees clicks the page stops from propagating', async () => {
      const page = await openPage();
      page.win.document.querySelector('#add').addEventListener('click', (e) => e.stopPropagation());
      page.click('#add');
      page.flush();
      expect((await page.sent()).map((e) => e.type)).toEqual(['page_view', 'click']);
    });

    it('records text for links and buttons only, and never form values', async () => {
      const page = await openPage();
      page.click('a');
      page.click('#copy');
      page.click('#email');
      page.flush();

      // A click on a form field isn't held for the dead-click check, so it is queued first.
      const byTag = Object.fromEntries((await page.sent()).map((e) => [e.target?.tag, e]));
      const { a: link, p: paragraph, input } = byTag;
      expect(link.target).toEqual({ tag: 'a', text: 'About us' });
      expect(paragraph.target).toEqual({ tag: 'p', id: 'copy' });
      expect(input.target).toEqual({ tag: 'input', id: 'email' });
      expect(await page.beacons[0].blob.text()).not.toContain('jane@example.com');
    });

    it('places a keyboard click at the centre of the element', async () => {
      const page = await openPage();
      page.win.document.querySelector('#add').getBoundingClientRect = () => ({ left: 100, top: 50, width: 40, height: 20 });
      page.click('#add', { detail: 0 });
      page.flush();
      expect((await page.sent())[1]).toMatchObject({ x: 120, y: 60 });
    });

    it('sends only events the API accepts', async () => {
      const page = await openPage({
        prepare: (win) => Object.defineProperty(win.document, 'referrer', { value: 'https://www.google.com/' }),
      });
      page.click('#add span', { x: 10, y: 20 });
      page.click('#email', { detail: 0 });
      page.click('#copy', { x: 5, y: 5 });
      page.runTimers(1000); // #add span and #copy are judged dead
      page.flush();

      const events = await page.sent();
      expect(events.filter((e) => e.dead)).toHaveLength(2);
      expect(events.map((e) => validateEvent(e).error)).toEqual([undefined, undefined, undefined, undefined]);
    });

    it('counts a page restored from the back/forward cache as a new page view', async () => {
      const page = await openPage();
      for (const persisted of [false, true]) {
        const event = new page.win.Event('pageshow');
        Object.defineProperty(event, 'persisted', { value: persisted });
        page.win.dispatchEvent(event);
      }
      page.flush();
      expect((await page.sent()).map((e) => e.type)).toEqual(['page_view', 'page_view']);
    });
  });

  describe('dead clicks', () => {
    const tick = () => new Promise((resolve) => setTimeout(resolve, 0)); // lets a MutationObserver report
    const sentClicks = async (page) => (await page.sent()).filter((e) => e.type === 'click');

    it('holds a click for 1 s, then flags it dead when nothing changed', async () => {
      const page = await openPage();
      page.click('#copy', { x: 5, y: 5 });
      expect(page.pendingTimers().map((t) => t.ms)).toEqual([5000, 1000]);
      page.runTimers(1000);
      page.flush();
      expect(await sentClicks(page)).toEqual([expect.objectContaining({ target: { tag: 'p', id: 'copy' }, dead: true })]);
    });

    it('does not flag a click that changes the page', async () => {
      const page = await openPage();
      const button = page.win.document.querySelector('#add');
      button.addEventListener('click', () => (button.textContent = 'Added ✓'));
      page.click('#add');
      await tick();
      page.runTimers(1000);
      page.flush();
      expect((await sentClicks(page))[0]).not.toHaveProperty('dead');
    });

    it('does not flag a click followed by a scroll or a URL change', async () => {
      const page = await openPage();
      page.click('#copy');
      page.win.document.dispatchEvent(new page.win.Event('scroll'));
      page.click('a'); // href="#about": the URL changes
      page.runTimers(1000);
      page.flush();
      expect((await sentClicks(page)).map((e) => e.dead ?? false)).toEqual([false, false]);
    });

    it('sends held clicks at once, unflagged, when the page is left', async () => {
      const page = await openPage();
      page.click('#copy');
      page.win.dispatchEvent(new page.win.Event('pagehide'));
      expect(await sentClicks(page)).toEqual([expect.not.objectContaining({ dead: true })]);
      page.runTimers(1000); // the verdict comes too late and sends nothing twice
      page.flush();
      expect(page.beacons).toHaveLength(1);
    });

    it('never holds clicks that only focus or open a new tab', async () => {
      const page = await openPage();
      page.win.document.body.insertAdjacentHTML('beforeend', '<div id="note" contenteditable="true">Note</div>');
      page.click('#email');
      page.click('#note');
      const event = new page.win.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, metaKey: true });
      page.win.document.querySelector('#copy').dispatchEvent(event);
      expect(page.pendingTimers().map((t) => t.ms)).toEqual([5000]);
      page.flush();
      expect((await sentClicks(page)).some((e) => e.dead)).toBe(false);
    });
  });

  describe('batching', () => {
    it('sends 5 seconds after the first queued event', async () => {
      const page = await openPage();
      expect(page.pendingTimers()).toEqual([expect.objectContaining({ ms: 5000 })]);
      expect(page.beacons).toHaveLength(0);
      page.runTimers();
      expect(page.beacons).toHaveLength(1);
    });

    it('sends at once when 10 events are queued', async () => {
      const page = await openPage();
      for (let i = 0; i < 9; i++) page.click('#add');
      expect(page.beacons).toHaveLength(0); // clicks wait 1 s for the dead-click check
      page.runTimers(1000);
      expect(page.beacons).toHaveLength(1);
      expect(await page.sent()).toHaveLength(10);
      expect(page.pendingTimers()).toHaveLength(0);
    });

    it('sends what is queued when the page is left or hidden', async () => {
      const page = await openPage();
      page.win.dispatchEvent(new page.win.Event('pagehide'));
      expect(page.beacons).toHaveLength(1);

      page.click('#add');
      Object.defineProperty(page.win.document, 'visibilityState', { value: 'hidden', configurable: true });
      page.win.document.dispatchEvent(new page.win.Event('visibilitychange'));
      expect(page.beacons).toHaveLength(2);
    });

    it('falls back to fetch with keepalive when sendBeacon refuses', async () => {
      const page = await openPage({ prepare: (win) => (win.navigator.sendBeacon = () => false) });
      const calls = [];
      page.win.fetch = (to, init) => calls.push({ to, init }) && Promise.resolve();
      page.flush();

      expect(calls).toHaveLength(1);
      expect(calls[0].to).toBe(`${ORIGIN}/api/events`);
      expect(calls[0].init).toMatchObject({
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'text/plain' },
      });
      expect(JSON.parse(calls[0].init.body).events[0].type).toBe('page_view');
    });
  });

  describe('session', () => {
    const storeSession = (session) => (win) =>
      win.localStorage.setItem('cf_session', typeof session === 'string' ? session : JSON.stringify(session));

    it('keeps the session within 30 minutes of the last event', async () => {
      const page = await openPage({
        prepare: storeSession({ id: 'existing_1', last_activity: Date.now() - 29 * MINUTE }),
      });
      page.flush();
      expect((await page.sent())[0].session_id).toBe('existing_1');
      const stored = JSON.parse(page.win.localStorage.getItem('cf_session'));
      expect(Date.now() - stored.last_activity).toBeLessThan(5000);
    });

    it('starts a new session after 30 minutes without events', async () => {
      const page = await openPage({
        prepare: storeSession({ id: 'old_1', last_activity: Date.now() - 31 * MINUTE }),
      });
      page.flush();
      const [event] = await page.sent();
      expect(event.session_id).not.toBe('old_1');
      expect(JSON.parse(page.win.localStorage.getItem('cf_session')).id).toBe(event.session_id);
    });

    it.each([
      ['not JSON', 'not json'],
      ['an id the API would reject', { id: 'has spaces', last_activity: Date.now() }],
      ['no last_activity', { id: 'ok_1' }],
    ])('replaces a stored session that is %s', async (_, stored) => {
      const page = await openPage({ prepare: storeSession(stored) });
      page.flush();
      const [event] = await page.sent();
      expect(event.session_id).toMatch(SESSION_ID_RE);
      expect(['has spaces', 'ok_1']).not.toContain(event.session_id);
    });

    it('keeps one session in memory when storage is blocked', async () => {
      const page = await openPage({
        prepare: (win) =>
          Object.defineProperty(win, 'localStorage', {
            configurable: true,
            get() {
              throw new Error('SecurityError: storage is disabled');
            },
          }),
      });
      page.click('#add');
      page.flush();
      const [pageView, click] = await page.sent();
      expect(pageView.session_id).toMatch(SESSION_ID_RE);
      expect(click.session_id).toBe(pageView.session_id);
    });

    it('makes its own id where crypto.randomUUID is missing (plain http)', async () => {
      const page = await openPage({
        prepare: (win) => Object.defineProperty(win.crypto, 'randomUUID', { value: undefined, configurable: true }),
      });
      page.flush();
      expect((await page.sent())[0].session_id).toMatch(SESSION_ID_RE);
    });
  });

  describe('safety', () => {
    it('does nothing in a heatmap preview (?cf_preview=1)', async () => {
      const page = await openPage({ url: `${ORIGIN}/demo/products.html?cf_preview=1` });
      expect(page.win.__cfTracker).toBeUndefined();
      page.click('#add');
      page.win.dispatchEvent(new page.win.Event('pagehide'));
      expect(page.beacons).toHaveLength(0);
    });

    it('does nothing inside an iframe', async () => {
      const page = await openPage({
        prepare: (win) => Object.defineProperty(win, 'top', { value: {}, configurable: true }),
      });
      expect(page.win.__cfTracker).toBeUndefined();
      expect(page.pendingTimers()).toHaveLength(0);
    });

    it('runs once when the script is included twice', async () => {
      const page = await openPage();
      const again = page.win.document.createElement('script');
      again.src = `${ORIGIN}/tracker.js`;
      page.win.document.head.appendChild(again);
      await page.win.happyDOM.waitUntilComplete();

      page.click('#add');
      page.flush();
      expect((await page.sent()).map((e) => e.type)).toEqual(['page_view', 'click']);
    });

    it('never throws into the page, even when sending fails', async () => {
      const page = await openPage({
        prepare: (win) => {
          win.navigator.sendBeacon = () => {
            throw new Error('beacon failed');
          };
        },
      });
      page.win.fetch = () => {
        throw new Error('fetch failed');
      };

      expect(() => page.flush()).not.toThrow();
      for (let i = 0; i < 12; i++) page.click('#add'); // crosses the 10-event flush
      page.win.dispatchEvent(new page.win.Event('pagehide'));
      expect(page.errors).toEqual([]);
    });

    it('does nothing when it cannot tell where to send events', async () => {
      const win = newWindow(PAGE);
      const script = win.document.createElement('script'); // inline: no src, no data-endpoint
      script.textContent = readFileSync(new URL('tracker.js', `file://${PUBLIC_DIR}`), 'utf8');
      win.document.head.appendChild(script);
      expect(win.__cfTracker).toBeUndefined();
    });
  });
});
