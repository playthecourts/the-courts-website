import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/admin-dal";

export default async function AdminIndexPage() {
  await getCurrentStaff();
  redirect("/admin/families");
}
