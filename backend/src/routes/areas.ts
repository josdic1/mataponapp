import { Router } from "express";

import type { Area } from "@matapon/shared/schemas/areas";

import { query } from "../db/db.js";
import {
  requireAuth,
  requirePasswordChanged,
} from "../middleware/auth.js";

export const areasRouter = Router();

areasRouter.get(
  "/",
  requireAuth,
  requirePasswordChanged,
  async (_req, res) => {
    try {
      const result = await query<Area>(
        `
          SELECT
            id,
            name,
            created_at,
            updated_at
          FROM areas
          ORDER BY name
        `,
      );

      res.json({
        areas: result.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not load areas",
      });
    }
  },
);
