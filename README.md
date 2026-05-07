# Vehkit

> Every car deserves a passport.

The trusted record that lives with the car.

## Stack

- **Web + Workshop Portal** — Next.js 15 (App Router) on Vercel
- **Mobile** — Expo / React Native (initialized separately, see `apps/mobile`)
- **Backend** — Supabase (Postgres + Auth + Storage + Realtime + Edge Functions)
- **Region** — South Asia (Mumbai) `ap-south-1`
- **Monorepo** — pnpm workspaces + Turborepo

## First-time setup

```bash
# 1. Install dependencies
pnpm install

# 2. Environment
cp apps/web/.env.example apps/web/.env.local
# Fill in your Supabase URL + keys

# 3. Install Supabase CLI (if not done)
brew install supabase/tap/supabase

# 4. Link to remote project + apply schema
supabase login
supabase link --project-ref lfgypksfhcuslqqangxi
pnpm db:push

# 5. Generate TS types from your live schema
pnpm db:types

# 6. Run the web app
pnpm dev
```

Open http://localhost:3000.

## Repo layout

```
vehkit/
├── apps/
│   ├── web/          Next.js — landing + workshop dashboard + consumer web
│   └── mobile/       Expo — consumer iOS + Android (init when ready)
├── packages/
│   ├── ui/           Shared design tokens + components
│   ├── types/        Shared TS types + Supabase-generated DB types
│   └── lib/          Shared utils, validators, API helpers
└── supabase/
    ├── config.toml
    ├── migrations/   Versioned SQL — source of truth for the schema
    ├── seed.sql      Local dev seed data
    └── functions/    Edge Functions (Deno)
```

## Day-1 conventions

- **Migrations are the source of truth.** Never modify the schema via the Supabase Studio UI in production. Always write a migration, push, version it.
- **RLS is mandatory.** Every new table gets RLS enabled (already auto-enforced by project setting) AND explicit policies. A table with RLS on but no policies = default deny = safe.
- **The `audit_log` table is append-only.** Never UPDATE or DELETE rows. Backed by a trigger.
- **Owner-entered records use `attestation = 'owner'`. Workshop-entered use `attestation = 'workshop'`.** Trust tier flows from this single column.
- **Service-role key never appears in client-side code.** No `NEXT_PUBLIC_` prefix. Server actions and route handlers only.

## Useful scripts

```bash
pnpm dev              # run all apps
pnpm build            # build all apps
pnpm type-check       # tsc --noEmit across the monorepo
pnpm db:push          # apply local migrations to remote Supabase
pnpm db:reset         # nuke + reapply (LOCAL ONLY — never on prod)
pnpm db:types         # regenerate packages/types/src/database.ts from live schema
```

## Brand & design

See `VEHKIT_BRAND_BRIEF.md` in the root project folder for the full brief.
Design tokens live in `packages/ui/src/tokens.ts` — single source of truth for colors, typography, spacing across web and mobile.
