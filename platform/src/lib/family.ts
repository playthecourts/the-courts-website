// The "Crew" display name for the family account area — turns whatever a
// guardian typed as their Family Name at signup ("The Smith Family",
// "Carle Family", "The Carles") into one consistent, warm format: "The
// {Name} Crew". Strips a leading "The" and a trailing "Family" first so
// neither word doubles up once we add our own.

export function familyCrewName(rawName: string | null | undefined): string {
  const trimmed = (rawName ?? "").trim();
  if (!trimmed) return "Your Courts Crew";

  const core = trimmed
    .replace(/^the\s+/i, "")
    .replace(/\s+family$/i, "")
    .trim();

  if (!core) return "Your Courts Crew";
  return `The ${core} Crew`;
}

export function familyCrewInitials(rawName: string | null | undefined): string {
  const display = familyCrewName(rawName).replace(/^the\s+/i, "");
  const words = display.split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "C";
  const second = words[1]?.[0] ?? "C";
  return (first + second).toUpperCase();
}
