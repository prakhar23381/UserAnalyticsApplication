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

  var endpoint;
  var queue = [];
  var timer = null;
  var memorySession = null; // used when localStorage is blocked

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

  function track(type, fields) {
    var root = document.documentElement;
    var event = {
      session_id: sessionId(),
      type: type,
      page_url: location.href,
      timestamp: new Date().toISOString(),
      referrer: document.referrer || undefined,
      viewport_w: window.innerWidth,
      viewport_h: window.innerHeight,
      doc_w: root.scrollWidth,
      doc_h: root.scrollHeight,
    };
    for (var key in fields) event[key] = fields[key];

    queue.push(event);
    if (queue.length >= FLUSH_AT) flush();
    else if (!timer) timer = setTimeout(safe(flush), FLUSH_DELAY_MS);
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
    track('click', { x: Math.round(x), y: Math.round(y), target: described.target });
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

    window.__cfTracker = { flush: safe(flush) };
    track('page_view');

    // Capture phase: page code that stops propagation can't hide clicks from us.
    document.addEventListener('click', safe(onClick), true);
    document.addEventListener('visibilitychange', safe(function () {
      if (document.visibilityState === 'hidden') flush();
    }));
    window.addEventListener('pagehide', safe(flush));
    // A page restored from the back/forward cache doesn't rerun scripts: count the visit.
    window.addEventListener('pageshow', safe(function (e) {
      if (e.persisted) track('page_view');
    }));
  })();
})();
