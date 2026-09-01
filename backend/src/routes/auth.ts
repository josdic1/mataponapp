import { Router } from "express";
import { rateLimit } from "express-rate-limit";

import { loginSchema, changePasswordSchema } from "@matapon/shared/schemas/auth";
import type { SessionUser, UserType } from "@matapon/shared/schemas/users";

import { query } from "../db/db.js";
import { endpointContracts } from "../matapon/endpoints.js";
import { requireAuth } from "../middleware/auth.js";
import {
  SESSION_COOKIE_NAME,
  createAccessToken,
  sessionCookieOptions,
  hashPassword,
  verifyPassword,
} from "../services/auth.js";

type AuthUserRow = {
  id: string;
  username: string;
  password_hash: string;
  user_type: UserType;
  must_change_password: boolean;
};

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});



authRouter.post(endpointContracts.login.path.replace("/api/auth", ""), loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Username and password are required",
    });
    return;
  }

  try {
    const result = await query<AuthUserRow>(
      `
        SELECT
          id,
          username,
          password_hash,
          user_type,
          must_change_password
        FROM users
        WHERE regexp_replace(
          lower(username),
          '[[:space:]]+',
          '',
          'g'
        ) = regexp_replace(
          lower($1),
          '[[:space:]]+',
          '',
          'g'
        )
        LIMIT 1
      `,
      [parsed.data.username]
    );

    const user = result.rows[0];

    if (!user) {
      res.status(401).json({
        error: "Invalid username or password",
      });
      return;
    }

    const passwordIsValid = await verifyPassword(
      parsed.data.password,
      user.password_hash
    );

    if (!passwordIsValid) {
      res.status(401).json({
        error: "Invalid username or password",
      });
      return;
    }

    const token = createAccessToken(user);

    res.cookie(
      SESSION_COOKIE_NAME,
      token,
      sessionCookieOptions()
    );

    res.json({
      user: {
        id: user.id,
        username: user.username,
        user_type: user.user_type,
        must_change_password: user.must_change_password,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Login failed",
    });
  }
});

authRouter.get(endpointContracts.me.path.replace("/api/auth", ""), requireAuth, async (req, res) => {
  try {
    const result = await query<SessionUser>(
      `
        SELECT
          id,
          username,
          user_type,
          must_change_password
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [req.auth!.sub]
    );

    const user = result.rows[0];

    if (!user) {
      res.status(401).json({
        error: "User no longer exists",
      });
      return;
    }

    res.json({
      user,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Could not load user",
    });
  }
});

authRouter.post(
  endpointContracts.changePassword.path.replace("/api/auth", ""),
  requireAuth,
  async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Current password and new password are required",
      });
      return;
    }

    try {
      const result = await query<{
        password_hash: string;
      }>(
        `
          SELECT password_hash
          FROM users
          WHERE id = $1
          LIMIT 1
        `,
        [req.auth!.sub]
      );

      const user = result.rows[0];

      if (!user) {
        res.status(401).json({
          error: "User no longer exists",
        });
        return;
      }

      const passwordIsValid = await verifyPassword(
        parsed.data.current_password,
        user.password_hash
      );

      if (!passwordIsValid) {
        res.status(401).json({
          error: "Current password is incorrect",
        });
        return;
      }

      const newPasswordHash = await hashPassword(
        parsed.data.new_password
      );

      await query(
        `
          UPDATE users
          SET
            password_hash = $1,
            must_change_password = FALSE,
            updated_at = CURRENT_TIMESTAMP::text
          WHERE id = $2
        `,
        [
          newPasswordHash,
          req.auth!.sub,
        ]
      );

      res.json({
        ok: true,
        must_change_password: false,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Password change failed",
      });
    }
  }
);

authRouter.post(endpointContracts.logout.path.replace("/api/auth", ""), (_req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  res.json({
    ok: true,
  });
});
