import "server-only";
import http2 from "node:http2";
import { createSign, sign as cryptoSign } from "node:crypto";
import { prisma } from "@/lib/prisma";

// Push notifications to The Courts app on iPhone (Apple APNs) and Android
// (Firebase Cloud Messaging). Off until the keys are set in Vercel — every
// call is a silent no-op without them, so nothing here can break a request.
//
//   iPhone:  APNS_KEY_P8 (the .p8 file's contents), APNS_KEY_ID, APNS_TEAM_ID,
//            optional APNS_SANDBOX=1 for builds run from Xcode
//   Android: FIREBASE_SERVICE_ACCOUNT_JSON (the service-account JSON)
//
// Use pushToAuthUser for one person, pushToAuthUsers for several. Never
// awaited in a way that can fail the caller: errors are logged and swallowed.

const BUNDLE_ID = "com.playthecourts.app";

export type PushMessage = {
  title: string;
  body: string;
  /// Path inside the app to open when tapped, e.g. "/my-courts/payments".
  url?: string;
};

export async function pushToAuthUser(authId: string, msg: PushMessage) {
  return pushToAuthUsers([authId], msg);
}

export async function pushToAuthUsers(authIds: string[], msg: PushMessage) {
  try {
    if (!authIds.length) return 0;
    const devices = await prisma.pushDevice.findMany({ where: { authId: { in: authIds } } });
    let sent = 0;
    for (const d of devices) {
      const result = d.platform === "ios" ? await sendApns(d.token, msg) : await sendFcm(d.token, msg);
      if (result === "sent") sent++;
      // The phone uninstalled the app or turned notifications off for good.
      if (result === "gone") await prisma.pushDevice.delete({ where: { id: d.id } }).catch(() => {});
    }
    return sent;
  } catch (err) {
    console.error("push failed", err);
    return 0;
  }
}

type Result = "sent" | "gone" | "failed" | "off";

/* ------------------------------------------------------------------ APNs */

let apnsJwt: { token: string; at: number } | null = null;

function apnsToken(): string | null {
  const key = process.env.APNS_KEY_P8;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  if (!key || !keyId || !teamId) return null;
  // Apple wants a fresh token at most hourly and no older than an hour.
  if (apnsJwt && Date.now() - apnsJwt.at < 50 * 60_000) return apnsJwt.token;
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "ES256", kid: keyId })}.${b64({ iss: teamId, iat: Math.floor(Date.now() / 1000) })}`;
  const pem = key.includes("BEGIN") ? key.replace(/\\n/g, "\n") : `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----`;
  const signature = cryptoSign("sha256", Buffer.from(unsigned), { key: pem, dsaEncoding: "ieee-p1363" }).toString("base64url");
  apnsJwt = { token: `${unsigned}.${signature}`, at: Date.now() };
  return apnsJwt.token;
}

function sendApns(deviceToken: string, msg: PushMessage): Promise<Result> {
  const jwt = apnsToken();
  if (!jwt) return Promise.resolve("off");
  const host = process.env.APNS_SANDBOX === "1" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
  const payload = JSON.stringify({ aps: { alert: { title: msg.title, body: msg.body }, sound: "default" }, url: msg.url ?? null });

  return new Promise((resolve) => {
    const client = http2.connect(host);
    client.on("error", () => resolve("failed"));
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": BUNDLE_ID,
      "apns-push-type": "alert",
      "content-type": "application/json",
    });
    let status = 0;
    req.on("response", (h) => {
      status = Number(h[":status"]);
    });
    req.on("data", () => {});
    req.on("end", () => {
      client.close();
      resolve(status === 200 ? "sent" : status === 410 ? "gone" : "failed");
    });
    req.on("error", () => {
      client.close();
      resolve("failed");
    });
    req.end(payload);
  });
}

/* ------------------------------------------------------------------- FCM */

let fcmAccess: { token: string; exp: number; project: string } | null = null;

async function fcmAuth(): Promise<{ token: string; project: string } | null> {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  if (fcmAccess && fcmAccess.exp > Date.now() + 60_000) return fcmAccess;
  const sa = JSON.parse(raw) as { client_email: string; private_key: string; project_id: string };
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key.replace(/\\n/g, "\n")).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { access_token: string; expires_in: number };
  fcmAccess = { token: j.access_token, exp: Date.now() + j.expires_in * 1000, project: sa.project_id };
  return fcmAccess;
}

async function sendFcm(deviceToken: string, msg: PushMessage): Promise<Result> {
  const auth = await fcmAuth();
  if (!auth) return "off";
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${auth.project}/messages:send`, {
    method: "POST",
    headers: { authorization: `Bearer ${auth.token}`, "content-type": "application/json" },
    body: JSON.stringify({
      message: {
        token: deviceToken,
        notification: { title: msg.title, body: msg.body },
        data: msg.url ? { url: msg.url } : {},
        android: { priority: "high" },
      },
    }),
  });
  if (res.ok) return "sent";
  if (res.status === 404) return "gone";
  return "failed";
}
