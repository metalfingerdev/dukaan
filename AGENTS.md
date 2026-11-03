<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`src/convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

# Dukaan

Quick-commerce grocery app for **one local store in Kothri Kalan, Madhya Pradesh**, serving locals
and college students. Three kinds of users share it: **customers** (browse, cart, order, track),
the **admin** (stock, prices, live orders, invoices; the founder and store staff) and **delivery
partners** (their assigned orders only). The auth foundation is built; the store itself (tables,
storefront, admin and delivery screens) is built with the `store-app` skill.

The founder is the only employee. Other developers contribute through pull requests.

## Stack

SvelteKit 3 + Svelte 5 (runes) + TypeScript, Convex (database, functions, storage, realtime),
Better Auth running inside Convex, Tailwind CSS 4 + Skeleton UI 5, Resend for email, pnpm.
Hosted on Vercel (staging for now).

## Commands

| Command | What it does |
| --- | --- |
| `pnpm install` | install (pnpm only; the version is pinned in `package.json`) |
| `npx convex dev` | sync `src/convex` to the dev deployment and regenerate types; keep it running |
| `pnpm dev` | SvelteKit dev server on http://localhost:5173 |
| `pnpm check` | type-check Svelte + TS (must be 0 errors) |
| `npx tsc -p src/convex --noEmit` | type-check the Convex functions |
| `pnpm test` | vitest, including `convex-test` for Convex functions (`*.test.ts` next to the code) |
| `pnpm build` | production build (needs `PUBLIC_CONVEX_URL` and `PUBLIC_CONVEX_SITE_URL` set) |

CI (`.github/workflows/ci.yml`) runs the four checks above on every PR. Run them before you say
something is done. Convex ignores file names with more than one dot, so `foo.test.ts` is never
deployed. In a `convex-test` file, anchor the `import.meta.glob` patterns at the project root
(`/src/convex/...`) and keep `betterAuth/_generated` out of them; `store/seed.test.ts` shows how.

## Repo map

```
src/convex/            backend
  auth.ts              Better Auth setup; auth.constants.ts = feature flags + brand name
  email.ts             Resend senders; model/emails/ = templates + rate limits
  otp/                 phone OTP: dispatcher, channels (textbee/WhatsApp/Fast2SMS), rate limits
  model/               shared logic (admin roles, ...); model/store/ = store logic once built
  admin/ users/ organizations/   Convex functions
  betterAuth/          the Better Auth component's schema (generatedSchema.ts)
  _generated/          generated; never edit by hand
src/lib/               UI: auth/, users/, organizations/, admin/, primitives/ (shared UI)
src/routes/            pages; (auth)/ sign-in etc., admin/, api/auth proxy
docs/                  developer docs, start at docs/README.md
.agents/skills/        agent skills (see below); .claude/skills/ links to them
```

## Conventions

- **Read `src/convex/_generated/ai/guidelines.md` before touching Convex code.** Its rules override
  what you remember about Convex.
- **Match the file you are editing.** Formatting is mixed (most files use tabs and single quotes;
  `src/routes/+layout.svelte` uses two spaces and double quotes). Don't reformat files you aren't
  changing.
- **Money is integer paise.** Format only for display, with `en-IN`.
- **Never accept a `userId` (or any identity) argument** for authorization. Derive the user on the
  server (`authComponent.getAuthUser(ctx)`). Every store function calls exactly one access guard.
- **Routes are private by default.** Add a route to `isPublic` in `src/hooks.server.ts` only if it
  is meant for signed-out visitors. The route check is UX; the Convex function check is security.
- **Bounded queries with indexes.** No `.collect()` on tables that grow.
- **Secrets never go in the repo.** This repository is public. Secrets live in Convex env vars
  (`npx convex env set`) or Vercel env vars. `.env.local` is gitignored. Also keep real customers'
  phone numbers, addresses and orders out of commits, tests, docs and screenshots.
- **Don't copy another company's branding.** Quick-commerce mechanics are fine; use Dukaan's own
  name, colours, copy and layout.
- Convex env vars are set per deployment with `npx convex env set NAME value` (`--prod` for the
  production slot, which is staging for now). They are not read from `.env.local`.

## India specifics

- Sign-in is **phone OTP first** (Indian mobiles, `+91`). Codes go through textbee, WhatsApp or
  Fast2SMS (`OTP_CHANNELS`); in dev use the `console` channel (`OTP_ALLOW_CONSOLE=true`, never on
  real production). `docs/06-phone-otp.md`.
- Phone-only users have a placeholder email `...@phone.invalid`. Never send mail to it;
  `src/convex/email.ts` already skips `.invalid` addresses.
- Email verification uses Resend. Until a domain is verified the sender is
  `onboarding@resend.dev`, which only delivers to the Resend account's own address.
  `docs/07-email-verification.md`.
- SMS to Indian numbers at scale needs TRAI **DLT** registration. Don't assume a gateway works
  without it.
- Invoices and GST: confirm requirements with the store's accountant; don't assert legal rules in
  code or copy (`store-app` skill, `references/admin.md`).

## Environments and deploys

| Env | Where | Backend |
| --- | --- | --- |
| Local | localhost:5173 | dev deployment via `npx convex dev` |
| Staging | the Vercel site built from `main` of this repo | this Convex project's production slot |
| Production | later: a bought domain, from a repo in a separate GitHub organization | a new Convex project |

The Vercel site is **staging, not the real store**. It shows a "Staging" badge
(`PUBLIC_APP_ENV=staging`). Don't hard-code this repo's name, a Vercel project or a Convex
deployment anywhere, so moving to production is a checklist, not a rewrite. Details, setup and the
production checklist: `docs/08-environments-and-deployment.md`.

Workflow: branch → open a PR → CI green → merge to `main` → Vercel deploys Convex and the site
together (`vercel.json`). Don't push directly to `main` once branch protection is on.

## Skills

Skills live in `.agents/skills/<name>/` (read by Claude Code, Codex and other AGENTS.md agents);
`.claude/skills/<name>` is a symlink to the same folder.

| Skill | Use it for |
| --- | --- |
| `store-app` | anything about the shop: catalogue, cart, checkout, orders, admin stock and order board, delivery-partner screens, invoices. Dukaan's own facts, decisions already made, what is built and **the roadmap** (what to build next and what each step needs from the founder) are in `references/store-profile.md` |
| `convex*` (many) | Convex work: auth, crons, migrations, review, tests, deploy safety |

To add a skill: copy `.agents/skill-template/` to `.agents/skills/<name>/`, add the symlink
(`ln -s ../../.agents/skills/<name> .claude/skills/<name>`), and fill it in. The template folder is
outside `skills/` on purpose so it never loads as a real skill. When the user dictates how a skill
should behave, write down *why* next to each rule.

`store-app` is shared with the `sveltekit-convex-auth-template` repo and differs from it only in
`references/store-profile.md`. Improve the generic parts in the template first, then copy them
here, so the two don't drift.

## Docs

`docs/README.md` indexes everything: overview, getting started, how auth works, building features,
configuration, phone OTP, email verification, environments and deployment.
`MIGRATION_TASKS.md` lists SvelteKit 3 migration items still to review.
