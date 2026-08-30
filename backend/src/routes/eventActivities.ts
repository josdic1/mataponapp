import { Router } from "express";

import { createEventActivitySchema } from "@matapon/shared/schemas/eventActivities";

import { query } from "../db/db.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
} from "../middleware/auth.js";

type EventActivityRow = {
  id: string;
  event_id: string;
  event_name: string;
  activity_id: string;
  activity_name: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string;
};

export const eventActivitiesRouter = Router();

eventActivitiesRouter.get(
  "/",
  requireAuth,
  requirePasswordChanged,
  async (_req, res) => {
    try {
      const result = await query<EventActivityRow>(
        `
          SELECT
            ea.id,
            ea.event_id,
            e.name AS event_name,
            ea.activity_id,
            a.name AS activity_name,
            ea.starts_at,
            ea.ends_at,
            ea.created_at,
            ea.updated_at
          FROM event_activities ea
          JOIN events e
            ON e.id = ea.event_id
          JOIN activities a
            ON a.id = ea.activity_id
          ORDER BY ea.starts_at, ea.id
        `
      );

      res.json({
        event_activities: result.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not load event activities",
      });
    }
  }
);

eventActivitiesRouter.post(
  "/",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed = createEventActivitySchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid event activity data",
      });
      return;
    }

    try {
      const eventResult = await query<{ id: string }>(
        `
          SELECT id
          FROM events
          WHERE id = $1
          LIMIT 1
        `,
        [parsed.data.event_id]
      );

      if (!eventResult.rows[0]) {
        res.status(400).json({
          error: "Event does not exist",
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

      const result = await query<EventActivityRow>(
        `
          WITH inserted AS (
            INSERT INTO event_activities (
              event_id,
              activity_id,
              starts_at,
              ends_at
            )
            VALUES ($1, $2, $3, $4)
            RETURNING *
          )
          SELECT
            i.id,
            i.event_id,
            e.name AS event_name,
            i.activity_id,
            a.name AS activity_name,
            i.starts_at,
            i.ends_at,
            i.created_at,
            i.updated_at
          FROM inserted i
          JOIN events e
            ON e.id = i.event_id
          JOIN activities a
            ON a.id = i.activity_id
        `,
        [
          parsed.data.event_id,
          parsed.data.activity_id,
          parsed.data.starts_at,
          parsed.data.ends_at,
        ]
      );

      res.status(201).json({
        event_activity: result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not schedule activity",
      });
    }
  }
);
