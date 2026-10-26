/* ═══════════════════════════════════════════════════════════
   Raihan Islam— Core engine
   Store · Auth · Cart · Orders · Real-time sync · UI shell
   ═══════════════════════════════════════════════════════════ */
(function () {
'use strict';

const K = {
  users:'jmc_users', session:'jmc_session', products:'jmc_products',
  orders:'jmc_orders', carts:'jmc_carts', wish:'jmc_wish',
  reviews:'jmc_reviews', theme:'jmc_theme', msgs:'jmc_messages', settings:'jmc_settings'
};

/* ── storage helpers ─────────────────────── */
const read  = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const write = (k, v) => { localStorage.setItem(k, JSON.stringify(v)); ping(k); };

/* ── real-time bus: same tab + cross tab ─── */
const bus = ('BroadcastChannel' in window) ? new BroadcastChannel('jmc-live') : null;
const listeners = [];
function ping(key){
  const msg = { key, at: Date.now() };
  if (bus) bus.postMessage(msg);
  listeners.forEach(fn => { try { fn(key); } catch(e){ console.error(e); } });
}
if (bus) bus.onmessage = e => listeners.forEach(fn => { try { fn(e.data.key); } catch(err){} });
window.addEventListener('storage', e => { if (e.key && e.key.startsWith('jmc_')) listeners.forEach(fn => fn(e.key)); });
function onLive(fn){ listeners.push(fn); }

/* ── crypto ──────────────────────────────── */
async function hash(txt){
  if (window.crypto && crypto.subtle && location.protocol !== 'file:') {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt + '::jmc'));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
    } catch(e){ /* fall through */ }
  }
  let h = 5381; const s = txt + '::jmc';
  for (let i=0;i<s.length;i++) h = ((h<<5)+h+s.charCodeAt(i)) >>> 0;
  return 'f' + h.toString(16).padStart(8,'0');
}

/* ── money / ids ─────────────────────────── */
const rs  = n => '₹' + Number(n||0).toLocaleString('en-IN');
const uid = p => p + '-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,6).toUpperCase();
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ═══════ PRODUCTS ═══════ */
function products(){
  let p = read(K.products, null);
  if (!p || !p.length) { p = window.JMC_SEED_PRODUCTS.slice(); localStorage.setItem(K.products, JSON.stringify(p)); }
  return p;
}
const productBySku = sku => products().find(p => p.sku === sku);
function saveProducts(list){ write(K.products, list); }

/* ═══════ AUTH ═══════ */
function users(){ return read(K.users, []); }
function session(){ return read(K.session, null); }

async function seedAdmin(){
  const u = users();
  if (!u.some(x => x.role === 'admin')) {
    u.push({
      id: uid('U'), name:'Store Admin', email:'admin@jaymataji.com',
      phone:'+91 98250 00000', pass: await hash('Mataji@2026'),
      role:'admin', createdAt: Date.now(), addresses:[]
    });
    localStorage.setItem(K.users, JSON.stringify(u));
  }
}

async function signup({name,email,phone,password}){
  email = String(email||'').trim().toLowerCase();
  name  = String(name||'').trim();
  if (name.length < 2) throw new Error('Enter your full name.');
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) throw new Error('Enter a valid email address.');
  if (!/^[\d+\s-]{10,15}$/.test(String(phone||'').trim())) throw new Error('Enter a 10-digit mobile number.');
  if (String(password||'').length < 6) throw new Error('Password needs at least 6 characters.');
  const list = users();
  if (list.some(u => u.email === email)) throw new Error('This email is already registered. Sign in instead.');
  const user = { id: uid('U'), name, email, phone:String(phone).trim(),
                 pass: await hash(password), role:'customer', createdAt: Date.now(), addresses:[] };
  list.push(user); write(K.users, list);
  setSession(user);
  return user;
}

async function login(email, password){
  email = String(email||'').trim().toLowerCase();
  const u = users().find(x => x.email === email);
  if (!u) throw new Error('No account found with this email.');
  if (u.pass !== await hash(password)) throw new Error('Incorrect password. Try again.');
  setSession(u);
  return u;
}

function setSession(u){
  write(K.session, { id:u.id, name:u.name, email:u.email, role:u.role, phone:u.phone });
}
function logout(){ localStorage.removeItem(K.session); ping(K.session); }

function currentUser(){
  const s = session(); if (!s) return null;
  return users().find(u => u.id === s.id) || null;
}
function updateUser(patch){
  const s = session(); if (!s) return null;
  const list = users(); const i = list.findIndex(u => u.id === s.id);
  if (i < 0) return null;
  list[i] = { ...list[i], ...patch };
  write(K.users, list); setSession(list[i]);
  return list[i];
}
function requireAuth(next){
  if (session()) return true;
  sessionStorage.setItem('jmc_after_login', next || location.pathname.split('/').pop() || 'index.html');
  location.href = 'login.html';
  return false;
}

/* ═══════ CART (per user, guest supported) ═══════ */
const cartKey = () => { const s = session(); return s ? s.id : 'guest'; };
function allCarts(){ return read(K.carts, {}); }
function cart(){ return allCarts()[cartKey()] || []; }
function saveCart(items){ const a = allCarts(); a[cartKey()] = items; write(K.carts, a); }

function addToCart(sku, qty, size){
  const p = productBySku(sku); if (!p) return;
  qty = qty || 1;
  const items = cart();
  const key = sku + '|' + (size || p.sizes[0]);
  const found = items.find(i => i.key === key);
  if (found) found.qty = Math.min(found.qty + qty, 20);
  else items.push({ key, sku, name:p.name, price:p.price, img:p.img, size:size || p.sizes[0], qty });
  saveCart(items);
  toast(p.name + ' added to your bag', 'ok');
  bump();
}
function setQty(key, qty){
  const items = cart(); const it = items.find(i => i.key === key); if (!it) return;
  it.qty = Math.max(1, Math.min(20, qty)); saveCart(items);
}
function removeItem(key){ saveCart(cart().filter(i => i.key !== key)); toast('Removed from bag'); }
function clearCart(){ saveCart([]); }
const cartCount = () => cart().reduce((n,i) => n + i.qty, 0);
const cartTotal = () => cart().reduce((n,i) => n + i.price * i.qty, 0);

/* migrate guest bag into the user's bag on login */
function mergeGuestCart(userId){
  const a = allCarts(); const g = a.guest || []; if (!g.length) return;
  const mine = a[userId] || [];
  g.forEach(gi => { const m = mine.find(x => x.key === gi.key);
    if (m) m.qty = Math.min(20, m.qty + gi.qty); else mine.push(gi); });
  a[userId] = mine; a.guest = []; write(K.carts, a);
}

/* ═══════ WISHLIST ═══════ */
function wishlist(){ const w = read(K.wish, {}); return w[cartKey()] || []; }
function toggleWish(sku){
  const w = read(K.wish, {}); const k = cartKey(); const list = w[k] || [];
  const i = list.indexOf(sku);
  if (i >= 0) { list.splice(i,1); toast('Removed from wishlist'); }
  else { list.push(sku); toast('Saved to wishlist','ok'); }
  w[k] = list; write(K.wish, w);
  return list.includes(sku);
}

/* ═══════ ORDERS ═══════ */
const STATUSES = ['Placed','Confirmed','Packed','Shipped','Delivered','Cancelled'];
function orders(){ return read(K.orders, []); }
function myOrders(){ const s = session(); return s ? orders().filter(o => o.userId === s.id) : []; }

function placeOrder({items, address, payment, paymentLabel, paymentRef, paymentPending, total, shipping, user}){
  const list = orders();
  const order = {
    id: uid('JMC'), userId: user.id, userName: user.name, userEmail: user.email,
    phone: address.phone, items, address, payment,
    paymentLabel: paymentLabel || payment,
    paymentRef: paymentRef || null,
    paymentPending: !!paymentPending,
    subtotal: total, shipping, total: total + shipping,
    status: 'Placed', createdAt: Date.now(),
    timeline: [{ status:'Placed', at: Date.now() }]
  };
  list.unshift(order); write(K.orders, list);
  // reduce stock
  const ps = products();
  items.forEach(it => { const p = ps.find(x => x.sku === it.sku); if (p) p.stock = Math.max(0, p.stock - it.qty); });
  saveProducts(ps);
  clearCart();
  return order;
}
function setOrderStatus(id, status){
  const list = orders(); const o = list.find(x => x.id === id); if (!o) return;
  o.status = status; o.timeline.push({ status, at: Date.now() });
  write(K.orders, list);
}

/* ═══════ REVIEWS ═══════ */
function reviews(sku){ const r = read(K.reviews, {}); return sku ? (r[sku] || []) : r; }
function addReview(sku, { name, rating, text }){
  const r = read(K.reviews, {}); r[sku] = r[sku] || [];
  r[sku].unshift({ id: uid('R'), name, rating, text, at: Date.now() });
  write(K.reviews, r);
}

/* ═══════ MESSAGES (contact form → admin) ═══════ */
function messages(){ return read(K.msgs, []); }
function addMessage(m){ const l = messages(); l.unshift({ id: uid('M'), ...m, at: Date.now(), read:false }); write(K.msgs, l); }

/* ═══════ THEME ═══════ */
function theme(){ return localStorage.getItem(K.theme) || 'light'; }
function applyTheme(t){
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem(K.theme, t);
  const i = document.querySelector('#theme-btn i');
  if (i) i.className = t === 'dark' ? 'bx bx-sun' : 'bx bx-moon';
}
function toggleTheme(){ applyTheme(theme() === 'dark' ? 'light' : 'dark'); }
applyTheme(theme());

/* ═══════ TOAST ═══════ */
function toast(msg, kind){
  let stack = document.getElementById('toast-stack');
  if (!stack) { stack = document.createElement('div'); stack.id = 'toast-stack'; document.body.appendChild(stack); }
  const icons = { ok:'bx-check-circle', bad:'bx-error-circle' };
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || '');
  el.innerHTML = `<i class='bx ${icons[kind] || 'bx-info-circle'}'></i><span>${esc(msg)}</span>`;
  stack.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 2800);
}

/* ═══════ LOGO ═══════ */
/* The mark lives in brand.js so the header, footer, intro and
   payment sheet all draw exactly the same geometry. */
function logoSVG(){
  return window.JMCBrand ? window.JMCBrand.logoSVG()
    : '<svg class="brand-mark" viewBox="0 0 64 68"></svg>';
}

/* ═══════ HEADER ═══════ */
const NAV = [
  ['index.html','Home'], ['shop.html','Collection'], ['gallery.html','Atelier'],
  ['about.html','Our Story'], ['contact.html','Contact']
];

function renderHeader(active){
  const s = session();
  const initials = s ? s.name.trim().split(/\s+/).slice(0,2).map(w => w[0]).join('').toUpperCase() : '';
  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = `
    <div class="header-inner">
      <a href="index.html" class="brand-lockup" aria-label="Jay Mataji Creation home">
        ${logoSVG()}
        <span class="brand-words"><b>Raihan</b><span>islam</span></span>
      </a>
      <nav class="main-nav" id="main-nav">
        ${NAV.map(([h,l]) => `<a href="${h}" ${active===h?'class="active"':''}>${l}</a>`).join('')}
      </nav>
      <div class="header-tools">
        <button class="tool-btn" id="theme-btn" title="Switch theme" aria-label="Switch theme"><i class='bx bx-moon'></i></button>
        <a href="wishlist.html" class="tool-btn" title="Wishlist" aria-label="Wishlist">
          <i class='bx bx-heart'></i><span class="count-badge hide" id="wish-badge">0</span></a>
        <button class="tool-btn" id="cart-btn" title="Your bag" aria-label="Your bag">
          <i class='bx bx-shopping-bag'></i><span class="count-badge hide" id="cart-badge">0</span></button>
        <div class="profile-zone">
          ${ s ? `<div class="avatar" id="avatar" tabindex="0" role="button" aria-label="Your account">${esc(initials)}</div>
            <div class="profile-menu" id="profile-menu">
              <div class="pm-head">
                <div class="avatar">${esc(initials)}</div>
                <div class="pm-id">
                  <b>${esc(s.name)}</b><small>${esc(s.email)}</small>
                  ${s.role==='admin'?'<span class="pm-tag">Admin</span>':''}
                </div>
              </div>
              <div class="pm-links">
                <a href="profile.html"><i class='bx bx-user'></i> My profile</a>
                <a href="orders.html"><i class='bx bx-package'></i> My orders <span class="pm-stat" id="pm-orders"></span></a>
                <a href="wishlist.html"><i class='bx bx-heart'></i> Wishlist <span class="pm-stat" id="pm-wish"></span></a>
                <a href="cart.html"><i class='bx bx-shopping-bag'></i> My bag <span class="pm-stat" id="pm-bag"></span></a>
                ${s.role==='admin'?`<div class="divider"></div><a href="admin.html"><i class='bx bx-grid-alt'></i> Admin dashboard</a>`:''}
                <div class="divider"></div>
                <a href="#" class="danger" id="logout-link"><i class='bx bx-log-out'></i> Sign out</a>
              </div>
            </div>`
          : `<a href="login.html" class="btn btn-line btn-sm" style="margin-left:8px"><i class='bx bx-user'></i> Sign in</a>` }
        </div>
        <button class="burger" id="burger" aria-label="Menu" aria-expanded="false"><i class='bx bx-menu'></i></button>
      </div>
    </div>
    <div class="zari-thread"></div>`;
  document.body.prepend(header);

  applyTheme(theme());
  document.getElementById('theme-btn').onclick = toggleTheme;

  const burger = document.getElementById('burger'), nav = document.getElementById('main-nav');
  burger.onclick = () => { const o = nav.classList.toggle('open'); burger.setAttribute('aria-expanded', o);
    burger.innerHTML = `<i class='bx bx-${o?'x':'menu'}'></i>`; };

  const av = document.getElementById('avatar'), pm = document.getElementById('profile-menu');
  if (av) {
    const openMenu = e => { e.stopPropagation(); pm.classList.toggle('open'); };
    av.onclick = openMenu;
    av.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') openMenu(e); };
    document.addEventListener('click', e => { if (!pm.contains(e.target)) pm.classList.remove('open'); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') pm.classList.remove('open'); });
    document.getElementById('logout-link').onclick = e => {
      e.preventDefault(); logout(); toast('Signed out'); setTimeout(() => location.href = 'index.html', 500);
    };
  }
  document.getElementById('cart-btn').onclick = openDrawer;

  addEventListener('scroll', () => header.classList.toggle('shrunk', scrollY > 30), { passive:true });
  refreshCounts();
}

let lastCount = -1;
function refreshCounts(){
  const c = cartCount(), w = wishlist().length;
  const cb = document.getElementById('cart-badge'), wb = document.getElementById('wish-badge');
  if (cb) { cb.textContent = c; cb.classList.toggle('hide', c === 0);
    if (lastCount >= 0 && c !== lastCount) { cb.classList.remove('pop'); void cb.offsetWidth; cb.classList.add('pop'); }
    lastCount = c; }
  if (wb) { wb.textContent = w; wb.classList.toggle('hide', w === 0); }
  const po = document.getElementById('pm-orders'), pw = document.getElementById('pm-wish'), pb = document.getElementById('pm-bag');
  if (po) po.textContent = myOrders().length || '';
  if (pw) pw.textContent = w || '';
  if (pb) pb.textContent = c || '';
}
function bump(){ refreshCounts(); }

/* ═══════ CART DRAWER ═══════ */
function buildDrawer(){
  if (document.getElementById('cart-drawer')) return;
  const scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.id = 'scrim';
  const d = document.createElement('aside'); d.className = 'drawer'; d.id = 'cart-drawer';
  d.setAttribute('aria-label','Your bag');
  d.innerHTML = `
    <div class="drawer-head">
      <h3>Your bag</h3>
      <button class="tool-btn" id="drawer-x" aria-label="Close bag"><i class='bx bx-x'></i></button>
    </div>
    <div class="drawer-body" id="drawer-body"></div>
    <div class="drawer-foot" id="drawer-foot"></div>`;
  document.body.append(scrim, d);
  scrim.onclick = closeDrawer;
  document.getElementById('drawer-x').onclick = closeDrawer;
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
}
function openDrawer(){ buildDrawer(); paintDrawer();
  document.getElementById('scrim').classList.add('open');
  document.getElementById('cart-drawer').classList.add('open');
  document.body.style.overflow = 'hidden'; }
function closeDrawer(){
  const s = document.getElementById('scrim'), d = document.getElementById('cart-drawer');
  if (s) s.classList.remove('open'); if (d) d.classList.remove('open');
  document.body.style.overflow = ''; }

function paintDrawer(){
  const body = document.getElementById('drawer-body'), foot = document.getElementById('drawer-foot');
  if (!body) return;
  const items = cart();
  if (!items.length) {
    body.innerHTML = `<div class="empty-state"><i class='bx bx-shopping-bag'></i>
      <h4>Your bag is empty</h4><p>Pieces you add will appear here.</p>
      <a href="shop.html" class="btn btn-solid">Browse the collection</a></div>`;
    foot.innerHTML = ''; return;
  }
  body.innerHTML = items.map(i => `
    <div class="cart-row">
      <img src="assets/img/${i.img}-960.jpg" alt="${esc(i.name)}">
      <div class="cart-row-main">
        <h4>${esc(i.name)}</h4>
        <div class="sku">${esc(i.sku)} · Size ${esc(i.size)}</div>
        <div class="rs">${rs(i.price)}</div>
        <div class="qty">
          <button data-dec="${i.key}" aria-label="Decrease">−</button>
          <span>${i.qty}</span>
          <button data-inc="${i.key}" aria-label="Increase">+</button>
        </div>
      </div>
      <button class="row-x" data-del="${i.key}" aria-label="Remove"><i class='bx bx-x'></i></button>
    </div>`).join('');
  const sub = cartTotal(), ship = sub >= 2999 ? 0 : 99;
  foot.innerHTML = `
    <div class="d-line"><span>Subtotal</span><span>${rs(sub)}</span></div>
    <div class="d-line"><span>Delivery</span><span>${ship ? rs(ship) : 'Free'}</span></div>
    <div class="d-line total"><span>Total</span><b>${rs(sub + ship)}</b></div>
    <a href="cart.html" class="btn btn-solid btn-block">Review bag &amp; check out</a>`;
  body.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => { const k=b.dataset.inc; setQty(k, (cart().find(i=>i.key===k).qty)+1); });
  body.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => { const k=b.dataset.dec; setQty(k, (cart().find(i=>i.key===k).qty)-1); });
  body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => removeItem(b.dataset.del));
}

/* ═══════ FOOTER ═══════ */
function renderFooter(){
  const f = document.createElement('footer');
  f.className = 'site-footer';
  f.innerHTML = `<div class="wrap"><div class="foot-grid">
    <div class="foot-col foot-brand">
      <a href="index.html" class="brand-lockup" style="margin-bottom:20px">
        ${logoSVG()}<span class="brand-words"><b>Raiyan</b><span>islam</span></span></a>
      <p>A small Ahmedabad atelier making hand-embroidered kurtas, gowns and co-ord sets. Every piece is cut, stitched and finished by our own karigars.</p>
      <div class="socials">
        <a href="#" aria-label="Instagram"><i class='bx bxl-instagram'></i></a>
        <a href="#" aria-label="WhatsApp"><i class='bx bxl-whatsapp'></i></a>
        <a href="#" aria-label="Facebook"><i class='bx bxl-facebook'></i></a>
        <a href="#" aria-label="Pinterest"><i class='bx bxl-pinterest'></i></a>
      </div>
    </div>
    <div class="foot-col"><h5>Shop</h5>
      <a href="shop.html?cat=kurta">Kurta sets</a><a href="shop.html?cat=gown">Gowns</a>
      <a href="shop.html?cat=set">Co-ord sets</a><a href="shop.html?cat=bridal">Bridal</a>
      <a href="shop.html">Everything</a></div>
    <div class="foot-col"><h5>Account</h5>
      <a href="profile.html">My profile</a><a href="orders.html">Track an order</a>
      <a href="wishlist.html">Wishlist</a><a href="cart.html">My bag</a><a href="login.html">Sign in</a></div>
    <div class="foot-col"><h5>Reach us</h5>
      <p><i class='bx bx-map'></i> Maninagar, Ahmedabad, Gujarat 380008</p>
      <p><i class='bx bx-phone'></i> +91 98250 00000</p>
      <p><i class='bx bx-envelope'></i> care@jaymataji.com</p>
      <p><i class='bx bx-time'></i> Mon–Sat, 10am–8pm IST</p></div>
  </div>
  <div class="foot-bottom">
    <span>© ${new Date().getFullYear()} Jay Mataji Creation · Handmade in Gujarat</span>
    <span>Free delivery over ₹2,999 · 7-day exchange ·
      <a href="#" id="replay-intro" style="color:var(--gold)">Play the opening again</a></span>
  </div></div>`;
  document.body.appendChild(f);
  const ri = document.getElementById('replay-intro');
  if (ri) ri.onclick = e => { e.preventDefault(); if (window.JMCBrand) window.JMCBrand.runIntro(true); };
}

/* ═══════ SCROLL REVEAL ═══════ */
function revealOnScroll(){
  const io = new IntersectionObserver(en => en.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold:.12, rootMargin:'0px 0px -40px' });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
}

/* ═══════ PRODUCT CARD ═══════ */
function cardHTML(p){
  const off = p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0;
  const wished = wishlist().includes(p.sku);
  const stars = '★★★★★'.slice(0, Math.round(p.rating)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(p.rating));
  return `<article class="card reveal" data-sku="${p.sku}" data-cat="${p.cat}" data-price="${p.price}" data-name="${esc(p.name.toLowerCase())}">
    <div class="card-media">
      <a href="product.html?sku=${p.sku}">
        <img src="assets/img/${p.img}-960.jpg"
             srcset="assets/img/${p.img}-960.jpg 960w, assets/img/${p.img}-1920.jpg 1920w, assets/img/${p.img}-4k.jpg 3840w"
             sizes="(max-width:900px) 50vw, 25vw" alt="${esc(p.name)}" loading="lazy">
      </a>
      ${p.badge ? `<span class="tag ${p.badgeTone||''}">${esc(p.badge)}</span>` : ''}
      ${off ? `<span class="off-pill">−${off}%</span>` : ''}
      <button class="wish ${wished?'on':''}" data-wish="${p.sku}" aria-label="Save ${esc(p.name)}">
        <i class='bx bx${wished?'s':''}-heart'></i></button>
      <div class="card-actions">
        <button class="btn btn-solid" data-add="${p.sku}">Add to bag</button>
        <a class="btn btn-line" href="product.html?sku=${p.sku}">View</a>
      </div>
    </div>
    <div class="card-body">
      <h3>${esc(p.name)}</h3>
      <div class="card-sku">${p.sku}</div>
      <div class="rating-line"><span class="stars">${stars}</span><span>${p.reviews} ratings</span></div>
      <div class="price-line">
        <span class="price">${rs(p.price)}</span>
        ${p.mrp > p.price ? `<span class="mrp">${rs(p.mrp)}</span><span class="save">Save ${rs(p.mrp - p.price)}</span>` : ''}
      </div>
      <div style="margin-top:8px;font-size:11.5px;color:${p.stock>0?'var(--ok)':'var(--bad)'}">
        ${p.stock > 0 ? (p.stock < 5 ? 'Only ' + p.stock + ' left' : 'In stock') : 'Sold out'}</div>
    </div>
  </article>`;
}
function wireCards(root){
  (root || document).querySelectorAll('[data-add]').forEach(b => b.onclick = e => {
    e.preventDefault(); const p = productBySku(b.dataset.add);
    if (!p || p.stock <= 0) { toast('This piece is sold out', 'bad'); return; }
    addToCart(b.dataset.add, 1); openDrawer();
  });
  (root || document).querySelectorAll('[data-wish]').forEach(b => b.onclick = e => {
    e.preventDefault(); const on = toggleWish(b.dataset.wish);
    b.classList.toggle('on', on); b.querySelector('i').className = 'bx bx' + (on?'s':'') + '-heart';
  });
}

/* ═══════ BOOT ═══════ */
async function boot(active){
  await seedAdmin();
  products();
  renderHeader(active);
  buildDrawer();
  onLive(key => {
    if (key === K.carts || key === K.wish || key === K.orders) { refreshCounts(); paintDrawer(); }
    if (typeof window.onJMCLive === 'function') window.onJMCLive(key);
  });
  document.addEventListener('DOMContentLoaded', revealOnScroll);
  if (document.readyState !== 'loading') revealOnScroll();

  if (window.JMCBrand) window.JMCBrand.runIntro();
  document.addEventListener('jmc:intro-done', () => {
    if (window.JMCFX) window.JMCFX.refresh();
  });
}

window.JMC = {
  K, read, write, onLive, hash, rs, uid, esc,
  products, productBySku, saveProducts,
  users, session, currentUser, updateUser, signup, login, logout, requireAuth, mergeGuestCart,
  cart, addToCart, setQty, removeItem, clearCart, cartCount, cartTotal, saveCart,
  wishlist, toggleWish,
  orders, myOrders, placeOrder, setOrderStatus, STATUSES,
  reviews, addReview, messages, addMessage,
  theme, toggleTheme, toast, cardHTML, wireCards, renderFooter, revealOnScroll,
  openDrawer, closeDrawer, refreshCounts, logoSVG, boot,
  replayIntro: () => window.JMCBrand && window.JMCBrand.runIntro(true)
};
})();
