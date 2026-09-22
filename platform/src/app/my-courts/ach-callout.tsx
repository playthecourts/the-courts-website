// Shared between Membership and Camps checkout — same nudge, same copy,
// wherever a family is about to pay.
export function AchCallout() {
  return (
    <div className="mb-4 rounded-lg border border-orange bg-orange/5 px-5 py-5">
      <p className="font-sport text-base font-bold uppercase tracking-wide text-orange">
        Help Us Keep More on the Court
      </p>
      <p className="mt-2 font-body text-[15px] leading-relaxed text-near-black">
        Choose bank account (ACH) at checkout when you can. Same price for you, lower processing fees for us, and
        more going back into The Courts. Thanks for helping us keep more on the court!
      </p>
    </div>
  );
}
