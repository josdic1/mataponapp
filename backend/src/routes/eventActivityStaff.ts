import { Router } from "express";

import {
  createEventActivityStaffSchema,
  eventActivityStaffIdParamsSchema,
} from "@matapon/shared/schemas/eventActivityStaff";

import { query } from "../db/db.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
} from "../middleware/auth.js";

type EventActivityStaffRow = {
  id: string;
  event_activity_id: string;
  event_name: string;
  activity_id: string;
  activity_name: string;
  staff_member_id: string;
  staff_member_name: string;
  created_at: string;
  updated_at: string;
};

export const eventActivityStaffRouter = Router();

eventActivityStaffRouter.get(
  "/",
  requireAuth,
  requirePasswordChanged,
  async (_req, res) => {
    try {
      const result = await query<EventActivityStaffRow>(
        `
          SELECT
            eas.id,
            eas.event_activity_id,
            e.name AS event_name,
            ea.activity_id,
            a.name AS activity_name,
            eas.staff_member_id,
            sm.full_name AS staff_member_name,
            eas.created_at,
            eas.updated_at
          FROM event_activity_staff eas
          JOIN event_activities ea
            ON ea.id = eas.event_activity_id
          JOIN events e
            ON e.id = ea.event_id
          JOIN activities a
            ON a.id = ea.activity_id
          JOIN staff_members sm
            ON sm.id = eas.staff_member_id
          ORDER BY ea.starts_at, sm.full_name, eas.id
        `
      );

      res.json({
        event_activity_staff: result.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not load event activity staff",
      });
    }
  }
);

eventActivityStaffRouter.post(
  "/",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed = createEventActivityStaffSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid staff booking",
      });
      return;
    }

    try {
      const eventActivityResult = await query<{
        id: string;
        activity_id: string;
      }>(
        `
          SELECT id, activity_id
          FROM event_activities
          WHERE id = $1
          LIMIT 1
        `,
        [parsed.data.event_activity_id]
      );

      const eventActivity = eventActivityResult.rows[0];

      if (!eventActivity) {
        res.status(400).json({
          error: "Event activity does not exist",
        });
        return;
      }

      const capabilityResult = await query<{ id: string }>(
        `
          SELECT id
          FROM staff_activities
          WHERE staff_member_id = $1
            AND activity_id = $2
          LIMIT 1
        `,
        [
          parsed.data.staff_member_id,
          eventActivity.activity_id,
        ]
      );

      if (!capabilityResult.rows[0]) {
        res.status(400).json({
          error: "Staff member is not capable of this activity",
        });
        return;
      }

      const result = await query<EventActivityStaffRow>(
        `
          WITH inserted AS (
            INSERT INTO event_activity_staff (
              event_activity_id,
              staff_member_id
            )
            VALUES ($1, $2)
            RETURNING *
          )
          SELECT
            i.id,
            i.event_activity_id,
            e.name AS event_name,
            ea.activity_id,
            a.name AS activity_name,
            i.staff_member_id,
            sm.full_name AS staff_member_name,
            i.created_at,
            i.updated_at
          FROM inserted i
          JOIN event_activities ea
            ON ea.id = i.event_activity_id
          JOIN events e
            ON e.id = ea.event_id
          JOIN activities a
            ON a.id = ea.activity_id
          JOIN staff_members sm
            ON sm.id = i.staff_member_id
        `,
        [
          parsed.data.event_activity_id,
          parsed.data.staff_member_id,
        ]
      );

      res.status(201).json({
        event_activity_staff: result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not book staff to activity",
      });
    }
  }
);

eventActivityStaffRouter.delete(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed = eventActivityStaffIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid scheduled staff assignment id",
      });
      return;
    }

    try {
      const result = await query<{ id: string }>(
        `
          DELETE FROM event_activity_staff
          WHERE id = $1
          RETURNING id
        `,
        [parsed.data.id]
      );

      if (!result.rows[0]) {
        res.status(404).json({
          error: "Scheduled staff assignment does not exist",
        });
        return;
      }

      res.json({
        ok: true,
        deleted_event_activity_staff_id: String(parsed.data.id),
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not remove staff from scheduled activity",
      });
    }
  }
);
