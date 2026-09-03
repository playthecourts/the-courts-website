import { getCurrentStaff } from "@/lib/admin-dal";
import { NewFamilyForm } from "./new-family-form";

export default async function NewFamilyPage() {
  await getCurrentStaff();

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">New Family</h1>
      <NewFamilyForm />
    </div>
  );
}
