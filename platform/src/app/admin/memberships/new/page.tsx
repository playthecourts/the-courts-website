import { getCurrentStaff } from "@/lib/admin-dal";
import { NewPlanForm } from "./new-plan-form";

export default async function NewMembershipPlanPage() {
  await getCurrentStaff();

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">New Membership Plan</h1>
      <NewPlanForm />
    </div>
  );
}
