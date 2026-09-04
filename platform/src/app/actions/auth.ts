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

type SignupValues = {
  name: string;
  email: string;
  phone: string;
  familyName: string;
  athletes: AthleteInput[];
};

function readSignupValues(formData: FormData): SignupValues {
  const athleteCount = parseInt((formData.get("athleteCount") as string) || "0", 10);
  const athletes: AthleteInput[] = [];
  for (let i = 0; i < athleteCount; i++) {
    athletes.push({
      firstName: (formData.get(`athlete_${i}_firstName`) as string)?.trim() || "",
      lastName: (formData.get(`athlete_${i}_lastName`) as string)?.trim() || "",
      dob: (formData.get(`athlete_${i}_dob`) as string) || "",
      grade: (formData.get(`athlete_${i}_grade`) as string)?.trim() || "",
      gender: (formData.get(`athlete_${i}_gender`) as string)?.trim() || "",
    });
  }
  return {
    name: (formData.get("name") as string)?.trim() || "",
    email: (formData.get("email") as string)?.trim() || "",
    phone: (formData.get("phone") as string)?.trim() || "",
    familyName: (formData.get("familyName") as string)?.trim() || "",
    athletes,
  };
}

export async function signup(_prevState: unknown, formData: FormData) {
  const values = readSignupValues(formData);
  const password = formData.get("password") as string;

  if (!values.name || !values.email || !password || !values.familyName) {
    return { error: "Fill in all required fields.", values };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", values };
  }

  const touchedAthletes = values.athletes.filter((a) => a.firstName || a.lastName || a.dob);
  for (const a of touchedAthletes) {
    if (!a.firstName || !a.lastName || !a.dob || !a.grade || !a.gender) {
      return {
        error: "Fill in name, date of birth, grade, and gender for every athlete.",
        values,
      };
    }
  }
  if (touchedAthletes.length === 0) {
    return { error: "Add at least one athlete.", values };
  }

  const existing = await prisma.guardian.findUnique({ where: { email: values.email } });
  if (existing) {
    return {
      error: "An account with this email already exists. Try signing in instead.",
      values,
    };
  }

  const supabase = await createClient();
  const { data, error: signUpError } = await supabase.auth.signUp({
    email: values.email,
    password,
  });

  if (signUpError) {
    return { error: signUpError.message, values };
  }
  if (!data.user) {
    return { error: "Something went wrong creating your account. Try again.", values };
  }
  // Supabase returns a user with no identities (rather than an error) when the email
  // already belongs to an existing account, to avoid revealing which emails are registered.
  if (data.user.identities?.length === 0) {
    return {
      error: "An account with this email already exists. Try signing in instead.",
      values,
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const guardian = await tx.guardian.create({
        data: { authId: data.user!.id, name: values.name, email: values.email, phone: values.phone || null },
      });
      const family = await tx.family.create({ data: { name: values.familyName } });
      await tx.familyGuardian.create({
        data: { familyId: family.id, guardianId: guardian.id, isPrimary: true },
      });
      await tx.athlete.createMany({
        data: touchedAthletes.map((a) => ({
          familyId: family.id,
          firstName: a.firstName,
          lastName: a.lastName,
          dob: new Date(`${a.dob}T00:00:00Z`),
          grade: a.grade,
          gender: a.gender,
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
