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

  /* ---- mobile menu ---- */
  var burger = document.getElementById('burger');
  if (burger) {
    burger.addEventListener('click', function () {
      nav.classList.toggle('open');
      nav.classList.toggle('mobile-open');
    });
    document.querySelectorAll('#navLinks a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('open', 'mobile-open');
      });
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

  /* ---- contact form -> emails LMK via FormSubmit (no page reload) ---- */
  var form = document.getElementById('lmkForm');
  if (form) {
    var statusEl = document.getElementById('formStatus');
    var FS_ENDPOINT = 'https://formsubmit.co/ajax/lmkwhat2026@gmail.com';

    function setStatus(msg, ok) {
      if (!statusEl) return;
      statusEl.textContent = msg;
      statusEl.hidden = false;
      statusEl.className = 'form-status ' + (ok ? 'ok' : 'err');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      // honeypot: silently ignore bots
      if (form._honey && form._honey.value) return;

      var btn = form.querySelector('button[type="submit"]');
      var label = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Sending…';
      if (statusEl) statusEl.hidden = true;

      fetch(FS_ENDPOINT, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(form)
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && (data.success === 'true' || data.success === true)) {
            setStatus("Thanks — your message is on its way. We'll reply fast.", true);
            form.reset();
          } else {
            // first-ever submit returns an activation notice
            setStatus("Almost there — check the LMK inbox to confirm the form once. After that, messages arrive instantly.", true);
          }
        })
        .catch(function () {
          setStatus('Something went wrong. Please email us directly at lmkwhat2026@gmail.com', false);
        })
        .then(function () {
          btn.disabled = false;
          btn.textContent = label;
        });
    });
  }
})();
