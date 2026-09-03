# The Courts — Member & Admin Platform: Architecture Plan

**Status:** Draft for approval. No implementation has started. This document is planning only, per explicit instruction — the public site at the repo root is untouched and stays that way regardless of what's decided here.

---

## 1. Current-State Audit

### Tech stack (confirmed by inspecting the repo directly)
- **Zero build tooling.** No `package.json`, no bundler/framework config, no `.env` files anywhere. Confirmed via `find`.
- **27 HTML pages** at the repo root, each a full static document.
- **One shared stylesheet**, [css/styles.css](css/styles.css) (1,402 lines) — CSS custom-property design tokens (`--black`, `--orange`, `--font-display`, etc.) plus shared component classes, with large page-scoped `<style>` blocks inline in most HTML files on top of it.
- **One shared script**, [js/script.js](js/script.js) (390 lines) — vanilla JS: Formspree submission for the contact form and footer newsletter signup, filter pills, scroll-reveal via `IntersectionObserver`, sticky-nav scroll listener, mobile menu toggle. No framework, no state management, no routing.
- **No backend, no database, no server-side code, no authentication anywhere in the repo.**
- **Hosting:** GitHub Pages, custom domain `playthecourts.com` via the [CNAME](CNAME) file, auto-deploy on push to `main`.
- **Forms:** two Formspree endpoints (`xeaqjjzn`, `xeaqejqz`) handle all form submission today — contact, newsletter, and now the Fall League evaluation interest form and Gear "first drop" capture. Formspree is the only "backend" the site currently has.
- **Booking/scheduling today** is not actually built here — pages link out to an external provider (Upper Hand) for the real class/camp/registration flows, or currently show "Coming Soon" states while those flows are paused. The "member-portal" concept doesn't exist yet as an app; it's informational content only.

### Current architecture, in plain terms
This is a hand-maintained static marketing site. There is no separation between content and presentation — copy changes mean editing HTML directly, which is exactly the workflow this session has run dozens of times (fast, low-ceremony, no build step to wait on). That responsiveness is a real asset and worth preserving for the *public* site regardless of what gets built next.

### What's reusable
- **Design system** — the CSS custom properties in `styles.css` (colors, type scale, spacing patterns) are brand-accurate as of this session's brand refresh and should be the source of truth for the new app's UI too, not reinvented.
- **Brand assets** — `images/brand/` (logo files, recoloring-via-CSS-filter approach) carry over directly.
- **Copy and content patterns** — page content (plan descriptions, program names, pricing) reflects real, current business facts (Fall 2026 league pricing, membership tiers, etc.) that should seed the new database rather than being re-typed from scratch.
- **The public site itself** — nothing about it needs to be rebuilt to support the platform. It can stay exactly as-is.

### Not reusable / doesn't transfer
- No JS module is structured to be imported into a real app (it's DOM-script style, not componentized).
- No existing data model, since none of this content is currently structured data — it's prose in HTML.

---

## 2. Recommended Architecture

### The constraint that drives this decision
GitHub Pages serves static files only — it cannot run authentication, a database, or business logic. Something has to run somewhere else. This is true no matter which repo the code lives in, so it has to be factored into the "keep it in this project" preference explicitly.

### Recommendation: one repository, two deployment targets
Keep everything in this same Git repository (satisfies "within the current project"), but split *deployment*, not *ownership*:

- **Public marketing site** (`playthecourts.com`) — stays exactly as it is today: static HTML at the repo root, deployed to GitHub Pages, no build step. Zero risk to the fast content-editing workflow this whole project depends on.
- **Member + admin platform** (`app.playthecourts.com` or `my.playthecourts.com`) — a new application in a subfolder of this same repo (e.g. `/platform`), deployed independently to a host that can run a real backend.

This mirrors how most companies split "marketing site" from "product app" (e.g. `stripe.com` vs. `dashboard.stripe.com`) and means the two codebases can evolve on completely different rhythms — rapid unstructured HTML edits on one side, disciplined typed code + migrations on the other — without either one blocking or destabilizing the other.

**Alternative considered and rejected:** bolting a framework onto the existing static site so everything runs through one build/deploy pipeline. Rejected because it would force every future one-line copy edit (which currently ships in seconds) through a build step, and because GitHub Pages still couldn't run the authenticated parts regardless.

### Recommended stack for the new platform
| Layer | Recommendation | Why |
|---|---|---|
| Framework | **Next.js** (App Router) | Handles both the member-facing pages and API routes in one app; mainstream, well-documented, pairs cleanly with Vercel. |
| Database | **PostgreSQL** | The data is inherently relational (families → guardians → athletes → memberships → bookings); Postgres is the right shape for this, not a document store. |
| DB + Auth host | **Supabase** | Managed Postgres with built-in auth and **row-level security** — genuinely useful here, since RLS can enforce "a guardian can only ever see their own family's data" at the database layer, not just in application code. Reduces custom auth-building work substantially. |
| ORM | **Prisma** | Typed schema, migrations, good Next.js/Postgres fit. (Drizzle is a reasonable lighter-weight alternative if preferred.) |
| Hosting | **Vercel** | Natural Next.js pairing, git-push-to-deploy (same muscle memory as today), generous free tier for this stage. |
| Payments | **Not implemented yet**, per instruction. Architecturally: Helcim (or similar) tokenizes card/ACH details; we store only a returned token + display metadata (last4, brand), never raw numbers. See §7. |

### Where the member portal and admin live
Both inside the new app, as protected route groups — not separate apps:
- `/my-courts/*` — family/member portal
- `/admin/*` — staff/admin console

They share the same database, the same design tokens, and mostly the same codebase, but enforce different authorization (guardian role vs. staff role) at the route/middleware level. Splitting them into fully separate apps isn't warranted at this scale and would just duplicate auth and UI plumbing.

---

## 3. Database Schema (draft)

This adapts the entity list provided, consolidating a few tables where a leaner relational model covers the same ground without redundant bookkeeping (noted inline). Everything below is a **draft for discussion**, not a final migration.

### Identity & family hierarchy
- **`guardians`** — one row per parent/guardian login. `id, auth_id (FK → auth provider), name, email, phone, created_at`.
- **`families`** — the household unit. `id, name, created_at`.
- **`family_guardians`** (join, N:N) — supports co-parents/divorced households cleanly. `family_id, guardian_id, is_primary`.
- **`athletes`** — belongs to exactly one family. `id, family_id, first_name, last_name, dob, grade, gender, medical_notes, emergency_contact, photo_consent, created_at`.

*Consolidation note:* the original list separated `users`, `family_members`, and `guardians`. Since only guardians actually authenticate, `guardians` + `family_guardians` + `athletes` covers the same ground with one fewer table and no ambiguity about who can log in.

### Membership & entitlements
- **`membership_plans`** — catalog: Weekly Basketball ($120/mo), etc. `id, name, price_cents, billing_interval, description`.
- **`athlete_memberships`** — a plan assigned to an athlete. `id, athlete_id, membership_plan_id, status, start_date, renewal_date, processor_subscription_id`.
- **`plan_entitlements`** — *new table, not in the original list* — what a plan actually grants, structured rather than hardcoded: `id, membership_plan_id, benefit_type (e.g. class_credit / member_pricing / league_eligibility), program_id (nullable), quantity_per_period`. This is what lets the system answer "is this booking included, discounted, credit-required, or unavailable?" from data instead of scattered if-statements.
- **`credits`** — a spendable ledger (e.g. a Dr. Dish 10-pack). `id, athlete_id, credit_type, balance, source, expires_at`.

### Programs & scheduling
Six different scheduling shapes were requested (recurring classes, fixed-date events, leagues, resource bookings, private appointments, rentals). Rather than one table per shape, this uses a **catalog → occurrence → booking** layering that all six map onto:

- **`programs`** — the catalog entry. `id, name, program_type (class/camp/league/resource/private/rental), sport, description, price_cents, member_price_cents`.
- **`sessions`** — an actual bookable occurrence. `id, program_id, team_id (nullable — league practices/games), coach_id, substitute_coach_id, resource_id, start_time, end_time, capacity, status`. Recurring classes materialize into rows on a rolling window rather than being expanded from an RRULE at read time — simpler booking logic, no recurrence-parsing in the hot path.
- **`bookings`** — an athlete occupying a seat in a session. `id, session_id, athlete_id, booked_by_guardian_id, status (booked/waitlisted/cancelled/attended/no_show), payment_status, price_charged_cents, credit_used, booked_at`.

*Consolidation note:* the original list had separate `registrations` and `bookings` tables. A camp registration, a class booking, a Dr. Dish slot, and a private-training appointment are all structurally "an athlete in a session" — one `bookings` table covers all of them and avoids maintaining two near-identical tables in parallel.

- **`waitlist_entries`** — `id, session_id, athlete_id, position, status`.

### Leagues (the one program type with real extra structure)
- **`league_seasons`** — `id, name, sport, registration_price_cents, evaluation_program_id, season_start, season_end`.
- **`teams`** — `id, league_season_id, name, division, primary_coach_id`.
- **`team_members`** — `team_id, athlete_id, joined_at`. Practices/games are just `sessions` rows with `team_id` set.

### Coaches
- **`coaches`** — `id, name, email, phone, sports, active`. Kept separate from `guardians` since coaches aren't customers; a staff login for coaches is a v2 concern, not MVP.
- Primary/substitute coach lives directly on `sessions` (above) rather than a separate assignment table, for simplicity — with one exception:
- **`coach_assignments`** — *optional, add when compensation reporting is actually being built*: `session_id, coach_id, role, rate_cents, computed_pay_cents, pay_period`. A dedicated ledger makes pay reporting clean without complicating the booking model now.

### Facility resources
- **`resources`** — Court 1, Court 2, Full Court, Dr. Dish. `id, name, resource_type, capacity, active`.
- Program-driven bookings (classes, camps, leagues, Dr. Dish, private training) get their resource + time range from `sessions.resource_id` / `start_time` / `end_time` directly.
- **`resource_reservations`** — covers the one case that isn't program-driven: ad-hoc **court rentals** booked directly against a resource. `id, resource_id, family_id, start_time, end_time, status, booking_id`.
- **Double-booking prevention** is enforced as one overlap constraint checked across both `sessions` and `resource_reservations` for a given `resource_id` — this is a single well-defined query/constraint, not two separate systems to keep in sync.

### Payments (architecture only — not implemented)
- **`payment_methods`** — `id, guardian_id, processor, processor_payment_method_id (token), type (card/ach), last4, brand_or_bank, is_default`. **Never a raw card or account number.**
- **`payments`** — a ledger. `id, family_id, amount_cents, status, processor_transaction_id, related_booking_id / related_membership_id, created_at`.
- **`discounts`** — `id, code, discount_type, value, applies_to_program_id (nullable), valid_from, valid_until, usage_limit`.
- Recurring membership billing itself is expected to be handled by the processor's own subscription feature where possible (e.g., Helcim), with `athlete_memberships.status` kept in sync via webhook — not custom-built recurring-charge scheduling.

### Waivers & attendance
- **`waivers`** — `id, waiver_type, version, content_url, effective_date`.
- **`waiver_signatures`** — `id, guardian_id, athlete_id (nullable for family-level waivers), waiver_id, signed_at, ip_address`.
- **`attendance`** — `id, booking_id, status (present/absent/late), recorded_by, recorded_at, notes`. Kept separate from `bookings` so "intent to attend" and "actual outcome" don't collapse into one ambiguous status field.

### Staff/admin accounts
- **`staff_users`** — deliberately separate from `guardians`, even though both may use the same underlying auth provider technology. `id, auth_id, name, email, role (admin/front_desk/coach)`. Keeping parent accounts and staff accounts as distinct trust boundaries avoids an entire class of authorization bugs (a guardian record accidentally getting admin scope, or vice versa).

### Data classification (§8 of the request)
| Category | Examples | Where it lives |
|---|---|---|
| **Stored directly** | Family/guardian/athlete profiles, program & session catalog, bookings, entitlements, credits, waiver signatures, attendance | Our Postgres DB |
| **Derived, not stored** | "Is this booking included/discounted/requires payment" | Computed at request time from `plan_entitlements` + `credits`, not persisted as a separate flag that can drift out of sync |
| **Relational joins** | "All athletes on a team," "a family's full booking history" | Standard joins across the tables above — no denormalized copies |
| **Held by the payment processor, never by us** | Raw card numbers, bank account/routing numbers, CVV | Processor only; we hold a token + display metadata (§7) |

---

## 4. MVP Build Sequence

Recommended order — each phase is independently useful and de-risks the next:

1. **Foundations**: Next.js app scaffold in `/platform`, Supabase project, Prisma schema for `guardians/families/family_guardians/athletes`, auth (magic link or password) with guardian login only.
2. **Member portal read-only shell**: `/my-courts` showing the logged-in guardian's family + athletes (manually seeded data first — proves the auth + family-scoping model before any booking logic exists).
3. **Admin: families & athletes**: `/admin/families`, `/admin/athletes` — CRUD for the data staff will actually need to seed and correct first.
4. **Programs & sessions (admin)**: `/admin/programs`, `/admin/schedule` — build the catalog + session generation for recurring classes and fixed-date events first (the two simplest scheduling shapes); leagues/resources/rentals come after the core booking loop works.
5. **Booking loop (member + admin)**: member-side "book a session," waitlist, cancellation; admin-side roster view and attendance. This is the core value loop — get it solid before adding more program types.
6. **Memberships & entitlements**: `membership_plans`, `athlete_memberships`, `plan_entitlements`, `credits` — layer the "is this included/discounted/needs payment" logic onto the now-working booking loop.
7. **Leagues**: evaluations as a session type → `league_seasons`/`teams`/`team_members` → practices/games as `sessions` with `team_id`.
8. **Resources & rentals**: Dr. Dish and court-rental booking, double-booking constraint.
9. **Waivers**: signature capture, gating bookings on required waivers being signed.
10. **Payments** (separate approval gate, not started until explicitly greenlit): processor integration, `payment_methods`, `payments`, webhook sync for membership billing status.
11. **Reporting**: attendance, coach compensation, revenue — once the underlying data has been flowing for a while and real reporting needs are clearer.

---

## 5. Security & Privacy Considerations (minors' data)

- **Row-level security in Postgres** (via Supabase) as the primary defense — a guardian's queries are scoped to their own family at the database layer, not just hidden in the UI.
- **Least-privilege staff roles** — front-desk vs. coach vs. admin should see different slices of athlete data (e.g., medical notes probably shouldn't be visible to every staff role).
- **Minimize what's collected** — only capture medical/emergency data actually needed operationally; avoid free-text fields that invite over-collection.
- **Photo consent** as a first-class field on `athletes`, checked before any photo/video use — not a paper form kept separately from the system that will act on it.
- **Data retention** — decide (as a business/legal question, not just technical) how long athlete data is kept after a family becomes inactive, and build deletion/export tooling early rather than retrofitting it under pressure later.
- **No raw payment data, ever**, per §3/§7 — this also meaningfully shrinks PCI compliance scope.
- **Audit logging** on admin actions touching athlete PII (who viewed/edited what, when) — worth having from day one given the population served.
- **COPPA is aimed at online services collecting data *directly from children under 13***; here, guardians are the ones creating accounts and entering athlete data, which is the standard and lower-risk pattern for youth-sports platforms — but this is worth a real legal review before launch, not just an engineering assumption. [INTERNAL-LEGAL-REVIEW.md](INTERNAL-LEGAL-REVIEW.md) already flags several open legal items (cancellation/refund terms, membership freezes) worth resolving alongside this.

---

## 6. Technical Debt in the Existing Codebase

Found during this audit, relevant because it affects what the new app can safely assume or reuse:

- **74 `.fuse_hidden*` temporary files are tracked in git** (at the repo root and inside `css/`) — these are filesystem-mount artifacts, not real project files, and shouldn't be in version control at all.
- **No `.gitignore` exists anywhere in the repo** — the direct cause of the above, and something that should exist regardless of the platform work.
- **Four stray, apparently-unused image files tracked at the repo root**, outside `images/brand/`: `logo-black.png`, `logo-compact-2x.png`, a ChatGPT-generated PNG, and a Getty Images stock photo — worth confirming none of these are actually referenced before removing them.
- **No favicon/icon asset in the new brand kit** — flagged earlier this session; the favicon is still the old circular mark. Not urgent, but worth resolving before the platform ships a polished new `/my-courts` experience under the same domain.
- None of this blocks starting the platform work, but it's a quick, low-risk cleanup pass worth doing on its own (add `.gitignore`, remove the fuse files and confirmed-unused images) — happy to do that as a small standalone change whenever you'd like, separate from the platform build.

---

## 7. Recommended Route Structure

**Member portal:**
```
/login
/my-courts                     family dashboard
/my-courts/athletes            manage athlete profiles
/my-courts/schedule            upcoming sessions across all athletes
/my-courts/bookings            book / cancel / waitlist
/my-courts/membership          plans, entitlements, credits
/my-courts/payments            payment methods, history (post payments phase)
```

**Admin:**
```
/admin
/admin/today                   day-of operational view: who's in, what's running
/admin/families
/admin/athletes
/admin/schedule
/admin/programs
/admin/memberships
/admin/coaches
/admin/payments                (post payments phase)
```

Both trees live under the new `/platform` app, gated by guardian vs. staff role respectively — not by separate applications.

---

## 8. Major Decisions Needing Your Approval

1. **Deployment split** — public site stays on GitHub Pages as-is; new platform deploys separately (Vercel) to a subdomain (`app.` or `my.playthecourts.com`), same repo, different deploy target. This is the one genuinely non-negotiable technical constraint in this whole plan (GitHub Pages cannot run a backend) — everything else here is a recommendation, this part isn't optional if the platform is going to exist at all.
2. **Subdomain name** — `app.playthecourts.com` vs. `my.playthecourts.com` vs. other.
3. **Stack** — Next.js + Supabase (Postgres + auth + RLS) + Prisma + Vercel, as proposed, vs. alternatives.
4. **Schema direction** — the consolidations above (one `bookings` table instead of separate `registrations`/`bookings`; a structured `plan_entitlements` table for automatic eligibility logic; separate `staff_users` from `guardians`) as the starting model.
5. **MVP scope for phase 1** — confirm the build order in §4, especially that leagues/resources/rentals/payments come *after* a working core booking loop rather than in parallel.
6. **Cleanup pass** — whether to do the small, low-risk repo-hygiene fixes in §6 now (as a standalone change, unrelated to the platform) or defer them.

Once these are decided, next step is scaffolding `/platform` and the initial schema — no code changes happen before that approval.
