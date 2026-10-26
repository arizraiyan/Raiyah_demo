/* ═══════════════════════════════════════════════════════════
   JMC QR — byte-mode QR encoder (versions 1–10, EC level M)
   No library, no network. Produces a real, scannable QR matrix.
   Used for the UPI payment code.
   ═══════════════════════════════════════════════════════════ */
(function () {
'use strict';

/* ── Galois field GF(256), primitive polynomial 0x11D ───── */
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
(function initGF(){
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x; LOG[x] = i;
    x <<= 1; if (x & 0x100) x ^= 0x11D;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const gmul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

/* generator polynomial of given degree */
function genPoly(deg){
  let poly = [1];
  for (let i = 0; i < deg; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j]     ^= poly[j];                    // × x
      next[j + 1] ^= gmul(poly[j], EXP[i]);      // × α^i
    }
    poly = next;
  }
  return poly;
}

/* Reed–Solomon remainder */
function rsEncode(data, ecLen){
  const gen = genPoly(ecLen);
  const res = new Array(ecLen).fill(0);
  for (const byte of data) {
    const factor = byte ^ res[0];
    res.shift(); res.push(0);
    if (factor !== 0) for (let i = 0; i < ecLen; i++) res[i] ^= gmul(gen[i + 1], factor);
  }
  return res;
}

/* ── EC table, level M, versions 1–10 ───────────────────── */
/*  version: [ ecCodewordsPerBlock, [ [blockCount, dataCodewordsPerBlock], ... ] ] */
const ECM = {
   1:[10,[[1,16]]],       2:[16,[[1,28]]],       3:[26,[[1,44]]],
   4:[18,[[2,32]]],       5:[24,[[2,43]]],       6:[16,[[4,27]]],
   7:[18,[[4,31]]],       8:[22,[[2,38],[2,39]]],
   9:[22,[[3,36],[2,37]]],10:[26,[[4,43],[1,44]]]
};
const ALIGN = {
  1:[], 2:[6,18], 3:[6,22], 4:[6,26], 5:[6,30], 6:[6,34],
  7:[6,22,38], 8:[6,24,42], 9:[6,26,46], 10:[6,28,50]
};
const dataCW = v => ECM[v][1].reduce((n, [c, d]) => n + c * d, 0);
const byteCapacity = v => dataCW(v) - (v >= 10 ? 3 : 2);

/* ── BCH helpers for format / version information ───────── */
function formatBits(mask){
  const data = (0b00 << 3) | mask;                  // level M = 00, then 3 mask bits
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return (((data << 10) | rem) ^ 0x5412) & 0x7FFF;
}
function versionBits(v){
  let rem = v;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
  return ((v << 12) | rem) & 0x3FFFF;
}

/* ── bit stream ─────────────────────────────────────────── */
function makeBitStream(bytes, version){
  const bits = [];
  const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  push(0b0100, 4);                              // byte mode
  push(bytes.length, version >= 10 ? 16 : 8);   // character count
  bytes.forEach(b => push(b, 8));

  const cap = dataCW(version) * 8;
  for (let i = 0; i < 4 && bits.length < cap; i++) bits.push(0);   // terminator
  while (bits.length % 8) bits.push(0);                            // byte align
  const pads = [0xEC, 0x11];
  for (let i = 0; bits.length < cap; i++) push(pads[i % 2], 8);    // pad codewords

  const cw = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    cw.push(b);
  }
  return cw;
}

/* interleave data + error correction codewords */
function interleave(cw, version){
  const [ecLen, groups] = ECM[version];
  const blocks = [];
  let pos = 0;
  groups.forEach(([count, size]) => {
    for (let i = 0; i < count; i++) {
      const d = cw.slice(pos, pos + size); pos += size;
      blocks.push({ d, e: rsEncode(d, ecLen) });
    }
  });
  const out = [];
  const maxD = Math.max(...blocks.map(b => b.d.length));
  for (let i = 0; i < maxD; i++) blocks.forEach(b => { if (i < b.d.length) out.push(b.d[i]); });
  for (let i = 0; i < ecLen; i++) blocks.forEach(b => out.push(b.e[i]));
  return out;
}

/* ── matrix construction ────────────────────────────────── */
function buildMatrix(version, codewords, mask){
  const size = version * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(null));   // null = free
  const fn = Array.from({ length: size }, () => new Array(size).fill(false)); // function module?

  const set = (r, c, v) => { m[r][c] = v; fn[r][c] = true; };

  /* finder patterns + separators */
  const finder = (R, C) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const rr = R + r, cc = C + c;
      if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
      const inRing = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                     (c >= 0 && c <= 6 && (r === 0 || r === 6));
      const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      set(rr, cc, (inRing || inCore) ? 1 : 0);
    }
  };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

  /* timing patterns */
  for (let i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0 ? 1 : 0); set(i, 6, i % 2 === 0 ? 1 : 0); }

  /* alignment patterns */
  const cs = ALIGN[version];
  cs.forEach(r => cs.forEach(c => {
    if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8)) return;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const ring = Math.max(Math.abs(dr), Math.abs(dc));
      set(r + dr, c + dc, (ring === 1) ? 0 : 1);
    }
  }));

  set(size - 8, 8, 1);                     // dark module

  /* reserve format areas */
  for (let i = 0; i < 9; i++) { if (!fn[8][i]) set(8, i, 0); if (!fn[i][8]) set(i, 8, 0); }
  for (let i = 0; i < 8; i++) { if (!fn[8][size - 1 - i]) set(8, size - 1 - i, 0);
                                if (!fn[size - 1 - i][8]) set(size - 1 - i, 8, 0); }

  /* version information (v7+) */
  if (version >= 7) {
    const vb = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = (vb >> i) & 1, a = Math.floor(i / 3), b = i % 3;
      set(size - 11 + b, a, bit); set(a, size - 11 + b, bit);
    }
  }

  /* data placement — zigzag, bottom-right upward */
  const maskFn = [
    (r,c)=>(r+c)%2===0, (r,c)=>r%2===0, (r,c)=>c%3===0, (r,c)=>(r+c)%3===0,
    (r,c)=>(Math.floor(r/2)+Math.floor(c/3))%2===0, (r,c)=>(r*c)%2+(r*c)%3===0,
    (r,c)=>((r*c)%2+(r*c)%3)%2===0, (r,c)=>((r+c)%2+(r*c)%3)%2===0
  ][mask];

  let bitIdx = 0;
  const totalBits = codewords.length * 8;
  const nextBit = () => {
    if (bitIdx >= totalBits) return 0;
    const b = (codewords[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1;
    bitIdx++; return b;
  };

  let up = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;                       // skip vertical timing column
    for (let i = 0; i < size; i++) {
      const row = up ? size - 1 - i : i;
      for (let k = 0; k < 2; k++) {
        const c = col - k;
        if (fn[row][c]) continue;
        let bit = nextBit();
        if (maskFn(row, c)) bit ^= 1;
        m[row][c] = bit;
      }
    }
    up = !up;
  }

  /* format information */
  const fb = formatBits(mask);
  const fbit = i => (fb >> (14 - i)) & 1;   // bit 14 (MSB) is placed first
  for (let i = 0; i <= 5; i++) m[8][i] = fbit(i);
  m[8][7] = fbit(6); m[8][8] = fbit(7); m[7][8] = fbit(8);
  for (let i = 9; i <= 14; i++) m[14 - i][8] = fbit(i);
  for (let i = 0; i <= 6; i++)  m[size - 1 - i][8]   = fbit(i);
  for (let i = 7; i <= 14; i++) m[8][size - 15 + i] = fbit(i);
  m[size - 8][8] = 1;

  m.fn = fn;
  return m;
}

/* ── mask penalty scoring (ISO/IEC 18004 rules 1–4) ─────── */
function penalty(m){
  const n = m.length; let score = 0;

  const runScore = line => {
    let s = 0, run = 1;
    for (let i = 1; i < n; i++) {
      if (line[i] === line[i - 1]) { run++; }
      else { if (run >= 5) s += run - 2; run = 1; }
    }
    if (run >= 5) s += run - 2;
    return s;
  };
  for (let r = 0; r < n; r++) score += runScore(m[r]);
  for (let c = 0; c < n; c++) score += runScore(m.map(row => row[c]));

  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++)
    if (m[r][c] === m[r][c+1] && m[r][c] === m[r+1][c] && m[r][c] === m[r+1][c+1]) score += 3;

  const pat1 = [1,0,1,1,1,0,1,0,0,0,0], pat2 = [0,0,0,0,1,0,1,1,1,0,1];
  const hit = (arr, i, p) => p.every((v, k) => arr[i + k] === v);
  for (let r = 0; r < n; r++) for (let c = 0; c + 11 <= n; c++)
    if (hit(m[r], c, pat1) || hit(m[r], c, pat2)) score += 40;
  for (let c = 0; c < n; c++) {
    const col = m.map(row => row[c]);
    for (let r = 0; r + 11 <= n; r++) if (hit(col, r, pat1) || hit(col, r, pat2)) score += 40;
  }

  let dark = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) dark += m[r][c];
  const pct = dark * 100 / (n * n);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;

  return score;
}

/* ── public: text → matrix of 0/1 ───────────────────────── */
function encode(text){
  const bytes = Array.from(new TextEncoder().encode(text));
  let version = 0;
  for (let v = 1; v <= 10; v++) if (bytes.length <= byteCapacity(v)) { version = v; break; }
  if (!version) throw new Error('QR payload too long');

  const cw = interleave(makeBitStream(bytes, version), version);
  let best = null, bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const m = buildMatrix(version, cw, mask);
    const s = penalty(m);
    if (s < bestScore) { bestScore = s; best = m; }
  }
  return best;
}

/* ── public: text → crisp SVG string ────────────────────── */
function svg(text, opts){
  const o = Object.assign({ size: 240, quiet: 3, dark: '#1B1020', light: 'transparent', radius: 0.5 }, opts || {});
  const m = encode(text);
  const n = m.length, total = n + o.quiet * 2;
  const cell = 1;

  let path = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c])
    path += `M${c + o.quiet} ${r + o.quiet}h${cell}v${cell}h-${cell}z`;

  /* finder eyes get rounded corners so the code reads as a designed object */
  const eye = (R, C) => `
    <rect x="${C + o.quiet}" y="${R + o.quiet}" width="7" height="7" rx="1.6"
          fill="none" stroke="${o.dark}" stroke-width="1"/>
    <rect x="${C + o.quiet + 2}" y="${R + o.quiet + 2}" width="3" height="3" rx=".8" fill="${o.dark}"/>`;

  /* blank the raw eye modules, then redraw them styled */
  let mask = '';
  [[0,0],[0,n-7],[n-7,0]].forEach(([R,C]) => {
    mask += `<rect x="${C + o.quiet}" y="${R + o.quiet}" width="7" height="7" fill="#000"/>`;
  });

  return `<svg viewBox="0 0 ${total} ${total}" width="${o.size}" height="${o.size}"
       xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" role="img" aria-label="UPI payment QR code">
    <defs><mask id="jmcqrm">
      <rect width="${total}" height="${total}" fill="#fff"/>${mask}
    </mask></defs>
    <rect width="${total}" height="${total}" fill="${o.light}"/>
    <path d="${path}" fill="${o.dark}" mask="url(#jmcqrm)"/>
    <g shape-rendering="geometricPrecision">${eye(0,0)}${eye(0,n-7)}${eye(n-7,0)}</g>
  </svg>`;
}

window.JMCQR = { encode, svg, byteCapacity, _dbg: { buildMatrix, interleave, makeBitStream, penalty, formatBits, versionBits, dataCW } };
})();
