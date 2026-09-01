import { Router } from "express";

import {
  createActivityQualificationSchema,
  relationshipIdParamsSchema,
  type ActivityQualification,
} from "@matapon/shared/schemas/qualifications";

import { query } from "../db/db.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
} from "../middleware/auth.js";

export const activityQualificationsRouter = Router();

activityQualificationsRouter.get(
  "/",
  requireAuth,
  requirePasswordChanged,
  async (_req, res) => {
    try {
      const result = await query<ActivityQualification>(
        `
          SELECT
            aq.id,
            aq.activity_id,
            a.name AS activity_name,
            aq.qualification_id,
            q.name AS qualification_name,
            aq.created_at,
            aq.updated_at
          FROM activity_qualifications aq
          JOIN activities a
            ON a.id = aq.activity_id
          JOIN qualifications q
            ON q.id = aq.qualification_id
          ORDER BY a.name, q.name, aq.id
        `,
      );

      res.json({
        activity_qualifications: result.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not load activity qualifications",
      });
    }
  },
);

activityQualificationsRouter.post(
  "/",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed =
      createActivityQualificationSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid activity qualification",
      });
      return;
    }

    try {
      const result = await query<ActivityQualification>(
        `
          WITH inserted AS (
            INSERT INTO activity_qualifications (
              activity_id,
              qualification_id
            )
            VALUES ($1, $2)
            RETURNING *
          )
          SELECT
            i.id,
            i.activity_id,
            a.name AS activity_name,
            i.qualification_id,
            q.name AS qualification_name,
            i.created_at,
            i.updated_at
          FROM inserted i
          JOIN activities a
            ON a.id = i.activity_id
          JOIN qualifications q
            ON q.id = i.qualification_id
        `,
        [
          parsed.data.activity_id,
          parsed.data.qualification_id,
        ],
      );

      res.status(201).json({
        activity_qualification: result.rows[0],
      });
    } catch (error: any) {
      if (error?.code === "23505") {
        res.status(409).json({
          error: "Activity already requires this qualification",
        });
        return;
      }

      if (error?.code === "23503") {
        res.status(400).json({
          error: "Activity or qualification does not exist",
        });
        return;
      }

      console.error(error);

      res.status(500).json({
        error: "Could not add activity qualification",
      });
    }
  },
);

activityQualificationsRouter.delete(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed =
      relationshipIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid activity qualification id",
      });
      return;
    }

    try {
      const result = await query<{ id: string }>(
        `
          DELETE FROM activity_qualifications
          WHERE id = $1
          RETURNING id
        `,
        [parsed.data.id],
      );

      if (!result.rows[0]) {
        res.status(404).json({
          error: "Activity qualification does not exist",
        });
        return;
      }

      res.json({
        ok: true,
        deleted_activity_qualification_id: String(parsed.data.id),
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not remove activity qualification",
      });
    }
  },
);
