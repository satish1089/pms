import { cookies } from "next/headers";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { UserRole } from "@/lib/roles";

const SESSION_COOKIE = "projectly_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "Missing AUTH_SECRET. Add a long random string to .env.local."
    );
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = JWTPayload & {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
};

export async function createSessionToken(payload: Omit<SessionPayload, "iat" | "exp">) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  try {
    const { connectDB } = await import("@/lib/mongodb");
    const User = (await import("@/models/User")).default;
    await connectDB();
    const fresh = await User.findById(payload.sub)
      .select("name email role status")
      .lean();
    if (!fresh || fresh.status === "inactive") {
      return null;
    }
    const drifted =
      fresh.role !== payload.role ||
      fresh.name !== payload.name ||
      fresh.email !== payload.email;
    if (drifted) {
      const refreshed: SessionPayload = {
        ...payload,
        name: fresh.name,
        email: fresh.email,
        role: fresh.role as UserRole,
      };
      try {
        const newToken = await createSessionToken({
          sub: payload.sub,
          email: fresh.email,
          name: fresh.name,
          role: fresh.role as UserRole,
        });
        await setSessionCookie(newToken);
      } catch {
        // cookie can't be set in some contexts (e.g. RSC reads); fall through
      }
      return refreshed;
    }
    return payload;
  } catch {
    return payload;
  }
}

export { SESSION_COOKIE };
