# SEO Audit — playthecourts.com

Date: September 4, 2026
Scope: all 27 indexable pages at the repo root (static HTML, GitHub Pages, custom domain `playthecourts.com`). The `/platform` directory is a separate Next.js app (member/admin portal, deployed elsewhere) and is out of scope for this audit beyond blocking it in `robots.txt`.

Priority key: **Critical** (blocks indexing/rankings or actively harms them) · **High** (real, measurable impact) · **Medium** (worth doing, not urgent) · **Nice to Have**

---

## 1. What I found and fixed

### Critical

**No `robots.txt` or `sitemap.xml` existed.** → Added both.
- `robots.txt`: allows everything, disallows `/platform/` (the separate Next.js source tree — it has no rendered pages, but there's no reason to let it be crawled), points at the sitemap.
- `sitemap.xml`: all 27 pages, clean URLs, `lastmod`/`changefreq`/`priority` set per page tier (homepage highest, core program pages high, legal/utility pages low).

**No canonical URLs anywhere, and the site serves duplicate content at two URLs per page.** GitHub Pages happily serves both `/basketball` and `/basketball.html` as 200 OK with identical content — confirmed live. Every page now has `<link rel="canonical">` pointing at the clean (no-extension) URL, which is also what internal nav links already use. This is the correct fix here — GitHub Pages has no server-side redirect mechanism, so canonical tags are the only way to tell Google which URL is authoritative.

**No structured data anywhere.** → Added:
- `SportsActivityLocation` (a LocalBusiness subtype — the most accurate available schema.org type for a physical youth-sports training facility) on every page: name, url, logo, image, full address, sameAs (Instagram + Facebook), areaServed. See §2 for what's deliberately omitted.
- `FAQPage` schema on `faq.html`, built from the 26 real, visible Q&A pairs already on the page (cross-checked the extracted count against the source markup — 26 `faq-item` blocks, 26 extracted). Nothing invented.

**HTTP does not redirect to HTTPS.** Confirmed live: `http://playthecourts.com/` returns `200 OK` directly rather than a `301` to `https://`. (`https://www.playthecourts.com/` does correctly 301 to the apex `https://playthecourts.com/`, so only the HTTP→HTTPS leg is missing.) This is a GitHub Pages repository setting ("Enforce HTTPS" under Settings → Pages), not something fixable from the codebase — see `SEO_LAUNCH_CHECKLIST.md`.

### High

**No Open Graph or Twitter Card metadata anywhere.** → Added to every page: `og:type`, `og:site_name`, `og:locale`, `og:url`, `og:title`, `og:description`, `og:image`, and the equivalent `twitter:*` tags (`summary_large_image`). Images use each page's own real hero photo where one exists (verified every referenced file actually exists on disk); pages without a clear hero photo (legal/utility pages) fall back to the brand logo mark rather than an unrelated action photo.

**Weak, generic page titles that didn't match search intent.** Every title already followed a "Page | The Courts — Nolensville, TN" pattern and already included the location — that part was fine. But titles like "Basketball | The Courts — Nolensville, TN" don't match how a parent actually searches ("basketball training Nolensville," "basketball lessons Nolensville"). Rewrote 14 titles and 5 meta descriptions (the ones either weak on intent or over the ~160-char guidance) to lead with what's actually being searched for, e.g.:
- `Basketball | The Courts — Nolensville, TN` → `Youth Basketball Training in Nolensville, TN | The Courts`
- `Membership | The Courts — Nolensville, TN` → `Youth Sports Memberships in Nolensville | The Courts`

Full before/after is in git history (commit "SEO pass: rewrite titles/descriptions..."). The remaining 13 pages (contact, schedule, shop, resources, legal pages, etc.) already had reasonable titles/descriptions or are low-search-intent utility pages, so I left them alone rather than rewrite for the sake of it. One real gap: `coach-collective.html`'s title was missing "Nolensville" entirely — fixed.

**Hero/content images with empty `alt` and no accessible description.** Found 10 across the site (mostly on `index.html` and `coach-collective.html`) where a real content photo — not a decorative texture or icon mark — had `alt=""` and no `aria-label` fallback. The site already has an established, correct pattern for this (`<div class="photo" role="img" aria-label="...">` wrapping an `<img alt="">`, used elsewhere on the same pages) — I followed it, writing plain descriptive alt text from actually looking at each image (e.g., "A coach and young basketball players fist-bumping in a team huddle at The Courts"), not keyword phrases. Left genuinely decorative images (icon marks, macro texture close-ups) with empty alt, which is correct WCAG practice, not a bug.

**No lazy loading on any of the site's 180 `<img>` tags.** Added `loading="lazy"` to every below-the-fold image (roughly 130 of them), skipping nav/footer logos and each page's first content photo (the LCP candidate) so this doesn't hurt perceived load speed.

### Medium

**Uncompressed, oversized hero/content images — the single biggest performance issue on the site.** ~90 of the 237 images in `/images` are 1.5–2.3MB PNGs of ordinary photographs. PNG is the wrong format for photographic content; the same images as JPEG or WebP at equivalent visual quality would typically be 150–400KB — a 75–90% reduction. I did **not** do a site-wide conversion in this pass: it would touch ~90 files and every `<img src>` reference to them across 27 pages, and I don't have `cwebp`/`imagemagick` available in this environment (only macOS's built-in `sips`, which can convert PNG→JPEG but not to WebP). This is real, high-impact work but it's a distinct, bounded project of its own — see the recommendation below rather than a rushed mass conversion bundled into an SEO pass.
- *Recommended next step*: convert the site's hero/above-the-fold images first (biggest LCP impact, smallest file count) to WebP with JPEG fallback via `<picture>`, or just high-quality JPEG if `<picture>` markup is more change than wanted. I can do this as a focused follow-up if you want it.

**27 image files have non-descriptive, space-containing export filenames** (`ChatGPT Image Aug 27, 2026, 03_31_18 PM.png`, `Screenshot 2026-08-21 at 11.01.33 PM.png`, etc.) — including at least one page hero (`camps.html`'s hero image). Filenames are a minor image-SEO signal, but the real reason I didn't rename them in this pass is risk: renaming means updating every HTML reference across every page that uses each file, and a missed reference is a broken image in production. This is doable but wants a dedicated, carefully-verified pass, not a rushed find-and-replace.

**Font loading may be over-provisioned.** Every page loads 14 font-weight/family combinations from Google Fonts (Archivo ×6 weights, Archivo Black, Inter ×5 weights, Barlow Condensed ×2 weights). I didn't audit which weights are actually used where across ~2,000+ lines of CSS (shared stylesheet + 27 pages' worth of page-scoped `<style>` blocks) — trimming an unused-looking weight that turns out to be used somewhere would visibly break typography, which you explicitly asked me not to risk. Flagging as worth a dedicated audit (a font-weight usage grep per page) rather than guessing.

### Nice to Have

**No native `width`/`height` attributes on any `<img>` tag.** Normally a real CLS (layout shift) risk, but checked the CSS: every `.photo` image container already reserves its box via CSS (`position:absolute; inset:0` inside a parent with its own fixed/aspect-ratio-based sizing, e.g. `.pt-banner .photo { width:120px; height:90px }`), so the space is already reserved before the image paints. Real CLS risk here is low; adding width/height to 180 tags for marginal additional protection isn't worth the churn.

**Event schema on `events.html`** — evaluated, didn't implement. The page has ~15 real scheduled events, but their dates are only present in the visible markup as fragmented weekday/month/day spans (`<span class="cal-weekday">Sat</span><span class="cal-month">Oct</span><span class="cal-day">24</span>`) with no year shown on the page itself. Building accurate `Event` schema means hand-reconstructing ISO dates and cross-referencing `schedule.html`'s separate JS data array (which does have full dates) to avoid errors — a real risk of a wrong date if rushed, and the brief specifically says not to add schema unless the visible content cleanly supports it. Flagging as a good follow-up, not doing it today.

**`BreadcrumbList` schema** — evaluated, skipped. The site has no visible breadcrumb UI anywhere and a genuinely flat structure (nearly every page sits one level under the homepage), so there's no real hierarchy to mark up. Adding invisible-only breadcrumb schema with nothing on the page to back it up is exactly the "schema because it exists" anti-pattern the brief warned against.

---

## 2. What I intentionally left alone

- **NextGen mentions on `about.html` and `faq.html`.** These are real, correct, intentional brand-story content (the founder's quote referencing NextGen, and an explicit FAQ entry titled "NextGen → The Courts" explaining the transition). Not stale, not something to scrub — see `SEO_MIGRATION_PLAN.md` for the actual migration-equity question.
- **H1 usage and heading hierarchy** — every page already has exactly one `<h1>`, confirmed by direct grep across all 27 files. No changes needed.
- **Viewport meta, script placement (render-blocking)** — already correct everywhere: `width=device-width` present on all pages, and the shared `js/script.js` is loaded at the end of `<body>` on every page, not in `<head>`. Nothing to fix.
- **Internal linking between program pages** — already comprehensive. The shared nav dropdown and footer link every major program page (Basketball, Volleyball, Leagues, Camps, Private Coaching, Dr. Dish, Membership, Court Rentals, etc.) to every other one, on every page, sitewide. I looked for natural contextual in-body-copy link opportunities per the brief's example map and didn't find clean ones that wouldn't feel forced — didn't manufacture links just to check a box.
- **Brand voice / headline copy** — untouched. Every metadata change was additive (new `<title>`/`<meta description>` text, new `<link>`/`<meta>`/`<script type="application/ld+json">` tags); no visible on-page headline or body copy was rewritten for SEO.
- **Pricing, dates, schedules, forms, payment flows** — untouched.

---

## 3. Issues that need your manual action (not fixable from this codebase)

| Issue | Where to fix it | Priority |
|---|---|---|
| HTTP doesn't redirect to HTTPS | GitHub repo → Settings → Pages → "Enforce HTTPS" checkbox | **Critical** |
| No phone number published anywhere on the site (so `LocalBusiness` schema has no `telephone` field — I didn't invent one) | Decide if you want a public phone number; if yes, tell me where to add it and I'll wire it into the schema too | High |
| No published operating hours anywhere (so schema has no `openingHours`) | Same — once hours are finalized/published somewhere on the site, I can add them to the schema | Medium |
| **ZIP code conflict**: every page on the site uses `2011 Johnson Industrial Blvd., Nolensville, TN 37086`, consistently, everywhere. Your Stripe business profile lists the same street address but ZIP **37135**. | Confirm which ZIP is correct and update whichever one is wrong (I didn't guess — flagging per your instructions) | High |
| Google Search Console / Business Profile setup | See `SEO_LAUNCH_CHECKLIST.md` | Critical |

---

## 4. Priority summary

| # | Item | Priority | Status |
|---|---|---|---|
| 1 | robots.txt / sitemap.xml | Critical | ✅ Fixed |
| 2 | Canonical tags (duplicate `/page` vs `/page.html`) | Critical | ✅ Fixed |
| 3 | Structured data (LocalBusiness + FAQPage) | Critical | ✅ Fixed |
| 4 | HTTP → HTTPS redirect | Critical | ⚠️ Manual (GitHub Pages setting) |
| 5 | Open Graph / Twitter metadata | High | ✅ Fixed |
| 6 | Title/description rewrite for search intent | High | ✅ Fixed (14 titles, 5 descriptions) |
| 7 | Real content image alt-text gaps | High | ✅ Fixed (10 images) |
| 8 | Lazy loading | High | ✅ Fixed (~130 images) |
| 9 | Image compression (PNG → JPEG/WebP) | Medium | 📋 Documented, not executed — recommend as follow-up |
| 10 | Non-descriptive image filenames | Medium | 📋 Documented, not executed — recommend as follow-up |
| 11 | Font-weight audit | Medium | 📋 Documented, not executed |
| 12 | Event schema on events.html | Nice to Have | 📋 Documented, deferred (date-accuracy risk) |
| 13 | Breadcrumb schema | Nice to Have | Skipped — no real hierarchy to mark up |
| 14 | NAP ZIP code conflict (site vs. Stripe) | High | ⚠️ Manual — needs your confirmation |
| 15 | Phone number / hours for schema | High/Medium | ⚠️ Manual — needs your decision |
