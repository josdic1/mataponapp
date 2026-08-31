import { Router } from "express";

import {
  createStaffActivitySchema,
  staffActivityIdParamsSchema,
} from "@matapon/shared/schemas/staffActivities";

import { pool } from "../db/pool.js";
import { query } from "../db/db.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
} from "../middleware/auth.js";

type StaffActivityRow = {
  id: string;
  staff_member_id: string;
  staff_member_name: string;
  activity_id: string;
  activity_name: string;
  created_at: string;
  updated_at: string;
};

export const staffActivitiesRouter = Router();

staffActivitiesRouter.get(
  "/",
  requireAuth,
  requirePasswordChanged,
  async (_req, res) => {
    try {
      const result = await query<StaffActivityRow>(
        `
          SELECT
            sta.id,
            sta.staff_member_id,
            sm.full_name AS staff_member_name,
            sta.activity_id,
            a.name AS activity_name,
            sta.created_at,
            sta.updated_at
          FROM staff_activities sta
          JOIN staff_members sm
            ON sm.id = sta.staff_member_id
          JOIN activities a
            ON a.id = sta.activity_id
          ORDER BY sm.full_name, a.name, sta.id
        `
      );

      res.json({
        staff_activities: result.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not load staff activities",
      });
    }
  }
);

staffActivitiesRouter.post(
  "/",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed = createStaffActivitySchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid staff activity assignment",
      });
      return;
    }

    try {
      const staffResult = await query<{ id: string }>(
        `
          SELECT id
          FROM staff_members
          WHERE id = $1
          LIMIT 1
        `,
        [parsed.data.staff_member_id]
      );

      if (!staffResult.rows[0]) {
        res.status(400).json({
          error: "Staff member does not exist",
        });
        return;
      }

      const activityResult = await query<{ id: string }>(
        `
          SELECT id
          FROM activities
          WHERE id = $1
          LIMIT 1
        `,
        [parsed.data.activity_id]
      );

      if (!activityResult.rows[0]) {
        res.status(400).json({
          error: "Activity does not exist",
        });
        return;
      }

      const result = await query<StaffActivityRow>(
        `
          WITH inserted AS (
            INSERT INTO staff_activities (
              staff_member_id,
              activity_id
            )
            VALUES ($1, $2)
            RETURNING *
          )
          SELECT
            i.id,
            i.staff_member_id,
            sm.full_name AS staff_member_name,
            i.activity_id,
            a.name AS activity_name,
            i.created_at,
            i.updated_at
          FROM inserted i
          JOIN staff_members sm
            ON sm.id = i.staff_member_id
          JOIN activities a
            ON a.id = i.activity_id
        `,
        [
          parsed.data.staff_member_id,
          parsed.data.activity_id,
        ]
      );

      res.status(201).json({
        staff_activity: result.rows[0],
      });
    } catch (error: any) {
      if (error?.code === "23505") {
        res.status(409).json({
          error: "Staff member already has this activity",
        });
        return;
      }

      console.error(error);

      res.status(500).json({
        error: "Could not assign staff activity",
      });
    }
  }
);

staffActivitiesRouter.delete(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed = staffActivityIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid staff activity assignment id",
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

      const current = await client.query<{
        id: string;
        staff_member_id: string;
        activity_id: string;
      }>(
        `
          SELECT
            id,
            staff_member_id,
            activity_id
          FROM staff_activities
          WHERE id = $1
          FOR UPDATE
        `,
        [parsed.data.id]
      );

      const assignment = current.rows[0];

      if (!assignment) {
        await client.query("ROLLBACK");

        res.status(404).json({
          error: "Staff activity assignment does not exist",
        });
        return;
      }

      const scheduled = await client.query<{ count: string }>(
        `
          SELECT COUNT(*)::text AS count
          FROM event_activity_staff eas
          JOIN event_activities ea
            ON ea.id = eas.event_activity_id
          WHERE eas.staff_member_id = $1
            AND ea.activity_id = $2
        `,
        [
          assignment.staff_member_id,
          assignment.activity_id,
        ]
      );

      if (Number(scheduled.rows[0]?.count ?? 0) > 0) {
        await client.query("ROLLBACK");

        res.status(409).json({
          error:
            "Cannot remove this staff activity capability while the staff member is assigned to scheduled instances of that activity",
        });
        return;
      }

      await client.query(
        `
          DELETE FROM staff_activities
          WHERE id = $1
        `,
        [parsed.data.id]
      );

      await client.query("COMMIT");

      res.json({
        ok: true,
        deleted_staff_activity_id: String(parsed.data.id),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(error);

      res.status(500).json({
        error: "Could not remove staff activity capability",
      });
    } finally {
      client.release();
    }
  }
);
