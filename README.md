# GAIL Works

Owner-only app for GAIL Gas works at Bengaluru: **SOR rates**, **weekly work logging**, **RA bill progress** and **margin against labour cost**.

It shares the same Supabase project and owner login as the attendance app, but lives on its own link.

## What it does

- **Rates** — final LOA rates for both contracts, PE (pipeline) and LMC (last mile). Search in trade language ("32", "1 inch", "meter"), a pipe rate matrix, and the full SOR description on every item. All rates show the document precision (2–3 decimals), never rounded to rupees.
- **Log work** — a site board with a **plan** and **quick repeat**. Create activities with a target quantity from the work order, then tap **+ Today** each day to add progress. Quantities can be entered in **feet/inches** (including length × width × depth for excavation) and are converted to the SOR unit automatically.
- **Progress** — cumulative work vs the LOA value, the next RA bill (value, GST, deductions, net), claimable by clear 7-day periods, item-wise quantities/sites/value, and labour cost from the attendance app.
- **More** — project value, RA bill plan and cutoffs, how the numbers work, account.

Phone **back** closes any popup and leaves you in the app; the old X buttons are gone.

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

Run `supabase/sor_schema.sql` once in the Supabase SQL editor (or apply it as a migration). It creates four owner-only tables:

- `sor_work_days` — one day per contract
- `sor_activities` — the site plan: one SOR item with an optional target quantity
- `sor_work_lines` — item, quantity (in the SOR unit), original feet/inches input, highest stage reached, linked activity
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
