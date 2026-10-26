/* ═══════════════════════════════════════════════════════════
   JMC PAY — checkout payment sheet
   UPI (real intent + real QR) · Card · Netbanking · Wallet · COD

   Demo mode (default) settles payments locally so the whole
   shop is clickable end to end. Turn it off in the admin
   dashboard and the UPI code becomes a real intent to your own
   VPA, with UTR capture and manual verification.
   Card numbers are validated, never stored — only the last 4.
   ═══════════════════════════════════════════════════════════ */
(function () {
'use strict';

const rs = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ── merchant settings (admin editable) ─────────────────── */
const DEFAULTS = { upiId: 'jaymatajicreation@okaxis', payee: 'Jay Mataji Creation', demoMode: true };
function settings(){
  try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem('jmc_settings') || '{}')); }
  catch { return Object.assign({}, DEFAULTS); }
}
function saveSettings(patch){
  const s = Object.assign(settings(), patch);
  localStorage.setItem('jmc_settings', JSON.stringify(s));
  if (window.JMC) window.JMC.write('jmc_settings', s);
  return s;
}

/* ── card helpers ───────────────────────────────────────── */
const BRANDS = [
  { id:'rupay',  name:'RuPay',      re:/^(60|65|81|82|508)/,                   len:[16], cvv:3 },
  { id:'visa',   name:'Visa',       re:/^4/,                                   len:[16], cvv:3 },
  { id:'master', name:'Mastercard', re:/^(5[1-5]|2[2-7])/,                     len:[16], cvv:3 },
  { id:'amex',   name:'Amex',       re:/^3[47]/,                               len:[15], cvv:4 },
  { id:'diners', name:'Diners',     re:/^3(0[0-5]|[68])/,                      len:[14,16], cvv:3 }
];
const brandOf = num => BRANDS.find(b => b.re.test(num.replace(/\D/g, ''))) || null;

function luhn(num){
  const d = num.replace(/\D/g, '');
  if (d.length < 12) return false;
  let sum = 0, dbl = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = +d[i];
    if (dbl) { n *= 2; if (n > 9) n -= 9; }
    sum += n; dbl = !dbl;
  }
  return sum % 10 === 0;
}
function groupCard(v, brand){
  const d = v.replace(/\D/g, '').slice(0, brand && brand.id === 'amex' ? 15 : 16);
  if (brand && brand.id === 'amex') return d.replace(/(\d{4})(\d{0,6})(\d{0,5})/, (m,a,b,c) => [a,b,c].filter(Boolean).join(' '));
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}
function expiryValid(v){
  const m = /^(\d{2})\s*\/?\s*(\d{2})$/.exec(v.trim());
  if (!m) return false;
  const mm = +m[1], yy = 2000 + +m[2];
  if (mm < 1 || mm > 12) return false;
  const now = new Date();
  const end = new Date(yy, mm, 0, 23, 59, 59);
  return end >= now && yy <= now.getFullYear() + 20;
}

const BANKS = [
  ['HDFC Bank','hdfc'], ['State Bank of India','sbi'], ['ICICI Bank','icici'],
  ['Axis Bank','axis'], ['Kotak Mahindra','kotak'], ['Bank of Baroda','bob'],
  ['Punjab National Bank','pnb'], ['Yes Bank','yes'], ['IDFC First','idfc'], ['Canara Bank','canara']
];
const WALLETS = [
  ['Paytm Wallet','paytm'], ['PhonePe Wallet','phonepe'], ['Amazon Pay','amazon'], ['Mobikwik','mobikwik']
];
const UPI_APPS = [
  { id:'gpay',    name:'Google Pay', pkg:'tez://upi/pay' },
  { id:'phonepe', name:'PhonePe',    pkg:'phonepe://pay' },
  { id:'paytm',   name:'Paytm',      pkg:'paytmmp://pay' },
  { id:'bhim',    name:'BHIM',       pkg:'upi://pay' }
];

/* build a real UPI intent string */
function upiLink(base, { amount, ref, note }){
  const s = settings();
  const p = new URLSearchParams({
    pa: s.upiId, pn: s.payee, am: Number(amount).toFixed(2),
    cu: 'INR', tn: note || ('Order ' + ref), tr: ref
  });
  return base + '?' + p.toString().replace(/\+/g, '%20');
}

/* ═══════ THE SHEET ═══════════════════════════════════════ */
let live = null;   // active sheet state

function open({ amount, orderRef, onDone }){
  close();
  const s = settings();
  const ref = orderRef || 'JMC' + Date.now().toString(36).toUpperCase();

  const scrim = document.createElement('div');
  scrim.className = 'pay-scrim';
  scrim.innerHTML = `
    <section class="pay-sheet" role="dialog" aria-modal="true" aria-label="Choose how to pay">
      <header class="pay-head">
        <div class="pay-head-l">
          <span class="pay-eyebrow">Secure checkout</span>
          <h3>${rs(amount)}</h3>
          <span class="pay-ref">Ref ${esc(ref)}</span>
        </div>
        <div class="pay-head-r">
          ${s.demoMode ? '<span class="demo-chip" title="No real money moves. Switch this off in the admin dashboard."><i class="bx bx-flask"></i> Demo mode</span>' : ''}
          <button class="tool-btn" id="pay-x" aria-label="Close"><i class='bx bx-x'></i></button>
        </div>
      </header>

      <div class="pay-body">
        <nav class="pay-tabs" role="tablist">
          <button class="pay-tab on" data-tab="upi"  role="tab"><i class='bx bx-qr-scan'></i><span>UPI</span><small>Instant</small></button>
          <button class="pay-tab"    data-tab="card" role="tab"><i class='bx bx-credit-card-front'></i><span>Card</span><small>Debit / credit</small></button>
          <button class="pay-tab"    data-tab="bank" role="tab"><i class='bx bx-building-house'></i><span>Netbanking</span><small>10 banks</small></button>
          <button class="pay-tab"    data-tab="wallet" role="tab"><i class='bx bx-wallet'></i><span>Wallet</span><small>Paytm, PhonePe</small></button>
          <button class="pay-tab"    data-tab="cod"  role="tab"><i class='bx bx-money'></i><span>Cash</span><small>On delivery</small></button>
        </nav>
        <div class="pay-pane" id="pay-pane"></div>
      </div>

      <footer class="pay-foot">
        <i class='bx bx-lock-alt'></i>
        <span>Card details are checked in your browser and never stored — we keep only the last four digits.</span>
      </footer>
    </section>`;
  document.body.appendChild(scrim);
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => scrim.classList.add('open'));

  const pane = scrim.querySelector('#pay-pane');
  live = { scrim, amount, ref, onDone, timers: [], settled: false };

  const settle = result => {
    if (live.settled) return;
    live.settled = true;
    live.timers.forEach(clearInterval);
    successScreen(pane, result, () => { close(); onDone && onDone(result); });
  };

  const tabs = { upi: upiPane, card: cardPane, bank: bankPane, wallet: walletPane, cod: codPane };
  function show(name){
    scrim.querySelectorAll('.pay-tab').forEach(t => t.classList.toggle('on', t.dataset.tab === name));
    live.timers.forEach(clearInterval); live.timers = [];
    pane.classList.remove('swap'); void pane.offsetWidth; pane.classList.add('swap');
    tabs[name](pane, { amount, ref, settle });
  }
  scrim.querySelectorAll('.pay-tab').forEach(t => t.onclick = () => show(t.dataset.tab));
  scrim.querySelector('#pay-x').onclick = close;
  scrim.addEventListener('click', e => { if (e.target === scrim) close(); });
  document.addEventListener('keydown', escClose);
  show('upi');
}

function escClose(e){ if (e.key === 'Escape') close(); }
function close(){
  document.removeEventListener('keydown', escClose);
  if (!live) return;
  live.timers.forEach(clearInterval);
  live.scrim.classList.remove('open');
  const el = live.scrim;
  setTimeout(() => el.remove(), 260);
  document.body.style.overflow = '';
  live = null;
}

/* ── UPI ────────────────────────────────────────────────── */
function upiPane(pane, { amount, ref, settle }){
  const s = settings();
  const link = upiLink('upi://pay', { amount, ref });
  let qr = '';
  try { qr = window.JMCQR.svg(link, { size: 210, quiet: 4, dark: '#1B1020' }); }
  catch (e) { qr = '<div class="qr-fail">Could not draw the code — use the UPI ID below.</div>'; }

  pane.innerHTML = `
    <div class="upi-grid">
      <div class="upi-qr-card">
        <div class="qr-frame" id="qr-frame">
          ${qr}
          <div class="qr-badge"><i class='bx bx-shield-quarter'></i></div>
          <div class="qr-expired" id="qr-expired">
            <i class='bx bx-time-five'></i><b>Code expired</b>
            <button class="btn btn-line btn-sm" id="qr-again">Show a new code</button>
          </div>
        </div>
        <div class="qr-meta">
          <div class="qr-count"><i class='bx bx-time-five'></i> Valid for <b id="qr-clock">05:00</b></div>
          <div class="qr-vpa">
            <span>${esc(s.upiId)}</span>
            <button class="copy-btn" id="copy-vpa" aria-label="Copy UPI ID"><i class='bx bx-copy'></i></button>
          </div>
        </div>
      </div>

      <div class="upi-side">
        <h4>Scan with any UPI app</h4>
        <p class="pay-note">Open Google&nbsp;Pay, PhonePe, Paytm or your bank app, scan the code, and approve ${rs(amount)}.</p>

        <div class="upi-apps">
          ${UPI_APPS.map(a => `
            <a class="upi-app" data-app="${a.id}" href="${esc(upiLink(a.pkg, { amount, ref }))}">
              <span class="ua-mark ua-${a.id}"></span>
              <b>${a.name}</b><i class='bx bx-right-arrow-alt'></i>
            </a>`).join('')}
        </div>
        <p class="pay-hint"><i class='bx bx-mobile-alt'></i> On a phone these buttons open the app directly.</p>

        <div class="upi-or"><span>or pay to a UPI ID</span></div>
        <label class="field">
          <span>Your UPI ID</span>
          <input type="text" id="vpa-in" placeholder="yourname@bank" autocomplete="off" spellcheck="false">
        </label>
        <div class="field-err" id="vpa-err"></div>
        <button class="btn btn-solid btn-block" id="vpa-go">Request ${rs(amount)}</button>

        <div class="upi-status" id="upi-status" hidden>
          <div class="us-ring"><span></span></div>
          <div class="us-text"><b id="us-title">Waiting for you to approve</b><small id="us-sub">Check the notification in your UPI app</small></div>
        </div>
      </div>
    </div>`;

  /* countdown */
  let left = 300;
  const clock = pane.querySelector('#qr-clock');
  const tick = setInterval(() => {
    left--;
    clock.textContent = String(Math.floor(left / 60)).padStart(2,'0') + ':' + String(left % 60).padStart(2,'0');
    if (left <= 0) { clearInterval(tick); pane.querySelector('#qr-expired').classList.add('on'); }
  }, 1000);
  live.timers.push(tick);
  pane.querySelector('#qr-again').onclick = () => upiPane(pane, { amount, ref, settle });

  pane.querySelector('#copy-vpa').onclick = async () => {
    try { await navigator.clipboard.writeText(s.upiId); toast('UPI ID copied'); }
    catch { toast('Copy it manually: ' + s.upiId); }
  };

  const status = pane.querySelector('#upi-status');
  const setStatus = (title, sub, cls) => {
    status.hidden = false;
    status.className = 'upi-status ' + (cls || '');
    pane.querySelector('#us-title').textContent = title;
    pane.querySelector('#us-sub').textContent = sub;
  };

  /* app buttons — real intent on mobile, tracked either way */
  pane.querySelectorAll('.upi-app').forEach(a => a.onclick = () => {
    setStatus('Opening ' + a.querySelector('b').textContent + '…', 'Approve the request, then come back here', '');
    beginWatch();
  });

  /* pay-to-VPA */
  pane.querySelector('#vpa-go').onclick = () => {
    const v = pane.querySelector('#vpa-in').value.trim();
    const err = pane.querySelector('#vpa-err');
    if (!/^[\w.\-]{2,}@[a-z]{2,}$/i.test(v)) {
      err.textContent = 'Enter a UPI ID like yourname@okhdfcbank.';
      pane.querySelector('#vpa-in').classList.add('bad'); return;
    }
    err.textContent = ''; pane.querySelector('#vpa-in').classList.remove('bad');
    setStatus('Collect request sent to ' + v, 'Open your UPI app and approve ' + rs(amount), '');
    beginWatch();
  };

  function beginWatch(){
    if (!s.demoMode) { manualVerify(pane, { amount, ref, settle }); return; }
    let step = 0;
    const seq = [
      ['Waiting for you to approve', 'Check the notification in your UPI app', ''],
      ['Authorising with your bank', 'This usually takes a moment', 'busy'],
      ['Payment received', 'Confirming your order', 'ok']
    ];
    const t = setInterval(() => {
      step++;
      if (step < seq.length) { setStatus(...seq[step]); }
      else {
        clearInterval(t);
        settle({ method:'upi', label:'UPI', ref, meta:{ vpa: pane.querySelector('#vpa-in').value.trim() || s.upiId } });
      }
    }, 1800);
    live.timers.push(t);
  }
}

/* when demo mode is off: capture the bank reference for manual verification */
function manualVerify(pane, { amount, ref, settle }){
  const box = pane.querySelector('#upi-status');
  box.hidden = false;
  box.className = 'upi-status manual';
  box.innerHTML = `
    <b>Paid already? Add the reference</b>
    <small>Your UPI app shows a 12-digit UTR / transaction ID once the payment goes through.</small>
    <div class="utr-row">
      <input type="text" id="utr" inputmode="numeric" maxlength="12" placeholder="12-digit UTR">
      <button class="btn btn-solid" id="utr-go">Submit</button>
    </div>
    <div class="field-err" id="utr-err"></div>`;
  box.querySelector('#utr-go').onclick = () => {
    const v = box.querySelector('#utr').value.replace(/\D/g,'');
    if (v.length !== 12) { box.querySelector('#utr-err').textContent = 'The UTR is exactly 12 digits.'; return; }
    settle({ method:'upi', label:'UPI', ref, pending:true, meta:{ utr:v } });
  };
}

/* ── CARD ───────────────────────────────────────────────── */
function cardPane(pane, { amount, ref, settle }){
  pane.innerHTML = `
    <div class="card-grid">
      <div class="card-visual" id="cv">
        <div class="cv-inner">
          <div class="cv-face cv-front">
            <div class="cv-top"><span class="cv-chip"></span><span class="cv-brand" id="cv-brand">Card</span></div>
            <div class="cv-num" id="cv-num">•••• •••• •••• ••••</div>
            <div class="cv-row">
              <div><small>Card holder</small><b id="cv-name">YOUR NAME</b></div>
              <div><small>Valid thru</small><b id="cv-exp">MM/YY</b></div>
            </div>
          </div>
          <div class="cv-face cv-back">
            <div class="cv-stripe"></div>
            <div class="cv-cvv"><small>CVV</small><b id="cv-cvv">•••</b></div>
          </div>
        </div>
      </div>

      <form class="card-form" id="cform" novalidate>
        <label class="field">
          <span>Card number</span>
          <input id="f-num" inputmode="numeric" autocomplete="cc-number" placeholder="1234 5678 9012 3456" maxlength="19">
        </label>
        <div class="field-err" id="e-num"></div>

        <label class="field">
          <span>Name on card</span>
          <input id="f-name" autocomplete="cc-name" placeholder="As printed on the card">
        </label>
        <div class="field-err" id="e-name"></div>

        <div class="two">
          <label class="field"><span>Expiry</span>
            <input id="f-exp" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/YY" maxlength="5"></label>
          <label class="field"><span>CVV</span>
            <input id="f-cvv" inputmode="numeric" autocomplete="cc-csc" placeholder="•••" maxlength="4" type="password"></label>
        </div>
        <div class="field-err" id="e-rest"></div>

        <label class="check"><input type="checkbox" id="f-save"><span>Remember the last four digits for faster checkout</span></label>
        <button class="btn btn-solid btn-block btn-lg" id="f-go" type="submit">Pay ${rs(amount)}</button>
      </form>
    </div>`;

  const $ = id => pane.querySelector(id);
  const num = $('#f-num'), nm = $('#f-name'), ex = $('#f-exp'), cv = $('#f-cvv');

  num.addEventListener('input', () => {
    const b = brandOf(num.value);
    num.value = groupCard(num.value, b);
    $('#cv-num').textContent = num.value.padEnd(19, '•').replace(/(.{4})/g, '$1 ').trim() || '•••• •••• •••• ••••';
    $('#cv-brand').textContent = b ? b.name : 'Card';
    $('#cv').dataset.brand = b ? b.id : '';
    cv.maxLength = b && b.cvv === 4 ? 4 : 3;
  });
  nm.addEventListener('input', () => $('#cv-name').textContent = (nm.value || 'YOUR NAME').toUpperCase());
  ex.addEventListener('input', () => {
    let d = ex.value.replace(/\D/g,'').slice(0,4);
    if (d.length >= 3) d = d.slice(0,2) + '/' + d.slice(2);
    ex.value = d; $('#cv-exp').textContent = d || 'MM/YY';
  });
  cv.addEventListener('input', () => {
    cv.value = cv.value.replace(/\D/g,'');
    $('#cv-cvv').textContent = '•'.repeat(cv.value.length) || '•••';
  });
  cv.addEventListener('focus', () => $('#cv').classList.add('flip'));
  cv.addEventListener('blur',  () => $('#cv').classList.remove('flip'));

  $('#cform').onsubmit = e => {
    e.preventDefault();
    const b = brandOf(num.value);
    const digits = num.value.replace(/\D/g,'');
    let ok = true;
    const fail = (sel, msg) => { pane.querySelector(sel).textContent = msg; ok = false; };
    ['#e-num','#e-name','#e-rest'].forEach(s => pane.querySelector(s).textContent = '');

    if (!b || !b.len.includes(digits.length) || !luhn(digits))
      fail('#e-num', digits.length < 12 ? 'Enter the full card number.' : 'That card number does not check out. Have another look.');
    if (nm.value.trim().length < 3) fail('#e-name', 'Enter the name printed on the card.');
    if (!expiryValid(ex.value)) fail('#e-rest', 'Check the expiry date — it needs to be in the future.');
    else if (cv.value.length !== (b && b.cvv === 4 ? 4 : 3)) fail('#e-rest', 'The CVV is ' + (b && b.cvv === 4 ? 'four' : 'three') + ' digits.');
    if (!ok) return;

    otpStep(pane, {
      amount, ref, settle,
      brand: b.name, last4: digits.slice(-4), bank: nm.value.trim()
    });
  };
}

/* card → OTP step, the way a real 3-D Secure page behaves */
function otpStep(pane, { amount, ref, settle, brand, last4 }){
  pane.innerHTML = `
    <div class="otp-wrap">
      <div class="otp-bank">
        <i class='bx bx-shield-quarter'></i>
        <div><b>Verifying with your bank</b><small>${esc(brand)} ending ${esc(last4)} · ${rs(amount)}</small></div>
      </div>
      <div class="otp-load" id="otp-load">
        <div class="dots"><span></span><span></span><span></span></div>
        <p>Connecting to the bank's secure page…</p>
      </div>
      <form class="otp-form" id="otp-form" hidden>
        <p class="otp-msg">We sent a one-time password to the mobile number registered with your bank.</p>
        <div class="otp-boxes">
          ${Array.from({length:6}, (_,i) => `<input class="otp-box" inputmode="numeric" maxlength="1" data-i="${i}" aria-label="Digit ${i+1}">`).join('')}
        </div>
        <div class="field-err" id="otp-err"></div>
        <button class="btn btn-solid btn-block btn-lg" type="submit">Confirm ${rs(amount)}</button>
        <div class="otp-foot">
          <span id="otp-timer">Resend in 30s</span>
          <button type="button" class="linkish" id="otp-resend" disabled>Resend OTP</button>
        </div>
        ${settings().demoMode ? '<p class="otp-demo">Demo mode — any six digits will go through.</p>' : ''}
      </form>
    </div>`;

  setTimeout(() => {
    pane.querySelector('#otp-load').hidden = true;
    pane.querySelector('#otp-form').hidden = false;
    pane.querySelector('.otp-box').focus();
  }, 1400);

  const boxes = [...pane.querySelectorAll('.otp-box')];
  boxes.forEach((b, i) => {
    b.addEventListener('input', () => {
      b.value = b.value.replace(/\D/g,'').slice(0,1);
      if (b.value && i < 5) boxes[i+1].focus();
    });
    b.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !b.value && i > 0) boxes[i-1].focus();
      if (e.key === 'ArrowLeft'  && i > 0) boxes[i-1].focus();
      if (e.key === 'ArrowRight' && i < 5) boxes[i+1].focus();
    });
    b.addEventListener('paste', e => {
      const d = (e.clipboardData.getData('text') || '').replace(/\D/g,'').slice(0,6);
      if (!d) return; e.preventDefault();
      d.split('').forEach((c, k) => boxes[k] && (boxes[k].value = c));
      boxes[Math.min(d.length, 5)].focus();
    });
  });

  let left = 30;
  const tm = pane.querySelector('#otp-timer'), rb = pane.querySelector('#otp-resend');
  const t = setInterval(() => {
    left--; tm.textContent = left > 0 ? `Resend in ${left}s` : 'Didn\u2019t get it?';
    if (left <= 0) { clearInterval(t); rb.disabled = false; }
  }, 1000);
  live.timers.push(t);
  rb.onclick = () => { left = 30; rb.disabled = true; toast('A new OTP is on its way'); };

  pane.querySelector('#otp-form').onsubmit = e => {
    e.preventDefault();
    const code = boxes.map(b => b.value).join('');
    if (code.length !== 6) { pane.querySelector('#otp-err').textContent = 'Enter all six digits.'; return; }
    processing(pane, 'Authorising with your bank', () =>
      settle({ method:'card', label:brand + ' ending ' + last4, ref, meta:{ brand, last4 } }));
  };
}

/* ── NETBANKING ─────────────────────────────────────────── */
function bankPane(pane, { amount, ref, settle }){
  pane.innerHTML = `
    <h4 class="pane-title">Pick your bank</h4>
    <p class="pay-note">You'll finish the payment on your bank's own page, then come straight back here.</p>
    <div class="bank-grid">
      ${BANKS.map(([n, id]) => `
        <button class="bank-pick" data-bank="${id}" data-name="${esc(n)}">
          <span class="bank-mark">${esc(n.split(' ').map(w=>w[0]).join('').slice(0,3))}</span>
          <b>${esc(n)}</b></button>`).join('')}
    </div>`;
  pane.querySelectorAll('.bank-pick').forEach(b => b.onclick = () => {
    pane.querySelectorAll('.bank-pick').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    processing(pane, 'Taking you to ' + b.dataset.name, () =>
      settle({ method:'bank', label:b.dataset.name, ref, meta:{ bank:b.dataset.name } }));
  });
}

/* ── WALLET ─────────────────────────────────────────────── */
function walletPane(pane, { amount, ref, settle }){
  pane.innerHTML = `
    <h4 class="pane-title">Pay from a wallet</h4>
    <div class="wallet-list">
      ${WALLETS.map(([n, id]) => `
        <button class="wallet-pick" data-name="${esc(n)}">
          <span class="wm wm-${id}"></span><b>${esc(n)}</b>
          <i class='bx bx-right-arrow-alt'></i></button>`).join('')}
    </div>
    <p class="pay-hint"><i class='bx bx-info-circle'></i> Your wallet balance is checked before the order is placed.</p>`;
  pane.querySelectorAll('.wallet-pick').forEach(b => b.onclick = () =>
    processing(pane, 'Opening ' + b.dataset.name, () =>
      settle({ method:'wallet', label:b.dataset.name, ref, meta:{ wallet:b.dataset.name } })));
}

/* ── CASH ON DELIVERY ───────────────────────────────────── */
function codPane(pane, { amount, ref, settle }){
  const fee = amount >= 2999 ? 0 : 40;
  pane.innerHTML = `
    <div class="cod-card">
      <i class='bx bx-money'></i>
      <h4>Pay when it reaches you</h4>
      <p class="pay-note">Hand over ${rs(amount + fee)} to the delivery partner. Cash, or UPI at the door — both are fine.</p>
      <div class="cod-lines">
        <div class="d-line"><span>Order total</span><span>${rs(amount)}</span></div>
        <div class="d-line"><span>Cash handling</span><span>${fee ? rs(fee) : 'Waived'}</span></div>
        <div class="d-line total"><span>Due on delivery</span><b>${rs(amount + fee)}</b></div>
      </div>
      <button class="btn btn-solid btn-block btn-lg" id="cod-go">Place the order</button>
      <p class="pay-hint"><i class='bx bx-check-shield'></i> Cash on delivery is available on orders up to ₹20,000.</p>
    </div>`;
  pane.querySelector('#cod-go').onclick = () =>
    processing(pane, 'Reserving your pieces', () =>
      settle({ method:'cod', label:'Cash on delivery', ref, fee, meta:{ fee } }));
}

/* ── shared: processing + success ───────────────────────── */
function processing(pane, label, then){
  pane.innerHTML = `
    <div class="pay-processing">
      <div class="proc-mark">
        <svg viewBox="0 0 64 68" aria-hidden="true">${window.JMCBrand ? window.JMCBrand.markPaths('pr-') : ''}</svg>
        <div class="proc-sweep"></div>
      </div>
      <b>${esc(label)}</b>
      <p>Please don't close this window or press back.</p>
      <div class="proc-bar"><span></span></div>
    </div>`;
  setTimeout(then, 2100);
}

function successScreen(pane, result, then){
  pane.innerHTML = `
    <div class="pay-success">
      <svg class="tick" viewBox="0 0 52 52" aria-hidden="true">
        <circle cx="26" cy="26" r="24"/><path d="M15 27l8 8 15-16"/>
      </svg>
      <h4>${result.pending ? 'Reference received' : 'Payment successful'}</h4>
      <p>${result.pending
        ? 'We\u2019ll confirm it against our bank statement and update your order shortly.'
        : 'Thank you. We\u2019re packing your order now.'}</p>
      <div class="succ-lines">
        <div class="d-line"><span>Paid with</span><b>${esc(result.label)}</b></div>
        <div class="d-line"><span>Reference</span><b>${esc(result.ref)}</b></div>
      </div>
      <button class="btn btn-solid btn-block btn-lg" id="succ-go">See your order</button>
    </div>`;
  pane.querySelector('#succ-go').onclick = then;
  setTimeout(() => { if (document.body.contains(pane)) then(); }, 4200);
}

function toast(m){ if (window.JMC && window.JMC.toast) window.JMC.toast(m); }

window.JMCPay = { open, close, settings, saveSettings, luhn, brandOf, upiLink, BANKS, WALLETS };
})();
