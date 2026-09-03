import { getCurrentStaff } from "@/lib/admin-dal";
import { NewWaiverForm } from "./new-waiver-form";

export default async function NewWaiverPage() {
  await getCurrentStaff();

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">New Waiver</h1>
      <NewWaiverForm />
    </div>
  );
}
