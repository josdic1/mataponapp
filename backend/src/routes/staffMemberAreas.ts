import { Router } from "express";

import {
  createStaffMemberAreaSchema,
  staffMemberAreaIdParamsSchema,
} from "@matapon/shared/schemas/staffMemberAreas";

import { query } from "../db/db.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
} from "../middleware/auth.js";

type StaffMemberAreaRow = {
  id: string;
  staff_member_id: string;
  staff_member_name: string;
  staff_area_id: string;
  staff_area_name: string;
  created_at: string;
  updated_at: string;
};

export const staffMemberAreasRouter = Router();

staffMemberAreasRouter.get(
  "/",
  requireAuth,
  requirePasswordChanged,
  async (_req, res) => {
    try {
      const result = await query<StaffMemberAreaRow>(
        `
          SELECT
            sma.id,
            sma.staff_member_id,
            sm.full_name AS staff_member_name,
            sma.staff_area_id,
            sa.name AS staff_area_name,
            sma.created_at,
            sma.updated_at
          FROM staff_member_areas sma
          JOIN staff_members sm
            ON sm.id = sma.staff_member_id
          JOIN staff_areas sa
            ON sa.id = sma.staff_area_id
          ORDER BY sm.full_name, sa.name, sma.id
        `
      );

      res.json({
        staff_member_areas: result.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not load staff member areas",
      });
    }
  }
);

staffMemberAreasRouter.post(
  "/",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed = createStaffMemberAreaSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid staff area assignment",
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

      const areaResult = await query<{ id: string }>(
        `
          SELECT id
          FROM staff_areas
          WHERE id = $1
          LIMIT 1
        `,
        [parsed.data.staff_area_id]
      );

      if (!areaResult.rows[0]) {
        res.status(400).json({
          error: "Staff area does not exist",
        });
        return;
      }

      const result = await query<StaffMemberAreaRow>(
        `
          WITH inserted AS (
            INSERT INTO staff_member_areas (
              staff_member_id,
              staff_area_id
            )
            VALUES ($1, $2)
            RETURNING *
          )
          SELECT
            i.id,
            i.staff_member_id,
            sm.full_name AS staff_member_name,
            i.staff_area_id,
            sa.name AS staff_area_name,
            i.created_at,
            i.updated_at
          FROM inserted i
          JOIN staff_members sm
            ON sm.id = i.staff_member_id
          JOIN staff_areas sa
            ON sa.id = i.staff_area_id
        `,
        [
          parsed.data.staff_member_id,
          parsed.data.staff_area_id,
        ]
      );

      res.status(201).json({
        staff_member_area: result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not assign staff area",
      });
    }
  }
);

staffMemberAreasRouter.delete(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed = staffMemberAreaIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid staff area assignment id",
      });
      return;
    }

    try {
      const result = await query<{ id: string }>(
        `
          DELETE FROM staff_member_areas
          WHERE id = $1
          RETURNING id
        `,
        [parsed.data.id]
      );

      if (!result.rows[0]) {
        res.status(404).json({
          error: "Staff area assignment does not exist",
        });
        return;
      }

      res.json({
        ok: true,
        deleted_staff_member_area_id: String(parsed.data.id),
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not remove staff area assignment",
      });
    }
  }
);
