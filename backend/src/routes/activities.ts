import { Router } from "express";

import { createActivitySchema } from "@matapon/shared/schemas/activities";

import { pool } from "../db/pool.js";
import { query } from "../db/db.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
} from "../middleware/auth.js";

type ActivityRow = {
  id: string;
  name: string;
  setting: "inside" | "outside" | "other";
  created_at: string;
  updated_at: string;
};

export const activitiesRouter = Router();

activitiesRouter.get(
  "/",
  requireAuth,
  requirePasswordChanged,
  async (_req, res) => {
    try {
      const result = await query<ActivityRow>(
        `
          SELECT
            id,
            name,
            setting,
            created_at,
            updated_at
          FROM activities
          ORDER BY name
        `
      );

      res.json({
        activities: result.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not load activities",
      });
    }
  }
);

activitiesRouter.post(
  "/",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed = createActivitySchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid activity data",
      });
      return;
    }

    if (
      parsed.data.setting === "other" &&
      (!parsed.data.other_value || !parsed.data.other_reason)
    ) {
      res.status(400).json({
        error: "Other setting requires value and reason",
      });
      return;
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query<ActivityRow>(
        `
          INSERT INTO activities (
            name,
            setting
          )
          VALUES ($1, $2)
          RETURNING
            id,
            name,
            setting,
            created_at,
            updated_at
        `,
        [
          parsed.data.name,
          parsed.data.setting,
        ]
      );

      const activity = result.rows[0];

      if (parsed.data.setting === "other") {
        await client.query(
          `
            INSERT INTO activity_others (
              activity_id,
              value,
              reason
            )
            VALUES ($1, $2, $3)
          `,
          [
            activity.id,
            parsed.data.other_value,
            parsed.data.other_reason,
          ]
        );
      }

      await client.query("COMMIT");

      res.status(201).json({
        activity: {
          ...activity,
          ...(parsed.data.setting === "other"
            ? {
                setting_other: {
                  value: parsed.data.other_value,
                  reason: parsed.data.other_reason,
                },
              }
            : {}),
        },
      });
    } catch (error: any) {
      await client.query("ROLLBACK");

      if (error?.code === "23505") {
        res.status(409).json({
          error: "Activity already exists",
        });
        return;
      }

      console.error(error);

      res.status(500).json({
        error: "Could not create activity",
      });
    } finally {
      client.release();
    }
  }
);
