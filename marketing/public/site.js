/* Writers Nook marketing — shared behavior (all pages) */
/* global document, window, localStorage, IntersectionObserver, setTimeout, fetch */
(function () {
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
      try { f.contentWindow.postMessage({ type: 'wn-theme', theme: t }, '*'); } catch (e) {}
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

  // ---- newsletter (any form.news-form) ----
  var newsForms = document.querySelectorAll('.news-form');
  if (newsForms.length === 0) return;

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

  newsForms.forEach(function (form) {
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
        var res = await fetch('/api/newsletter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email }),
        });
        if (res.ok) {
          if (note) { note.textContent = "You're on the list — thank you. Watch for a quiet hello soon."; note.style.color = ''; }
          form.reset();
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
})();
