import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Email-link landing route for password recovery (and any other emailed OTP).
//
// This exists because /auth/callback can't serve recovery links reliably.
// That route exchanges a PKCE `code`, and PKCE only completes in the SAME
// browser that asked for the reset — the code_verifier lives in a cookie set
// on that device. Request the reset on a laptop, open the mail on a phone (or
// in Gmail's in-app browser, or Outlook's preview pane) and the verifier isn't
// there, so the exchange fails and the person is told the link expired when it
// never did.
//
// verifyOtp carries no device state: the token_hash in the URL is the whole
// credential, so the link works wherever it's opened. /auth/callback is still
// live for any links already sitting in inboxes.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/my-courts";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // Supabase distinguishes a consumed/expired token from a malformed one;
    // both land the person on login, but the copy shouldn't guess.
    return NextResponse.redirect(`${origin}/login?error=link_expired`);
  }

  return NextResponse.redirect(`${origin}/login?error=link_invalid`);
}
