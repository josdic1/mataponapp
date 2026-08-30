import { Router } from "express";

import {
  createActivitySchema,
  updateActivitySchema,
  activityIdParamsSchema,
} from "@matapon/shared/schemas/activities";

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

type ActivityDetailRow = ActivityRow & {
  other_id: string | null;
  other_value: string | null;
  other_reason: string | null;
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

activitiesRouter.get(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  async (req, res) => {
    const parsed = activityIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid activity id",
      });
      return;
    }

    try {
      const result = await query<ActivityDetailRow>(
        `
          SELECT
            a.id,
            a.name,
            a.setting,
            a.created_at,
            a.updated_at,
            ao.id AS other_id,
            ao.value AS other_value,
            ao.reason AS other_reason
          FROM activities a
          LEFT JOIN LATERAL (
            SELECT
              id,
              value,
              reason
            FROM activity_others
            WHERE activity_id = a.id
            ORDER BY id DESC
            LIMIT 1
          ) ao ON TRUE
          WHERE a.id = $1
          LIMIT 1
        `,
        [parsed.data.id]
      );

      const activity = result.rows[0];

      if (!activity) {
        res.status(404).json({
          error: "Activity does not exist",
        });
        return;
      }

      const {
        other_id,
        other_value,
        other_reason,
        ...baseActivity
      } = activity;

      res.json({
        activity: {
          ...baseActivity,
          ...(activity.setting === "other" &&
          other_id !== null
            ? {
                setting_other: {
                  value: other_value,
                  reason: other_reason,
                },
              }
            : {}),
        },
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not load activity",
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

      await client.query(
        `SELECT set_config('matapon.actor_user_id', $1, true)`,
        [req.auth!.sub]
      );

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

activitiesRouter.patch(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const params = activityIdParamsSchema.safeParse(req.params);
    const body = updateActivitySchema.safeParse(req.body);

    if (!params.success) {
      res.status(400).json({
        error: "Invalid activity id",
      });
      return;
    }

    if (!body.success) {
      res.status(400).json({
        error: "Invalid activity data",
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

      const currentResult =
        await client.query<ActivityDetailRow>(
          `
            SELECT
              a.id,
              a.name,
              a.setting,
              a.created_at,
              a.updated_at,
              ao.id AS other_id,
              ao.value AS other_value,
              ao.reason AS other_reason
            FROM activities a
            LEFT JOIN LATERAL (
              SELECT
                id,
                value,
                reason
              FROM activity_others
              WHERE activity_id = a.id
              ORDER BY id DESC
              LIMIT 1
            ) ao ON TRUE
            WHERE a.id = $1
            LIMIT 1
          `,
          [params.data.id]
        );

      const current = currentResult.rows[0];

      if (!current) {
        await client.query("ROLLBACK");

        res.status(404).json({
          error: "Activity does not exist",
        });
        return;
      }

      const nextSetting =
        body.data.setting ?? current.setting;

      const nextOtherValue =
        body.data.other_value ??
        current.other_value ??
        undefined;

      const nextOtherReason =
        body.data.other_reason ??
        current.other_reason ??
        undefined;

      if (
        nextSetting === "other" &&
        (!nextOtherValue || !nextOtherReason)
      ) {
        await client.query("ROLLBACK");

        res.status(400).json({
          error: "Other setting requires value and reason",
        });
        return;
      }

      const activityResult =
        await client.query<ActivityRow>(
          `
            UPDATE activities
            SET
              name = $2,
              setting = $3,
              updated_at = CURRENT_TIMESTAMP::text
            WHERE id = $1
            RETURNING
              id,
              name,
              setting,
              created_at,
              updated_at
          `,
          [
            params.data.id,
            body.data.name ?? current.name,
            nextSetting,
          ]
        );

      if (nextSetting === "other") {
        if (current.other_id !== null) {
          await client.query(
            `
              UPDATE activity_others
              SET
                value = $2,
                reason = $3
              WHERE id = $1
            `,
            [
              current.other_id,
              nextOtherValue,
              nextOtherReason,
            ]
          );
        } else {
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
              params.data.id,
              nextOtherValue,
              nextOtherReason,
            ]
          );
        }
      } else {
        await client.query(
          `
            DELETE FROM activity_others
            WHERE activity_id = $1
          `,
          [params.data.id]
        );
      }

      await client.query("COMMIT");

      res.json({
        activity: {
          ...activityResult.rows[0],
          ...(nextSetting === "other"
            ? {
                setting_other: {
                  value: nextOtherValue,
                  reason: nextOtherReason,
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
        error: "Could not update activity",
      });
    } finally {
      client.release();
    }
  }
);

activitiesRouter.delete(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed = activityIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid activity id",
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
          FROM activities
          WHERE id = $1
          LIMIT 1
        `,
        [parsed.data.id]
      );

      if (!exists.rows[0]) {
        await client.query("ROLLBACK");

        res.status(404).json({
          error: "Activity does not exist",
        });
        return;
      }

      const dependencies = await client.query<{
        event_activities: string;
        staff_activities: string;
      }>(
        `
          SELECT
            (
              SELECT COUNT(*)::text
              FROM event_activities
              WHERE activity_id = $1
            ) AS event_activities,
            (
              SELECT COUNT(*)::text
              FROM staff_activities
              WHERE activity_id = $1
            ) AS staff_activities
        `,
        [parsed.data.id]
      );

      const counts = dependencies.rows[0];

      if (
        Number(counts.event_activities) > 0 ||
        Number(counts.staff_activities) > 0
      ) {
        await client.query("ROLLBACK");

        res.status(409).json({
          error:
            "Cannot delete an activity that is scheduled in an event or assigned to staff",
        });
        return;
      }

      await client.query(
        `
          DELETE FROM activity_others
          WHERE activity_id = $1
        `,
        [parsed.data.id]
      );

      await client.query(
        `
          DELETE FROM activities
          WHERE id = $1
        `,
        [parsed.data.id]
      );

      await client.query("COMMIT");

      res.json({
        ok: true,
        deleted_activity_id: String(parsed.data.id),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(error);

      res.status(500).json({
        error: "Could not delete activity",
      });
    } finally {
      client.release();
    }
  }
);
