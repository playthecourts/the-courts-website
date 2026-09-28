import { NextResponse } from "next/server";
import { sendNextGenReminderEmails } from "@/lib/nextgen-notifications";

// Vercel Cron calls this daily (see vercel.json) with
// `Authorization: Bearer ${CRON_SECRET}` automatically attached — same auth
// pattern as promote-grades, the only other cron job in the app.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendNextGenReminderEmails();
  return NextResponse.json({ ok: true, ...result });
}
