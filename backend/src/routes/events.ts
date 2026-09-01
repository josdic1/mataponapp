import { Router } from "express";

import {
  createEventSchema,
  updateEventSchema,
  eventIdParamsSchema,
  type Event,
} from "@matapon/shared/schemas/events";

import { pool } from "../db/pool.js";
import { query } from "../db/db.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
} from "../middleware/auth.js";

export const eventsRouter = Router();

eventsRouter.get(
  "/",
  requireAuth,
  requirePasswordChanged,
  async (req, res) => {
    try {
      const isMember = req.auth!.user_type === "member";

      const result = await query<Event>(
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
          WHERE (
            $1::boolean = false
            OR EXISTS (
              SELECT 1
              FROM event_registrations er
              WHERE er.event_id = e.id
                AND er.user_id = $2
            )
          )
          ORDER BY e.id DESC
        `,
        [
          isMember,
          req.auth!.sub,
        ]
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

eventsRouter.get(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  async (req, res) => {
    const parsed = eventIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid event id",
      });
      return;
    }

    try {
      const result = await query<Event & {
        other_value: string | null;
        other_reason: string | null;
      }>(
        `
          SELECT
            e.id,
            e.name,
            e.event_type_id,
            et.name AS event_type_name,
            e.starts_at,
            e.ends_at,
            e.created_at,
            e.updated_at,
            eto.value AS other_value,
            eto.reason AS other_reason
          FROM events e
          JOIN event_types et
            ON et.id = e.event_type_id
          LEFT JOIN event_type_others eto
            ON eto.event_id = e.id
          WHERE e.id = $1
            AND (
              $2::boolean = false
              OR EXISTS (
                SELECT 1
                FROM event_registrations er
                WHERE er.event_id = e.id
                  AND er.user_id = $2
              )
            )
          LIMIT 1
        `,
        [
          parsed.data.id,
          req.auth!.user_type === "member"
            ? req.auth!.sub
            : false,
        ]
      );

      const event = result.rows[0];

      if (!event) {
        res.status(404).json({
          error: "Event does not exist",
        });
        return;
      }

      const {
        other_value,
        other_reason,
        ...baseEvent
      } = event;

      res.json({
        event: {
          ...baseEvent,
          ...(other_value !== null
            ? {
                event_type_other: {
                  value: other_value,
                  reason: other_reason,
                },
              }
            : {}),
        },
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not load event",
      });
    }
  }
);

eventsRouter.patch(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const params = eventIdParamsSchema.safeParse(req.params);
    const body = updateEventSchema.safeParse(req.body);

    if (!params.success) {
      res.status(400).json({
        error: "Invalid event id",
      });
      return;
    }

    if (!body.success) {
      res.status(400).json({
        error: "Invalid event data",
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

      const currentResult = await client.query<{
        id: string;
        name: string;
        event_type_id: string;
        starts_at: string;
        ends_at: string;
        other_value: string | null;
        other_reason: string | null;
      }>(
        `
          SELECT
            e.id,
            e.name,
            e.event_type_id,
            e.starts_at,
            e.ends_at,
            eto.value AS other_value,
            eto.reason AS other_reason
          FROM events e
          LEFT JOIN event_type_others eto
            ON eto.event_id = e.id
          WHERE e.id = $1
          LIMIT 1
        `,
        [params.data.id]
      );

      const current = currentResult.rows[0];

      if (!current) {
        await client.query("ROLLBACK");

        res.status(404).json({
          error: "Event does not exist",
        });
        return;
      }

      const nextEventTypeId =
        body.data.event_type_id ?? Number(current.event_type_id);

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
        [nextEventTypeId]
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

      const nextOtherValue =
        body.data.other_value ?? current.other_value ?? undefined;

      const nextOtherReason =
        body.data.other_reason ?? current.other_reason ?? undefined;

      if (
        isOther &&
        (!nextOtherValue || !nextOtherReason)
      ) {
        await client.query("ROLLBACK");

        res.status(400).json({
          error: "Other event type requires value and reason",
        });
        return;
      }

      const eventResult = await client.query<Event>(
        `
          UPDATE events
          SET
            name = $2,
            event_type_id = $3,
            starts_at = $4,
            ends_at = $5,
            updated_at = CURRENT_TIMESTAMP::text
          WHERE id = $1
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
          params.data.id,
          body.data.name ?? current.name,
          nextEventTypeId,
          body.data.starts_at ?? current.starts_at,
          body.data.ends_at ?? current.ends_at,
        ]
      );

      if (isOther) {
        await client.query(
          `
            INSERT INTO event_type_others (
              event_id,
              value,
              reason
            )
            VALUES ($1, $2, $3)
            ON CONFLICT (event_id)
            DO UPDATE SET
              value = EXCLUDED.value,
              reason = EXCLUDED.reason
          `,
          [
            params.data.id,
            nextOtherValue,
            nextOtherReason,
          ]
        );
      } else {
        await client.query(
          `
            DELETE FROM event_type_others
            WHERE event_id = $1
          `,
          [params.data.id]
        );
      }

      await client.query("COMMIT");

      res.json({
        event: {
          ...eventResult.rows[0],
          event_type_name: eventType.name,
          ...(isOther
            ? {
                event_type_other: {
                  value: nextOtherValue,
                  reason: nextOtherReason,
                },
              }
            : {}),
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(error);

      res.status(500).json({
        error: "Could not update event",
      });
    } finally {
      client.release();
    }
  }
);

eventsRouter.delete(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed = eventIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid event id",
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
          FROM events
          WHERE id = $1
          LIMIT 1
        `,
        [parsed.data.id]
      );

      if (!exists.rows[0]) {
        await client.query("ROLLBACK");

        res.status(404).json({
          error: "Event does not exist",
        });
        return;
      }

      const dependencies = await client.query<{
        event_activities: string;
        member_attendees: string;
        event_registrations: string;
      }>(
        `
          SELECT
            (
              SELECT COUNT(*)::text
              FROM event_activities
              WHERE event_id = $1
            ) AS event_activities,
            (
              SELECT COUNT(*)::text
              FROM member_attendees
              WHERE event_id = $1
            ) AS member_attendees,
            (
              SELECT COUNT(*)::text
              FROM event_registrations
              WHERE event_id = $1
            ) AS event_registrations
        `,
        [parsed.data.id]
      );

      const counts = dependencies.rows[0];

      if (
        Number(counts.event_activities) > 0 ||
        Number(counts.member_attendees) > 0 ||
        Number(counts.event_registrations) > 0
      ) {
        await client.query("ROLLBACK");

        res.status(409).json({
          error:
            "Cannot delete an event that has scheduled activities, attendees, or registrations",
        });
        return;
      }

      await client.query(
        `
          DELETE FROM event_type_others
          WHERE event_id = $1
        `,
        [parsed.data.id]
      );

      await client.query(
        `
          DELETE FROM events
          WHERE id = $1
        `,
        [parsed.data.id]
      );

      await client.query("COMMIT");

      res.json({
        ok: true,
        deleted_event_id: String(parsed.data.id),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(error);

      res.status(500).json({
        error: "Could not delete event",
      });
    } finally {
      client.release();
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

      await client.query(
        `SELECT set_config('matapon.actor_user_id', $1, true)`,
        [req.auth!.sub]
      );

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

      const eventResult = await client.query<Event>(
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
