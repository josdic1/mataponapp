import type {
  NextFunction,
  Request,
  Response,
} from "express";

import type { UserType } from "@matapon/shared/schemas/users";

import { query } from "../db/db.js";
import {
  SESSION_COOKIE_NAME,
  verifyAccessToken,
  type AuthTokenPayload,
} from "../services/auth.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
    }
  }
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.cookies?.[SESSION_COOKIE_NAME];

  if (!token) {
    res.status(401).json({
      error: "Authentication required",
    });
    return;
  }

  try {
    req.auth = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({
      error: "Invalid or expired session",
    });
  }
}

export async function requirePasswordChanged(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.auth) {
    res.status(401).json({
      error: "Authentication required",
    });
    return;
  }

  try {
    const result = await query<{
      must_change_password: boolean;
    }>(
      `
        SELECT must_change_password
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [req.auth.sub]
    );

    const user = result.rows[0];

    if (!user) {
      res.status(401).json({
        error: "User no longer exists",
      });
      return;
    }

    if (user.must_change_password) {
      res.status(403).json({
        error: "PASSWORD_CHANGE_REQUIRED",
      });
      return;
    }

    next();
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Authentication check failed",
    });
  }
}

export function requireRole(...allowedRoles: UserType[]) {
  return (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.auth) {
      res.status(401).json({
        error: "Authentication required",
      });
      return;
    }

    if (!allowedRoles.includes(req.auth.user_type)) {
      res.status(403).json({
        error: "Forbidden",
      });
      return;
    }

    next();
  };
}
