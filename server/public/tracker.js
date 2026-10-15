/*!
 * Trailmark tracker: records page views and clicks and sends them to the
 * Trailmark API. Zero dependencies, no build step.
 *
 * Embed it on every page (in <head> with defer, or before </body>):
 *
 *   <script src="https://<api-host>/tracker.js" defer></script>
 *
 * Events go to the script's own origin + /api/events. To send them elsewhere:
 *
 *   <script src="https://<cdn>/tracker.js" data-endpoint="https://<api-host>/api/events" defer></script>
 *
 * Every event carries a session id (localStorage `cf_session`, renewed after
 * 30 minutes without events), the page URL, a timestamp, the referrer and
 * the viewport and document sizes. Clicks add document coordinates
 * (pageX/pageY) and the clicked element's tag, id and classes, plus its text
 * for links, buttons and labels only. Form field values are never read.
 * A click also names its element with a short CSS selector (tags, ids, up to
 * two classes and :nth-of-type, from the nearest id) and its box in page px.
 *
 * Dead clicks: a click is held for 1 second. If nothing on the page changed
 * (DOM, scroll position or URL) in that time, it is sent with `dead: true`. A
 * click held when the page is left or hidden is sent at once, unflagged.
 * Clicks on form fields, labels and editable text (they only focus) and
 * ctrl/⌘/shift clicks (they open a new tab or window) are never flagged.
 *
 * Every page view has an id (`pv_id`), and when the page is hidden or left the
 * tracker sends a `page_exit` with running totals for that view: the deepest
 * point seen, px scrolled, active time (visible, with input in the last 15 s)
 * and active time per 50 px band of the page on screen.
 *
 * It does nothing inside an iframe or when the URL has ?cf_preview=1 (the
 * dashboard's heatmap preview), and never throws into the host page.
 */
(function () {
  'use strict';

  var SESSION_KEY = 'cf_session';
  var SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  var SESSION_ID_RE = /^[A-Za-z0-9_-]{1,64}$/; // what the API accepts
  var FLUSH_AT = 10; // events; well under the API's limit of 50 per request
  var FLUSH_DELAY_MS = 5000; // after the first event is queued
  var TEXT_MAX = 80;
  var INTERACTIVE = 'a, button, input, select, textarea, label, [role="button"]';
  var TEXT_TAGS = { A: true, BUTTON: true, LABEL: true };
  var SELECTOR_DEPTH = 5; // elements, counting the clicked one
  var SELECTOR_MAX = 256; // what the API accepts; a longer selector is left out
  var DEAD_AFTER_MS = 1000;
  var IDLE_AFTER_MS = 15000; // time after the last input that still counts as active
  var BAND_PX = 50;
  var MAX_BANDS = 400; // 20 000 px of page
  var MAX_SCROLL_DISTANCE = 10000000; // what the API accepts // a click that changed nothing for this long is dead
  var FOCUS_ONLY = 'input, select, textarea, label';

  var endpoint;
  var queue = [];
  var timer = null;
  var memorySession = null; // used when localStorage is blocked
  var held = []; // clicks waiting to be judged dead or not: { event, at, href }
  var lastChange = 0; // when the page last changed (DOM or scroll), while clicks are held
  var observer = null;
  var view = null; // the current page view's engagement, see startView

  // Wraps every entry point: an analytics script must never break the page.
  function safe(fn) {
    return function () {
      try {
        return fn.apply(this, arguments);
      } catch (e) {
        /* swallow */
      }
    };
  }

  function inIframe() {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true; // a cross-origin parent denied access
    }
  }

  function isPreview() {
    return new URLSearchParams(location.search).get('cf_preview') === '1' || inIframe();
  }

  function resolveEndpoint(script) {
    if (!script) return null;
    var configured = script.getAttribute('data-endpoint');
    if (configured) return configured;
    return script.src ? new URL(script.src).origin + '/api/events' : null;
  }

  // ---- session -----------------------------------------------------------

  function newId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID(); // only in secure contexts (https, localhost)
    }
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }

  function readSession() {
    try {
      var stored = JSON.parse(localStorage.getItem(SESSION_KEY));
      if (stored && SESSION_ID_RE.test(stored.id) && typeof stored.last_activity === 'number') {
        return stored;
      }
    } catch (e) {
      /* blocked storage or a corrupt value */
    }
    return memorySession;
  }

  function writeSession(session) {
    memorySession = session;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) {
      /* keep it in memory only */
    }
  }

  // One session per browser, shared by its tabs, renewed after 30 min without events.
  function sessionId() {
    var now = Date.now();
    var session = readSession();
    if (!session || now - session.last_activity > SESSION_TIMEOUT_MS) {
      session = { id: newId() };
    }
    session.last_activity = now;
    writeSession(session);
    return session.id;
  }

  // ---- events ------------------------------------------------------------

  // `session`: a page_exit keeps its page view's session and doesn't renew it.
  function build(type, fields, session) {
    var root = document.documentElement;
    var event = {
      session_id: session || sessionId(),
      type: type,
      page_url: location.href,
      timestamp: new Date().toISOString(),
      referrer: document.referrer || undefined,
      viewport_w: window.innerWidth,
      viewport_h: window.innerHeight,
      doc_w: root.scrollWidth,
      doc_h: root.scrollHeight,
    };
    if (view) event.pv_id = view.id;
    for (var key in fields) event[key] = fields[key];
    return event;
  }

  function enqueue(event) {
    queue.push(event);
    if (queue.length >= FLUSH_AT) flush();
    else if (!timer) timer = setTimeout(safe(flush), FLUSH_DELAY_MS);
  }

  function track(type, fields) {
    enqueue(build(type, fields));
  }

  // ---- engagement --------------------------------------------------------

  function startView() {
    var now = Date.now();
    view = {
      id: newId(),
      session: null,
      depth: window.scrollY + window.innerHeight,
      distance: 0,
      active: 0,
      bands: [],
      lastY: window.scrollY,
      lastTick: now,
      lastInput: now, // opening the page counts as activity
      visible: document.visibilityState !== 'hidden',
      sent: '',
    };
    var event = build('page_view');
    view.session = event.session_id;
    enqueue(event);
  }

  // Adds the active time since the last tick, at the position the page was at.
  function account(now) {
    if (!view) return;
    if (view.visible) {
      var ms = Math.min(now, view.lastInput + IDLE_AFTER_MS) - view.lastTick;
      if (ms > 0) {
        view.active += ms;
        var first = Math.floor(Math.max(0, view.lastY) / BAND_PX);
        var last = Math.min(MAX_BANDS - 1, Math.floor((Math.max(0, view.lastY) + window.innerHeight - 1) / BAND_PX));
        for (var i = first; i <= last; i++) view.bands[i] = (view.bands[i] || 0) + ms;
      }
    }
    view.lastTick = now;
  }

  function onInput() {
    if (!view) return;
    var now = Date.now();
    if (now - view.lastTick >= 200) account(now); // mousemove fires often; a 200 ms grain is enough
    view.lastInput = now;
  }

  function onScroll() {
    if (!view) return;
    var now = Date.now();
    account(now);
    var y = window.scrollY;
    view.distance += Math.abs(y - view.lastY);
    view.lastY = y;
    view.depth = Math.max(view.depth, y + window.innerHeight);
    view.lastInput = now;
  }

  // Leaving: time stops here, so a visibilitychange that follows adds nothing and sends no second summary.
  function onPageHide() {
    if (view) {
      account(Date.now());
      view.visible = false;
    }
    leave();
  }

  function onVisibility() {
    if (!view) return;
    var now = Date.now();
    account(now);
    view.visible = document.visibilityState !== 'hidden';
    if (view.visible) view.lastInput = now; // coming back counts as activity
  }

  // The page view's running totals, or null when nothing changed since the last one sent.
  function summary() {
    account(Date.now());
    var bands = [];
    for (var i = 0; i < view.bands.length; i++) bands.push(Math.round(view.bands[i] || 0));
    var fields = {
      scroll_depth: Math.round(view.depth),
      scroll_distance: Math.min(Math.round(view.distance), MAX_SCROLL_DISTANCE),
      active_ms: Math.round(view.active),
      bands: bands,
    };
    var key = fields.scroll_depth + ':' + fields.scroll_distance + ':' + fields.active_ms;
    if (key === view.sent) return null;
    view.sent = key;
    return build('page_exit', fields, view.session);
  }

  // ---- dead clicks -------------------------------------------------------

  function changed() {
    lastChange = Date.now();
  }

  // Watches the DOM only while a click is held, so the page pays nothing otherwise.
  function watch() {
    if (observer || typeof MutationObserver !== 'function') return;
    observer = new MutationObserver(changed);
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  }

  function unwatch() {
    if (held.length > 0 || !observer) return;
    observer.disconnect();
    observer = null;
  }

  function hold(event) {
    var item = { event: event, at: Date.now(), href: location.href };
    held.push(item);
    watch();
    setTimeout(safe(function () {
      settle(item, true);
    }), DEAD_AFTER_MS);
  }

  // Queues a held click. Judged: flagged dead when nothing changed since it.
  function settle(item, judge) {
    var i = held.indexOf(item);
    if (i === -1) return; // already sent
    held.splice(i, 1);
    if (judge && lastChange < item.at && location.href === item.href) item.event.dead = true;
    enqueue(item.event);
    unwatch();
  }

  // Leaving or hiding the page counts as a change: send every held click unflagged, now.
  function sendAll() {
    while (held.length > 0) settle(held[0], false);
    flush();
  }

  // The page is hidden or left: held clicks, the page view's summary, everything queued.
  function leave() {
    while (held.length > 0) settle(held[0], false);
    var exit = view && summary();
    if (exit) queue.push(exit);
    flush();
  }

  function canBeDead(e, el) {
    if (e.ctrlKey || e.metaKey || e.shiftKey) return false;
    return !el.closest(FOCUS_ONLY) && !el.isContentEditable;
  }

  function escapeCss(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
    return value.replace(/[^A-Za-z0-9_-]/g, '\\$&');
  }

  // One step of a selector: #id, or tag.class.class plus :nth-of-type among same-tag siblings.
  function selectorStep(el) {
    if (el.id) return '#' + escapeCss(el.id);
    var step = el.tagName.toLowerCase();
    var classes = (el.getAttribute('class') || '').trim().split(/\s+/);
    for (var i = 0; i < classes.length && i < 2; i++) {
      if (classes[i]) step += '.' + escapeCss(classes[i]);
    }
    var parent = el.parentElement;
    if (parent) {
      var index = 0;
      var same = 0;
      for (var child = parent.firstElementChild; child; child = child.nextElementSibling) {
        if (child.tagName !== el.tagName) continue;
        same++;
        if (child === el) index = same;
      }
      if (same > 1) step += ':nth-of-type(' + index + ')';
    }
    return step;
  }

  // A short path to the element, from the nearest id (or SELECTOR_DEPTH steps up).
  function selectorOf(el) {
    var steps = [];
    for (var node = el; node && node.nodeType === 1 && steps.length < SELECTOR_DEPTH; node = node.parentElement) {
      if (node === document.body || node === document.documentElement) break;
      steps.unshift(selectorStep(node));
      if (node.id) break;
    }
    var selector = steps.join(' > ');
    return selector && selector.length <= SELECTOR_MAX ? selector : undefined;
  }

  // Names the element worth naming: the nearest link, button or field, else what was clicked.
  function describe(el) {
    el = el.closest(INTERACTIVE) || el;
    var target = { tag: el.tagName.toLowerCase() };
    if (el.id) target.id = el.id;
    var classes = el.getAttribute('class'); // works for SVG elements too
    if (classes && classes.trim()) target.classes = classes.trim().replace(/\s+/g, ' ');
    if (TEXT_TAGS[el.tagName] || el.getAttribute('role') === 'button') {
      var text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, TEXT_MAX);
      if (text) target.text = text;
    }
    var selector = selectorOf(el);
    if (selector) target.selector = selector;
    var box = el.getBoundingClientRect();
    target.box = {
      x: Math.round(box.left + window.scrollX),
      y: Math.round(box.top + window.scrollY),
      w: Math.round(box.width),
      h: Math.round(box.height),
    };
    return { el: el, target: target };
  }

  function onClick(e) {
    var node = e.target;
    var el = node && node.nodeType === 1 ? node : node && node.parentElement;
    if (!el) return;
    var described = describe(el);
    var x = e.pageX;
    var y = e.pageY;
    // A keyboard or scripted click has no pointer position; use the element's centre.
    if (e.detail === 0) {
      var box = described.el.getBoundingClientRect();
      x = box.left + box.width / 2 + window.scrollX;
      y = box.top + box.height / 2 + window.scrollY;
    }
    var event = build('click', { x: Math.round(x), y: Math.round(y), target: described.target });
    if (canBeDead(e, el)) hold(event);
    else enqueue(event);
  }

  // ---- sending -----------------------------------------------------------

  function flush() {
    clearTimeout(timer);
    timer = null;
    if (queue.length === 0) return;
    send(queue.splice(0, queue.length));
  }

  // text/plain is CORS-safelisted: no preflight, so sendBeacon can post it
  // cross-origin, and the beacon survives the page navigating away.
  function send(events) {
    var body = JSON.stringify({ events: events });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(endpoint, new Blob([body], { type: 'text/plain' }))) {
        return;
      }
    } catch (e) {
      /* fall back to fetch */
    }
    fetch(endpoint, {
      method: 'POST',
      body: body,
      keepalive: true,
      headers: { 'Content-Type': 'text/plain' },
    }).catch(function () {});
  }

  // ---- start -------------------------------------------------------------

  safe(function () {
    if (window.__cfTracker) return; // loaded twice
    if (isPreview()) return;
    endpoint = resolveEndpoint(document.currentScript);
    if (!endpoint) return;

    window.__cfTracker = { flush: safe(sendAll) };
    startView();

    // Capture phase: page code that stops propagation can't hide clicks from us.
    document.addEventListener('click', safe(onClick), true);
    // Scrolling anywhere (a page or a panel) means a click did something.
    document.addEventListener('scroll', safe(changed), { capture: true, passive: true });
    window.addEventListener('scroll', safe(onScroll), { passive: true });
    var inputs = ['mousemove', 'pointerdown', 'keydown', 'touchstart', 'wheel'];
    for (var i = 0; i < inputs.length; i++) document.addEventListener(inputs[i], safe(onInput), { capture: true, passive: true });
    document.addEventListener('visibilitychange', safe(function () {
      onVisibility();
      if (document.visibilityState === 'hidden') leave();
    }));
    window.addEventListener('pagehide', safe(onPageHide));
    // A page restored from the back/forward cache doesn't rerun scripts: count the visit.
    window.addEventListener('pageshow', safe(function (e) {
      if (e.persisted) startView();
    }));
  })();
})();
