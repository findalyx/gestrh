"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";

export type LoginState = {
  error?: string;
  email?: string;
} | undefined;

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email et mot de passe requis.", email };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Compare toujours, même si l'utilisateur n'existe pas, pour éviter de fuiter
  // l'existence d'un compte par chronométrage.
  const fallbackHash = "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi";
  const hash = user?.passwordHash ?? fallbackHash;
  const isValid = await bcrypt.compare(password, hash);

  if (!user || !user.isActive || !isValid) {
    return { error: "Identifiants invalides.", email };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await createSession(user.id, user.role);
  redirect("/tableau-de-bord");
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
