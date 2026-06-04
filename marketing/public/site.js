/* Writers Nook marketing — shared behavior (all pages) */
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
  function applyTheme(t) {
    if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    if (brandLogo) brandLogo.src = (t === 'dark') ? 'assets/logo-light.png' : 'assets/logo-dark.png';
  }
  var savedTheme = null;
  try { savedTheme = localStorage.getItem(THEME_KEY); } catch (e) {}
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
  var themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.addEventListener('click', function () {
    var next = (document.documentElement.getAttribute('data-theme') === 'dark') ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    applyTheme(next);
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
  document.querySelectorAll('.news-form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var note = form.parentElement.querySelector('.news-note');
      if (note) note.textContent = "You're on the list — thank you. Watch for a quiet hello soon.";
      form.reset();
    });
  });
})();
