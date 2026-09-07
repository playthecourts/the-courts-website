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
    background_color: "#FAF8F5",
    theme_color: "#1A1A1A",
    icons: [
      { src: "/brand/icon-mark-color.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-mark-color.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  });
}
