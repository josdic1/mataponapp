import { Router } from "express";

import {
  createUserSchema,
  updateUserSchema,
  userIdParamsSchema,
  type UserType,
} from "@matapon/shared/schemas/users";

import { pool } from "../db/pool.js";
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

usersRouter.get(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed = userIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid user id",
      });
      return;
    }

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
          WHERE id = $1
          LIMIT 1
        `,
        [parsed.data.id]
      );

      const user = result.rows[0];

      if (!user) {
        res.status(404).json({
          error: "User does not exist",
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

usersRouter.patch(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const params = userIdParamsSchema.safeParse(req.params);
    const body = updateUserSchema.safeParse(req.body);

    if (!params.success) {
      res.status(400).json({
        error: "Invalid user id",
      });
      return;
    }

    if (!body.success) {
      res.status(400).json({
        error: "Invalid user data",
      });
      return;
    }

    try {
      const result = await query<UserAccountRow>(
        `
          UPDATE users
          SET
            username = COALESCE($2, username),
            updated_at = CURRENT_TIMESTAMP::text
          WHERE id = $1
          RETURNING
            id,
            username,
            user_type,
            must_change_password,
            created_at,
            updated_at
        `,
        [
          params.data.id,
          body.data.username ?? null,
        ]
      );

      const user = result.rows[0];

      if (!user) {
        res.status(404).json({
          error: "User does not exist",
        });
        return;
      }

      res.json({
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
        error: "Could not update user",
      });
    }
  }
);

usersRouter.delete(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed = userIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid user id",
      });
      return;
    }

    if (String(parsed.data.id) === String(req.auth!.sub)) {
      res.status(409).json({
        error: "Cannot delete the account you are currently using",
      });
      return;
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `SELECT set_config('matapon.actor_user_id', $1, true)`,
        [req.auth!.sub]
      );

      const exists = await client.query<{ id: string }>(
        `
          SELECT id
          FROM users
          WHERE id = $1
          FOR UPDATE
        `,
        [parsed.data.id]
      );

      if (!exists.rows[0]) {
        await client.query("ROLLBACK");

        res.status(404).json({
          error: "User does not exist",
        });
        return;
      }

      const dependencies = await client.query<{
        user_members: string;
        staff_members: string;
      }>(
        `
          SELECT
            (
              SELECT COUNT(*)::text
              FROM user_members
              WHERE user_id = $1
            ) AS user_members,
            (
              SELECT COUNT(*)::text
              FROM staff_members
              WHERE user_id = $1
            ) AS staff_members
        `,
        [parsed.data.id]
      );

      const counts = dependencies.rows[0];

      if (
        Number(counts.user_members) > 0 ||
        Number(counts.staff_members) > 0
      ) {
        await client.query("ROLLBACK");

        res.status(409).json({
          error:
            "Cannot delete a user account while household or staff profiles still belong to it",
        });
        return;
      }

      await client.query(
        `
          DELETE FROM users
          WHERE id = $1
        `,
        [parsed.data.id]
      );

      await client.query("COMMIT");

      res.json({
        ok: true,
        deleted_user_id: String(parsed.data.id),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(error);

      res.status(500).json({
        error: "Could not delete user",
      });
    } finally {
      client.release();
    }
  }
);
