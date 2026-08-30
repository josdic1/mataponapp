import { Router } from "express";

import {
  createUserSchema,
  type UserType,
} from "@matapon/shared/schemas/users";

import { query } from "../db/db.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
} from "../middleware/auth.js";
import {
  createUserAccount,
  type UserAccountRow,
} from "../services/users.js";

export const usersRouter = Router();

usersRouter.get(
  "/",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (_req, res) => {
    try {
      const result = await query<UserAccountRow>(
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
      const user = await createUserAccount(parsed.data);

      res.status(201).json({
        user,
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
