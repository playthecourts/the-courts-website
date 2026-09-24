import { NextResponse } from "next/server";
import { promoteAllGrades } from "@/lib/grade-promotion";

// Vercel Cron calls this every June 1 (see vercel.json) with
// `Authorization: Bearer ${CRON_SECRET}` automatically attached — that's the
// whole auth story, no session/cookie involved since nobody is logged in
// when this fires.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await promoteAllGrades();
  return NextResponse.json({
    ok: true,
    promotedCount: result.promoted.length,
    keptAt12thCount: result.keptAt12th.length,
    unparsedCount: result.unparsed.length,
    unparsed: result.unparsed,
  });
}
