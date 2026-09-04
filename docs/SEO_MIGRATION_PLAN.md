# SEO Migration Plan — NextGen Court Academy → The Courts

## Status

**The old NextGen domain is not accessible from this project** — it isn't part of this repository, and I have no visibility into its current DNS, hosting, or whether it's even still live. Everything below is a plan to execute once you have access to that domain's DNS/hosting, not something already done. Nothing in this document should be read as "the migration is complete."

## What I found in this codebase

Searched the whole site for old-domain references, stale branding, and leftover NextGen artifacts. Found only two mentions, both intentional and correct — not migration debris:

- `about.html` — the founder's quote: *"I had the opportunity to experience NextGen first as a parent..."* and *"...build on what families already loved about NextGen..."* — real brand-story content explaining the transition.
- `faq.html` — a dedicated FAQ entry, filtered under a "NextGen" category tab: *"What's happening with NextGen Court Academy?"* → *"Beginning October 1, NextGen Court Academy will transition to The Courts."*

No old NextGen URLs, no duplicate pages, no stale social links, no leftover NextGen business name anywhere else on the site. Nothing to remove here — these two mentions are doing real work (they're literally what a parent searching "NextGen Court Academy" would want to land on).

## Why this matters

If NextGen Court Academy had any organic rankings, backlinks, or a Google Business Profile with reviews, that's real accumulated search equity. Losing it means starting from zero on local search instead of carrying it forward. The standard, correct way to preserve it is a one-to-one **301 redirect** from each old URL to its closest equivalent on the new domain — never a blanket redirect-everything-to-the-homepage, which loses the specific relevance signal each old page had.

## Recommended 301 mapping

I don't have the actual list of NextGen's live URLs (no access to that domain). The mapping below is a **template** based on typical youth-sports-facility site structure and the page names already established on this site — confirm the actual old URLs before implementing, and adjust any row where the old site's structure differs from this guess.

| Old NextGen URL (typical pattern — confirm actual) | Redirects to | Notes |
|---|---|---|
| `/` (homepage) | `https://playthecourts.com/` | |
| `/basketball` or `/basketball-training` | `https://playthecourts.com/basketball` | |
| `/volleyball` or `/volleyball-training` | `https://playthecourts.com/volleyball` | |
| `/camps` | `https://playthecourts.com/camps` | |
| `/leagues` or `/basketball-leagues` | `https://playthecourts.com/leagues` | |
| `/private-training` or `/private-lessons` | `https://playthecourts.com/private-coaching` | Naming differs slightly — confirm old slug |
| `/membership` or `/memberships` | `https://playthecourts.com/membership` | |
| `/court-rental` or `/rentals` | `https://playthecourts.com/court-rentals` | |
| `/about` or `/about-us` | `https://playthecourts.com/about` | |
| `/contact` | `https://playthecourts.com/contact` | |
| `/schedule` or `/calendar` | `https://playthecourts.com/schedule` | |
| `/faq` | `https://playthecourts.com/faq` | |
| `/events` | `https://playthecourts.com/events` | |
| Any blog/news posts | Closest matching current page, or `/about` if no clear match | Do **not** send these to the homepage by default — a specific old post about, say, a past camp should go to `/camps`, not `/` |
| Anything with no clear current equivalent | `https://playthecourts.com/programs` (the general programs overview) rather than the homepage | Keeps the redirect topically relevant instead of a generic catch-all |

**Before implementing**: pull the actual list of indexed NextGen URLs from Google Search Console (if you have/can get access to that property) or a crawl tool, and replace the guessed slugs above with the real ones.

## How to actually implement the redirects

This depends entirely on where the NextGen domain is hosted, which I don't have visibility into. In order of preference:

1. **If NextGen's domain registrar/host supports server-side redirects** (most do — Squarespace, Wix, WordPress, GoDaddy, Namecheap, etc. all have a redirect feature): set up the 301s there, one row from the table above at a time. This is the cleanest option — the redirect happens before Google ever needs to re-crawl anything.
2. **If the NextGen site is being fully decommissioned and you control its DNS**: you could point the NextGen domain's DNS at this same GitHub Pages deployment and handle redirects via each page's own logic — but this is more fragile and not recommended unless option 1 isn't available.
3. **If you no longer have access to the NextGen domain at all**: the redirect option is off the table, and the realistic path is Search Console's Change of Address tool (below) plus rebuilding authority organically over time. Worth confirming which situation you're actually in before planning further.

## Google Search Console — Change of Address

If you have (or can get) *Search Console access to the old NextGen property*, use the **Change of Address tool** (Search Console → old property → Settings → Change of Address) to formally tell Google the site moved to `playthecourts.com`. This only works properly *after* the 301 redirects above are live — Google needs to be able to follow old URL → new URL before it'll accept the change-of-address signal. If you don't have access to a NextGen Search Console property, this step isn't available and redirects alone (once live) will still let Google's normal crawling gradually transfer signal — just slower.

## Sitemap updates

Once redirects are live: make sure `sitemap.xml` (already created in this pass — see `SEO_AUDIT.md`) only lists **current** playthecourts.com URLs, never old NextGen ones. It already does. No action needed there beyond what's already shipped.

## Redirect testing

Before considering this done:
- Spot-check every row in the mapping table with a real browser or `curl -I <old-url>` — confirm each returns `301` (not `302`) and lands on the intended new URL.
- Check that redirects preserve `https://` and don't accidentally redirect to `http://`.
- Test at least one URL you're confident was actually indexed/linked externally (if you know of any inbound links to the old site, prioritize those specific pages first).

## Backlink preservation

- Reach out to any sites you know link to NextGen Court Academy (partner orgs, schools, local press if any) and ask them to update the link to the new domain directly — a direct link update is always stronger than relying on a redirect chain.
- Redirects alone will pass most link equity over time as Google recrawls, but a direct update is faster and more reliable, especially for high-value links (see the local-authority section in `SEO_LAUNCH_CHECKLIST.md`).

## How long to keep the redirects live

**Indefinitely, or at minimum 12 months.** This is the standard SEO guidance for domain migrations — Google can take months to fully process a site move, and removing redirects early (or letting the old domain lapse/expire without them) forfeits whatever equity hasn't transferred yet. If the old domain's hosting/registration costs are a concern, keeping just the DNS + a minimal redirect-only setup alive is far cheaper than losing the migration's value.
