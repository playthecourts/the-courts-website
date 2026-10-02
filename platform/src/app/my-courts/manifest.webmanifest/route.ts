// Parent App web manifest, served at /my-courts/manifest.webmanifest.
//
// A route handler rather than Next's app/manifest.ts convention for the same
// reason as the Coach App's (coach/manifest.webmanifest/route.ts): that
// convention allows only ONE manifest at the app root, and this Next app
// serves two installable apps. Scoping this one to /my-courts/ is what makes
// "Add to Home Screen" install The Courts family app.
//
// Must be fetchable signed-out — proxy.ts exempts exactly this path from the
// /my-courts login redirect (browsers fetch manifests without credentials).
export function GET() {
  return Response.json(
    {
      name: "The Courts",
      short_name: "The Courts",
      description: "Book, schedule, and manage your family's time at The Courts.",
      id: "/my-courts",
      start_url: "/my-courts",
      // No trailing slash, deliberately: start_url "/my-courts" is NOT inside
      // a "/my-courts/" scope (scope is a plain prefix match), and a manifest
      // whose start_url falls outside its scope has the scope thrown out and
      // replaced with "/" — the whole site. Next also 308s "/my-courts/" to
      // "/my-courts", so the slash can't move to start_url instead.
      scope: "/my-courts",
      display: "standalone",
      orientation: "portrait",
      background_color: "#F7F5F0",
      theme_color: "#171717",
      icons: [
        { src: "/icons/parent-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/parent-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/parent-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } }
  );
}
