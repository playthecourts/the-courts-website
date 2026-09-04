"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function login(_prevState: unknown, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const next = (formData.get("next") as string) || "/my-courts";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Email or password is incorrect." };
  }

  redirect(next);
}

type AthleteInput = {
  firstName: string;
  lastName: string;
  dob: string;
  grade: string;
  gender: string;
};

export async function signup(_prevState: unknown, formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const familyName = (formData.get("familyName") as string)?.trim();

  if (!name || !email || !password || !familyName) {
    return { error: "Fill in all required fields." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const athleteCount = parseInt((formData.get("athleteCount") as string) || "0", 10);
  const athletes: AthleteInput[] = [];
  for (let i = 0; i < athleteCount; i++) {
    const firstName = (formData.get(`athlete_${i}_firstName`) as string)?.trim();
    const lastName = (formData.get(`athlete_${i}_lastName`) as string)?.trim();
    const dob = formData.get(`athlete_${i}_dob`) as string;
    if (!firstName || !lastName || !dob) continue;
    athletes.push({
      firstName,
      lastName,
      dob,
      grade: (formData.get(`athlete_${i}_grade`) as string)?.trim() || "",
      gender: (formData.get(`athlete_${i}_gender`) as string)?.trim() || "",
    });
  }
  if (athletes.length === 0) {
    return { error: "Add at least one athlete, with a name and date of birth." };
  }

  const supabase = await createClient();
  const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

  if (signUpError) {
    return { error: signUpError.message };
  }
  if (!data.user) {
    return { error: "Something went wrong creating your account. Try again." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const guardian = await tx.guardian.create({
        data: { authId: data.user!.id, name, email, phone },
      });
      const family = await tx.family.create({ data: { name: familyName } });
      await tx.familyGuardian.create({
        data: { familyId: family.id, guardianId: guardian.id, isPrimary: true },
      });
      await tx.athlete.createMany({
        data: athletes.map((a) => ({
          familyId: family.id,
          firstName: a.firstName,
          lastName: a.lastName,
          dob: new Date(`${a.dob}T00:00:00Z`),
          grade: a.grade || null,
          gender: a.gender || null,
        })),
      });
    });
  } catch {
    return {
      error:
        "Your account was created, but we couldn't finish setting up your family. Contact us and we'll fix it.",
    };
  }

  if (data.session) {
    redirect("/my-courts");
  }

  return { success: "Check your email to confirm your account, then sign in." };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
