// Fills the events collection with fake but realistic visits to the demo
// store, so the dashboard has sessions and heatmaps to show, and builds their
// sessions the way ingest does.
//
//   npm run seed                                   add 40 sessions to MONGODB_URI (server/.env)
//   npm run seed -- --reset                        first delete earlier seeded sessions
//   npm run seed -- --sessions 80
//   npm run seed -- --base-url https://<api>.onrender.com --allow-remote
//
// Seeded session ids start with `seed_` and --reset deletes only those, so real
// visits survive. A database that isn't on localhost needs --allow-remote.
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { connect, disconnect } from '../src/db.js';
import { rebuildSessions } from '../src/lib/sessionStore.js';
import { validateEvent } from '../src/lib/validateEvent.js';
import { Event } from '../src/models/Event.js';
import { Session } from '../src/models/Session.js';

export const SEED_PREFIX = 'seed_';
const SEED_ID_RE = /^seed_/; // anchored, so a delete uses the { session_id, timestamp } index

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const DAY = 24 * 60 * MINUTE;
const MAX_PAGES_PER_SESSION = 6;
const RAGE_SHARE = 0.4; // of photo clicks: the visitor keeps clicking the photo
const QUICK_BACK_SHARE = 0.12; // of link clicks: the visitor comes straight back
const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

export const PAGES = { home: '/demo/', products: '/demo/products.html', about: '/demo/about.html' };

// [product, how often it goes in the cart]
const PRODUCTS = [
  ['house-blend', 6],
  ['ethiopia', 4],
  ['colombia', 3],
  ['decaf', 1],
  ['espresso', 5],
  ['cold-brew', 2],
  ['kettle', 1],
  ['mug', 2],
];

// What tracker.js records as the `target` of a click on each element, and the
// page a link opens. The cart link's text also includes the cart count.
export const ELEMENTS = {
  logo: { target: { tag: 'a', classes: 'logo', text: 'Acme Roasters' }, opens: 'home' },
  'nav-home': { target: { tag: 'a', text: 'Home' }, opens: 'home' },
  'nav-products': { target: { tag: 'a', text: 'Products' }, opens: 'products' },
  'nav-about': { target: { tag: 'a', text: 'About' }, opens: 'about' },
  cart: { target: { tag: 'a', id: 'cart-link', classes: 'cart' }, opens: 'products' },
  'cta-shop': {
    target: { tag: 'a', id: 'cta-shop', classes: 'btn btn-primary', text: 'Shop now' },
    opens: 'products',
  },
  'cta-learn': {
    target: { tag: 'a', id: 'cta-learn', classes: 'btn btn-secondary', text: 'Learn more' },
    opens: 'about',
  },
  'cta-visit-shop': {
    target: { tag: 'a', id: 'cta-visit-shop', classes: 'btn btn-primary', text: 'Visit the shop' },
    opens: 'products',
  },
  'newsletter-email': { target: { tag: 'input', id: 'newsletter-email' } },
  'newsletter-submit': {
    target: { tag: 'button', id: 'newsletter-submit', classes: 'btn btn-primary', text: 'Subscribe' },
  },
};
PRODUCTS.forEach(([name], i) => {
  ELEMENTS[`img-${name}`] = { target: { tag: 'div', classes: `product-image tone-${i + 1}` } };
  ELEMENTS[`add-${name}`] = {
    target: { tag: 'button', id: `add-${name}`, classes: 'btn btn-primary add-to-cart', text: 'Add to cart' },
  };
});

// Where each element sits at the heatmap's reference widths, as [left, top,
// width, height] in page px. Measured on 2026-10-13 in headless Brave with
// scrollbars hidden (as on macOS and phones), so doc_w equals the viewport
// width. Header boxes are the home page's; on other pages they move ≤ 2 px.
// Re-measure if the demo pages' markup or demo.css changes.
export const LAYOUT = {
  desktop: {
    viewport: [1280, 800],
    doc_h: { home: 920, products: 1144, about: 2707 },
    box: {
      logo: [100, 14, 137, 31], 'nav-home': [261, 17, 45, 26],
      'nav-products': [324, 17, 65, 26], 'nav-about': [407, 17, 44, 26],
      cart: [1123, 17, 57, 26], 'cta-shop': [100, 372, 123, 54],
      'cta-learn': [235, 372, 134, 54],
      'img-house-blend': [117, 253, 221, 160], 'add-house-blend': [117, 523, 221, 54],
      'img-ethiopia': [392, 253, 221, 160], 'add-ethiopia': [392, 523, 221, 54],
      'img-colombia': [667, 253, 221, 160], 'add-colombia': [667, 523, 221, 54],
      'img-decaf': [942, 253, 221, 160], 'add-decaf': [942, 523, 221, 54],
      'img-espresso': [117, 631, 221, 160], 'add-espresso': [117, 900, 221, 54],
      'img-cold-brew': [392, 631, 221, 160], 'add-cold-brew': [392, 900, 221, 54],
      'img-kettle': [667, 631, 221, 160], 'add-kettle': [667, 900, 221, 54],
      'img-mug': [942, 631, 221, 160], 'add-mug': [942, 900, 221, 54],
      'newsletter-email': [418, 2098, 421, 54], 'newsletter-submit': [850, 2098, 125, 54],
      'cta-visit-shop': [564, 2441, 152, 54],
    },
  },
  tablet: {
    viewport: [768, 1024],
    doc_h: { home: 1024, products: 1934, about: 2742 },
    box: {
      logo: [20, 14, 137, 31], 'nav-home': [181, 17, 45, 26],
      'nav-products': [244, 17, 65, 26], 'nav-about': [327, 17, 44, 26],
      cart: [691, 17, 57, 26], 'cta-shop': [20, 313, 123, 54],
      'cta-learn': [155, 313, 134, 54],
      'img-house-blend': [37, 253, 320, 160], 'add-house-blend': [37, 523, 320, 54],
      'img-ethiopia': [411, 253, 320, 160], 'add-ethiopia': [411, 523, 320, 54],
      'img-colombia': [37, 631, 320, 160], 'add-colombia': [37, 900, 320, 54],
      'img-decaf': [411, 631, 320, 160], 'add-decaf': [411, 900, 320, 54],
      'img-espresso': [37, 1008, 320, 160], 'add-espresso': [37, 1278, 320, 54],
      'img-cold-brew': [411, 1008, 320, 160], 'add-cold-brew': [411, 1278, 320, 54],
      'img-kettle': [37, 1385, 320, 160], 'add-kettle': [37, 1655, 320, 54],
      'img-mug': [411, 1385, 320, 160], 'add-mug': [411, 1655, 320, 54],
      'newsletter-email': [162, 2098, 421, 54], 'newsletter-submit': [594, 2098, 125, 54],
      'cta-visit-shop': [308, 2441, 152, 54],
    },
  },
  mobile: {
    viewport: [375, 812],
    doc_h: { home: 1463, products: 3552, about: 3464 },
    box: {
      logo: [20, 14, 137, 31], 'nav-home': [20, 53, 45, 26],
      'nav-products': [83, 53, 65, 26], 'nav-about': [166, 53, 44, 26],
      cart: [298, 53, 57, 26], 'cta-shop': [20, 428, 123, 54],
      'cta-learn': [155, 428, 134, 54],
      'img-house-blend': [37, 316, 301, 160], 'add-house-blend': [37, 586, 301, 54],
      'img-ethiopia': [37, 694, 301, 160], 'add-ethiopia': [37, 963, 301, 54],
      'img-colombia': [37, 1071, 301, 160], 'add-colombia': [37, 1341, 301, 54],
      'img-decaf': [37, 1448, 301, 160], 'add-decaf': [37, 1718, 301, 54],
      'img-espresso': [37, 1826, 301, 160], 'add-espresso': [37, 2095, 301, 54],
      'img-cold-brew': [37, 2203, 301, 160], 'add-cold-brew': [37, 2473, 301, 54],
      'img-kettle': [37, 2580, 301, 160], 'add-kettle': [37, 2850, 301, 54],
      'img-mug': [37, 2958, 301, 160], 'add-mug': [37, 3228, 301, 54],
      'newsletter-email': [45, 2660, 285, 52], 'newsletter-submit': [45, 2723, 125, 54],
      'cta-visit-shop': [112, 3117, 152, 54],
    },
  },
};

const DEVICE_MIX = [
  ['desktop', 50],
  ['mobile', 35],
  ['tablet', 15],
];

const USER_AGENTS = {
  desktop: [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0',
  ],
  tablet: [
    'Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
  ],
  mobile: [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36',
  ],
};

const ENTRY_PAGES = [
  ['home', 55],
  ['products', 30],
  ['about', 15],
];

// Where a visit comes from: campaign tags in the landing URL and/or a referrer.
const SOURCES = [
  [{ utm: null, referrer: undefined }, 30], // typed or bookmarked
  [{ utm: null, referrer: 'https://www.google.com/' }, 30],
  [{ utm: null, referrer: 'https://duckduckgo.com/' }, 5],
  // email clients send no referrer
  [{ utm: { utm_source: 'newsletter', utm_medium: 'email', utm_campaign: 'october-beans' }, referrer: undefined }, 15],
  [{ utm: { utm_source: 'instagram', utm_medium: 'social', utm_campaign: 'autumn-launch' }, referrer: 'https://l.instagram.com/' }, 15],
  [{ utm: { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'autumn-launch' }, referrer: 'https://www.google.com/' }, 5],
];

// Where visitors are, as the edge's country header would say; null: not known.
const COUNTRIES = [
  ['IN', 30],
  ['US', 22],
  ['GB', 12],
  ['DE', 9],
  ['SG', 8],
  ['CA', 7],
  ['AU', 7],
  [null, 5],
];

// What a visitor clicks on each page, in order; `null` means they leave. A
// link click ends the visit to that page and opens the link's page.
const BEHAVIOUR = {
  home: (random) => [
    weighted(random, [
      ['cta-shop', 40],
      ['cta-learn', 12],
      ['nav-products', 10],
      ['nav-about', 5],
      ['logo', 3],
      [null, 30],
    ]),
  ],
  products: (random, cart) => {
    const clicks = [];
    const adds = weighted(random, [
      [0, 3],
      [1, 4],
      [2, 2],
      [3, 1],
    ]);
    for (let i = 0; i < adds; i++) {
      const product = weighted(random, PRODUCTS);
      // Some visitors click the photo first, expecting a product page.
      if (random() < 0.2) clicks.push(`img-${product}`);
      clicks.push(`add-${product}`);
    }
    clicks.push(
      weighted(random, [
        ['nav-about', 12],
        ['nav-home', 6],
        ['logo', 3],
        ['cart', cart + adds > 0 ? 12 : 0],
        [null, 60],
      ]),
    );
    return clicks;
  },
  about: (random) => [
    ...(random() < 0.3 ? ['newsletter-email', 'newsletter-submit'] : []),
    weighted(random, [
      ['cta-visit-shop', 30],
      ['nav-products', 12],
      ['nav-home', 5],
      [null, 50],
    ]),
  ],
};

const between = (random, min, max) => min + random() * (max - min);

/** Picks a value from `[[value, weight], ...]` in proportion to its weight. */
function weighted(random, options) {
  let r = random() * options.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [value, weight] of options) {
    r -= weight;
    if (r < 0) return value;
  }
  return options.at(-1)[0];
}

/** A point near another, kept inside the box: how a frustrated visitor clicks the same spot. */
function pointNear(random, { x, y }, [left, top, width, height]) {
  const jitter = () => Math.round((random() - 0.5) * 20);
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  return { x: clamp(x + jitter(), left, left + width), y: clamp(y + jitter(), top, top + height) };
}

/** A point inside a box, usually near its middle: [left, top, width, height] → { x, y }. */
function pointIn(random, [left, top, width, height]) {
  const offset = () => (random() + random()) / 2;
  return { x: Math.round(left + offset() * width), y: Math.round(top + offset() * height) };
}

function landingUrl(random, baseUrl, page, utm) {
  // /demo/index.html is the same page as /demo/ once normalizeUrl has run.
  const path = page === 'home' && random() < 0.2 ? '/demo/index.html' : PAGES[page];
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(utm ?? {})) url.searchParams.set(key, value);
  return url.href;
}

function generateSession(random, { baseUrl, now }) {
  const device = weighted(random, DEVICE_MIX);
  const { viewport, doc_h, box } = LAYOUT[device];
  const [viewport_w, viewport_h] = viewport;
  const agents = USER_AGENTS[device];
  const user_agent = agents[Math.floor(random() * agents.length)];
  const country = weighted(random, COUNTRIES);
  const session_id =
    SEED_PREFIX + Array.from({ length: 12 }, () => ID_CHARS[Math.floor(random() * ID_CHARS.length)]).join('');

  const source = weighted(random, SOURCES);
  let page = weighted(random, ENTRY_PAGES);
  let url = landingUrl(random, baseUrl, page, source.utm);
  let referrer = source.referrer;
  // Starts at least 30 minutes ago, so even the longest session ends in the past.
  let time = Math.round(now - between(random, 30 * MINUTE, 7 * DAY));
  let cart = 0;
  const events = [];

  for (let visit = 1; ; visit++) {
    const common = {
      session_id,
      page_url: url,
      ...(referrer && { referrer }),
      viewport_w,
      viewport_h,
      doc_w: viewport_w,
      doc_h: doc_h[page],
    };
    events.push({ ...common, type: 'page_view', timestamp: new Date(time).toISOString() });

    let clicks = BEHAVIOUR[page](random, cart).filter(Boolean);
    // On the last page allowed, leave instead of following a link.
    if (visit === MAX_PAGES_PER_SESSION) clicks = clicks.filter((name) => !ELEMENTS[name].opens);

    let next = null;
    clicks.forEach((name, i) => {
      const element = ELEMENTS[name];
      const [, top] = box[name];
      // Read for a while, scroll down to the element, then click; later clicks come quicker.
      time +=
        i === 0
          ? between(random, 3, 15) * SECOND + (top / viewport_h) * between(random, 1, 3) * SECOND
          : between(random, 2, 10) * SECOND;
      time = Math.round(time);
      const target = name === 'cart' ? { ...element.target, text: `Cart ${cart}` } : element.target;
      // A product photo does nothing when clicked: the tracker flags the click as dead.
      const photo = name.startsWith('img-');
      const click = { ...common, type: 'click', ...pointIn(random, box[name]), target, ...(photo && { dead: true }) };
      events.push({ ...click, timestamp: new Date(time).toISOString() });
      // Some visitors keep clicking the photo, quickly and on the same spot: rage clicks.
      if (photo && random() < RAGE_SHARE) {
        const more = 2 + Math.floor(random() * 3);
        for (let r = 0; r < more; r++) {
          time = Math.round(time + between(random, 0.15, 0.5) * SECOND);
          events.push({ ...click, ...pointNear(random, click, box[name]), timestamp: new Date(time).toISOString() });
        }
      }
      if (name.startsWith('add-')) cart += 1;
      if (element.opens) next = element.opens;
    });

    // Some visitors open a link and come straight back (a quick back): the page
    // they left loads again, and the visit carries on there.
    if (next && next !== page && visit < MAX_PAGES_PER_SESSION - 1 && random() < QUICK_BACK_SHARE) {
      time = Math.round(time + between(random, 0.3, 1.5) * SECOND);
      events.push({
        ...common,
        type: 'page_view',
        page_url: new URL(PAGES[next], baseUrl).href,
        referrer: url,
        doc_h: doc_h[next],
        timestamp: new Date(time).toISOString(),
      });
      time = Math.round(time + between(random, 2, 6) * SECOND);
      continue; // the same page again, with its original referrer
    }

    if (!next) break;
    time = Math.round(time + between(random, 0.3, 1.5) * SECOND);
    referrer = url;
    page = next;
    url = new URL(PAGES[next], baseUrl).href;
  }

  return { user_agent, country, events };
}

/**
 * Fake visits as the tracker would send them, one `{ user_agent, country, events }` per
 * session, spread over the 7 days before `now`.
 */
export function generateSessions({
  count = 40,
  baseUrl = 'http://localhost:4000',
  now = Date.now(),
  random = Math.random,
} = {}) {
  return Array.from({ length: count }, () => generateSession(random, { baseUrl, now }));
}

/**
 * Shapes the sessions for storage the way POST /api/events does: validateEvent,
 * then the user agent and country (request headers there) and the server's receive time,
 * a moment after the client's since the tracker batches. Throws on an event
 * validateEvent rejects: that is a bug in this script.
 */
export function toDocuments(sessions) {
  return sessions.flatMap(({ user_agent, country, events }) =>
    events.map((event) => {
      const result = validateEvent(event);
      if (!result.ok) throw new Error(`validateEvent rejected a seeded event: ${result.error}`);
      const received_at = new Date(result.value.timestamp.getTime() + Math.round(between(Math.random, 100, 5000)));
      return { ...result.value, user_agent, ...(country && { country }), received_at };
    }),
  );
}

/**
 * Inserts the documents and builds their sessions. With `reset`, first deletes
 * every earlier seeded session (events and summary) and nothing else.
 */
export async function seed(documents, { reset = false } = {}) {
  let deleted = 0;
  if (reset) {
    deleted = (await Event.deleteMany({ session_id: SEED_ID_RE })).deletedCount;
    await Session.deleteMany({ session_id: SEED_ID_RE });
  }
  await Event.insertMany(documents, { ordered: false, throwOnValidationError: true });
  const sessions = await rebuildSessions(documents.map((doc) => doc.session_id));
  return { deleted, inserted: documents.length, sessions };
}

/** True when every host in a mongodb:// URI is this machine. mongodb+srv:// is always remote. */
export function isLocalUri(uri) {
  const hosts = /^mongodb:\/\/(?:[^@/]*@)?([^/?]+)/.exec(uri)?.[1];
  return Boolean(hosts) && hosts.split(',').every((host) => /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host));
}

/** The URI without credentials or options, safe to print. */
const redact = (uri) => uri.replace(/\/\/[^@/]*@/, '//').replace(/\?.*$/, '');

async function main() {
  const { values } = parseArgs({
    options: {
      reset: { type: 'boolean', default: false },
      sessions: { type: 'string', default: '40' },
      'base-url': { type: 'string', default: 'http://localhost:4000' },
      'allow-remote': { type: 'boolean', default: false },
    },
  });
  const count = Number(values.sessions);
  if (!Number.isInteger(count) || count < 1 || count > 1000) {
    throw new Error('--sessions must be a whole number from 1 to 1000');
  }
  const baseUrl = values['base-url'];
  if (!/^https?:\/\/[^/]/.test(baseUrl) || !URL.canParse(baseUrl)) {
    throw new Error('--base-url must be an http(s) URL, such as http://localhost:4000');
  }

  // Imported here rather than at the top: config.js requires MONGODB_URI, which the tests don't set.
  const { config } = await import('../src/config.js');
  const target = redact(config.mongodbUri);
  if (!isLocalUri(config.mongodbUri) && !values['allow-remote']) {
    throw new Error(`refusing to write to ${target}: it isn't on localhost. Pass --allow-remote if you mean it.`);
  }

  const documents = toDocuments(generateSessions({ count, baseUrl }));
  console.log(`Seeding ${target}: ${count} sessions, ${documents.length} events, pages on ${baseUrl}`);
  await connect(config.mongodbUri);
  try {
    // autoIndex is off; the API builds these at startup too
    await Event.createIndexes();
    await Session.createIndexes();
    const { deleted, inserted, sessions } = await seed(documents, { reset: values.reset });
    if (values.reset) console.log(`Deleted ${deleted} earlier seeded events`);
    console.log(`Inserted ${inserted} events and built ${sessions} sessions`);
  } finally {
    await disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`seed: ${err.message}`);
    process.exitCode = 1;
  });
}
