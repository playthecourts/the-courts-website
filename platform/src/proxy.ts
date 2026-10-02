import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Optimistic auth check only — reads the session cookie, does not hit the
// database. Redirects a signed-out guardian away from /my-courts and a
// signed-out user away from /admin. It intentionally does NOT check staff
// role for /admin: role authorization is a database lookup (staff_users),
// and per Next.js guidance, Proxy runs on every request (incl. prefetches)
// so DB checks belong in the route's own server-side data access layer,
// not here. Treat this as the first gate, not the only one.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Kiosk Mode lock (see lib/kiosk.ts). A device in Kiosk Mode can only show
  // the self check-in screen — every other page bounces back to /kiosk, so the
  // staff session it's signed in with can't be used from the lobby. /login and
  // /auth stay reachable so staff can sign the iPad back in if that session
  // expires; leaving Kiosk Mode itself goes through /kiosk/exit.
  if (
    request.cookies.get("courts_kiosk")?.value === "1" &&
    !path.startsWith("/kiosk") &&
    !path.startsWith("/login") &&
    !path.startsWith("/auth")
  ) {
    return NextResponse.redirect(new URL("/kiosk", request.url));
  }
  const isProtected = path.startsWith("/my-courts") || path.startsWith("/admin");

  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    // Carry the query string, not just the path. A "Book" link from
    // playthecourts.com is /my-courts/explore?offering=<id>; keeping only the
    // pathname dropped the offering at the login gate, so a logged-out family
    // — most of the website's traffic — signed in and landed on the full
    // browse list with no idea which class they had clicked.
    loginUrl.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // Messaging is hidden sitewide for now — every nav link and in-app button
  // to it is already removed, but a bookmarked or guessed URL could still
  // reach the page/route handlers directly without this. Blocked here
  // (rather than a notFound() call inside each page) so a bare, unconditional
  // "never returns" call doesn't wreck TypeScript's null-narrowing for the
  // rest of those files — confirmed the hard way.
  if (path.startsWith("/my-courts/messages") || path.startsWith("/os/communications")) {
    return NextResponse.rewrite(new URL("/messaging-is-not-a-real-page-404", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
