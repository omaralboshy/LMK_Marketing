/* ============================================================
   LMK MARKETING — app.js  (v2 · purple identity)
   Vanilla JS, no dependencies.
   ============================================================ */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var fx = canHover && !reduceMotion;          // pointer-driven effects on/off
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* ---- current year ---- */
  var yr = $('#yr');
  if (yr) yr.textContent = new Date().getFullYear();

  /* ---- rolling text labels: wrap text in <b data-text> ---- */
  $$('.btn-txt[data-text], .roll > span[data-text]').forEach(function (el) {
    var t = el.getAttribute('data-text');
    el.classList.add('roll-t');
    el.innerHTML = '';
    var b = document.createElement('b');
    b.setAttribute('data-text', t);
    b.textContent = t;
    el.appendChild(b);
  });

  /* ---- hero title: split into words + characters for the load sequence ---- */
  var heroTitle = $('.hero-title');
  if (heroTitle && !reduceMotion) {
    $$('[data-split]', heroTitle).forEach(function (line, li) {
      var text = line.textContent.trim();
      line.textContent = '';
      line.setAttribute('aria-hidden', 'true');
      var word = document.createElement('span');
      word.className = 'word';
      text.split('').forEach(function (ch, ci) {
        var s = document.createElement('span');
        s.className = 'ch';
        s.textContent = ch;
        s.style.setProperty('--c', ci);
        s.style.setProperty('--l', li);
        word.appendChild(s);
      });
      line.appendChild(word);
    });
  }

  /* ---- about paragraph: words light up as you read/scroll ---- */
  var aboutBody = $('[data-words]');
  var aboutWords = [];
  if (aboutBody && !reduceMotion) {
    var words = aboutBody.textContent.trim().split(/\s+/);
    aboutBody.textContent = '';
    words.forEach(function (w, i) {
      var s = document.createElement('span');
      s.className = 'w';
      s.textContent = w;
      aboutBody.appendChild(s);
      if (i < words.length - 1) aboutBody.appendChild(document.createTextNode(' '));
      aboutWords.push(s);
    });
  }

  /* ---- nav ---- */
  var nav = $('#nav');
  var lastY = window.scrollY;

  /* ---- mobile menu (full-screen overlay, works at any scroll position) ---- */
  var burger = $('#burger');
  var mobileMenu = $('#mobileMenu');
  function closeMenu() {
    if (!mobileMenu) return;
    nav.classList.remove('open');
    mobileMenu.classList.remove('open');
    document.body.classList.remove('menu-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
    mobileMenu.setAttribute('aria-hidden', 'true');
  }
  if (burger && mobileMenu) {
    burger.addEventListener('click', function () {
      var willOpen = !mobileMenu.classList.contains('open');
      nav.classList.toggle('open', willOpen);
      nav.classList.remove('hide');
      mobileMenu.classList.toggle('open', willOpen);
      document.body.classList.toggle('menu-open', willOpen);
      burger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      burger.setAttribute('aria-label', willOpen ? 'Close menu' : 'Open menu');
      mobileMenu.setAttribute('aria-hidden', willOpen ? 'false' : 'true');
    });
    $$('a', mobileMenu).forEach(function (a) { a.addEventListener('click', closeMenu); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  }

  /* ---- active nav link ---- */
  if ('IntersectionObserver' in window) {
    var navLinks = $$('.nav-links a');
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        navLinks.forEach(function (a) {
          a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['about', 'services', 'industries', 'work', 'edge', 'contact', 'top'].forEach(function (id) {
      var el = document.getElementById(id); if (el) spy.observe(el);
    });
  }

  /* ---- scroll-triggered reveals (started after the preloader) ---- */
  var revealsStarted = false;
  function onRevealIn(el) {
    el.classList.add('in');
    // drop the stagger delay once revealed so hover transitions stay instant
    if (el.hasAttribute('data-d')) setTimeout(function () { el.removeAttribute('data-d'); }, 1500);
    $$('[data-scramble]', el).forEach(scramble);
    $$('[data-count]', el).forEach(countUp);
  }
  function startReveals() {
    if (revealsStarted) return;
    revealsStarted = true;
    if (heroTitle) heroTitle.classList.add('go');
    var reveals = $$('.reveal');
    if ('IntersectionObserver' in window && !reduceMotion) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { onRevealIn(e.target); io.unobserve(e.target); }
        });
      }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
      // clipped headings report a tiny visible area, so they get a zero-threshold observer
      var ioHead = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { onRevealIn(e.target); ioHead.unobserve(e.target); }
        });
      }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });
      reveals.forEach(function (el) {
        if (el.matches('.sec-title, .big-statement, .cta-title')) ioHead.observe(el); else io.observe(el);
      });
    } else {
      reveals.forEach(onRevealIn);
    }
  }

  /* ---- text scramble for the "Five" / "UAE" facts ---- */
  var glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&*+';
  function scramble(el) {
    if (reduceMotion || el._done) return; el._done = true;
    var target = el.getAttribute('data-scramble'), frame = 0, total = 26;
    (function tick() {
      var out = '';
      for (var i = 0; i < target.length; i++) {
        out += (frame / total > i / target.length) ? target[i] : glyphs[Math.floor(Math.random() * glyphs.length)];
      }
      el.textContent = out;
      if (frame++ < total) requestAnimationFrame(tick); else el.textContent = target;
    })();
  }
  /* ---- count up for "100%" ---- */
  function countUp(el) {
    if (reduceMotion || el._done) return; el._done = true;
    var end = +el.getAttribute('data-count'), t0 = null, dur = 1600;
    (function tick(t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(end * e);
      if (p < 1) requestAnimationFrame(tick);
    })(performance.now());
  }

  /* ---- preloader: the mark assembles, count up, then diagonal wipe ---- */
  (function preload() {
    var pl = $('#preloader'), fill = $('#plFill'), count = $('#plCount'), finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      if (pl) {
        pl.classList.add('done');
        setTimeout(function () { if (pl.parentNode) pl.parentNode.removeChild(pl); }, 1200);
      }
      setTimeout(startReveals, pl && !reduceMotion ? 350 : 0);
    }
    if (!pl || reduceMotion) { if (pl) pl.style.display = 'none'; finish(); return; }
    var pct = 0;
    var timer = setInterval(function () {
      pct += Math.max(1, Math.round((100 - pct) * 0.08)) + Math.random() * 1.8;
      if (pct >= 100) { pct = 100; clearInterval(timer); }
      if (count) count.textContent = Math.floor(pct);
      if (fill) fill.style.width = pct + '%';
      if (pct >= 100) setTimeout(finish, 450);
    }, 65);
    setTimeout(function () { clearInterval(timer); finish(); }, 5000); // safety net
  })();

  /* ---- custom cursor (ring + dot) with contextual labels ---- */
  var cursor = $('#cursor'), dot = $('#cursorDot'), curLabel = $('#curLabel');
  var mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
  if (fx && cursor && dot) {
    document.documentElement.classList.add('has-cursor');
    var cx = mouseX, cy = mouseY;
    window.addEventListener('mousemove', function (e) {
      mouseX = e.clientX; mouseY = e.clientY;
      dot.style.transform = 'translate(' + mouseX + 'px,' + mouseY + 'px) translate(-50%,-50%)';
      cursor.classList.add('on'); dot.classList.add('on');
    }, { passive: true });
    document.addEventListener('mouseleave', function () { cursor.classList.remove('on'); dot.classList.remove('on'); });
    (function loop() {
      cx += (mouseX - cx) * 0.18; cy += (mouseY - cy) * 0.18;
      cursor.style.transform = 'translate(' + cx + 'px,' + cy + 'px) translate(-50%,-50%)';
      requestAnimationFrame(loop);
    })();
    $$('a, button, input, textarea, [data-magnetic]').forEach(function (el) {
      el.addEventListener('mouseenter', function () { cursor.classList.add('grow'); });
      el.addEventListener('mouseleave', function () { cursor.classList.remove('grow'); });
    });
    $$('[data-cursor]').forEach(function (el) {
      el.addEventListener('mouseenter', function () {
        if (curLabel) curLabel.textContent = el.getAttribute('data-cursor');
        cursor.classList.add('labeled');
      });
      el.addEventListener('mouseleave', function () { cursor.classList.remove('labeled'); });
    });
  } else {
    if (cursor) cursor.style.display = 'none';
    if (dot) dot.style.display = 'none';
  }

  /* ---- aurora glow + hero mark follow the pointer ---- */
  var aurora = $('#aurora'), heroMark = $('.hero-mark');
  if (fx) {
    window.addEventListener('mousemove', function (e) {
      if (aurora) { aurora.style.setProperty('--ax', e.clientX + 'px'); aurora.style.setProperty('--ay', e.clientY + 'px'); }
      if (heroMark && window.scrollY < window.innerHeight) {
        var nx = e.clientX / window.innerWidth - 0.5, ny = e.clientY / window.innerHeight - 0.5;
        heroMark.style.setProperty('--hx', (nx * -40) + 'px');
        heroMark.style.setProperty('--hy', (ny * -30) + 'px');
      }
    }, { passive: true });
  }

  /* ---- magnetic buttons ---- */
  if (fx) {
    $$('[data-magnetic]').forEach(function (el) {
      var strength = el.classList.contains('reel-trigger') ? 0.22 : 0.3;
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.transform = 'translate(' + ((e.clientX - (r.left + r.width / 2)) * strength) + 'px,' +
          ((e.clientY - (r.top + r.height / 2)) * strength) + 'px)';
      });
      el.addEventListener('mouseleave', function () { el.style.transform = ''; });
    });
  }

  /* ---- buttons: fill circle grows from where the pointer enters ---- */
  $$('.btn').forEach(function (b) {
    function setOrigin(e) {
      var r = b.getBoundingClientRect();
      b.style.setProperty('--bx', (e.clientX - r.left) + 'px');
      b.style.setProperty('--by', (e.clientY - r.top) + 'px');
    }
    b.addEventListener('mouseenter', setOrigin);
    b.addEventListener('mouseleave', setOrigin);
  });

  /* ---- 3D tilt + spotlight on cards ---- */
  $$('.card, .ind, .platform').forEach(function (card) {
    card.addEventListener('mousemove', function (e) {
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', (px * 100) + '%');
      card.style.setProperty('--my', (py * 100) + '%');
      if (fx && card.classList.contains('tilt')) {
        card.style.transform = 'perspective(900px) rotateX(' + ((0.5 - py) * 7) + 'deg) rotateY(' + ((px - 0.5) * 9) + 'deg) translateZ(0)';
      }
    });
    card.addEventListener('mouseleave', function () { card.style.transform = ''; });
  });

  /* ---- form spotlight ---- */
  var form = $('#lmkForm');
  if (form && fx) {
    var fglow = $('.form-glow', form);
    form.addEventListener('mousemove', function (e) {
      var r = form.getBoundingClientRect();
      fglow.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      fglow.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  }

  /* ---- footer: the giant LMK mark fills in under a spotlight ---- */
  var fw = $('#footerWord');
  if (fw) {
    var fwFill = $('.fw-fill', fw);
    if (fx) {
      fw.addEventListener('mousemove', function (e) {
        var r = fw.getBoundingClientRect();
        fwFill.style.setProperty('--fx', (e.clientX - r.left) + 'px');
        fwFill.style.setProperty('--fy', (e.clientY - r.top) + 'px');
      });
      fw.addEventListener('mouseleave', function () {
        fwFill.style.setProperty('--fx', '-30%'); fwFill.style.setProperty('--fy', '-30%');
      });
    } else {
      fw.classList.add('static');
    }
  }

  /* ---- background video: autoplay + crossfade at the halfway scroll point ---- */
  var bgv = (function setupBgVideo() {
    var v1 = $('#bgv1'), v2 = $('#bgv2'), l1 = $('#bgl1'), l2 = $('#bgl2');
    if (!v1 || !v2 || !l1 || !l2) return null;
    var conn = navigator.connection || {};
    var saveData = conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
    if (reduceMotion || saveData) return null;   // keep still poster frames
    function safePlay(v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    safePlay(v1);
    var loaded2 = false, current = 1;
    return function (prog) {
      if (prog > 0.5 && current === 1) {
        current = 2;
        if (!loaded2) { loaded2 = true; v2.load(); }
        safePlay(v2); l2.classList.add('is-active'); l1.classList.remove('is-active');
        setTimeout(function () { if (current === 2) v1.pause(); }, 1300);
      } else if (prog <= 0.46 && current === 2) {
        current = 1;
        safePlay(v1); l1.classList.add('is-active'); l2.classList.remove('is-active');
        setTimeout(function () { if (current === 1) v2.pause(); }, 1300);
      }
    };
  })();

  /* ---- one scroll loop for everything scroll-linked ---- */
  var progress = $('#scrollProgress');
  var edgeLine = $('#edgeLine'), principles = $('#principles');
  var ctaMark = $('.cta-mark'), ctaBand = $('.cta-band');
  var waFab = $('#waFab'), contact = $('#contact');
  var ticking = false;
  function onScroll() {
    var y = window.scrollY, vh = window.innerHeight;
    var max = document.documentElement.scrollHeight - vh;
    var prog = max > 0 ? y / max : 0;

    if (progress) progress.style.transform = 'scaleX(' + prog + ')';

    // nav: glass after 30px, hides on scroll down, returns on scroll up
    nav.classList.toggle('scrolled', y > 30);
    // (desktop only — on phones the menu button always stays in reach)
    if (window.innerWidth <= 760) nav.classList.remove('hide');
    else if (!document.body.classList.contains('menu-open')) {
      if (y > 500 && y > lastY + 4) nav.classList.add('hide');
      else if (y < lastY - 4 || y < 500) nav.classList.remove('hide');
    }
    lastY = y;

    // about paragraph read-along
    if (aboutWords.length) {
      var r = aboutBody.getBoundingClientRect();
      var p = clamp((vh * 0.82 - r.top) / (r.height + vh * 0.3), 0, 1);
      var lit = Math.round(p * aboutWords.length);
      for (var i = 0; i < aboutWords.length; i++) aboutWords[i].classList.toggle('lit', i < lit);
    }

    // edge progress line
    if (edgeLine && principles) {
      var pr = principles.getBoundingClientRect();
      edgeLine.style.setProperty('--p', clamp((vh * 0.85 - pr.top) / (vh * 0.6), 0, 1));
    }

    // CTA mark parallax
    if (ctaMark && ctaBand && !reduceMotion) {
      var cr = ctaBand.getBoundingClientRect();
      ctaMark.style.setProperty('--cy', ((cr.top + cr.height / 2 - vh / 2) * -0.18) + 'px');
    }

    // floating WhatsApp: after the hero, hidden while the contact section is on screen
    if (waFab) {
      var cRect = contact ? contact.getBoundingClientRect() : null;
      var contactVisible = cRect && cRect.top < vh * 0.8 && cRect.bottom > vh * 0.2;
      waFab.classList.toggle('show', y > vh * 0.7 && !contactVisible);
    }

    if (bgv) bgv(prog);
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ---- kinetic marquee: auto-scrolls, speeds up + skews with scroll velocity ---- */
  (function setupMarquee() {
    var tracks = $$('.marquee-track');
    if (!tracks.length || reduceMotion) return;
    var state = tracks.map(function (t) {
      t.style.animation = 'none';               // JS drives it instead of the CSS fallback
      return { el: t, dir: +t.getAttribute('data-dir') || -1, x: 0, half: t.scrollWidth / 2 };
    });
    window.addEventListener('resize', function () { state.forEach(function (s) { s.half = s.el.scrollWidth / 2; }); });
    var prevY = window.scrollY, vel = 0, skew = 0;
    window.addEventListener('scroll', function () { vel = window.scrollY - prevY; prevY = window.scrollY; }, { passive: true });
    (function loop() {
      var boost = Math.min(8, Math.abs(vel) * 0.25);
      skew += (clamp(vel * 0.45, -12, 12) - skew) * 0.12;
      state.forEach(function (s) {
        s.x += (0.55 + boost) * s.dir;
        if (s.half > 0) {
          if (s.dir < 0 && -s.x >= s.half) s.x += s.half;
          if (s.dir > 0 && s.x >= 0) s.x -= s.half;
        }
        s.el.style.transform = 'translate3d(' + s.x.toFixed(2) + 'px,0,0) skewX(' + skew.toFixed(2) + 'deg)';
      });
      vel *= 0.86;
      requestAnimationFrame(loop);
    })();
    state.forEach(function (s) { if (s.dir > 0) s.x = -s.half; });
  })();

  /* ---- showreel lightbox ---- */
  (function setupReel() {
    var trigger = $('#reelTrigger'), modal = $('#reelModal'), video = $('#reelVideo');
    var close = $('#reelClose'), backdrop = $('#reelBackdrop');
    if (!trigger || !modal || !video) return;
    function open() {
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('menu-open');
      try { video.currentTime = 0; } catch (e) {}
      video.muted = false;
      var p = video.play(); if (p && p.catch) p.catch(function () {});
      if (close) setTimeout(function () { close.focus(); }, 50);
    }
    function shut() {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('menu-open');
      video.pause();
      trigger.focus();
    }
    trigger.addEventListener('click', open);
    if (close) close.addEventListener('click', shut);
    if (backdrop) backdrop.addEventListener('click', shut);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('open')) shut();
    });
  })();

  /* ---- contact form: native submit to FormSubmit (works on every device/browser) ---- */
  var statusEl = $('#formStatus'), statusMsg = $('#formStatusMsg');
  function setStatus(msg, ok) {
    if (!statusEl) return;
    statusMsg.textContent = msg;
    statusEl.hidden = false;
    statusEl.className = 'form-status ' + (ok ? 'ok' : 'err');
  }
  // After FormSubmit sends the email it redirects back here with ?sent=1
  if (statusEl && /[?&]sent=1/.test(location.search)) {
    setStatus("Thanks — your message was sent. We'll reply fast.", true);
    if (history.replaceState) history.replaceState(null, '', location.pathname + (location.hash || '#contact'));
  }
  if (form) {
    form.addEventListener('submit', function () {
      var btn = form.querySelector('button[type="submit"]');
      if (btn) {
        btn.disabled = true;
        var label = btn.querySelector('.btn-txt b') || btn.querySelector('.btn-txt');
        if (label) { label.textContent = 'Sending…'; label.setAttribute('data-text', 'Sending…'); }
      }
      // No preventDefault: the browser performs a normal POST to FormSubmit.
      // This isn't affected by ad blockers / privacy extensions the way a
      // background fetch is, so it sends reliably everywhere.
    });
  }
  // if the visitor comes back with the browser's back button, re-enable the button
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted || !form) return;
    var btn = form.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = false;
      var label = btn.querySelector('.btn-txt b');
      if (label) { label.textContent = 'Send it'; label.setAttribute('data-text', 'Send it'); }
    }
  });
})();
