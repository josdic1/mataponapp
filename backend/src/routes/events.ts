import { Router } from "express";

import { createEventSchema } from "@matapon/shared/schemas/events";

import { pool } from "../db/pool.js";
import { query } from "../db/db.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
} from "../middleware/auth.js";

type EventRow = {
  id: string;
  name: string;
  event_type_id: string;
  event_type_name: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string;
};

export const eventsRouter = Router();

eventsRouter.get(
  "/",
  requireAuth,
  requirePasswordChanged,
  async (_req, res) => {
    try {
      const result = await query<EventRow>(
        `
          SELECT
            e.id,
            e.name,
            e.event_type_id,
            et.name AS event_type_name,
            e.starts_at,
            e.ends_at,
            e.created_at,
            e.updated_at
          FROM events e
          JOIN event_types et
            ON et.id = e.event_type_id
          ORDER BY e.id DESC
        `
      );

      res.json({
        events: result.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not load events",
      });
    }
  }
);

eventsRouter.post(
  "/",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed = createEventSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid event data",
      });
      return;
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const typeResult = await client.query<{
        id: string;
        name: string;
      }>(
        `
          SELECT id, name
          FROM event_types
          WHERE id = $1
          LIMIT 1
        `,
        [parsed.data.event_type_id]
      );

      const eventType = typeResult.rows[0];

      if (!eventType) {
        await client.query("ROLLBACK");

        res.status(400).json({
          error: "Event type does not exist",
        });
        return;
      }

      const isOther =
        eventType.name.trim().toLowerCase() === "other";

      if (
        isOther &&
        (!parsed.data.other_value || !parsed.data.other_reason)
      ) {
        await client.query("ROLLBACK");

        res.status(400).json({
          error: "Other event type requires value and reason",
        });
        return;
      }

      const eventResult = await client.query<EventRow>(
        `
          INSERT INTO events (
            name,
            event_type_id,
            starts_at,
            ends_at
          )
          VALUES ($1, $2, $3, $4)
          RETURNING
            id,
            name,
            event_type_id,
            starts_at,
            ends_at,
            created_at,
            updated_at
        `,
        [
          parsed.data.name,
          parsed.data.event_type_id,
          parsed.data.starts_at,
          parsed.data.ends_at,
        ]
      );

      const event = eventResult.rows[0];

      if (isOther) {
        await client.query(
          `
            INSERT INTO event_type_others (
              event_id,
              value,
              reason
            )
            VALUES ($1, $2, $3)
          `,
          [
            event.id,
            parsed.data.other_value,
            parsed.data.other_reason,
          ]
        );
      }

      await client.query("COMMIT");

      res.status(201).json({
        event: {
          ...event,
          event_type_name: eventType.name,
          ...(isOther
            ? {
                event_type_other: {
                  value: parsed.data.other_value,
                  reason: parsed.data.other_reason,
                },
              }
            : {}),
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(error);

      res.status(500).json({
        error: "Could not create event",
      });
    } finally {
      client.release();
    }
  }
);
