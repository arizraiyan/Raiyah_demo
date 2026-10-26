/* ═══════════════════════════════════════════════════════════
   JMC CAROUSEL — three shapes, one engine
   · hero    full-bleed cross-fading slides with a slow push-in
   · rail    snap-scrolling row of cards with arrows
   · shots   product photo carousel: thumbs, swipe, zoom
   ═══════════════════════════════════════════════════════════ */
(function () {
'use strict';

const mq = q => (window.matchMedia ? window.matchMedia(q).matches : false);
const reduced = () => mq('(prefers-reduced-motion: reduce)');

/* small helper: horizontal drag / swipe detection */
function onSwipe(el, { left, right, threshold = 45 }){
  let x0 = null, y0 = null, locked = false;
  el.addEventListener('touchstart', e => {
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; locked = false;
  }, { passive: true });
  el.addEventListener('touchmove', e => {
    if (x0 == null) return;
    const dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0;
    if (!locked && Math.abs(dx) > Math.abs(dy) + 6) locked = true;
  }, { passive: true });
  el.addEventListener('touchend', e => {
    if (x0 == null || !locked) { x0 = null; return; }
    const dx = e.changedTouches[0].clientX - x0;
    if (dx < -threshold) left && left();
    if (dx >  threshold) right && right();
    x0 = null;
  }, { passive: true });
}

/* ═══════ HERO ═══════════════════════════════════════════ */
/* slides: [{ img, eyebrow, title, titleEm, text, ctaHref, ctaText, altHref, altText }] */
function hero(mount, slides, opts){
  const o = Object.assign({ interval: 6200 }, opts || {});
  const el = typeof mount === 'string' ? document.querySelector(mount) : mount;
  if (!el || !slides.length) return null;

  el.classList.add('hero-carousel');
  el.innerHTML = `
    <div class="hc-stage">
      ${slides.map((s, i) => `
        <div class="hc-slide ${i === 0 ? 'on' : ''}" data-i="${i}" aria-hidden="${i !== 0}">
          <img src="assets/img/${s.img}-1920.jpg"
               srcset="assets/img/${s.img}-960.jpg 960w, assets/img/${s.img}-1920.jpg 1920w, assets/img/${s.img}-4k.jpg 3840w"
               sizes="100vw" alt="${s.alt || ''}" ${i === 0 ? '' : 'loading="lazy"'}>
        </div>`).join('')}
      <div class="hc-veil"></div>
    </div>
    <div class="hc-inner">
      ${slides.map((s, i) => `
        <div class="hc-copy ${i === 0 ? 'on' : ''}" data-i="${i}">
          <div class="eyebrow">${s.eyebrow}</div>
          <h1>${s.title}${s.titleEm ? `<br><em>${s.titleEm}</em>` : ''}</h1>
          <p>${s.text}</p>
          <div class="hero-cta">
            <a href="${s.ctaHref}" class="btn btn-solid btn-lg">${s.ctaText}</a>
            ${s.altText ? `<a href="${s.altHref}" class="btn btn-line btn-lg">${s.altText}</a>` : ''}
          </div>
        </div>`).join('')}
    </div>
    <div class="hc-controls">
      <button class="hc-arrow" data-dir="-1" aria-label="Previous slide"><i class='bx bx-left-arrow-alt'></i></button>
      <div class="hc-dots" role="tablist">
        ${slides.map((s, i) => `
          <button class="hc-dot ${i === 0 ? 'on' : ''}" data-go="${i}" role="tab"
                  aria-label="Slide ${i + 1}" aria-selected="${i === 0}">
            <span class="hc-dot-fill"></span></button>`).join('')}
      </div>
      <button class="hc-arrow" data-dir="1" aria-label="Next slide"><i class='bx bx-right-arrow-alt'></i></button>
      <div class="hc-counter"><b>01</b><span>/ ${String(slides.length).padStart(2, '0')}</span></div>
    </div>`;

  let i = 0, timer = null, paused = false;
  const q  = s => el.querySelectorAll(s);
  const pad = n => String(n + 1).padStart(2, '0');

  function go(n, dir){
    n = (n + slides.length) % slides.length;
    if (n === i) return;
    const prev = i; i = n;
    q('.hc-slide').forEach(s => {
      const k = +s.dataset.i;
      s.classList.toggle('on', k === i);
      s.classList.toggle('out', k === prev);
      s.setAttribute('aria-hidden', k !== i);
    });
    q('.hc-copy').forEach(c => {
      const k = +c.dataset.i;
      c.classList.remove('on');
      if (k === i) { void c.offsetWidth; c.classList.add('on'); }
    });
    q('.hc-dot').forEach(d => {
      const on = +d.dataset.go === i;
      d.classList.toggle('on', on); d.setAttribute('aria-selected', on);
    });
    el.querySelector('.hc-counter b').textContent = pad(i);
    restart();
  }

  function restart(){
    clearInterval(timer);
    if (reduced() || slides.length < 2) return;
    el.style.setProperty('--hc-dur', o.interval + 'ms');
    timer = setInterval(() => { if (!paused && !document.hidden) go(i + 1); }, o.interval);
  }

  q('.hc-arrow').forEach(b => b.onclick = () => go(i + (+b.dataset.dir)));
  q('.hc-dot').forEach(b => b.onclick = () => go(+b.dataset.go));
  el.addEventListener('mouseenter', () => paused = true);
  el.addEventListener('mouseleave', () => paused = false);
  el.addEventListener('focusin',  () => paused = true);
  el.addEventListener('focusout', () => paused = false);
  onSwipe(el, { left: () => go(i + 1), right: () => go(i - 1) });
  el.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') go(i + 1);
    if (e.key === 'ArrowLeft')  go(i - 1);
  });

  restart();
  return { go, next: () => go(i + 1), prev: () => go(i - 1) };
}

/* ═══════ RAIL ═══════════════════════════════════════════ */
/* turns any container of cards into an arrow-driven snap rail */
function rail(mount, opts){
  const o = Object.assign({ label: '' }, opts || {});
  const el = typeof mount === 'string' ? document.querySelector(mount) : mount;
  if (!el) return null;

  const wrap = document.createElement('div');
  wrap.className = 'rail-wrap';
  el.parentNode.insertBefore(wrap, el);
  wrap.appendChild(el);
  el.classList.add('rail-track');

  const nav = document.createElement('div');
  nav.className = 'rail-nav';
  nav.innerHTML = `
    <button class="rail-btn" data-dir="-1" aria-label="Scroll left"><i class='bx bx-chevron-left'></i></button>
    <div class="rail-progress"><span></span></div>
    <button class="rail-btn" data-dir="1" aria-label="Scroll right"><i class='bx bx-chevron-right'></i></button>`;
  wrap.appendChild(nav);

  const bar = nav.querySelector('.rail-progress span');
  const step = () => {
    const card = el.querySelector(':scope > *');
    return card ? card.getBoundingClientRect().width + 22 : el.clientWidth * .8;
  };
  const update = () => {
    const max = el.scrollWidth - el.clientWidth;
    const pct = max > 4 ? el.scrollLeft / max : 0;
    bar.style.transform = `scaleX(${Math.max(.08, Math.min(1, pct || .08))})`;
    nav.querySelector('[data-dir="-1"]').disabled = el.scrollLeft < 6;
    nav.querySelector('[data-dir="1"]').disabled  = el.scrollLeft > max - 6;
    nav.classList.toggle('idle', max <= 4);
  };
  nav.querySelectorAll('.rail-btn').forEach(b => b.onclick = () =>
    el.scrollBy({ left: (+b.dataset.dir) * step() * 2, behavior: reduced() ? 'auto' : 'smooth' }));
  el.addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  setTimeout(update, 60);
  return { update };
}

/* ═══════ SHOTS — product photo carousel ═════════════════ */
/* imgs: array of image basenames */
function shots(mount, imgs, opts){
  const o = Object.assign({ alt: '', zoom: true }, opts || {});
  const el = typeof mount === 'string' ? document.querySelector(mount) : mount;
  if (!el || !imgs.length) return null;

  el.classList.add('shots');
  el.innerHTML = `
    <div class="shots-stage" tabindex="0" aria-roledescription="carousel">
      <div class="shots-track">
        ${imgs.map((g, i) => `
          <figure class="shot ${i === 0 ? 'on' : ''}" data-i="${i}">
            <img src="assets/img/${g}-1920.jpg"
                 srcset="assets/img/${g}-960.jpg 960w, assets/img/${g}-1920.jpg 1920w, assets/img/${g}-4k.jpg 3840w"
                 sizes="(max-width:900px) 100vw, 46vw"
                 alt="${o.alt}${imgs.length > 1 ? ` — view ${i + 1}` : ''}" ${i ? 'loading="lazy"' : ''}>
          </figure>`).join('')}
      </div>
      ${imgs.length > 1 ? `
        <button class="shots-arrow left"  aria-label="Previous photo"><i class='bx bx-chevron-left'></i></button>
        <button class="shots-arrow right" aria-label="Next photo"><i class='bx bx-chevron-right'></i></button>` : ''}
      <span class="res-tag">4K · tap to zoom</span>
      <div class="shots-pips">${imgs.map((_, i) =>
        `<button class="pip ${i === 0 ? 'on' : ''}" data-go="${i}" aria-label="Photo ${i + 1}"></button>`).join('')}</div>
    </div>
    <div class="shots-thumbs">
      ${imgs.map((g, i) => `
        <button class="s-thumb ${i === 0 ? 'on' : ''}" data-go="${i}" aria-label="Photo ${i + 1}">
          <img src="assets/img/${g}-960.jpg" alt="" loading="lazy"></button>`).join('')}
    </div>`;

  let i = 0;
  const stage = el.querySelector('.shots-stage');
  const track = el.querySelector('.shots-track');

  function go(n){
    n = (n + imgs.length) % imgs.length;
    i = n;
    track.style.transform = `translate3d(${-i * 100}%,0,0)`;
    el.querySelectorAll('.shot').forEach(s => s.classList.toggle('on', +s.dataset.i === i));
    el.querySelectorAll('.pip, .s-thumb').forEach(b => b.classList.toggle('on', +b.dataset.go === i));
    stage.classList.remove('zoomed');
  }

  el.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(+b.dataset.go));
  const L = el.querySelector('.shots-arrow.left'), R = el.querySelector('.shots-arrow.right');
  if (L) L.onclick = e => { e.stopPropagation(); go(i - 1); };
  if (R) R.onclick = e => { e.stopPropagation(); go(i + 1); };
  onSwipe(stage, { left: () => go(i + 1), right: () => go(i - 1) });
  stage.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); go(i - 1); }
  });

  if (o.zoom) {
    stage.addEventListener('click', e => {
      if (e.target.closest('.shots-arrow, .pip')) return;
      stage.classList.toggle('zoomed');
    });
    stage.addEventListener('mousemove', e => {
      if (!stage.classList.contains('zoomed')) return;
      const r = stage.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100, y = ((e.clientY - r.top) / r.height) * 100;
      stage.style.setProperty('--ox', x + '%');
      stage.style.setProperty('--oy', y + '%');
    });
  }

  return { go, next: () => go(i + 1), prev: () => go(i - 1), current: () => i };
}

window.JMCCarousel = { hero, rail, shots, onSwipe };
})();
