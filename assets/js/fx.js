/* ═══════════════════════════════════════════════════════════
   JMC FX — the motion layer
   Everything here checks prefers-reduced-motion first and
   degrades to a plain, still page.
   ═══════════════════════════════════════════════════════════ */
(function () {
'use strict';

const mq = q => (window.matchMedia ? window.matchMedia(q).matches : false);
const still = () => mq('(prefers-reduced-motion: reduce)');

/* ── reading progress along the top of the page ─────────── */
function progressBar(){
  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  bar.innerHTML = '<span></span>';
  document.body.appendChild(bar);
  const fill = bar.firstElementChild;
  const paint = () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    fill.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`;
  };
  addEventListener('scroll', paint, { passive: true });
  addEventListener('resize', paint);
  paint();
}

/* ── staggered reveal, including per-word headline reveal ── */
function reveals(){
  if (still()) {
    document.querySelectorAll('.reveal, .reveal-words').forEach(e => e.classList.add('in'));
    return;
  }
  document.querySelectorAll('.reveal-words').forEach(el => {
    if (el.dataset.split) return;
    el.dataset.split = '1';
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map((w, i) =>
      `<span class="rw"><span style="--d:${i * 55}ms">${w}</span></span>`).join(' ');
  });
  const io = new IntersectionObserver(en => en.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    io.unobserve(e.target);
  }), { threshold: .12, rootMargin: '0px 0px -50px' });
  document.querySelectorAll('.reveal, .reveal-words').forEach(el => io.observe(el));
}

/* ── numbers that count up when they scroll in ──────────── */
function counters(){
  const els = document.querySelectorAll('[data-count]');
  if (!els.length) return;
  if (still()) { els.forEach(e => e.textContent = e.dataset.count); return; }
  const io = new IntersectionObserver(en => en.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target, end = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || '', dur = 1400;
    const t0 = performance.now();
    const step = t => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(end * eased).toLocaleString('en-IN') + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    io.unobserve(el);
  }), { threshold: .4 });
  els.forEach(e => io.observe(e));
}

/* ── buttons that lean towards the cursor ───────────────── */
function magnetic(){
  if (still() || mq('(hover: none)')) return;
  document.querySelectorAll('[data-magnetic], .btn-solid.btn-lg').forEach(el => {
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * .22;
      const y = (e.clientY - r.top - r.height / 2) * .3;
      el.style.transform = `translate(${x}px, ${y}px)`;
    });
    el.addEventListener('mouseleave', () => el.style.transform = '');
  });
}

/* ── gentle 3-D tilt on product cards ───────────────────── */
function tilt(){
  if (still() || mq('(hover: none)')) return;
  document.querySelectorAll('[data-tilt], .card .card-media').forEach(el => {
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - .5;
      const py = (e.clientY - r.top) / r.height - .5;
      el.style.setProperty('--rx', (-py * 5).toFixed(2) + 'deg');
      el.style.setProperty('--ry', (px * 6).toFixed(2) + 'deg');
      el.style.setProperty('--gx', ((px + .5) * 100).toFixed(1) + '%');
      el.style.setProperty('--gy', ((py + .5) * 100).toFixed(1) + '%');
      el.classList.add('tilting');
    });
    el.addEventListener('mouseleave', () => {
      el.classList.remove('tilting');
      el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg');
    });
  });
}

/* ── slow parallax on anything marked for it ────────────── */
function parallax(){
  const els = [...document.querySelectorAll('[data-parallax]')];
  if (!els.length || still()) return;
  let ticking = false;
  const paint = () => {
    els.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > innerHeight + 200) return;
      const speed = parseFloat(el.dataset.parallax) || .12;
      const mid = r.top + r.height / 2 - innerHeight / 2;
      el.style.setProperty('--py', (-mid * speed).toFixed(1) + 'px');
    });
    ticking = false;
  };
  addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(paint); }
  }, { passive: true });
  paint();
}

/* ── fade the page out on internal links ────────────────── */
function pageTransitions(){
  if (still()) return;
  document.body.classList.add('page-in');
  document.addEventListener('click', e => {
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || a.target === '_blank' || a.hasAttribute('download')) return;
    if (/^(#|mailto:|tel:|javascript:|https?:)/i.test(href)) return;
    e.preventDefault();
    document.body.classList.add('page-out');
    setTimeout(() => location.href = href, 240);
  });
  addEventListener('pageshow', e => { if (e.persisted) document.body.classList.remove('page-out'); });
}

function init(){
  progressBar();
  reveals();
  counters();
  magnetic();
  tilt();
  parallax();
  pageTransitions();
}

/* re-arm after cards or sections are painted in by JS */
function refresh(){ reveals(); counters(); magnetic(); tilt(); parallax(); }

window.JMCFX = { init, refresh, reveals, counters, tilt, magnetic, parallax };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
