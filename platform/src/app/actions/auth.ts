"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { matchEvalAttendanceForNewAthlete } from "@/lib/eval-attendance";
import { sendNewAccountStaffAlert } from "@/lib/registration-notifications";

async function getOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  return `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
}

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

type NextGenAnswer = "new" | "former_nextgen" | "current_nextgen";

type SignupValues = {
  name: string;
  email: string;
  phone: string;
  familyName: string;
  athletes: AthleteInput[];
  nextGenStatus: NextGenAnswer | "";
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
  const nextGenStatusRaw = (formData.get("nextGenStatus") as string) || "";
  const nextGenStatus: NextGenAnswer | "" =
    nextGenStatusRaw === "new" || nextGenStatusRaw === "former_nextgen" || nextGenStatusRaw === "current_nextgen"
      ? nextGenStatusRaw
      : "";
  return {
    name: (formData.get("name") as string)?.trim() || "",
    email: (formData.get("email") as string)?.trim() || "",
    phone: (formData.get("phone") as string)?.trim() || "",
    familyName: (formData.get("familyName") as string)?.trim() || "",
    athletes,
    nextGenStatus,
  };
}

export async function signup(_prevState: unknown, formData: FormData) {
  const values = readSignupValues(formData);
  const password = formData.get("password") as string;

  if (!values.name || !values.email || !password || !values.familyName) {
    return { error: "Fill in all required fields.", values };
  }
  if (!values.nextGenStatus) {
    return { error: "Let us know whether you're a NextGen family.", values };
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
      error: "Looks like you already have an account with this email.",
      existingAccount: true,
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
      error: "Looks like you already have an account with this email.",
      existingAccount: true,
      values,
    };
  }

  let newAthleteIds: string[] = [];
  let newGuardianId: string | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      const guardian = await tx.guardian.create({
        data: {
          authId: data.user!.id,
          name: values.name,
          email: values.email,
          phone: values.phone || null,
          nextGenStatus: values.nextGenStatus === "new" ? null : (values.nextGenStatus as "former_nextgen" | "current_nextgen"),
          nextGenVerification: values.nextGenStatus === "new" ? null : "unverified",
          // Current NextGen members automatically qualify as Founders — no
          // 25-cap, no admin gate on the LABEL. Only their actual legacy
          // RATE still needs admin assignment (legacyRateCents stays null
          // here). Former NextGen only earns isFounder once admin
          // verifies/links/approves them (os/nextgen/actions.ts).
          isFounder: values.nextGenStatus === "current_nextgen",
        },
      });
      const family = await tx.family.create({ data: { name: values.familyName } });
      await tx.familyGuardian.create({
        data: { familyId: family.id, guardianId: guardian.id, isPrimary: true },
      });
      const createdAthletes = await Promise.all(
        touchedAthletes.map((a) =>
          tx.athlete.create({
            data: {
              familyId: family.id,
              firstName: a.firstName,
              lastName: a.lastName,
              dob: new Date(`${a.dob}T00:00:00Z`),
              grade: a.grade,
              gender: a.gender,
            },
          })
        )
      );
      newAthleteIds = createdAthletes.map((a) => a.id);
      newGuardianId = guardian.id;
    });
  } catch {
    return {
      error:
        "Your account was created, but we couldn't finish setting up your family. Contact us and we'll fix it.",
    };
  }

  // Best-effort — links a family that attended League evals before ever
  // creating an account (see lib/eval-attendance.ts). Never blocks signup.
  await Promise.all(
    touchedAthletes.map((a, i) => matchEvalAttendanceForNewAthlete(newAthleteIds[i], a.firstName, a.lastName))
  );

  // Best-effort staff notification — never blocks signup on a failed send
  // (sendEmail already swallows its own errors).
  if (newGuardianId) {
    await sendNewAccountStaffAlert(newGuardianId);
  }

  if (data.session) {
    // An explicit destination (e.g. a League registration link) always wins
    // — only when there isn't one does the NextGen answer pick the default
    // landing page.
    const next = (formData.get("next") as string) || "";
    if (next) {
      redirect(next);
    }
    if (values.nextGenStatus === "former_nextgen") {
      redirect("/my-courts/memberships");
    }
    redirect("/my-courts");
  }

  return { success: "Check your email to confirm your account, then sign in." };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Always the same message regardless of whether the email exists — same
// reason signup's "email already exists" check can't be echoed back here:
// confirming or denying an email is registered is exactly what a password
// reset form should never reveal.
const RESET_REQUESTED_MESSAGE = "If an account exists for that email, we've sent a link to reset your password.";

export async function requestPasswordReset(_prevState: unknown, formData: FormData) {
  const email = (formData.get("email") as string)?.trim();
  if (!email) {
    return { error: "Enter your email address." };
  }

  const supabase = await createClient();
  const origin = await getOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  // A real send failure (bad email format Supabase itself rejects, rate
  // limit) is worth surfacing — silently swallowing every error here would
  // hide a genuine "this can never work" case behind the generic message.
  if (error && error.code !== "email_not_confirmed") {
    return { error: "Something went wrong. Try again in a moment." };
  }

  return { success: RESET_REQUESTED_MESSAGE };
}

export async function updatePassword(_prevState: unknown, formData: FormData) {
  const password = formData.get("password") as string;
  if (!password || password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  // Only reachable with a valid recovery session — exchanged for one by
  // /auth/callback right before landing here. No session means the link was
  // invalid or already used, not that the password is wrong.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "This reset link has expired or was already used. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "Something went wrong. Try again." };
  }

  redirect("/my-courts");
}
