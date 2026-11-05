# Dukaan

Quick-commerce grocery app for a local store in Kothri Kalan, Madhya Pradesh, serving locals and
college students. Customers browse and order, the store admin manages stock and orders, and
delivery partners see only the orders assigned to them.

> **Status:** early. Sign-in (phone OTP, email verification) is built; the storefront, admin and
> delivery screens are being built. The Vercel deployment from this repo is **staging**, not the
> real store.

## Stack

SvelteKit 3 + Svelte 5, Convex (database, functions, storage, realtime), Better Auth running inside
Convex, Tailwind CSS 4 + Bits UI, Resend for email, pnpm.

## Run it locally

You need Node 22+, pnpm and a free [Convex](https://convex.dev) account.

```sh
pnpm install
npx convex dev          # first run logs you in, creates a dev deployment, writes .env.local; keep it running
```

In another terminal, set the backend's environment variables (they live on the Convex deployment,
not in `.env.local`):

```sh
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
npx convex env set BETTER_AUTH_ALLOWED_HOSTS "localhost:5173"
npx convex env set BETTER_AUTH_FALLBACK_URL "http://localhost:5173"

# Phone sign-in without a real SMS provider: codes are printed in `npx convex logs`
npx convex env set OTP_CHANNELS console
npx convex env set OTP_ALLOW_CONSOLE true

# Email verification (Resend). Without a verified domain, mail only reaches your own Resend address
npx convex env set RESEND_API_KEY re_...
npx convex env set EMAIL_SEND_FROM "Dukaan <onboarding@resend.dev>"
```

Then `pnpm dev` and open http://localhost:5173/signin.

## Checks

```sh
pnpm check                         # Svelte + TypeScript
npx tsc -p src/convex --noEmit     # Convex functions
pnpm build                         # needs PUBLIC_CONVEX_URL and PUBLIC_CONVEX_SITE_URL set
```

These run on every pull request in CI and must pass before merging to `main`.

## Contributing

Branch, open a PR, wait for CI to pass, merge to `main`. Merging to `main` deploys staging.
Never commit secrets: this repository is public, and secrets belong in Convex or Vercel
environment variables.

## Docs

| | |
| --- | --- |
| [`docs/README.md`](./docs/README.md) | Index of the developer docs |
| [`docs/02-getting-started.md`](./docs/02-getting-started.md) | Full local setup and env vars |
| [`docs/06-phone-otp.md`](./docs/06-phone-otp.md) | Phone sign-in and SMS/WhatsApp delivery |
| [`docs/07-email-verification.md`](./docs/07-email-verification.md) | Resend and email verification |
| [`docs/08-environments-and-deployment.md`](./docs/08-environments-and-deployment.md) | Staging, CI/CD, moving to production |
| [`AGENTS.md`](./AGENTS.md) | Conventions for AI coding agents and contributors |
