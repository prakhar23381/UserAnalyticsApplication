// Sample data for the UI lab, shaped like the API's responses (lib/types.ts).
// Click positions match the demo shop's desktop layout (server/scripts/seed.js).
import { API_URL } from '@/lib/config';
import type { HeatmapClick, OverviewResponse, TrackedEvent } from '@/lib/types';

const HOME = `${API_URL}/demo`;
const PRODUCTS = `${API_URL}/demo/products.html`;
const START = Date.parse('2026-10-14T09:30:00.000Z');
const at = (seconds: number) => new Date(START + seconds * 1000).toISOString();

const base = {
  session_id: 'lab_fixture',
  viewport_w: 1280,
  viewport_h: 800,
  doc_w: 1280,
  device: 'desktop' as const,
};

export const LAB_EVENTS: TrackedEvent[] = [
  { ...base, _id: 'e1', type: 'page_view', page_url: HOME, raw_url: `${HOME}/?utm_source=newsletter`, timestamp: at(0), received_at: at(1), doc_h: 920, referrer: 'https://mail.example.com/' },
  { ...base, _id: 'e2', type: 'click', page_url: HOME, raw_url: `${HOME}/?utm_source=newsletter`, timestamp: at(7), received_at: at(8), doc_h: 920, x: 210, y: 416, target: { tag: 'a', id: 'cta-shop', classes: 'btn btn-primary', text: 'Shop now' } },
  { ...base, _id: 'e3', type: 'page_view', page_url: PRODUCTS, raw_url: PRODUCTS, timestamp: at(8), received_at: at(9), doc_h: 1144 },
  // A visitor keeps clicking a product photo, which does nothing: rage and dead clicks.
  ...[15, 15.3, 15.6].map((s, i): TrackedEvent => ({ ...base, _id: `e3${i}`, type: 'click', page_url: PRODUCTS, raw_url: PRODUCTS, timestamp: at(s), received_at: at(17), doc_h: 1144, x: 226 + i * 4, y: 708 - i * 3, target: { tag: 'div', classes: 'product-image tone-5' }, dead: true, rage: true })),
  { ...base, _id: 'e4', type: 'click', page_url: PRODUCTS, raw_url: PRODUCTS, timestamp: at(21), received_at: at(22), doc_h: 1144, x: 281, y: 943, target: { tag: 'button', id: 'add-espresso', classes: 'btn btn-primary add-to-cart', text: 'Add to cart' } },
  { ...base, _id: 'e5', type: 'click', page_url: PRODUCTS, raw_url: PRODUCTS, timestamp: at(30), received_at: at(31), doc_h: 1144, x: 1166, y: 32, target: { tag: 'a', id: 'cart-link', text: 'Cart 1' } },
];

export const LAB_HEATMAP_PAGE = PRODUCTS;

// A spread around three "Add to cart" buttons and the nav, like real traffic,
// each click naming its element (and box) as GET /api/heatmap does.
const ESPRESSO = { key: '#add-espresso', box: { x: 117, y: 900, w: 221, h: 54 } };
const ETHIOPIA = { key: '#add-ethiopia', box: { x: 392, y: 523, w: 221, h: 54 } };
const COLD_BREW = { key: '#add-cold-brew', box: { x: 392, y: 900, w: 221, h: 54 } };
const CART = { key: '#cart-link', box: { x: 1123, y: 17, w: 57, h: 26 } };
const ABOUT = { key: 'a "About"' }; // recorded before the tracker sent boxes
const PRODUCTS_LINK = { key: 'a "Products"' };
export const LAB_CLICKS: HeatmapClick[] = (
  [
    [281, 943, ESPRESSO], [300, 930, ESPRESSO], [262, 951, ESPRESSO], [549, 547, ETHIOPIA], [560, 540, ETHIOPIA],
    [530, 560, ETHIOPIA], [324, 913, ESPRESSO], [564, 927, COLD_BREW], [580, 920, COLD_BREW], [1166, 32, CART],
    [1170, 36, CART], [407, 30, ABOUT], [412, 28, ABOUT], [324, 30, PRODUCTS_LINK], [268, 941, ESPRESSO],
  ] as const
).map(([x, y, element]) => ({ x, y, doc_w: 1280, doc_h: 1144, viewport_w: 1280, viewport_h: 800, device: 'desktop', ...element }));

// The ranking GET /api/elements would return for LAB_CLICKS.
export const LAB_RANKING = [
  { rank: 1, key: '#add-espresso' },
  { rank: 2, key: '#add-ethiopia' },
  { rank: 3, key: '#add-cold-brew' },
  { rank: 4, key: '#cart-link' },
  { rank: 5, key: 'a "About"' },
  { rank: 6, key: 'a "Products"' },
];

// Two weeks of sample traffic for the Overview, with a previous period to compare.
export const LAB_OVERVIEW: OverviewResponse = {
  range: { from: '2026-10-01T00:00:00.000Z', to: '2026-10-15T00:00:00.000Z' },
  totals: { sessions: 1284, page_views: 3410, clicks: 5120, avg_duration_ms: 94_000, pages_per_session: 2.66, bounce_rate: 0.381, rage_sessions: 96, dead_sessions: 231, quick_back_sessions: 142, excessive_scroll_sessions: 64 },
  previous: { sessions: 1102, page_views: 3020, clicks: 5310, avg_duration_ms: 88_000, pages_per_session: 2.74, bounce_rate: 0.402, rage_sessions: 71, dead_sessions: 240, quick_back_sessions: 118, excessive_scroll_sessions: 59 },
  series: [62, 71, 80, 77, 95, 104, 88, 79, 92, 101, 110, 96, 113, 116].map((sessions, i) => ({
    date: `2026-10-${String(i + 1).padStart(2, '0')}`,
    sessions,
  })),
  top_pages: [
    { page_url: PRODUCTS, page_views: 1620 },
    { page_url: HOME, page_views: 1210 },
    { page_url: `${API_URL}/demo/about.html`, page_views: 580 },
  ],
  devices: [
    { device: 'desktop', sessions: 642 },
    { device: 'mobile', sessions: 488 },
    { device: 'tablet', sessions: 154 },
  ],
  browsers: [
    { value: 'Chrome', sessions: 701 },
    { value: 'Safari', sessions: 402 },
    { value: 'Firefox', sessions: 96 },
    { value: 'Edge', sessions: 61 },
    { value: 'Samsung Internet', sessions: 24 },
  ],
  countries: [
    { value: 'IN', sessions: 388 },
    { value: 'US', sessions: 301 },
    { value: 'GB', sessions: 144 },
    { value: 'DE', sessions: 97 },
    { value: null, sessions: 40 },
  ],
  sources: [
    { value: 'Direct', sessions: 470 },
    { value: 'google.com', sessions: 402 },
    { value: 'newsletter', sessions: 210 },
    { value: 'instagram', sessions: 150 },
    { value: 'duckduckgo.com', sessions: 52 },
  ],
};
