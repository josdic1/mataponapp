import { Router } from "express";

import { createStaffAreaSchema } from "@matapon/shared/schemas/staffAreas";

import { query } from "../db/db.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
} from "../middleware/auth.js";

type StaffAreaRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export const staffAreasRouter = Router();

staffAreasRouter.get(
  "/",
  requireAuth,
  requirePasswordChanged,
  async (_req, res) => {
    try {
      const result = await query<StaffAreaRow>(
        `
          SELECT
            id,
            name,
            created_at,
            updated_at
          FROM staff_areas
          ORDER BY name
        `
      );

      res.json({
        staff_areas: result.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not load staff areas",
      });
    }
  }
);

staffAreasRouter.post(
  "/",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed = createStaffAreaSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Staff area name is required",
      });
      return;
    }

    try {
      const result = await query<StaffAreaRow>(
        `
          INSERT INTO staff_areas (name)
          VALUES ($1)
          RETURNING
            id,
            name,
            created_at,
            updated_at
        `,
        [parsed.data.name]
      );

      res.status(201).json({
        staff_area: result.rows[0],
      });
    } catch (error: any) {
      if (error?.code === "23505") {
        res.status(409).json({
          error: "Staff area already exists",
        });
        return;
      }

      console.error(error);

      res.status(500).json({
        error: "Could not create staff area",
      });
    }
  }
);
