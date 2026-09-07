// Stripe tax codes The Courts actually needs, as a plain constant so the
// builder's client form can render it without importing the Stripe SDK.
//
// Deliberately a short, explicit list with plain descriptions rather than a
// searchable dump of Stripe's catalog — whoever picks one should understand
// what they are asserting. Tax treatment is never inferred from a program's
// name or marketing copy.

export const COURTS_TAX_CODES = [
  {
    code: "txcd_20060000",
    label: "Recreational instruction / lessons",
    hint: "Coach-led: group training, private training, clinics, camps, guided Dr. Dish.",
  },
  {
    code: "txcd_20050000",
    label: "Recreational admission / participation",
    hint: "League participation, open gym, events.",
  },
  {
    code: "txcd_20030000",
    label: "Facility rental",
    hint: "Court rentals, parties, self-service machine time.",
  },
  {
    code: "txcd_99999999",
    label: "General — tangible goods",
    hint: "Merchandise.",
  },
  {
    code: "txcd_00000000",
    label: "Nontaxable",
    hint: "Only where The Courts has confirmed the offering is genuinely exempt.",
  },
] as const;
