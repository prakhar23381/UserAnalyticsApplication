// Demo-store behaviour: cart badge, button feedback, newsletter form and the
// dashboard link. The tracker (/tracker.js) doesn't depend on any of this.
// External file, not inline: the server's CSP allows only same-origin scripts.
(function () {
  'use strict';

  var CART_KEY = 'acme_cart';
  // Where the footer's "View dashboard" link points off localhost. With null,
  // the link is hidden there rather than pointing somewhere broken.
  var PRODUCTION_DASHBOARD_URL = 'https://useranalytics-dashboard.vercel.app';

  function readCart() {
    try {
      return Number(localStorage.getItem(CART_KEY)) || 0;
    } catch (e) {
      return 0;
    }
  }

  function writeCart(count) {
    try {
      localStorage.setItem(CART_KEY, String(count));
    } catch (e) {
      /* storage blocked: the badge still updates for this page */
    }
  }

  function renderCart(count) {
    document.querySelectorAll('[data-cart-count]').forEach(function (el) {
      el.textContent = String(count);
    });
  }

  renderCart(readCart());

  document.querySelectorAll('.add-to-cart').forEach(function (button) {
    var label = button.textContent;
    button.addEventListener('click', function () {
      var count = readCart() + 1;
      writeCart(count);
      renderCart(count);
      button.textContent = 'Added ✓';
      setTimeout(function () {
        button.textContent = label;
      }, 1200);
    });
  });

  var form = document.querySelector('[data-newsletter]');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var thanks = document.createElement('p');
      thanks.textContent = 'Thanks! This is a demo, so nothing was sent.';
      form.replaceWith(thanks);
    });
  }

  var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  document.querySelectorAll('[data-dashboard-link]').forEach(function (link) {
    if (isLocal) return; // the HTML already points at http://localhost:3000
    if (PRODUCTION_DASHBOARD_URL) link.href = PRODUCTION_DASHBOARD_URL;
    else link.hidden = true;
  });
})();
