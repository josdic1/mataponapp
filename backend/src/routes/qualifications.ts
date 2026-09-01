import { Router } from "express";

import {
  createQualificationSchema,
  updateQualificationSchema,
  qualificationIdParamsSchema,
  type Qualification,
} from "@matapon/shared/schemas/qualifications";

import { query } from "../db/db.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
} from "../middleware/auth.js";

export const qualificationsRouter = Router();

qualificationsRouter.get(
  "/",
  requireAuth,
  requirePasswordChanged,
  async (_req, res) => {
    try {
      const result = await query<Qualification>(
        `
          SELECT
            id,
            name,
            created_at,
            updated_at
          FROM qualifications
          ORDER BY name
        `,
      );

      res.json({
        qualifications: result.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not load qualifications",
      });
    }
  },
);

qualificationsRouter.post(
  "/",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed = createQualificationSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid qualification",
      });
      return;
    }

    try {
      const result = await query<Qualification>(
        `
          INSERT INTO qualifications (name)
          VALUES ($1)
          RETURNING
            id,
            name,
            created_at,
            updated_at
        `,
        [parsed.data.name],
      );

      res.status(201).json({
        qualification: result.rows[0],
      });
    } catch (error: any) {
      if (error?.code === "23505") {
        res.status(409).json({
          error: "Qualification already exists",
        });
        return;
      }

      console.error(error);

      res.status(500).json({
        error: "Could not create qualification",
      });
    }
  },
);

qualificationsRouter.patch(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const params = qualificationIdParamsSchema.safeParse(req.params);
    const body = updateQualificationSchema.safeParse(req.body);

    if (!params.success || !body.success) {
      res.status(400).json({
        error: "Invalid qualification data",
      });
      return;
    }

    try {
      const result = await query<Qualification>(
        `
          UPDATE qualifications
          SET
            name = COALESCE($2, name),
            updated_at = CURRENT_TIMESTAMP::text
          WHERE id = $1
          RETURNING
            id,
            name,
            created_at,
            updated_at
        `,
        [
          params.data.id,
          body.data.name ?? null,
        ],
      );

      if (!result.rows[0]) {
        res.status(404).json({
          error: "Qualification does not exist",
        });
        return;
      }

      res.json({
        qualification: result.rows[0],
      });
    } catch (error: any) {
      if (error?.code === "23505") {
        res.status(409).json({
          error: "Qualification already exists",
        });
        return;
      }

      console.error(error);

      res.status(500).json({
        error: "Could not update qualification",
      });
    }
  },
);

qualificationsRouter.delete(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed = qualificationIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid qualification id",
      });
      return;
    }

    try {
      const dependencies = await query<{
        activities: string;
        staff: string;
      }>(
        `
          SELECT
            (
              SELECT COUNT(*)::text
              FROM activity_qualifications
              WHERE qualification_id = $1
            ) AS activities,
            (
              SELECT COUNT(*)::text
              FROM staff_qualifications
              WHERE qualification_id = $1
            ) AS staff
        `,
        [parsed.data.id],
      );

      const counts = dependencies.rows[0];

      if (
        Number(counts.activities) > 0 ||
        Number(counts.staff) > 0
      ) {
        res.status(409).json({
          error:
            "Cannot delete a qualification while activities or staff use it",
        });
        return;
      }

      const result = await query<{ id: string }>(
        `
          DELETE FROM qualifications
          WHERE id = $1
          RETURNING id
        `,
        [parsed.data.id],
      );

      if (!result.rows[0]) {
        res.status(404).json({
          error: "Qualification does not exist",
        });
        return;
      }

      res.json({
        ok: true,
        deleted_qualification_id: String(parsed.data.id),
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not delete qualification",
      });
    }
  },
);
