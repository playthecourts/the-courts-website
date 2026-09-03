import { getCurrentStaff } from "@/lib/admin-dal";
import { NewProgramForm } from "./new-program-form";

export default async function NewProgramPage() {
  await getCurrentStaff();

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">New Program</h1>
      <NewProgramForm />
    </div>
  );
}
