import { Router } from "express";

import { resetTestDataSchema } from "@matapon/shared/schemas/resetTestData";

import {
  createAccessToken,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "../services/auth.js";

import { pool } from "../db/pool.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
} from "../middleware/auth.js";

export const devRouter = Router();


function requireDevelopment(req: any, res: any, next: any) {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({
      error: "Development tools are disabled in production",
    });
    return;
  }

  next();
}

devRouter.get(
  "/users",
  requireDevelopment,
  async (_req, res) => {
    try {
      const result = await pool.query<{
        id: string;
        username: string;
        user_type: "member" | "staff" | "admin";
        must_change_password: boolean;
      }>(
        `
          SELECT
            id,
            username,
            user_type,
            must_change_password
          FROM users
          ORDER BY
            CASE user_type
              WHEN 'member' THEN 1
              WHEN 'staff' THEN 2
              WHEN 'admin' THEN 3
            END,
            LOWER(username)
        `
      );

      res.json({
        users: result.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not load development users",
      });
    }
  }
);

devRouter.post(
  "/login/:id",
  requireDevelopment,
  async (req, res) => {
    try {
      const result = await pool.query<{
        id: string;
        username: string;
        user_type: "member" | "staff" | "admin";
        must_change_password: boolean;
      }>(
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
        [req.params.id]
      );

      const user = result.rows[0];

      if (!user) {
        res.status(404).json({
          error: "Development user does not exist",
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
        user,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Development login failed",
      });
    }
  }
);

devRouter.post(
  "/reset-test-data",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    if (process.env.NODE_ENV === "production") {
      res.status(403).json({
        error: "Test data reset is disabled in production",
      });
      return;
    }

    const parsed = resetTestDataSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: 'Confirmation must be exactly "RESET"',
      });
      return;
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const adminResult = await client.query<{
        id: string;
        username: string;
      }>(
        `
          SELECT id, username
          FROM users
          WHERE username = 'admin'
            AND user_type = 'admin'
          LIMIT 1
        `
      );

      const admin = adminResult.rows[0];

      if (!admin) {
        await client.query("ROLLBACK");

        res.status(409).json({
          error: "Admin account not found; reset cancelled",
        });
        return;
      }

      await client.query(
        `SELECT set_config('matapon.actor_user_id', $1, true)`,
        [admin.id]
      );

      const tables = [
        "event_activity_signups",
        "member_attendees",
        "event_activity_staff",
        "event_meals",
        "activity_qualifications",
        "staff_qualifications",
        "qualifications",
        "staff_member_areas",
        "event_activities",
        "activity_others",
        "activities",
        "meal_types",
        "staff_areas",
        "staff_members",
        "event_type_others",
        "events",
        "event_types",
        "user_members",
      ];

      for (const table of tables) {
        if (table === "user_members") {
          await client.query(
            `DELETE FROM user_members WHERE member_role <> 'primary'`
          );

          await client.query(
            `DELETE FROM user_members WHERE member_role = 'primary'`
          );

          continue;
        }

        await client.query(`DELETE FROM ${table}`);
      }

      await client.query(
        `
          DELETE FROM users
          WHERE id <> $1
        `,
        [admin.id]
      );

      for (const table of tables) {
        await client.query(
          `
            SELECT setval(
              pg_get_serial_sequence($1, 'id'),
              1,
              false
            )
          `,
          [table]
        );
      }

      await client.query(
        `
          SELECT setval(
            pg_get_serial_sequence('users', 'id'),
            $1,
            true
          )
        `,
        [admin.id]
      );

      await client.query("COMMIT");

      res.json({
        ok: true,
        kept: {
          id: admin.id,
          username: admin.username,
        },
        message: "All test data deleted. Admin preserved.",
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(error);

      res.status(500).json({
        error: "Could not reset test data",
        detail:
          process.env.NODE_ENV !== "production" &&
          error instanceof Error
            ? error.message
            : undefined,
      });
    } finally {
      client.release();
    }
  }
);
