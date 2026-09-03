import { getCurrentStaff } from "@/lib/admin-dal";
import { NewResourceForm } from "./new-resource-form";

export default async function NewResourcePage() {
  await getCurrentStaff();

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">New Resource</h1>
      <NewResourceForm />
    </div>
  );
}
