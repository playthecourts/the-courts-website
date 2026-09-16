# Internal Legal / Launch Review Notes

Not part of the public site. These items were pulled off terms.html, privacy.html,
and accessibility.html because they were internal drafting notes, not customer-facing
copy. Keeping them here so they don't get lost before launch.

## Terms & Conditions (terms.html)

**Memberships + Recurring Billing** — the 30-day cancellation notice period is approved
and live on the page. Still need to be finalized internally:
- Billing-date treatment relative to the notice period
- Membership freezes / pauses
- Failed-payment handling
- Termination rights
- Refunds
- Minimum commitments, if any
- Treatment of unused membership benefits
- Reset / expiration of included benefits

**Cancellations + Refunds** — finalize cancellation / refund rules for: memberships,
camps, leagues, private training, rentals, events, no-shows, weather cancellations,
and credits / make-ups.

**Website Information + Liability** — participant waiver, assumption of risk, minor
consent, medical authorization, and related participation documents require separate
Tennessee counsel review. The website Terms are not a substitute for the participant
waiver. Also: confirm the limitation-of-liability paragraph language with counsel.

**Governing Law + Changes** — confirm Tennessee governing-law language and whether
venue / jurisdiction language should be added.

## Privacy Policy (privacy.html)

Vendor / tech-stack identification still needed before the Cookies + Third-Party
Services sections can be made vendor-specific:
- Membership / scheduling platform
- Merchandise / fulfillment provider
- Payment processor
- Analytics provider
- Email platform
- Form / communications providers

Cookie / analytics QA still needed:
- Identify analytics provider
- Identify any marketing pixels
- Identify any advertising / retargeting technology
- Determine whether a cookie banner or consent tool is required
- Confirm what cookies are set before consent
- Confirm any applicable opt-out mechanisms

Privacy request process still needed:
- Who monitors privacy requests
- How identity will be verified if necessary
- How deletion / correction requests will be handled
- What data exists across third-party systems
- How requests involving minor athletes will be handled
- Applicable response timelines

Also confirm before publishing further: whether "We do not sell personal information"
remains accurate once the advertising/analytics stack is finalized. Do not publish
COPPA/GDPR/CCPA compliance claims until specifically reviewed.

## Membership Policies (membership-policies.html)

Pulled off the live page during the pre-launch audit — same reason as the terms.html/privacy.html/accessibility.html items above (internal drafting notes, not customer-facing copy). Still need to be finalized:
- Exact billing-date logic (join-date anniversary vs. 1st of month) and how partial first months are handled.
- How the 30-day cancellation notice lines up with the next billing date, exactly how cancellation requests are submitted, and when cancellation formally takes effect.
- Whether membership pauses/freezes (injury, travel, off-season) are offered — if so, the process, notice, and any limits. No "Pauses / Freezes" section exists on the page at all right now (removed rather than left empty) until this is decided.
- Retry schedule and grace period for a failed membership payment, and what happens to registrations if it isn't resolved.
- Refund/credit policy for billing errors, facility closures, or other exceptions.

One item was resolved and published, not left pending: the 12-hour group-training/Dr.-Dish cancellation policy already lived on faq.html but was missing from this page — added here now, matching the real REFUND_CUTOFF_HOURS behavior already built into the app.

Fall League and camp refund policies still have no specific published terms anywhere on the site (only a generic blanket line in terms.html) — not yet drafted at all, not just pulled from this page.

## Facility Policies (facility-policies.html)

Also pulled off the live page during the pre-launch audit:
- Age-specific drop-off / parent-presence requirements — to be finalized separately.
- Whether younger athletes require a parent/guardian to remain on-site during their session, and at what age that changes. No "Parent / Guardian Presence" section exists on the page at all right now (removed rather than left empty) until this is decided.
- Standard late-pickup policy, including any applicable fee, before publishing. No "Late Pickup" section exists on the page at all right now, same reason.

The "Weather / Facility Closures" section on this page currently only commits to notifying affected families — it does not say what happens to a paid/scheduled session (credit, make-up, refund). That's the same open decision as the "facility closures" line item in the Refunds + Credits gap above, not a separate one.

## Accessibility (accessibility.html)

No formal accessibility audit or verification has been completed for
playthecourts.com. Until one has, do not state that the site "complies with,"
"conforms to," or "is certified under" any specific WCAG level or accessibility
standard — commitment / ongoing-improvement language only.

Internal checklist, not yet verified:
- Keyboard-only navigation
- Visible focus states
- Skip-to-content functionality
- Heading hierarchy
- Accessible names for interactive controls
- Form labels
- Form errors and validation
- Color contrast
- Alternative text
- Decorative image handling
- Mobile touch target sizing
- Reduced-motion behavior where applicable
- Captions / transcripts for meaningful video
- Accessibility of embedded / third-party services
- SVG accessibility
- Link purpose
- Modal / menu focus management
- Screen-reader testing
