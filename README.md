# Jay Mataji Creation — website

Poori working e-commerce website. Koi backend, database ya install ki zaroorat nahi —
`index.html` ko browser me kholo aur chalu ho jayegi.

> **Chhota sa mashwara:** agar ho sake to folder ko ek chhote local server se kholna —
> folder me terminal khol kar `python3 -m http.server`, phir browser me
> `http://localhost:8000`. Sidha `file://` se bhi chalti hai, lekin kuch browsers
> `file://` par localStorage band kar dete hain, tab login aur cart save nahi hota.
> Server se sab kuch chalta hai.

---

## Login karne ke liye

**Admin (dashboard ke liye)**

```
Email     admin@jaymataji.com
Password  Mataji@2026
```

Login page par "Fill these in for me" button bhi hai.

**Customer** — `signup.html` se apna naya account bana lo. Jitne chaho utne ban sakte hain.

> Password plain text me save nahi hota — SHA-256 hash hota hai.

---

## Naya kya hai

### 1 · Logo — naya monogram

Purana "JMC" wala seal hata diya. Ab mark hai: **torana (mandir ka arch)**, uske andar
**kamal ki jyot**, aur kandhe par **abhla (sheeshe) ke dot**. Poora SVG path se bana hai,
kisi font par depend nahi karta — isliye har screen aur har size par ek jaisa dikhta hai
(header me 42px, intro me 124px, dono me saaf).

Badalna ho to: `assets/js/brand.js` ke sabse upar `ARCH_OUT`, `PETAL_C` wagairah paths hain.
Rang `assets/css/luxe.css` ke section 1 me.

### 2 · Opening animation

Website pehli baar khulte hi poori screen par:
zari ring ghoomti hai → arch khud draw hota hai → kamal ki pankhudiyan khilti hain →
**Jay Mataji / Creation** naam ubharta hai → phir parda do taraf khul kar site dikhti hai.

- **Skip intro** button hai, `Esc` se bhi band ho jata hai
- Ek session me ek hi baar chalta hai — har page par nahi, wo pareshan karta hai
- Dobara dekhna ho to **footer me "Play the opening again"** link hai
- Jis user ne phone ya laptop me "reduce motion" on kiya hai, uske liye apne aap band

### 3 · Carousel — teen jagah

| Kahan | Kya |
|---|---|
| Home ka hero | 4 slides, apne aap chalta hai, arrows + dots + swipe, har slide ka apna text aur button |
| Home ke products | 8 pieces ki rail — arrow se aage-peeche, phone par ungli se swipe |
| Product page | Photo carousel — thumbnails, swipe, arrows, aur click karke **4K zoom** |

### 4 · Payment — UPI, card, netbanking, wallet, cash

Checkout par "Pay" dabate hi poora payment sheet khulta hai:

- **UPI** — **asli QR code** jo browser me hi banta hai, koi internet ya library nahi.
  Saath me GPay / PhonePe / Paytm / BHIM ke buttons — phone par seedha app khulta hai.
  5 minute ka timer, UPI ID copy karne ka button, aur live status.
- **Card** — 3D card preview jo type karte hi bharta hai aur CVV par palat jata hai.
  Number Luhn check se guzarta hai, Visa / Mastercard / RuPay / Amex apne aap pehchana
  jata hai, expiry aur CVV check hote hain, phir bank ka OTP screen.
- **Netbanking** — 10 bank
- **Wallet** — Paytm, PhonePe, Amazon Pay, Mobikwik
- **Cash on delivery** — ₹2,999 se upar handling charge free

> **Card ka number kabhi save nahi hota.** Sirf aakhri 4 digit order me rakhe jate hain.

---

## Demo mode — ye zaroor padhein

By default **demo mode ON** hai. Matlab payment turant "successful" ho jata hai aur
**asli paisa nahi katta**. Ye isliye hai taki aap poori website aaram se test kar sako.
Payment sheet me upar peela **"Demo mode"** chip dikhta rehta hai.

**Asli payment lena shuru karne ke liye:**

1. Admin dashboard → **Payments** tab
2. Apni **UPI ID** daalo (jaise `jaymataji@okaxis`) aur woh naam jo customer ke app me dikhe
3. **Demo mode** ka tick hata do → **Save payment settings**

Ab customer ko jo QR dikhega wo **aapki apni UPI ID ka asli request** hoga. Payment karne
ke baad wo apna **12-digit UTR** daalega, aur wo order admin ke Payments tab me
**"Waiting on your check"** me aa jayega — aap bank statement se mila kar
**"Mark as received"** daba dena.

> Card, netbanking aur wallet se asli paisa lena ho to ek payment gateway
> (Razorpay, Cashfree, PayU) lagana padega, aur uske liye server chahiye.
> UPI QR wala tarika bina server ke bhi asli chalta hai.

---

## Pages

| File | Kya hai |
|---|---|
| `index.html` | Home — hero carousel, categories, product rail, numbers, process, bridal, reviews |
| `shop.html` | Collection — category, price, size, stock filter + search + sort |
| `product.html` | Product detail — photo carousel, 4K zoom, size/colour, review likhna |
| `cart.html` | Bag + 3-step checkout → payment sheet |
| `orders.html` | Mere orders — live status tracker, cancel, order again |
| `profile.html` | Profile — details edit, addresses, stats, password change |
| `wishlist.html` | Saved pieces |
| `gallery.html` | Atelier — 15 photos, 4K lightbox (arrow keys chalti hain) |
| `about.html` | Our story |
| `contact.html` | Contact form (seedha admin inbox me jata hai) + FAQ |
| `admin.html` | Dashboard — overview, orders, products, customers, inbox, reviews, **payments** |

---

## Profile aur bag — right corner

Header ke right corner me, jaisa aapne kaha:

- **Theme button** — light ⇄ dark
- **Wishlist** — count badge ke saath
- **Bag** — count badge, click karne par cart drawer khulta hai
- **Avatar** — user ke naam ke initials. Click karo to dropdown me **naam + email**
  dikhta hai, aur My profile / My orders / Wishlist / My bag /
  Admin dashboard (sirf admin ko) / Sign out ke links.

Jo bhi user kharidta hai wo `orders.html` me aata hai aur `profile.html` ke stats
(orders, pieces, total spent) me count hota hai.

---

## Real-time kaise chalta hai

Do tabs kholo — ek me admin, dusre me customer:

- Admin order ka status badle → customer ke **My orders** par tracker turant aage badhta hai
- Admin stock badle ya naya product add kare → **shop page** turant update
- Customer order place kare → admin ke **KPI, chart aur activity feed** turant update

Ye `BroadcastChannel` + `storage` event se hota hai, bina refresh ke.

---

## Photos

Sab photos 4K me hain (`3840px` long edge). Har photo ke 3 size banaye hain —
`-960`, `-1920`, `-4k` — aur `srcset` laga hai, taki phone par site tez chale aur
bade screen par poori quality mile. Gallery ka lightbox hamesha `-4k` kholta hai.

> Original files 1800px ke the. Unhe Lanczos + sharpening se 4K par upscale kiya gaya hai —
> resolution poori 4K hai, lekin jo detail original me nahi thi wo naye sire se nahi
> banai ja sakti. Agar aapke paas asli camera originals hain to `assets/img/` me wahi
> daal dena, sab apne aap chalega.

---

## Files

```
assets/css/style.css    design system — colours, type, layout
assets/css/luxe.css     logo, intro, carousels, payment sheet, motion
assets/js/data.js       product catalogue
assets/js/brand.js      logo geometry + opening sequence
assets/js/qr.js         QR encoder (Reed-Solomon, versions 1-10) — UPI ke liye
assets/js/carousel.js   hero slider, product rail, photo carousel
assets/js/payments.js   payment sheet — UPI, card, netbanking, wallet, COD
assets/js/app.js        core — auth, cart, orders, real-time, header aur footer
assets/js/fx.js         scroll progress, reveals, tilt, counters, parallax
```

## Kuch badalna ho to

- **Products** — `assets/js/data.js`, ya admin dashboard se add / edit / delete
- **Colours** — `assets/css/style.css` ke sabse upar `:root` aur `[data-theme="dark"]`
- **Address, phone, email** — `assets/js/app.js` ke `renderFooter()` me, aur `contact.html`
- **Logo** — `assets/js/brand.js`
- **Hero slides** — `index.html` ke neeche `JMCCarousel.hero(...)` wali list
- **UPI ID** — admin dashboard → Payments

Products reset karne ho to browser console me: `localStorage.removeItem('jmc_products')`

---

## Data kahan store hota hai

Sab kuch browser ke `localStorage` me — users, orders, products, cart, wishlist,
reviews, messages, payment settings. Iska matlab:

- Site bina server ke poori chalti hai — demo, client ko dikhane, testing ke liye perfect
- Data usi browser me rehta hai. Alag phone ya laptop par alag data hoga.

Agar asli online shop chahiye — sab devices par ek hi data, payment gateway, email —
to `assets/js/app.js` ke `read` / `write` functions ko API calls se badalna hoga.
Baaki poora UI waisa hi rahega.
