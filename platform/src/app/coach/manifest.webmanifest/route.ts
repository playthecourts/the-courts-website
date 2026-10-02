// Coach App web manifest, served at /coach/manifest.webmanifest.
//
// A route handler rather than Next's app/manifest.ts convention, because that
// convention only supports ONE manifest at the app root — and this Next app
// also serves the Parent App, which should keep its own identity. Scoping the
// manifest to /coach is what makes "Add to Home Screen" install *The Courts
// Coach* rather than the family portal.
export function GET() {
  return Response.json({
    name: "The Courts Coach",
    short_name: "Courts Coach",
    description: "Run today's court — schedule, rosters, attendance and notes for Courts coaches.",
    start_url: "/coach",
    scope: "/coach/",
    display: "standalone",
    orientation: "portrait",
    // Dark, to match the icons — the splash screen reads as one piece.
    background_color: "#171717",
    theme_color: "#171717",
    // Square icons only: a non-square source fails install or gets stretched.
    icons: [
      { src: "/icons/coach-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/coach-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/coach-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  });
}
