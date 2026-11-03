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
| Name on the shop signboard | **TODO (dictate)** | header, invoices, SMS text |
| Opening and closing time (IST) | **TODO (dictate)** | `opensAtMinute`/`closesAtMinute`, checkout gate |
| Typical delivery time | **TODO (dictate)** | `etaMinutes`, the header pill |
| Delivery areas: localities, colleges, hostels | **TODO (dictate)** | `deliveryAreas`, address form |
| Delivery fee, free-delivery threshold | **TODO (dictate)** | `priceCart` |
| Small-cart fee and its threshold | **TODO (dictate)** | `priceCart` |
| Minimum order | **TODO (dictate)** | checkout check |
| Product categories to start with | **TODO (dictate)** | seed data, home grid |
| Languages in the UI | English, plus Hindi? **TODO (dictate)** | `strings.ts` |
| Brand colours and logo | **TODO (dictate)** | Skeleton theme in `src/app.css` / `src/themes/` |
| Number of delivery partners at launch | **TODO (dictate)** | `/admin/delivery` seed |
| Store phone number for customers | **TODO (dictate)** | cancel/help text |
| UPI id (VPA) for payments | **TODO (dictate)** | UPI on delivery |
| GST: registered? GSTIN? composition scheme? | **TODO (dictate)**, confirm with the CA | invoice tax columns |
| Invoice prefix (≤ 3 letters, so numbers stay within 16 characters) | `DK` (proposed) | invoice numbers |
| Legal name and address for invoices | **TODO (dictate)** | invoice header |
| Slots or ASAP only | **TODO (dictate)** | checkout "Delivery" block |
| Tips for delivery partners? How partners are paid? | **TODO (dictate)** | out of scope until answered |

When the user dictates values, update this table first, then the code constants and the seed.
