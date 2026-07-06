/* Writers Nook marketing — shared behavior (all pages) */
/* global document, window, navigator, localStorage, IntersectionObserver, setTimeout, fetch */
(function () {
  // ---- Fathom event tracking ----
  // window.fathom may not be defined yet at click time (script loads with
  // `defer`) — every call site guards through this wrapper instead of
  // touching window.fathom directly. Exposed on window so checkout.js,
  // account.js, and purchase-success.js can call it too (they all load
  // after site.js has run — see those files' load order in each HTML page).
  function wnTrack(name, opts) {
    if (window.fathom && typeof window.fathom.trackEvent === 'function') {
      window.fathom.trackEvent(name, opts);
    }
  }
  window.wnTrack = wnTrack;

  // ---- starfields (any [data-stars] element) ----
  document.querySelectorAll('[data-stars]').forEach(function (el) {
    var n = parseInt(el.getAttribute('data-stars'), 10) || 50;
    var html = '';
    for (var i = 0; i < n; i++) {
      var s = (Math.random() * 2 + 1).toFixed(1);
      html += '<span class="star" style="left:' + (Math.random() * 100).toFixed(2) + '%;top:' + (Math.random() * 100).toFixed(2) + '%;width:' + s + 'px;height:' + s + 'px;--mag:' + (Math.random() * 0.6 + 0.25).toFixed(2) + ';animation-delay:' + (Math.random() * 5).toFixed(2) + 's"></span>';
    }
    el.innerHTML = html;
  });

  // ---- light the dark hero (trigger entrance animation) ----
  var hero = document.querySelector('.hero');
  if (hero) hero.classList.add('lit');

  // ---- light / dark theme ----
  var THEME_KEY = 'wn-theme';
  var brandLogo = document.getElementById('brand-logo');
  // Live interactive embeds (e.g. the relationship map iframe on Features)
  // can't see our <html data-theme>, so push the theme to them on every change.
  function pushThemeToEmbeds(t) {
    document.querySelectorAll('iframe.relmap-embed').forEach(function (f) {
      try { f.contentWindow.postMessage({ type: 'wn-theme', theme: t }, '*'); } catch { /* cross-origin or unavailable — ignore */ }
    });
  }
  function applyTheme(t) {
    if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    if (brandLogo) brandLogo.src = (t === 'dark') ? 'assets/logo-light.png' : 'assets/logo-dark.png';
    pushThemeToEmbeds(t);
  }
  var savedTheme = null;
  try { savedTheme = localStorage.getItem(THEME_KEY); } catch { /* storage unavailable */ }
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
  var themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.addEventListener('click', function () {
    var next = (document.documentElement.getAttribute('data-theme') === 'dark') ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, next); } catch { /* storage unavailable */ }
    applyTheme(next);
  });

  // ---- relationship-map embed: load the embed via srcdoc (the preview's serve
  //      endpoint token-gates iframe navigations, but same-origin subresource
  //      fetches are fine — and srcdoc works identically in production). Then
  //      fit the iframe to its content and hand it the current theme. ----
  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }
  window.addEventListener('message', function (e) {
    var d = e.data || {};
    if (d.type === 'wn-relmap-height' && d.height) {
      document.querySelectorAll('iframe.relmap-embed').forEach(function (f) {
        if (f.contentWindow === e.source) f.style.height = d.height + 'px';
      });
    }
  });
  document.querySelectorAll('iframe.relmap-embed').forEach(function (f) {
    f.addEventListener('load', function () { pushThemeToEmbeds(currentTheme()); });
    var url = f.getAttribute('data-src');
    if (!url) return;
    fetch(url).then(function (r) { return r.text(); }).then(function (html) {
      f.srcdoc = html;
    }).catch(function () {
      // Fallback for plain static hosting: a normal navigation still works.
      f.src = url;
    });
  });

  // ---- nav: scrolled border ----
  var nav = document.getElementById('nav');
  function onScroll() {
    if (!nav) return;
    nav.classList.toggle('scrolled', window.scrollY > 8);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // ---- mobile nav ----
  var toggle = document.getElementById('navToggle');
  var links = document.getElementById('navLinks');
  if (toggle) toggle.addEventListener('click', function () { links.classList.toggle('open'); });

  // ---- reveal on scroll ----
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll('.io').forEach(function (el) { io.observe(el); });

  // ---- safety: if the animation timeline is frozen (capture/print/throttle),
  //      force everything to its visible end-state. ----
  var startT = document.timeline ? document.timeline.currentTime : 0;
  setTimeout(function () {
    var nowT = document.timeline ? document.timeline.currentTime : 1;
    if (nowT === startT) document.body.classList.add('reveal-all');
  }, 500);

  // ---- email capture forms (newsletter) ----
  // isValidEmail mirrors the server-side rule; form-utils.js is module-only so
  // we inline a matching guard here for the non-module site.js context.
  function isValidEmail(s) {
    if (typeof s !== 'string' || s.trim().length === 0) return false;
    var parts = s.split('@');
    if (parts.length !== 2) return false;
    var local = parts[0]; var domain = parts[1];
    if (!local || !domain) return false;
    if (domain[0] === '.' || domain[domain.length - 1] === '.') return false;
    if (domain.indexOf('..') !== -1) return false;
    var dotIdx = domain.lastIndexOf('.');
    if (dotIdx <= 0 || dotIdx >= domain.length - 1) return false;
    return true;
  }

  // wireEmailForm: attaches submit handling to all matching forms.
  // Reads feedback from/writes to the nearest sibling `.news-note` element.
  // eventName (optional): Fathom event fired only on a successful submit —
  // callers that don't pass one (none currently) stay silent.
  function wireEmailForm(selector, endpoint, successMsg, eventName) {
    document.querySelectorAll(selector).forEach(function (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var emailInput = form.querySelector('input[type="email"], input[name="email"]');
        var note = form.parentElement ? form.parentElement.querySelector('.news-note') : null;
        var submitBtn = form.querySelector('button[type="submit"], button');
        var email = emailInput ? emailInput.value.trim() : '';
        if (!isValidEmail(email)) {
          if (note) { note.textContent = 'Please enter a valid email address.'; note.style.color = 'var(--error,#c0392b)'; }
          return;
        }
        if (submitBtn) submitBtn.disabled = true;
        try {
          var res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email }),
          });
          if (res.ok) {
            if (note) { note.textContent = successMsg; note.style.color = ''; }
            form.reset();
            if (eventName) wnTrack(eventName);
          } else {
            if (note) { note.textContent = 'Something went wrong. Please try again.'; note.style.color = 'var(--error,#c0392b)'; }
          }
        } catch {
          if (note) { note.textContent = 'Could not reach the server. Please try again shortly.'; note.style.color = 'var(--error,#c0392b)'; }
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    });
  }

  wireEmailForm('.news-form', '/api/newsletter', "You're on the list — thank you. Watch for a quiet hello soon.", 'newsletter-signup');

  // ---- buy-intent click tracking (nav CTA, page-bottom CTA bands, pricing→checkout links) ----
  // Delegated on document so it covers CTAs present on page load; fires on
  // the capture phase so it still records the click even if a later handler
  // (e.g. checkout.js's data-ls-checkout overlay) calls preventDefault().
  document.addEventListener('click', function (e) {
    var a = e.target && typeof e.target.closest === 'function' ? e.target.closest('a') : null;
    if (!a) return;
    if (a.classList.contains('nav-cta')) {
      wnTrack('buy-click-nav');
      return;
    }
    var href = a.getAttribute('href') || '';
    if (href.indexOf('checkout.html') !== -1) {
      if (href.indexOf('utm_content=pricing-buy') !== -1) wnTrack('buy-click-pricing-card');
      else if (href.indexOf('utm_content=pricing-cta') !== -1) wnTrack('buy-click-pricing-bottom');
      return;
    }
    if (href.indexOf('pricing.html') !== -1 && a.classList.contains('m-btn')) {
      wnTrack('buy-click-page-cta');
    }
  }, true);

  // ---- platform-aware download CTAs (hero, pricing, pricing-page trial link) ----
  // Progressively enhances the static Windows download links in the HTML: a
  // macOS visitor gets the .dmg and a "Download for macOS" label on the primary
  // buttons; everyone else stays on Windows. A small "Also available for …"
  // link to the other platform is inserted under each primary CTA. With JS off,
  // the static Windows href stays put, so every button still works. URLs come
  // from window.WN_DL (downloads-config.js, loaded before site.js).
  function detectMac() {
    // Prefer User-Agent Client Hints (Chromium); fall back to the classic sniff.
    // Ambiguous / undetectable → false → Windows (the static default).
    try {
      var uad = window.navigator.userAgentData;
      if (uad && typeof uad.platform === 'string') return /mac/i.test(uad.platform);
    } catch (e) { /* userAgentData is Chromium-only — fall through */ }
    if (typeof navigator.platform === 'string' && /mac/i.test(navigator.platform)) return true;
    return /mac/i.test(navigator.userAgent || '');
  }
  function withDlUtm(url, content) {
    return url + '?utm_source=writersnook&utm_medium=cta&utm_campaign=launch&utm_content=' + content;
  }
  function makeAltDlLink(otherUrl, otherLabel, center) {
    var p = document.createElement('p');
    if (center) p.style.textAlign = 'center';
    p.style.margin = '10px 0 0';
    var a = document.createElement('a');
    a.href = otherUrl;
    a.className = 'dl-alt-link';
    a.textContent = 'Also available for ' + otherLabel;
    p.appendChild(a);
    return p;
  }
  // makeMacNote: the macOS build is Apple-silicon-only (M1+). Arch can't be
  // sniffed reliably from JS (navigator.platform reads 'MacIntel' on every
  // Mac; Safari lacks UA-CH), so we disclose the requirement in copy beside
  // the macOS CTA. Mac visitors only — Windows visitors see no note.
  function makeMacNote(center) {
    var p = document.createElement('p');
    p.className = 'platform-note';
    if (center) p.style.textAlign = 'center';
    p.textContent = 'macOS version requires Apple silicon (M1 or later).';
    return p;
  }
  (function wirePlatformDl() {
    var cfg = window.WN_DL || {};
    var winUrl = cfg.winUrl || '';
    var macUrl = cfg.macUrl || '';
    if (!winUrl && !macUrl) return;
    var isMac = detectMac();
    var primaryUrl = isMac ? macUrl : winUrl;
    var primaryLabel = isMac ? 'Download for macOS' : 'Download for Windows';
    var otherUrl = isMac ? winUrl : macUrl;
    var otherLabel = isMac ? 'Windows' : 'macOS';
    // btn: primary button id · content: utm_content · alt: insert "also available" link
    // placement: the {placement} slot in the download-{os}-{placement} Fathom event name
    var ctas = [
      { btn: 'hero-dl', content: 'hero', alt: true, center: false, placement: 'hero' },
      { btn: 'pricing-dl', content: 'pricing-section', alt: true, center: true, placement: 'pricing' },
      { btn: 'pricing-trial-link', content: 'pricing-trial-link', alt: false, center: true, placement: 'trial' }
    ];
    var primaryOs = isMac ? 'macos' : 'windows';
    var otherOs = isMac ? 'windows' : 'macos';
    ctas.forEach(function (c) {
      var btn = document.getElementById(c.btn);
      if (!btn) return;
      if (primaryUrl) btn.href = withDlUtm(primaryUrl, c.content);
      var label = btn.querySelector('.dl-label');
      if (label) label.textContent = primaryLabel;
      btn.addEventListener('click', function () {
        wnTrack('download-' + primaryOs + '-' + c.placement);
      });
      var ctaRow = btn.parentNode;
      if (!ctaRow || !ctaRow.parentNode) return;
      // "Also available for …" cross-platform link under the CTA.
      if (c.alt && otherUrl) {
        var altLinkP = makeAltDlLink(withDlUtm(otherUrl, c.content), otherLabel, c.center);
        var altLinkA = altLinkP.querySelector('a');
        if (altLinkA) altLinkA.addEventListener('click', function () {
          wnTrack('download-' + otherOs + '-alt');
        });
        ctaRow.parentNode.insertBefore(altLinkP, ctaRow.nextSibling);
      }
      // macOS arch disclosure — Apple-silicon-only build. Mac visitors only;
      // inserted last so it lands directly under the CTA (above the alt link),
      // and Windows visitors see no note at all.
      if (isMac) {
        ctaRow.parentNode.insertBefore(makeMacNote(c.center), ctaRow.nextSibling);
      }
    });
  })();
})();
