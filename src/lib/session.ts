import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";

const SESSION_COOKIE = "sirh_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

const secretKey = process.env.SESSION_SECRET;
if (!secretKey) {
  throw new Error("SESSION_SECRET manquant dans les variables d'environnement");
}
const encodedKey = new TextEncoder().encode(secretKey);

export type SessionPayload = {
  userId: string;
  role: Role;
  expiresAt: number;
};

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey);
}

export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
    });
    if (
      typeof payload.userId !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.expiresAt !== "number"
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      role: payload.role as Role,
      expiresAt: payload.expiresAt,
    };
  } catch {
    return null;
  }
}

export async function createSession(userId: string, role: Role): Promise<void> {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const token = await encrypt({ userId, role, expiresAt });
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function readSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return decrypt(token);
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export { SESSION_COOKIE };
