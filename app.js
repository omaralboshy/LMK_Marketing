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

  /* ---- contact form -> emails LMK via FormSubmit, with native fallback ---- */
  var form = document.getElementById('lmkForm');
  if (form) {
    var statusEl = document.getElementById('formStatus');
    var FS_AJAX = 'https://formsubmit.co/ajax/lmkwhat2026@gmail.com';

    function setStatus(msg, ok) {
      if (!statusEl) return;
      statusEl.textContent = msg;
      statusEl.hidden = false;
      statusEl.className = 'form-status ' + (ok ? 'ok' : 'err');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form._honey && form._honey.value) return; // honeypot

      var btn = form.querySelector('button[type="submit"]');
      var label = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Sending…';
      setStatus('Sending your message…', true);

      var settled = false;
      // If the AJAX request is blocked (ad blocker) or too slow,
      // fall back to a normal form submission so the message still sends.
      function nativeFallback() {
        if (settled) return;
        settled = true;
        form.submit(); // full-page POST to FormSubmit (bypasses fetch/XHR blockers)
      }
      var timer = setTimeout(nativeFallback, 7000);

      fetch(FS_AJAX, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(form)
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (data && (data.success === 'true' || data.success === true)) {
            setStatus("Thanks — your message is on its way. We'll reply fast.", true);
            form.reset();
          } else {
            setStatus("Almost there — confirm the form once via the email in lmkwhat2026@gmail.com, then every message lands instantly.", true);
          }
          btn.disabled = false;
          btn.textContent = label;
        })
        .catch(function () {
          clearTimeout(timer);
          nativeFallback();
        });
    });
  }
})();
