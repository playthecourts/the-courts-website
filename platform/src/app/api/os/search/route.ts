import { NextResponse } from "next/server";
import { getOsActorOrNull } from "@/lib/os/dal";
import { globalSearch } from "@/lib/os/search";

// Search endpoint for the command palette. Authorization is re-derived here
// from the session — the client sends only a query string, never a role or a
// scope, so there is nothing for a caller to tamper with.
export async function GET(request: Request) {
  const actor = await getOsActorOrNull();
  if (!actor) return NextResponse.json({ results: [] }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q") ?? "";
  const results = await globalSearch(actor, q);
  return NextResponse.json({ results });
}
