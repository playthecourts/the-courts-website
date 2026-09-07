import Link from "next/link";
import AddAthleteForm from "./add-athlete-form";

export const metadata = { title: "Add an Athlete" };

export default function NewAthletePage() {
  return (
    <div>
      <Link
        href="/my-courts/athletes"
        className="font-sport text-xs font-bold uppercase tracking-wide text-gray-dark hover:text-orange"
      >
        &larr; My Athletes
      </Link>
      <div className="mt-4">
        <AddAthleteForm />
      </div>
    </div>
  );
}
