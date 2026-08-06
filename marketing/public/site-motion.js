/* Writers Nook marketing — shared motion helper (redesign, 2026-08).
 *
 * Invariant (earned by bugs — see Animating marketing website/HANDOFF-marketing.md):
 * motion is an enhancement, never a precondition for reading the page. If the GSAP
 * ticker cannot run — background tab, prerender, throttled rAF — the final state is
 * applied instantly instead of tweened, so nothing is ever left stuck at opacity 0.
 * Hence: no IntersectionObserver, no one-shot ScrollTriggers, no clearProps (pages
 * carry styling inline), and every user-visible fallback is scheduled with setTimeout,
 * never rAF alone (rAF is suspended in exactly the cases the fallback exists for).
 */
(function () {
  'use strict';

  /* Waits for the GSAP CDN script, then calls fn once. */
  function ready(fn) {
    if (window.gsap) { fn(); return; }
    var boot = setInterval(function () {
      if (window.gsap) { clearInterval(boot); fn(); }
    }, 60);
  }

  /* Reveal-on-scroll engine. Usage:
   *   var m = WNMotion.create();
   *   m.reveal(els, {y:32, opacity:0}, {y:0, opacity:1, duration:.95, ease:'power3.out'}, .12);
   *   m.kick();   // after all reveal() registrations
   */
  function create() {
    var gsap = window.gsap;
    var pending = [];

    var play = function (p) {
      if (document.hidden) gsap.set(p.el, p.to);
      else gsap.to(p.el, Object.assign({}, p.to, { delay: p.delay }));
    };
    var settleAll = function () {
      while (pending.length) { var p = pending.pop(); gsap.set(p.el, p.to); }
      gsap.globalTimeline.getChildren().forEach(function (t) { try { t.progress(1); } catch (e) {} });
    };
    var flush = function () {
      var h = window.innerHeight;
      for (var i = pending.length - 1; i >= 0; i--) {
        var p = pending[i], r = p.el.getBoundingClientRect();
        if (r.top < h * 0.92 && r.bottom > -80) { pending.splice(i, 1); play(p); }
      }
    };

    /* revealed later (tab restored)? catch up at once rather than staying blank */
    document.addEventListener('visibilitychange', settleAll);
    /* watchdog: if the ticker never advanced, no tween will ever run — settle now */
    var frame0 = gsap.ticker.frame;
    setTimeout(function () { if (gsap.ticker.frame === frame0) settleAll(); }, 900);
    window.addEventListener('scroll', flush, { passive: true });
    window.addEventListener('resize', flush);

    return {
      reveal: function (els, from, to, stagger) {
        var list = Array.from(els);
        if (!list.length) return;
        gsap.set(list, from);
        list.forEach(function (el, i) {
          pending.push({ el: el, to: to, delay: stagger ? (i % 6) * stagger : 0 });
        });
      },
      /* The setTimeout backs the rAF up — keep this shape. */
      kick: function () { flush(); requestAnimationFrame(flush); setTimeout(flush, 300); },
      flush: flush,
      settleAll: settleAll
    };
  }

  /* Button magnetism: the element leans toward the cursor. */
  function magnetize(els) {
    var gsap = window.gsap;
    Array.from(els).forEach(function (b) {
      var mx = gsap.quickTo(b, 'x', { duration: 0.4, ease: 'power3' });
      var my = gsap.quickTo(b, 'y', { duration: 0.4, ease: 'power3' });
      b.addEventListener('mousemove', function (e) {
        var r = b.getBoundingClientRect();
        mx((e.clientX - r.left - r.width / 2) * 0.18);
        my((e.clientY - r.top - r.height / 2) * 0.26);
      });
      b.addEventListener('mouseleave', function () { mx(0); my(0); });
    });
  }

  window.WNMotion = { ready: ready, create: create, magnetize: magnetize };
})();
