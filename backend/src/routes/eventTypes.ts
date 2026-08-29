import { Router } from "express";

import { createEventTypeSchema } from "@matapon/shared/schemas/eventTypes";

import { query } from "../db/db.js";
import { endpointContracts } from "../matapon/endpoints.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
} from "../middleware/auth.js";

type EventTypeRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export const eventTypesRouter = Router();

eventTypesRouter.get(
  "/",
  requireAuth,
  requirePasswordChanged,
  async (_req, res) => {
    try {
      const result = await query<EventTypeRow>(
        `
          SELECT
            id,
            name,
            created_at,
            updated_at
          FROM event_types
          ORDER BY name
        `
      );

      res.json({
        event_types: result.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not load event types",
      });
    }
  }
);

eventTypesRouter.post(
  "/",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed = createEventTypeSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Event type name is required",
      });
      return;
    }

    try {
      const result = await query<EventTypeRow>(
        `
          INSERT INTO event_types (name)
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
        event_type: result.rows[0],
      });
    } catch (error: any) {
      if (error?.code === "23505") {
        res.status(409).json({
          error: "Event type already exists",
        });
        return;
      }

      console.error(error);

      res.status(500).json({
        error: "Could not create event type",
      });
    }
  }
);
