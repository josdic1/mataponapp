import argon2 from "argon2";
import jwt, { type JwtPayload } from "jsonwebtoken";

import type { UserType } from "@matapon/shared/schemas/users";

export const SESSION_COOKIE_NAME = "matapon_session";

export type AuthTokenPayload = {
  sub: string;
  username: string;
  user_type: UserType;
};

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is required");
  }

  return secret;
}

function getSessionHours(): number {
  const value = Number(process.env.SESSION_HOURS || "12");

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("SESSION_HOURS must be a positive number");
  }

  return value;
}

export function getSessionMaxAgeMs(): number {
  return getSessionHours() * 60 * 60 * 1000;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
  });
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
}

export function createAccessToken(user: {
  id: string | number;
  username: string;
  user_type: UserType;
}): string {
  return jwt.sign(
    {
      username: user.username,
      user_type: user.user_type,
    },
    getJwtSecret(),
    {
      subject: String(user.id),
      expiresIn: getSessionHours() * 60 * 60,
    }
  );
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, getJwtSecret());

  if (typeof decoded === "string") {
    throw new Error("Invalid token");
  }

  const payload = decoded as JwtPayload;

  if (
    typeof payload.sub !== "string" ||
    typeof payload.username !== "string" ||
    !["member", "staff", "admin"].includes(String(payload.user_type))
  ) {
    throw new Error("Invalid token");
  }

  return {
    sub: payload.sub,
    username: payload.username,
    user_type: payload.user_type as UserType,
  };
}
