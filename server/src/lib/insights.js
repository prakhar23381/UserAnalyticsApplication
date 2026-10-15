// Frustration signals in one session (D9 and M3 in docs/v2-plan.md), found in its
// events sorted by { timestamp, _id }. Used to summarize sessions
// (lib/sessionStore.js) and to mark the events of a journey (routes/sessions.js).

export const INSIGHTS = ['rage', 'dead', 'quick_back', 'excessive_scroll'];

const RAGE_MIN_CLICKS = 3;
const RAGE_MAX_GAP_MS = 700; // between one click and the next
const RAGE_RADIUS_PX = 30; // from the burst's first click
const QUICK_BACK_MS = 7000; // time on the page left again
const EXCESSIVE_SCROLL_FACTOR = 3; // px scrolled, in page heights (M5-D4)
const EXCESSIVE_MIN_SCREENS = 2; // only on pages taller than this many windows

const isClick = (event) => event.type === 'click';
const time = (event) => new Date(event.timestamp).getTime();

function joinsBurst(burst, click) {
  const first = burst[0];
  const last = burst.at(-1);
  return (
    click.page_url === first.page_url &&
    time(click) - time(last) <= RAGE_MAX_GAP_MS &&
    Math.hypot(click.x - first.x, click.y - first.y) <= RAGE_RADIUS_PX
  );
}

/** Bursts of rapid clicks on one spot: arrays of click events. */
function rageBursts(events) {
  const bursts = [];
  let burst = [];
  const close = () => {
    if (burst.length >= RAGE_MIN_CLICKS) bursts.push(burst);
    burst = [];
  };
  for (const event of events) {
    if (event.type === 'page_exit') continue; // a summary, not something the visitor did
    if (!isClick(event)) {
      close(); // a page view (or reload) ends the burst
      continue;
    }
    if (burst.length > 0 && !joinsBurst(burst, event)) close();
    burst.push(event);
  }
  close();
  return bursts;
}

/** Page views B in A → B → A where B lasted under QUICK_BACK_MS. */
function quickBacks(events) {
  const views = events.filter((event) => event.type === 'page_view');
  const found = [];
  for (let i = 1; i < views.length - 1; i++) {
    const [before, view, after] = [views[i - 1], views[i], views[i + 1]];
    if (before.page_url === after.page_url && view.page_url !== before.page_url && time(after) - time(view) < QUICK_BACK_MS) {
      found.push(view);
    }
  }
  return found;
}

/**
 * Page views where the visitor scrolled up and down far more than reading
 * needs: ≥ 3 page heights, on a page taller than two windows. Judged on each
 * page view's latest summary (page exits carry running totals); returns those exits.
 */
function excessiveScrolls(events) {
  const latest = new Map();
  for (const event of events) if (event.type === 'page_exit' && event.pv_id) latest.set(event.pv_id, event);
  return [...latest.values()].filter(
    (exit) =>
      exit.doc_h > EXCESSIVE_MIN_SCREENS * exit.viewport_h && exit.scroll_distance >= EXCESSIVE_SCROLL_FACTOR * exit.doc_h,
  );
}

/**
 * The insights of one session's events, oldest first: counts for the session
 * document, and the events involved (sets of the given event objects).
 */
export function findInsights(events) {
  const bursts = rageBursts(events);
  const backs = quickBacks(events);
  const scrolls = excessiveScrolls(events);
  return {
    counts: {
      rage_clicks: bursts.length,
      dead_clicks: events.filter((event) => isClick(event) && event.dead === true).length,
      quick_backs: backs.length,
      excessive_scrolls: scrolls.length,
    },
    rage: new Set(bursts.flat()),
    quickBacks: new Set(backs),
    excessiveScrolls: new Set(scrolls),
  };
}
