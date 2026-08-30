import { Router } from "express";
import argon2 from "argon2";

import { createUserSchema } from "@matapon/shared/schemas/adminUsers";

import { query } from "../db/db.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
} from "../middleware/auth.js";

type UserRow = {
  id: string;
  username: string;
  user_type: "member" | "staff" | "admin";
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
};

export const usersRouter = Router();

usersRouter.get(
  "/",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (_req, res) => {
    try {
      const result = await query<UserRow>(
        `
          SELECT
            id,
            username,
            user_type,
            must_change_password,
            created_at,
            updated_at
          FROM users
          ORDER BY id
        `
      );

      res.json({
        users: result.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not load users",
      });
    }
  }
);

usersRouter.post(
  "/",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed = createUserSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid user",
      });
      return;
    }

    try {
      const passwordHash = await argon2.hash(
        parsed.data.temporary_password,
        {
          type: argon2.argon2id,
        }
      );

      const result = await query<UserRow>(
        `
          INSERT INTO users (
            username,
            password_hash,
            user_type,
            must_change_password
          )
          VALUES ($1, $2, $3, true)
          RETURNING
            id,
            username,
            user_type,
            must_change_password,
            created_at,
            updated_at
        `,
        [
          parsed.data.username,
          passwordHash,
          parsed.data.user_type,
        ]
      );

      res.status(201).json({
        user: result.rows[0],
      });
    } catch (error: any) {
      if (error?.code === "23505") {
        res.status(409).json({
          error: "Username already exists",
        });
        return;
      }

      console.error(error);

      res.status(500).json({
        error: "Could not create user",
      });
    }
  }
);
