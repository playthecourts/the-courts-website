import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Lands here from a Supabase auth email link (password reset today; the
// same route works for email confirmation if that's ever turned on) with a
// PKCE `code` param. Exchanging it here, server-side, is what turns the
// email link into a real session — the page it redirects to afterward
// (reset-password) can then just check for a signed-in user rather than
// handling any token itself.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/my-courts";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link_expired`);
}
