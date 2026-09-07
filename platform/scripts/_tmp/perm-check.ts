import { can, type OsActor } from "../../src/lib/os/permissions";

const roles = ["owner", "admin", "head_coach", "coach", "front_desk", "marketing", "finance_viewer"] as const;
const actor = (role: string): OsActor => ({
  id: "x", name: "x", email: "x", role: role as never, sports: [], active: true,
});

console.log("role            media status | consent detail | athlete records");
for (const r of roles) {
  const a = actor(r);
  console.log(
    r.padEnd(15),
    String(can(a, "athletes.viewMediaStatus")).padEnd(12),
    "|",
    String(can(a, "families.viewSensitive")).padEnd(14),
    "|",
    String(can(a, "athletes.view"))
  );
}
