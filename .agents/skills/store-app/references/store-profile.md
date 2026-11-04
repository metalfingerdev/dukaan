# Store profile: Dukaan

The only file in this skill that is specific to the store. Everything else is the same in the
template. Values marked **TODO (dictate)** haven't been decided: don't invent them. Put a
placeholder in one named constant (`src/convex/model/store/storeProfile.ts`, which the seed copies
into the `storeSettings` row; it sits under `src/convex` because Convex code imports it, and the
frontend reaches it as `#convex/model/store/storeProfile.js`), say so in your report, and ask when
it affects behaviour. The current placeholders are the `TODO (dictate)` lines in that file.

## What's known

- **Store**: one local grocery store, called Dukaan in the app, in **Kothri Kalan, Madhya Pradesh**.
- **Customers**: locals (families, shops nearby) and **college students** (hostels and PGs). Expect
  many first-time online shoppers and mostly Android phones on mobile data.
- **Model**: quick commerce for a small area. The store packs and dispatches from its own shelves
  with its own delivery partners; there is no warehouse network.
- **Currency**: INR, prices tax-inclusive. Amounts formatted with the `en-IN` locale.
- **Sign-in**: phone OTP first (Indian mobiles only), email as a fallback
  (`docs/06-phone-otp.md`, `docs/07-email-verification.md`).
- **Payment now**: cash on delivery and UPI on delivery. Online payment comes later.
- **People**: the founder is the only employee and the store admin; other developers contribute
  through pull requests (`AGENTS.md`).
- **Environments**: the Vercel site is *staging*; the real store launches later on its own domain
  (`docs/08-environments-and-deployment.md`).

## To dictate

| Item | Value | Used for |
| --- | --- | --- |
| Name on the shop signboard | **Dukaan** (decided for now; confirm the signboard name before invoices) | header, invoices, SMS text |
| Opening and closing time (IST) | **TODO (dictate)** | `opensAtMinute`/`closesAtMinute`, checkout gate |
| Typical delivery time | **TODO (dictate)** | `etaMinutes`, the header pill |
| Delivery areas: localities, colleges, hostels | **TODO (dictate)** | `deliveryAreas`, address form |
| Delivery fee, free-delivery threshold | **TODO (dictate)** | `priceCart` |
| Small-cart fee and its threshold | **TODO (dictate)** | `priceCart` |
| Minimum order | **TODO (dictate)** | checkout check |
| Product categories to start with | **Decided**: Fruits & Vegetables, Dairy & Eggs, Atta/Rice/Dal, Snacks & Biscuits, Beverages, Instant Food & Noodles, Personal Care, Household & Cleaning, Stationery (the seeded demo set; the founder edits them in the admin screens later) | seed data, home grid |
| Languages in the UI | **Decided**: English only, Hindi-ready (all text in `src/lib/store/strings.ts`) | `strings.ts` |
| Brand colours and logo | **TODO (dictate)** | Skeleton theme in `src/app.css` / `src/themes/` |
| Number of delivery partners at launch | **TODO (dictate)** | `/admin/delivery` seed |
| Store phone number for customers | **TODO (dictate)** | cancel/help text |
| UPI id (VPA) for payments | **TODO (dictate)** | UPI on delivery |
| GST: registered? GSTIN? composition scheme? | **TODO (dictate)**, confirm with the CA | invoice tax columns |
| Invoice prefix (≤ 3 letters, so numbers stay within 16 characters) | `DK` (proposed) | invoice numbers |
| Legal name and address for invoices | **TODO (dictate)** | invoice header |
| Slots or ASAP only | **Decided**: ASAP plus one-hour slots, at least 30 minutes' notice, today only, no capacity limit (`SLOT_MINUTES`, `SLOT_NOTICE_MINUTES`) | checkout "Delivery" block |
| Tips for delivery partners? How partners are paid? | **TODO (dictate)** | out of scope until answered |

When the user dictates values, update this table first, then the code constants and the seed.

## Decisions already made (don't re-ask)

- **Direction**: a Blinkit-style quick-commerce app. Mechanics are fine; Blinkit's name, logo,
  colours and screens are not. **Function first, visual design last** (the look will be inspired by
  slothbytes.dev, but only at the end).
- **Delivery people are store employees** in a very small town and **phone the customer**. So the
  customer's phone number and a landmark matter more than a perfect pin.
- **Maps** (changed 2026-11-04): **every saved address needs a pin**. Kothri Kalan is a village with
  few street names or house numbers, so the rider finds the door from the pin first and the phone
  call second. The address form opens with "Where should we come?": the map in satellite view,
  starting at the customer's location, or, without a Maps key, "Use my current location". The
  server refuses an address without a pin (`PIN_REQUIRED`) and an order to an address saved before
  this rule; checkout offers "Add the pin". Customers still pick a named area (**no coverage
  radius**), may paste a Google Maps link, and can "Send my current location" from an open order,
  which moves the rider's pin live. The rider sees a small satellite view of the pin, and orders
  without a pin are flagged on the board and the rider's list. The map parts appear only when
  `PUBLIC_GOOGLE_MAPS_API_KEY` is set; Google requires a billing account for the Maps APIs, so cap
  the key with a daily API quota (a budget alert only emails). The founder is creating the key.
  **No live rider tracking** until there is a rider app that can report location in the background
  (a web page stops reporting when the screen locks).
- **Payment**: cash on delivery or UPI on delivery. **UPI goes through Razorpay** (chosen
  2026-11-04): a single-use QR fixed to the order total, confirmed only by Razorpay's signed webhook
  or a status check against Razorpay, never by the rider's word or by the owner reading the bank
  statement (that manual design was tried and rejected). Until Razorpay enables QR Codes on the
  account, the rider can only mark cash. Customers can also pay online at checkout (step 7), with
  refunds through Razorpay when a paid order is cancelled.
- **Tests**: very few, and only tests that fail when behaviour breaks: security refusals, money and
  stock correctness, real invariants. No tests that restate a table, a string or static data.
  Pages are checked by the Playwright suite in `tests/e2e`, run locally against the dev deployment
  only, not in CI (`docs/09-testing.md`). Each new screen adds its spec there.
- **Workflow**: one branch and one draft PR per piece; the founder merges; merging to `main`
  deploys staging.
- **Real store values go in through the admin, not the repo.** The placeholders in
  `storeProfile.ts` stay; the founder types the real hours, fees, areas, store phone and UPI id in
  `/admin/settings`. The repo is public, so the phone and UPI id never belong in it.
- **Products**: entered one by one in the admin *and* by CSV import. A CSV import asks what its
  stock column means for existing products: leave stock alone (default), add as received, or set
  to a counted number. A count becomes *count − what placed/accepted orders hold* (those items are
  still on the shelf), and the import stops if stock changed between preview and apply.

## Status (what exists)

Built and live on staging: auth and admin user dashboard; store tables and access guards;
catalogue, search and the seeded demo catalogue; cart (guest and signed-in, merge on sign-in);
saved addresses with optional pin, Maps link and Myself/Someone else; checkout with slots; the
order engine (`placeOrder`, `cancelOrder`, stock and status helpers, rate limits); `/orders` and
live `/orders/[id]` with the delivery code.

Step 1 is **complete** (PRs #10, #12, #13, #14). The admin area has a layout and nav, `/admin` (home with the open/closed
switch, until the order board), `/admin/settings` (hours, ETA, fees, minimum order, delivery areas,
store phone, UPI id), `/admin/users` (the user dashboard, moved from `/admin`),
`/admin/categories` (add, rename, hide, reorder) and `/admin/products` (list by category or name,
add, edit, photo; opening stock only on creation). A hidden category hides its products from
customers everywhere (`isProductVisible` in `model/store/publicProjection.ts`), and `placeOrder`
treats such a line as unavailable. Products and categories are hidden, never deleted. Category
photos are not built. On `/admin/products` each row has a Stock panel (Received, Damaged, a shelf
count and the last 20 changes) and the list has Low stock / Out of stock filters; every change goes
through `adjustStock` (`store/admin/stock.ts`). A count sets stock to *count minus what placed and
accepted orders hold* (`heldByOpenOrders`) and is refused if the stock moved since it was shown.
`/admin/products/import` exports every product as CSV and imports one back (up to 1000 rows;
columns `slug,name,category,unit,price,mrp,stock,low_stock_at,max_per_order,featured,active,gst_rate,hsn`).
`planImport` (`model/store/productImport.ts`) is the one planner used by the preview and again by
`applyImport`, which is all or nothing. A blank cell keeps the value (a blank cell cannot clear
one); unknown categories are created; the stock column follows a per-import mode: leave alone
(default), add as received, or set to a counted number (count minus held), and `set` is refused if
stock moved since the preview.

End-to-end tests run against dev: the admin test user is in `ADMIN_USER_IDS` on the dev
deployment and `E2E_ADMIN_PHONE` / `E2E_CUSTOMER_PHONE` are in `.env.local` (never committed), so
`pnpm test:e2e` runs all specs, including `admin-products.spec.ts`. Playwright is **not** run on
every change: it is slow (~2 min) and has found only test bugs so far, so run it when a change
touches a screen it covers, or when asked.

**Not built**: the order board and anything for the
delivery partner, so **an order stays at "Order placed" forever**; payments beyond cash; invoices;
the designed UI.

## Step 2: the live order board (built)

`/admin` is the board (`src/lib/store/admin/OrderBoard.svelte`, `OrderCard.svelte`,
`RejectDialog.svelte`). Backend in `src/convex/store/admin/orders.ts`: `listOrders({ status })`,
`acceptOrder`, `packOrder`, `cancelOrder({ reason })`, all through `transitionOrder`.

- One `useQuery` per column (New, Accepted, Packed, Out for delivery). Under `lg` the columns are
  tabs with counts; from `lg` up all four show side by side.
- Card: number, age (`createClock`, 15 s), items, area, landmark, COD amount to collect, tap-to-call.
  A New order older than 5 minutes is highlighted. Accept / Mark packed / Reject (a dialog with the
  required reason and three quick-reason chips); Packed offers Cancel only.
- Alerts (`orderAlerts.svelte.ts`): toast, tab title flashing "(n) New order" while the tab is in the
  background, and a tone behind a "Sound off/on" switch kept in `localStorage`. The first list that
  loads is the baseline, so orders already waiting don't alert on page load.
- The open/closed switch sits above the board; the other admin pages are in the layout nav.
- Out for delivery cards show who has the order; the partner's own screens (step 4) do the rest.

## Roadmap (agreed order; each step is its own PR or small series)

The founder wants all three payment pieces, and they depend on the admin and partner screens, so
those come first. Ordered by what unblocks what.

1. **Admin: catalogue, stock and settings** (`admin.md`). Product, category and stock screens
   (stock through `adjustStock` only), and a settings page that replaces the placeholders: hours,
   fees, delivery areas, store phone, UPI id (**built**; `store/seed:setDeliveryAreas` is gone).
   The user dashboard moved from `/admin` to `/admin/users` (**built**). Categories, products with photos and the
   stock panel are **built**. CSV export and import with the stock modes above are **built**; step 1 is complete. *Needs from the founder:* real products with
   prices and stock, real hours and fees, the real delivery areas, the store phone number.
2. **Admin: the live order board** (**built**, see the section above). Columns by status, one-tap Accept, Reject (with a reason), Mark
   packed, Assign partner (step 3); new-order alert; all moves through `transitionOrder`. Orders finally move.
3. **Admin: delivery partners and cash settlement** (**built**). `/admin/delivery`: add a partner by
   phone number (matched to their verified sign-in phone), switch on or off, cash to settle per
   partner per India delivery day (`settleCash` refuses if the total changed since the admin saw it).
   On the board a packed card has a partner select and an "Out for delivery" button
   (`assignPartner`, `startDelivery`). Cash only appears once step 4 records `cashCollectedPaise`
   on delivery. *Needs:* the partners' real phone numbers, added in `/admin/delivery` on staging.
4. **Delivery-partner screens** (**built**, `delivery.md`). `/delivery` (to pick up, on the way,
   today's tally and cash to hand over) and `/delivery/orders/[id]`: big Collect line, tap-to-call,
   Maps button (saved pin, else the customer's Google Maps link, else a search on the address),
   items checklist, timeline, "Picked up", "Delivered" (the customer's 4-digit code, at most 5
   guesses per order per 10 minutes, and how the partner was paid) and "Couldn't deliver" with a
   reason. A failed delivery lands in a "Needs you" section on the admin board (Pack again or
   Cancel). The header shows a "Deliveries" link to partners. *Needs:* a partner signed in on a real
   phone to try it end to end.
5. **UPI on delivery** (**built**, waiting on Razorpay to enable QR Codes). When an unpaid order is
   out for delivery, the rider ("Customer paying by UPI? Show QR") or the customer (on their order
   page) asks for a QR; `store/upi.ts` creates a single-use Razorpay `upi_qr` fixed to the order
   total (`upiQrs` table, one payable QR per order, closes after 115 minutes, a new one after
   that). Razorpay's webhook (`/razorpay-webhook` in `http.ts`, HMAC-checked) or "Check payment"
   (asks Razorpay) records the payment; the order turns paid on both screens live. The rider can no
   longer claim UPI (`UPI_NOT_CONFIRMED`); only cash is cash to settle.
   `npx convex run store/upi:checkRazorpaySetup` tells whether the account can make QRs (test keys).
   *Needs:* Razorpay support to enable QR Codes (on 2026-11-04 the test keys worked but QR creation
   returned "The requested URL was not found"); the webhook (URL below) and
   `RAZORPAY_WEBHOOK_SECRET`; KYC and live keys for real payments. Refunds (a UPI-paid order that
   fails or is cancelled) are not built: refund from the Razorpay dashboard for now.
6. **Invoices** (**built**, with placeholder details). The number is given in `transitionOrder` when
   an order is delivered (`model/store/invoice.ts`): `<prefix>/<financial year>/<6 digits>`, from
   the `invoice:<FY>` counter in the same transaction, so cancelled orders leave no gaps; a new
   financial year (1 April, IST) starts again at 000001. The seller's details are copied onto the
   order when issued (`invoiceSeller`), so editing them later never rewrites an old invoice.
   Printable at `/orders/[id]/invoice` (customer) and `/admin/orders/[id]/invoice` (admin), full
   page or receipt size, "Print → Save as PDF". `/admin/orders` ("Past orders") lists delivered
   orders with their invoices. `/admin/settings` has an "Invoice details" form (legal name,
   address, GSTIN, prefix). Without a GSTIN (today) invoices print without tax columns; with one,
   the tax inside each price is shown (CGST/SGST halves, `splitInclusiveTax`) for products that have
   a GST rate. *Needs:* a decision with the founder's accountant on GST (registered? GSTIN?
   composition scheme? which items at what rate; whether fees are taxed; the wording, for example
   "Tax invoice" or "Bill of supply"), the legal name and full address. Don't assert tax rules in
   code or copy.
7. **Online payments through a payment gateway** (**built**, Razorpay, test mode). "Pay online now"
   at checkout creates the order as `awaiting_payment` (stock held, not on the board) and a Razorpay
   order (`onlinePayments` table, `store/payments.ts`); the order page opens Razorpay Checkout.
   The order becomes `placed` and paid only from Razorpay's signed webhook (`payment.captured` /
   `order.paid`) or a server-side check against Razorpay's API, never from the browser. Not paid
   within 15 minutes (plus 3 minutes' grace) → cancelled by a scheduled job, stock back; money that
   arrives after that is refunded. **Refunds**: cancelling any order paid through Razorpay (online
   or UPI QR) starts a full refund in `transitionOrder` (idempotent receipt per order); the order's
   `refund` tracks requesting → pending → processed/failed (webhook `refund.processed` /
   `refund.failed`). `/admin/payments` lists Razorpay payments with refunds; a failed refund is
   shown in red for a manual refund from the dashboard. `npx convex run store/upi:checkRazorpaySetup`
   checks keys, orders and UPI QR. *Needs:* on each deployment, the webhook in the Razorpay
   dashboard (URL `https://<deployment>.convex.site/razorpay-webhook`, events `payment.captured`,
   `order.paid`, `refund.processed`, `refund.failed`, `qr_code.credited`) and
   `RAZORPAY_WEBHOOK_SECRET`; UPI enabled by Razorpay for UPI in Checkout and QR at the door;
   KYC and live keys before real money.
8. **The designed UI**, last: colours, logo, layout, Hindi strings if wanted, inspired by
   slothbytes.dev and not by another company's branding.
   **In progress**, one screen per PR, founder reviews each (order: storefront, rider, admin, auth).
   Own colours in `src/themes/palette.css` (not Skeleton), headless parts from Bits UI (replacing
   Ark UI), shared parts as small components in `src/lib/ui`. Rules in AGENTS.md Conventions.
   Design scratch pad: `/demo` (`src/routes/demo`, `src/lib/demo`) has one static mock page per
   screen with a "this screen must" note; the founder edits the mocks and each real screen is built
   from its mock. It 404s on the real production site; delete it, Skeleton and Ark when the last
   area is done.

   **Storefront design, decided with the founder (2026-11-04)**. Why each: the founder reviewed
   screenshots at phone, tablet and 1920px and asked for these.
   - *Header* (`src/lib/store/ui/ShopHeader.svelte`), Blinkit-style mechanics with our branding.
     Laptop (lg up): one **full-width** sticky row, not held to the page content's width: brand |
     delivery time + open pill | search taking all free space | account links | cart button.
     Phone and tablet: two halves; the top (brand, delivery time, account) scrolls away, the bar
     with search (and cart from md) sticks. Why: a narrow search bar on wide screens looked empty,
     and a single crowded row overlapped on tablets.
   - *Colours*: appetite palette (tomato red-orange actions, turmeric gold accents, warm cream /
     warm brown-black neutrals, green only for open / fresh / in stock). Why: the founder asked for
     hunger-triggering colours; red, orange and yellow are the hues tied to appetite in
     food-delivery research.
   - *Borders are never black*; black is for text (`edge` utilities).
   - *Grids are fluid* (`auto-fill`), two product columns on a small phone up to seven or eight on
     a wide screen; the page content stops at 1536px, the header does not.
   - *Product cards are all the same height*: the stock line is always reserved and the "% off"
     pill sits on the photo, so the price row never wraps.
   - *Skeletons are drawn by the real components* (`ProductCard` with no product, `CategoryTiles`
     with no categories, the `bone` utility), never separate placeholder boxes. Why: the old
     skeletons had drifted away from the real layout.
   - *Emoji stand-ins* for products and categories without a photo (`src/lib/store/emoji.ts`,
     matched on words in the name). Real photos replace them.
   - *Cart opens over the page* as a sheet (Bits `Dialog`, `src/lib/ui/Sheet.svelte`; bottom sheet
     on a phone, side panel from md up) from the cart bar and the header cart button; `/cart`
     stays as the full page. Why: adding things should never take a customer off the shelves.
   - *Checkout is two columns on a laptop*: the form on the left, the bill and "Place order"
     sticky on the right. Dropdowns stay native `<select>` (cheap Android phones show their own
     picker; the e2e tests drive them).
   - *Confirmations are in-page dialogs* (Bits `AlertDialog`, `ConfirmDialog.svelte`), never the
     browser's `confirm()`: cancel order, delete address.
   - *Account menu* (`AccountMenu.svelte`, Bits `Popover`) and the sign-in `Modal` replace
     `UserButton` on the storefront; `UserButton` and the profile dialog stay for the old header
     until the auth area is redesigned. Orders, Admin and Deliveries links stay visible on phones.
   - *Rider screens* (`/delivery`): a slim `RiderHeader` (no search or cart), "Collect ₹…" as the
     biggest line on every card and on the delivery page, big green Call / Delivered and red
     Couldn't-deliver buttons, and the Delivered and Couldn't-deliver forms as bottom sheets
     (Bits `Dialog`). Why: one hand, on a bike, in sunlight.
   - *Not built*: a "call your delivery partner" button on order tracking, because the customer's
     order does not expose the partner's name or phone (riders phone customers). It needs a
     privacy decision first.

**Smaller items, any time**: the founder enters the real delivery areas, hours, fees and store
phone in `/admin/settings` on staging; create the Maps key (`docs/08-environments-and-deployment.md`); push or SMS
notifications (SMS to Indian numbers at scale needs TRAI DLT registration); bump the GitHub Actions versions that warn about Node 20;
a rider app if live tracking is ever wanted.
