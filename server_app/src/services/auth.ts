import crypto from "crypto";
import { SignJWT, jwtVerify } from "jose";

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    crypto.timingSafeEqual(a, a);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

export async function signAdminToken(
  username: string,
  jwtSecret: string,
  expiresIn: string
): Promise<string> {
  return new SignJWT({ sub: username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey(jwtSecret));
}

export async function verifyAdminToken(
  token: string,
  jwtSecret: string
): Promise<string> {
  const { payload } = await jwtVerify(token, secretKey(jwtSecret));
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new Error("Invalid token subject");
  }
  return payload.sub;
}
