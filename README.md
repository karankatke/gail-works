# GAIL Works

Owner-only app for GAIL Gas works at Bengaluru: **SOR rates**, **weekly work logging**, **RA bill progress** and **margin against labour cost**.

It shares the same Supabase project and owner login as the attendance app, but lives on its own link.

## What it does

- **Rates** — final LOA rates for both contracts, PE (pipeline) and LMC (last mile). Search in trade language ("32", "1 inch", "meter"), a pipe rate matrix, and a one-flat connection value card.
- **Log work** — log what was done on any date, for any site, at the stage reached. The app keeps both the full work value and what is claimable now.
- **Progress** — cumulative work vs the LOA value, the next RA bill (value, GST, deductions, net), weekly claimable trend, item-wise progress, and labour cost from the attendance app.
- **More** — project value, RA bill baseline, how the numbers work, account.

## The money rules

1. **LOA rates are final.** The SOR sheet quantities are examples, not executed quantities.
2. Each item is paid in **stages** (for example 60% laying → 10% testing → 25% commissioning → 5% documents, or 70/25/5). The app stores the highest stage reached and derives the claim percentage.
3. **Labour is one project.** Wages and bata come from the attendance app for all sites; they are not split between PE and LMC.
4. **The RA bill is cumulative.** Work after the latest bill cutoff becomes the next bill. Logging weekly is enough.

## Stack

React + Vite + TypeScript + Tailwind, Supabase (shared project), GitHub Pages.

## Setup

```bash
npm install
cp .env.example .env.local   # or create .env.local
npm run dev
```

`.env.local`:

```
VITE_SUPABASE_URL=https://duxzyxwvmmbtgxwzeuna.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

### Database

Run `supabase/sor_schema.sql` once in the Supabase SQL editor (or apply it as a migration). It creates three owner-only tables:

- `sor_work_days` — one day per contract
- `sor_work_lines` — item, quantity, highest stage reached
- `sor_bills` — RA bill cutoffs

RLS uses the existing `public.is_owner()` function from the attendance app.

### Deploy

The workflow uses two repository variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Then push to `main`. Pages must be set to “GitHub Actions” as the source.

## Phase 2 (not in this MVP)

- Vendor / label cost split
- Material inventory
- Per-flat LMC tracking (BP no., house no., meter no.)
- RA bill Excel export
- Bill history and comparison
