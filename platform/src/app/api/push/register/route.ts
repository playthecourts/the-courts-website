import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// Called by The Courts app (iPhone/Android) after the person allows
// notifications. Saves this phone's push token against whoever is signed in.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { token?: unknown; platform?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const platform = body?.platform === "ios" || body?.platform === "android" ? body.platform : null;
  if (!token || token.length > 4096 || !platform) return NextResponse.json({ ok: false }, { status: 400 });

  await prisma.pushDevice.upsert({
    where: { token },
    create: { token, platform, authId: user.id },
    update: { authId: user.id, platform, lastSeenAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
