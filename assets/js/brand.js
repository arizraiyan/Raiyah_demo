/* ═══════════════════════════════════════════════════════════
   JAY MATAJI CREATION — Brand mark + opening sequence
   The mark: a torana (temple arch) holding a lotus flame,
   ringed by abhla (mirror-work) dots. Drawn, never a font.
   ═══════════════════════════════════════════════════════════ */
// (function () {
// 'use strict';

// const mq = q => (window.matchMedia ? window.matchMedia(q).matches : false);

// /* ── geometry shared by every size of the mark ──────────── */
// const ARCH_OUT = 'M32 3.5C45.2 3.5 55 14 55 27.6V59a4.5 4.5 0 0 1-4.5 4.5h-37A4.5 4.5 0 0 1 9 59V27.6C9 14 18.8 3.5 32 3.5Z';
// const ARCH_IN  = 'M32 9.5C42 9.5 49.5 17.4 49.5 28v29.5h-35V28C14.5 17.4 22 9.5 32 9.5Z';
// const PETAL_C  = 'M32 18.5c-5.3 7.6-5.3 16.8 0 24.7 5.3-7.9 5.3-17.1 0-24.7Z';
// const PETAL_L  = 'M32 43.2c-7.4-1.8-12.5-7.6-13.1-15.2 5.8 1.4 10.3 6.8 13.1 15.2Z';
// const PETAL_R  = 'M32 43.2c7.4-1.8 12.5-7.6 13.1-15.2-5.8 1.4-10.3 6.8-13.1 15.2Z';
// const STEM     = 'M32 43.2v9.3';
// const BASE     = 'M22 55h20';
// /* abhla dots sit on the arch shoulder */
// const DOTS = [[32,7.4,1.5],[19.5,13.5,1],[44.5,13.5,1],[13.6,23,.85],[50.4,23,.85]];

// function markPaths(prefix){
//   return `
//     <path class="${prefix}arch" d="${ARCH_OUT}"/>
//     <path class="${prefix}arch ${prefix}arch-2" d="${ARCH_IN}"/>
//     <path class="${prefix}petal ${prefix}p1" d="${PETAL_L}"/>
//     <path class="${prefix}petal ${prefix}p2" d="${PETAL_R}"/>
//     <path class="${prefix}petal ${prefix}p3" d="${PETAL_C}"/>
//     <path class="${prefix}stem" d="${STEM}"/>
//     <path class="${prefix}stem ${prefix}base" d="${BASE}"/>
//     ${DOTS.map(([x,y,r],i) => `<circle class="${prefix}dot" style="--i:${i}" cx="${x}" cy="${y}" r="${r}"/>`).join('')}`;
// }

// /* compact mark for header / footer */
// function logoSVG(){
//   return `<svg class="brand-mark" viewBox="0 0 64 68" aria-hidden="true" focusable="false">
//     ${markPaths('m-')}
//   </svg>`;
// }

// /* ── the opening sequence ───────────────────────────────── */
// const SEEN = 'jmc_intro_seen';

// function introHTML(){
//   const ticks = Array.from({length:36}, (_,i) =>
//     `<line class="ring-tick" style="--i:${i}" x1="90" y1="6" x2="90" y2="${i%3===0?14:10}"
//            transform="rotate(${i*10} 90 90)"/>`).join('');
//   return `
//   <div class="intro-veil" id="intro-veil" role="presentation">
//     <div class="veil-panel veil-l"></div>
//     <div class="veil-panel veil-r"></div>
//     <div class="intro-core">
//       <svg class="intro-ring" viewBox="0 0 180 180" aria-hidden="true">
//         <circle class="ring-line" cx="90" cy="90" r="80"/>
//         <g class="ring-ticks">${ticks}</g>
//       </svg>
//       <svg class="intro-mark" viewBox="0 0 64 68" aria-hidden="true">
//         <defs>
//           <linearGradient id="zari" x1="0" y1="0" x2="1" y2="1">
//             <stop offset="0"   stop-color="var(--gold)"/>
//             <stop offset=".45" stop-color="var(--gold-hi)"/>
//             <stop offset="1"   stop-color="var(--gold)"/>
//           </linearGradient>
//         </defs>
//         ${markPaths('i-')}
//       </svg>
//       <div class="intro-words">
//         <div class="iw-line" aria-hidden="true"></div>
//         <h1 class="iw-name">Jay&nbsp;Mataji</h1>
//         <p class="iw-sub">Creation</p>
//         <div class="iw-line" aria-hidden="true"></div>
//         <p class="iw-tag">Hand embroidery · Ahmedabad</p>
//       </div>
//       <div class="intro-bar"><span></span></div>
//     </div>
//     <button class="intro-skip" id="intro-skip" type="button">Skip intro</button>
//   </div>`;
// }

// function runIntro(force){
//   const reduced = mq('(prefers-reduced-motion: reduce)');
//   if (!force) {
//     if (sessionStorage.getItem(SEEN)) return;
//     if (reduced) { sessionStorage.setItem(SEEN, '1'); return; }
//   }
//   sessionStorage.setItem(SEEN, '1');

//   const host = document.createElement('div');
//   host.innerHTML = introHTML();
//   const veil = host.firstElementChild;
//   document.body.appendChild(veil);
//   document.documentElement.classList.add('intro-lock');

//   let done = false;
//   const finish = () => {
//     if (done) return; done = true;
//     veil.classList.add('parting');
//     document.documentElement.classList.remove('intro-lock');
//     document.dispatchEvent(new CustomEvent('jmc:intro-done'));
//     setTimeout(() => veil.remove(), 1200);
//   };

//   veil.querySelector('#intro-skip').addEventListener('click', finish);
//   document.addEventListener('keydown', function esc(e){
//     if (e.key === 'Escape') { finish(); document.removeEventListener('keydown', esc); }
//   });

//   requestAnimationFrame(() => veil.classList.add('playing'));
//   setTimeout(finish, force ? 4200 : 4200);
// }

// window.JMCBrand = { logoSVG, runIntro, markPaths };
// })();

/* ═══════════════════════════════════════════════════════════
   RAYHAN — Premium Animated Brand Mark
   SVG monogram + cinematic opening sequence
   ═══════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const mq = (q) =>
    window.matchMedia ? window.matchMedia(q).matches : false;

  /* ── SVG geometry ─────────────────────────────────────── */

  // Royal arch
  const ARCH_OUT =
    "M32 3C43 3 48 12 48 12C56 16 59 23 59 32V60H5V32C5 23 8 16 16 12C16 12 21 3 32 3Z";

  const ARCH_IN =
    "M32 10C40 10 44 18 44 18C51 21 53 26 53 33V54H11V33C11 26 13 21 20 18C20 18 24 10 32 10Z";

  // Decorative R letter
  const R_STEM = "M23 47V21H34C45 21 45 35 34 35H23";
  const R_LEG = "M33 35L45 48";
  const R_SWASH = "M19 42Q32 31 47 44";
  const CROWN = "M25 18L28 13L32 17L36 13L39 18Z";

  const DOTS = [
    [32, 7, 1.4],
    [16, 19, 1.1],
    [48, 19, 1.1],
    [8, 32, 0.9],
    [56, 32, 0.9],
  ];

  /* ── Shared SVG paths ─────────────────────────────────── */

  function markPaths(prefix) {
    return `
      <path class="${prefix}arch" d="${ARCH_OUT}"/>
      <path class="${prefix}arch ${prefix}arch-2" d="${ARCH_IN}"/>

      <path class="${prefix}letter ${prefix}r-stem"
        d="${R_STEM}"/>

      <path class="${prefix}letter ${prefix}r-leg"
        d="${R_LEG}"/>

      <path class="${prefix}swash"
        d="${R_SWASH}"/>

      <path class="${prefix}crown"
        d="${CROWN}"/>

      ${DOTS.map(
        ([x, y, r], i) => `
        <circle
          class="${prefix}dot"
          style="--i:${i}"
          cx="${x}"
          cy="${y}"
          r="${r}"
        />`
      ).join("")}
    `;
  }

  /* ── Header / Footer logo ─────────────────────────────── */

  function logoSVG() {
    return `
      <svg
        class="brand-mark rayhan-mark"
        viewBox="0 0 64 68"
        aria-hidden="true"
        focusable="false"
      >
        ${markPaths("m-")}
      </svg>
    `;
  }

  /* ── Opening sequence ─────────────────────────────────── */

  const SEEN = "rayhan_intro_seen";

  function introHTML() {
    const ticks = Array.from({ length: 36 }, (_, i) => `
      <line
        class="ring-tick"
        style="--i:${i}"
        x1="90"
        y1="6"
        x2="90"
        y2="${i % 3 === 0 ? 14 : 10}"
        transform="rotate(${i * 10} 90 90)"
      />
    `).join("");

    return `
      <div
        class="intro-veil"
        id="intro-veil"
        role="presentation"
      >
        <div class="veil-panel veil-l"></div>
        <div class="veil-panel veil-r"></div>

        <div class="intro-core">

          <svg
            class="intro-ring"
            viewBox="0 0 180 180"
            aria-hidden="true"
          >
            <circle
              class="ring-line"
              cx="90"
              cy="90"
              r="80"
            />

            <g class="ring-ticks">
              ${ticks}
            </g>
          </svg>

          <svg
            class="intro-mark"
            viewBox="0 0 64 68"
            aria-hidden="true"
          >
            <defs>
              <linearGradient
                id="rayhan-gold"
                x1="0"
                y1="0"
                x2="1"
                y2="1"
              >
                <stop
                  offset="0"
                  stop-color="#9c6927"
                />
                <stop
                  offset=".45"
                  stop-color="#ffe6a2"
                />
                <stop
                  offset="1"
                  stop-color="#d4a447"
                />
              </linearGradient>
            </defs>

            ${markPaths("i-")}
          </svg>

          <div class="intro-words">

            <div
              class="iw-line"
              aria-hidden="true"
            ></div>

            <h1 class="iw-name">
              RAYHAN
            </h1>

            <p class="iw-sub">
              CREATIVE STUDIO
            </p>

            <div
              class="iw-line"
              aria-hidden="true"
            ></div>

            <p class="iw-tag">
              Design · Development · Creativity
            </p>

          </div>

          <div class="intro-bar">
            <span></span>
          </div>

        </div>

        <button
          class="intro-skip"
          id="intro-skip"
          type="button"
        >
          Skip intro
        </button>
      </div>
    `;
  }

  /* ── Intro controller ─────────────────────────────────── */

  function runIntro(force = false) {
    const reduced = mq(
      "(prefers-reduced-motion: reduce)"
    );

    if (!force) {
      try {
        if (sessionStorage.getItem(SEEN)) return;

        if (reduced) {
          sessionStorage.setItem(SEEN, "1");
          return;
        }
      } catch (error) {
        // Intro still works without storage.
      }
    }

    try {
      sessionStorage.setItem(SEEN, "1");
    } catch (error) {}

    const host = document.createElement("div");
    host.innerHTML = introHTML();

    const veil = host.firstElementChild;

    document.body.appendChild(veil);

    document.documentElement.classList.add(
      "intro-lock"
    );

    let done = false;
    let finishTimer;

    const onEscape = (e) => {
      if (e.key === "Escape") finish();
    };

    const finish = () => {
      if (done) return;

      done = true;

      clearTimeout(finishTimer);
      document.removeEventListener(
        "keydown",
        onEscape
      );

      veil.classList.add("parting");

      document.documentElement.classList.remove(
        "intro-lock"
      );

      document.dispatchEvent(
        new CustomEvent("jmc:intro-done")
      );

      setTimeout(() => {
        veil.remove();
      }, 1200);
    };

    veil
      .querySelector("#intro-skip")
      .addEventListener("click", finish);

    document.addEventListener(
      "keydown",
      onEscape
    );

    requestAnimationFrame(() => {
      veil.classList.add("playing");
    });

    finishTimer = setTimeout(finish, 4200);
  }

  /* ── Public API ───────────────────────────────────────── */

  window.JMCBrand = {
    logoSVG,
    runIntro,
    markPaths,
  };

})();
