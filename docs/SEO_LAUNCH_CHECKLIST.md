# SEO Launch Checklist — Manual Actions

Everything here needs a human (you) doing something outside this codebase — clicking through Google Search Console, Google Business Profile, or a GitHub repo setting. Nothing in this file can be automated from here.

---

## 0. One repo setting first (do this before anything else below)

GitHub → this repository → **Settings → Pages** → check **"Enforce HTTPS."**

Right now `http://playthecourts.com` serves the site directly instead of redirecting to `https://`. Every search engine and most browsers prefer/require the redirect, and it's a one-click fix.

---

## 1. Google Search Console

1. **Verify the property.** Go to [search.google.com/search-console](https://search.google.com/search-console), add `playthecourts.com` as a **Domain property** (covers `http`, `https`, `www`, and non-`www` all at once — better than a URL-prefix property for this site, since you have all four variants live/redirecting). Verification is via a DNS TXT record — whoever manages the `playthecourts.com` DNS (likely wherever the domain is registered) will need to add it.
2. **Submit the sitemap.** Once verified: Search Console → Sitemaps → enter `sitemap.xml` → Submit. (It now exists at `https://playthecourts.com/sitemap.xml`.)
3. **Inspect the homepage.** Use the URL Inspection tool on `https://playthecourts.com/`. If it says "URL is not on Google," click **Request Indexing**.
4. **Request indexing on the major program pages** — at minimum: `/basketball`, `/volleyball`, `/leagues`, `/camps`, `/private-coaching`, `/dr-dish`, `/membership`, `/court-rentals`. Same Inspect → Request Indexing flow, one at a time (Google rate-limits this — don't try to do all 27 pages in one sitting).
5. **Check the Pages/Indexing report** after a few days. Look for anything marked "Excluded" or "Not indexed" that shouldn't be — the canonical tags added in this pass mean Google should settle on the no-extension URLs (`/basketball`) and quietly drop the `/basketball.html` duplicates from its index over the following weeks; that's expected, not an error.
6. **Come back to Search Performance after 2–3 weeks** once data starts accumulating. That's where you'll actually see which "basketball training Nolensville"-style queries are bringing people in, and whether the new titles/descriptions are getting clicked.

---

## 2. Google Business Profile

If a listing doesn't exist yet, create one at [business.google.com](https://business.google.com). If it does, review each of these against what's live on the site so the two stay in sync:

- **Business name**: The Courts (not "The Courts Nolensville" or similar — keep it exactly matching what's on the site and in the schema markup)
- **Primary category**: something like "Sports Complex" or "Basketball Court" — pick whichever Google's category list has that best matches; there's no exact "youth basketball/volleyball training facility" category
- **Secondary categories**: consider adding both Basketball Court and Volleyball Court if the primary only lets you pick one; also worth checking for "Sports Club," "Youth Organization," or "Personal Trainer" depending on what's available and accurate
- **Website URL**: `https://playthecourts.com`
- **Address**: `2011 Johnson Industrial Blvd., Nolensville, TN` — **confirm the ZIP first** (site says 37086, your Stripe profile says 37135 — these need to match before you publish the listing)
- **Phone**: not currently published anywhere on the website. Decide if you want a public number, and if so, make sure it matches everywhere (site, GBP, schema) once it exists
- **Hours**: not currently published anywhere on the website either. Same — set real hours once finalized, and they should match across GBP and the site
- **Business description**: short, matches the site's voice — something like the homepage meta description works as a starting point, doesn't need to be a re-write
- **Photos**: upload real facility/action photos (you have plenty in `/images` already)
- **Logo**: `images/brand/logo-mark-orange-black.png` or `icon-mark-color.png` — either is a clean, square-enough option
- **Social links**: Instagram (`instagram.com/thecourtstn`) and Facebook (`facebook.com/playthecourts`) — Google Business Profile supports linking these
- **Services/Programs**: list out the major programs — Basketball Training, Volleyball Training, Private Coaching, Camps, Basketball Leagues, Dr. Dish, Court Rentals, Membership — matching your actual page names helps tie the listing to the site
- **Review link**: once the listing is live, Google gives you a short review link (Business Profile → "Ask for reviews") — save that link somewhere handy (email signature, post-session text, a QR code on-site) for the next section

---

## 3. Reviews

- Start asking for Google reviews as soon as the listing is live and verified — the review link from the step above is the easiest way (a text or email after a family's first few sessions works better than a blanket ask).
- Don't incentivize reviews with discounts or anything that could read as compensated (violates Google's policy and puts the listing at risk).
- Respond to every review, positive or negative — Google factors response activity into local ranking, and it's just good practice.

---

## 4. Local authority / backlinks

Real, legitimate, one-at-a-time local links — not directories, not link exchanges, not anything paid. Priority roughly in order of effort-to-value:

- **WNSL (West Nashville Sports League)** — you already have a real, active relationship (Fall League runs through them). Ask if they link partner facilities/venues on their site.
- **Nolensville/Williamson County schools** — PTOs/PTAs often maintain a "community partners" or "local business" page, especially for youth sports facilities. Worth reaching out to the schools your current families already attend.
- **Local youth sports leagues and clubs** (beyond WNSL) that use or could use your court time — a link from their "where we practice" or "facilities" page is natural and relevant.
- **Nolensville / Williamson County chamber of commerce or business directory**, if one exists and is a legitimate local org (not a paid national directory).
- **Local sponsorships** — if you sponsor a team, tournament, or community event, ask if sponsors get listed with a link on the event page.
- **Business partners** mentioned on the site (coaches in the Coach Collective, any equipment/brand partners) — a reciprocal, genuine link from their site if they have one.

Do **not**: buy links, submit to mass business directories, do link exchanges ("link to us and we'll link to you"), or post on low-quality guest-post sites. These either do nothing or actively risk a Google penalty.
