// Sample data for the UI lab, shaped like the API's responses (lib/types.ts).
// Click positions match the demo shop's desktop layout (server/scripts/seed.js).
import { API_URL } from '@/lib/config';
import type { HeatmapClick, TrackedEvent } from '@/lib/types';

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
  { ...base, _id: 'e4', type: 'click', page_url: PRODUCTS, raw_url: PRODUCTS, timestamp: at(21), received_at: at(22), doc_h: 1144, x: 281, y: 943, target: { tag: 'button', id: 'add-espresso', classes: 'btn btn-primary add-to-cart', text: 'Add to cart' } },
  { ...base, _id: 'e5', type: 'click', page_url: PRODUCTS, raw_url: PRODUCTS, timestamp: at(30), received_at: at(31), doc_h: 1144, x: 1166, y: 32, target: { tag: 'a', id: 'cart-link', text: 'Cart 1' } },
];

export const LAB_HEATMAP_PAGE = PRODUCTS;

// A spread around three "Add to cart" buttons and the nav, like real traffic.
export const LAB_CLICKS: HeatmapClick[] = [
  [281, 943], [300, 930], [262, 951], [549, 547], [560, 540], [530, 560], [324, 913],
  [564, 927], [580, 920], [1166, 32], [1170, 36], [407, 30], [412, 28], [324, 30], [268, 941],
].map(([x, y]) => ({ x, y, doc_w: 1280, doc_h: 1144, viewport_w: 1280, viewport_h: 800, device: 'desktop' }));
