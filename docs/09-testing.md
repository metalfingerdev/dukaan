# Testing

Two layers, each for what it does best. Every test must be able to fail when the behaviour it
guards breaks. Don't add tests that restate a table, a string, static data or the implementation,
and don't test the same thing at both layers.

| Layer | Command | Runs in CI | What belongs here |
| --- | --- | --- | --- |
| Vitest (`*.test.ts` next to the code) | `pnpm test` | yes | Convex functions through `convex-test`: refusals (signed out, another user's data, admin-only), money (`placeOrder`, pricing thresholds), stock (holds, rollback, restore once), idempotency, what public queries may expose. Pure logic with real edge cases (IST day boundaries, slots, Maps-link safety). |
| Playwright (`tests/e2e/*.spec.ts`) | `pnpm test:e2e` | no | Real pages on a phone-sized Chromium against the **dev** deployment: which pages open for whom, the customer's path from category to a placed and cancelled order, admin screens changing what customers see. |

## Vitest

- Store tests use the shared harness in `src/convex/store/harness.testutils.ts`: `setupStore()`
  gives a fresh in-memory deployment with the demo catalogue and three callers (`alice`, `bob`,
  `admin`), plus `failure()` and product helpers.
- The access guards are replaced for every test in `src/convex/vitest.setup.ts`: convex-test
  doesn't mount the Better Auth component the real guards read. The stand-ins refuse a signed-out
  caller, take the user id from the session, and treat only the identity `admin` as the store
  admin. The real guards are covered by the Playwright suite.
- Files that must not be deployed or run as tests carry two dots (`vitest.setup.ts`,
  `harness.testutils.ts`): Convex ignores such names, and Vitest only runs `*.test.ts`.

## Playwright

The suite places and cancels orders and changes store settings, so it only runs against a dev
deployment. `playwright.config.ts` refuses to start unless `CONVEX_DEPLOYMENT` is a `dev:`
deployment and `PUBLIC_CONVEX_URL` points at the same one.

### One-time setup

1. The dev deployment needs the console OTP channel (never on staging or production):
   `npx convex env set OTP_CHANNELS console` and `npx convex env set OTP_ALLOW_CONSOLE true`.
2. Add test accounts to `.env.local` (gitignored). Use numbers that belong to test accounts on the
   dev deployment, never a real customer's:

   ```sh
   E2E_CUSTOMER_PHONE=+91XXXXXXXXXX
   E2E_ADMIN_PHONE=+91XXXXXXXXXX
   ```

   The admin account must be an admin on dev: set its role in `/admin/users` while signed in as an
   admin, or add its user id to `ADMIN_USER_IDS` on the dev deployment.
3. Browsers: `@playwright/test` is pinned; `pnpm exec playwright install chromium` fetches the
   matching Chromium if it isn't cached yet.

### Running

```sh
pnpm test:e2e                          # starts pnpm dev on :5173 unless it is already running
pnpm test:e2e tests/e2e/access.spec.ts # one file
```

The `setup` project seeds the demo catalogue (idempotent) and signs each account in once with
phone OTP. The code is read from `npx convex logs`, since the console channel prints it there. The
session is kept in `tests/e2e/.auth/<role>.json` and reused while it is valid.

Specs without the account they need are skipped and say why. `checkout.spec.ts` needs the store
open: with an admin account it opens the store all day and restores the hours afterwards; without
one it only runs inside the dev deployment's opening hours. Every spec puts back what it changes
and cancels the orders it places.
