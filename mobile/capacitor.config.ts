import type { CapacitorConfig } from "@capacitor/cli";

// The Courts app is a native shell around the live web app. Nothing is
// bundled except an offline fallback page: every screen — My Courts, the
// Coach App, Courts OS, Front Desk — loads from app.playthecourts.com, so a
// web deploy updates the app instantly with no App Store release.
//
// /start sends each person to their own side after sign-in (parent, coach,
// front desk, owner).
const config: CapacitorConfig = {
  appId: "com.playthecourts.app",
  appName: "The Courts",
  webDir: "www",
  server: {
    url: "https://app.playthecourts.com/start",
    // Stripe Checkout and the billing portal open inside the app so parents
    // come straight back after paying.
    allowNavigation: [
      "app.playthecourts.com",
      "playthecourts.com",
      "www.playthecourts.com",
      "checkout.stripe.com",
      "billing.stripe.com",
      "*.supabase.co",
    ],
    errorPath: "offline.html",
  },
  ios: {
    contentInset: "automatic",
    scheme: "The Courts",
  },
  android: {
    backgroundColor: "#F7F5F0",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#F7F5F0",
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
