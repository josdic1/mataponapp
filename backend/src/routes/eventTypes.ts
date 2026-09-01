import { Router } from "express";

import {
  createEventTypeSchema,
  updateEventTypeSchema,
  eventTypeIdParamsSchema,
  type EventType,
} from "@matapon/shared/schemas/eventTypes";

import { query } from "../db/db.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
} from "../middleware/auth.js";

export const eventTypesRouter = Router();

eventTypesRouter.get(
  "/",
  requireAuth,
  requirePasswordChanged,
  async (_req, res) => {
    try {
      const result = await query<EventType>(
        `
          SELECT id, name, created_at, updated_at
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

eventTypesRouter.get(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  async (req, res) => {
    const parsed = eventTypeIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid event type id",
      });
      return;
    }

    try {
      const result = await query<EventType>(
        `
          SELECT id, name, created_at, updated_at
          FROM event_types
          WHERE id = $1
          LIMIT 1
        `,
        [parsed.data.id]
      );

      if (!result.rows[0]) {
        res.status(404).json({
          error: "Event type does not exist",
        });
        return;
      }

      res.json({
        event_type: result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not load event type",
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
      const result = await query<EventType>(
        `
          INSERT INTO event_types (name)
          VALUES ($1)
          RETURNING id, name, created_at, updated_at
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

eventTypesRouter.patch(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const params = eventTypeIdParamsSchema.safeParse(req.params);
    const body = updateEventTypeSchema.safeParse(req.body);

    if (!params.success) {
      res.status(400).json({
        error: "Invalid event type id",
      });
      return;
    }

    if (!body.success) {
      res.status(400).json({
        error: "Event type name is required",
      });
      return;
    }

    try {
      const result = await query<EventType>(
        `
          UPDATE event_types
          SET
            name = $2,
            updated_at = CURRENT_TIMESTAMP::text
          WHERE id = $1
          RETURNING id, name, created_at, updated_at
        `,
        [
          params.data.id,
          body.data.name,
        ]
      );

      if (!result.rows[0]) {
        res.status(404).json({
          error: "Event type does not exist",
        });
        return;
      }

      res.json({
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
        error: "Could not update event type",
      });
    }
  }
);

eventTypesRouter.delete(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed = eventTypeIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid event type id",
      });
      return;
    }

    try {
      const result = await query<{ id: string }>(
        `
          DELETE FROM event_types
          WHERE id = $1
          RETURNING id
        `,
        [parsed.data.id]
      );

      if (!result.rows[0]) {
        res.status(404).json({
          error: "Event type does not exist",
        });
        return;
      }

      res.json({
        ok: true,
        deleted_event_type_id: result.rows[0].id,
      });
    } catch (error: any) {
      if (error?.code === "23503") {
        res.status(409).json({
          error: "Cannot delete an event type that is being used by an event",
        });
        return;
      }

      console.error(error);

      res.status(500).json({
        error: "Could not delete event type",
      });
    }
  }
);
