/* ============================================================
   LMK MARKETING — app.js
   ============================================================ */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---- current year ---- */
  var yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();

  /* ---- nav: transparent -> frosted glass on scroll ---- */
  var nav = document.getElementById('nav');
  function onScroll() { nav.classList.toggle('scrolled', window.scrollY > 30); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- mobile menu (full-screen overlay, works at any scroll position) ---- */
  var burger = document.getElementById('burger');
  var mobileMenu = document.getElementById('mobileMenu');
  if (burger && mobileMenu) {
    function closeMenu() {
      nav.classList.remove('open');
      mobileMenu.classList.remove('open');
      document.body.classList.remove('menu-open');
      burger.setAttribute('aria-expanded', 'false');
      mobileMenu.setAttribute('aria-hidden', 'true');
    }
    function toggleMenu() {
      var willOpen = !mobileMenu.classList.contains('open');
      nav.classList.toggle('open', willOpen);
      mobileMenu.classList.toggle('open', willOpen);
      document.body.classList.toggle('menu-open', willOpen);
      burger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      mobileMenu.setAttribute('aria-hidden', willOpen ? 'false' : 'true');
    }
    burger.addEventListener('click', toggleMenu);
    mobileMenu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', closeMenu);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu();
    });
  }

  /* ---- scroll-triggered reveals (Intersection Observer) ---- */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---- custom cursor ---- */
  var cursor = document.getElementById('cursor');
  if (cursor && canHover && !reduceMotion) {
    var cx = window.innerWidth / 2, cy = window.innerHeight / 2, tx = cx, ty = cy;
    window.addEventListener('mousemove', function (e) { tx = e.clientX; ty = e.clientY; });
    (function loop() {
      cx += (tx - cx) * 0.2;
      cy += (ty - cy) * 0.2;
      cursor.style.transform = 'translate(' + cx + 'px,' + cy + 'px) translate(-50%,-50%)';
      requestAnimationFrame(loop);
    })();
    document.querySelectorAll('a, button, [data-magnetic], input, textarea').forEach(function (el) {
      el.addEventListener('mouseenter', function () { cursor.classList.add('grow'); });
      el.addEventListener('mouseleave', function () { cursor.classList.remove('grow'); });
    });
  } else if (cursor) {
    cursor.style.display = 'none';
  }

  /* ---- magnetic hover on buttons / cards ---- */
  if (canHover && !reduceMotion) {
    document.querySelectorAll('[data-magnetic]').forEach(function (el) {
      var strength = el.classList.contains('card') || el.classList.contains('platform') ? 0.12 : 0.35;
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var mx = e.clientX - (r.left + r.width / 2);
        var my = e.clientY - (r.top + r.height / 2);
        el.style.transform = 'translate(' + (mx * strength) + 'px,' + (my * strength) + 'px)';
      });
      el.addEventListener('mouseleave', function () {
        el.style.transform = '';
      });
    });
  }

  /* ---- glow border follows cursor on cards & platforms ---- */
  document.querySelectorAll('.card, .platform').forEach(function (card) {
    card.addEventListener('mousemove', function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
    });
  });

  /* ---- background video: autoplay + crossfade at the halfway scroll point ---- */
  (function setupBgVideo() {
    var v1 = document.getElementById('bgv1');
    var v2 = document.getElementById('bgv2');
    var l1 = document.getElementById('bgl1');
    var l2 = document.getElementById('bgl2');
    if (!v1 || !v2 || !l1 || !l2) return;

    // Respect data-saver / reduced-motion: keep the still poster frames, no playback.
    var conn = navigator.connection || {};
    var saveData = conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
    if (reduceMotion || saveData) return;

    function safePlay(v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    safePlay(v1);

    var loaded2 = false, current = 1, ticking = false;

    function showSecond() {
      if (!loaded2) { loaded2 = true; v2.load(); }
      safePlay(v2);
      l2.classList.add('is-active');
      l1.classList.remove('is-active');
      setTimeout(function () { if (current === 2) v1.pause(); }, 1300);
    }
    function showFirst() {
      safePlay(v1);
      l1.classList.add('is-active');
      l2.classList.remove('is-active');
      setTimeout(function () { if (current === 1) v2.pause(); }, 1300);
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        var prog = max > 0 ? window.scrollY / max : 0;
        if (prog > 0.5 && current === 1) { current = 2; showSecond(); }
        else if (prog <= 0.46 && current === 2) { current = 1; showFirst(); }
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
  })();

  /* ---- contact form: native submit to FormSubmit (works on every device/browser) ---- */
  var form = document.getElementById('lmkForm');
  var statusEl = document.getElementById('formStatus');

  function setStatus(msg, ok) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.hidden = false;
    statusEl.className = 'form-status ' + (ok ? 'ok' : 'err');
  }

  // After FormSubmit sends the email it redirects back here with ?sent=1
  if (statusEl && /[?&]sent=1/.test(location.search)) {
    setStatus("Thanks — your message was sent. We'll reply fast.", true);
    if (history.replaceState) {
      history.replaceState(null, '', location.pathname + (location.hash || '#contact'));
    }
  }

  if (form) {
    form.addEventListener('submit', function () {
      var btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
      // No preventDefault: the browser performs a normal POST to FormSubmit.
      // This isn't affected by ad blockers / privacy extensions the way a
      // background fetch is, so it sends reliably everywhere.
    });
  }
})();
