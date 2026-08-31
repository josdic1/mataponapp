import { Router } from "express";

import {
  createStaffAreaSchema,
  updateStaffAreaSchema,
  staffAreaIdParamsSchema,
} from "@matapon/shared/schemas/staffAreas";

import { pool } from "../db/pool.js";
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

staffAreasRouter.get(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  async (req, res) => {
    const parsed = staffAreaIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid staff area id",
      });
      return;
    }

    try {
      const result = await query<StaffAreaRow>(
        `
          SELECT
            id,
            name,
            created_at,
            updated_at
          FROM staff_areas
          WHERE id = $1
          LIMIT 1
        `,
        [parsed.data.id]
      );

      const staffArea = result.rows[0];

      if (!staffArea) {
        res.status(404).json({
          error: "Staff area does not exist",
        });
        return;
      }

      res.json({
        staff_area: staffArea,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not load staff area",
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

staffAreasRouter.patch(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const params = staffAreaIdParamsSchema.safeParse(req.params);
    const body = updateStaffAreaSchema.safeParse(req.body);

    if (!params.success) {
      res.status(400).json({
        error: "Invalid staff area id",
      });
      return;
    }

    if (!body.success) {
      res.status(400).json({
        error: "Invalid staff area data",
      });
      return;
    }

    try {
      const result = await query<StaffAreaRow>(
        `
          UPDATE staff_areas
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
        [params.data.id, body.data.name ?? null]
      );

      const staffArea = result.rows[0];

      if (!staffArea) {
        res.status(404).json({
          error: "Staff area does not exist",
        });
        return;
      }

      res.json({
        staff_area: staffArea,
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
        error: "Could not update staff area",
      });
    }
  }
);

staffAreasRouter.delete(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed = staffAreaIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid staff area id",
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
          FROM staff_areas
          WHERE id = $1
          FOR UPDATE
        `,
        [parsed.data.id]
      );

      if (!exists.rows[0]) {
        await client.query("ROLLBACK");

        res.status(404).json({
          error: "Staff area does not exist",
        });
        return;
      }

      const dependencies = await client.query<{ count: string }>(
        `
          SELECT COUNT(*)::text AS count
          FROM staff_member_areas
          WHERE staff_area_id = $1
        `,
        [parsed.data.id]
      );

      if (Number(dependencies.rows[0]?.count ?? 0) > 0) {
        await client.query("ROLLBACK");

        res.status(409).json({
          error:
            "Cannot delete a staff area while staff members are assigned to it",
        });
        return;
      }

      await client.query(
        `
          DELETE FROM staff_areas
          WHERE id = $1
        `,
        [parsed.data.id]
      );

      await client.query("COMMIT");

      res.json({
        ok: true,
        deleted_staff_area_id: String(parsed.data.id),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(error);

      res.status(500).json({
        error: "Could not delete staff area",
      });
    } finally {
      client.release();
    }
  }
);
