import { Router } from "express";

import {
  createEventRegistrationSchema,
  eventRegistrationIdParamsSchema,
  updateEventRegistrationSchema,
  type EventRegistration,
} from "@matapon/shared/schemas/eventRegistrations";

import { pool } from "../db/pool.js";
import { query } from "../db/db.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
} from "../middleware/auth.js";

export const eventRegistrationsRouter = Router();

eventRegistrationsRouter.get(
  "/",
  requireAuth,
  requirePasswordChanged,
  requireRole("member", "admin"),
  async (req, res) => {
    try {
      const isAdmin = req.auth!.user_type === "admin";

      const result = await query<EventRegistration>(
        `
          SELECT
            er.id,
            er.user_id,
            u.username AS household_name,
            er.event_id,
            e.name AS event_name,
            er.spots_paid_for,
            (
              SELECT COUNT(*)::int
              FROM member_attendees ma
              JOIN user_members um ON um.id = ma.member_id
              WHERE um.user_id = er.user_id
                AND ma.event_id = er.event_id
            ) AS attendee_count,
            er.created_at,
            er.updated_at
          FROM event_registrations er
          JOIN users u ON u.id = er.user_id
          JOIN events e ON e.id = er.event_id
          WHERE ($1::boolean = true OR er.user_id = $2)
          ORDER BY e.starts_at, er.id
        `,
        [isAdmin, req.auth!.sub]
      );

      res.json({ event_registrations: result.rows });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: "Could not load event registrations",
      });
    }
  }
);

eventRegistrationsRouter.post(
  "/",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed = createEventRegistrationSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid event registration" });
      return;
    }

    try {
      const household = await query<{ id: string; user_type: string }>(
        `
          SELECT id, user_type
          FROM users
          WHERE id = $1
          LIMIT 1
        `,
        [parsed.data.user_id]
      );

      if (!household.rows[0] || household.rows[0].user_type !== "member") {
        res.status(400).json({
          error: "Household account does not exist",
        });
        return;
      }

      const event = await query<{ id: string }>(
        `
          SELECT id
          FROM events
          WHERE id = $1
          LIMIT 1
        `,
        [parsed.data.event_id]
      );

      if (!event.rows[0]) {
        res.status(400).json({ error: "Event does not exist" });
        return;
      }

      const result = await query<EventRegistration>(
        `
          WITH inserted AS (
            INSERT INTO event_registrations (
              user_id,
              event_id,
              spots_paid_for
            )
            VALUES ($1, $2, $3)
            RETURNING *
          )
          SELECT
            i.id,
            i.user_id,
            u.username AS household_name,
            i.event_id,
            e.name AS event_name,
            i.spots_paid_for,
            0::int AS attendee_count,
            i.created_at,
            i.updated_at
          FROM inserted i
          JOIN users u ON u.id = i.user_id
          JOIN events e ON e.id = i.event_id
        `,
        [
          parsed.data.user_id,
          parsed.data.event_id,
          parsed.data.spots_paid_for,
        ]
      );

      res.status(201).json({
        event_registration: result.rows[0],
      });
    } catch (error) {
      const dbError = error as Error & {
        code?: string;
        constraint?: string;
      };

      if (
        dbError.code === "23505" &&
        dbError.constraint === "event_registrations_user_event_unique"
      ) {
        res.status(409).json({
          error: "This household is already registered for this event",
        });
        return;
      }

      console.error(error);
      res.status(500).json({
        error: "Could not create event registration",
      });
    }
  }
);

eventRegistrationsRouter.patch(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const params =
      eventRegistrationIdParamsSchema.safeParse(req.params);
    const body =
      updateEventRegistrationSchema.safeParse(req.body);

    if (!params.success) {
      res.status(400).json({
        error: "Invalid event registration id",
      });
      return;
    }

    if (!body.success) {
      res.status(400).json({
        error: "Invalid event registration",
      });
      return;
    }

    try {
      const result = await query<EventRegistration>(
        `
          WITH changed AS (
            UPDATE event_registrations
            SET
              spots_paid_for = $2,
              updated_at = CURRENT_TIMESTAMP::text
            WHERE id = $1
            RETURNING *
          )
          SELECT
            c.id,
            c.user_id,
            u.username AS household_name,
            c.event_id,
            e.name AS event_name,
            c.spots_paid_for,
            (
              SELECT COUNT(*)::int
              FROM member_attendees ma
              JOIN user_members um ON um.id = ma.member_id
              WHERE um.user_id = c.user_id
                AND ma.event_id = c.event_id
            ) AS attendee_count,
            c.created_at,
            c.updated_at
          FROM changed c
          JOIN users u ON u.id = c.user_id
          JOIN events e ON e.id = c.event_id
        `,
        [params.data.id, body.data.spots_paid_for]
      );

      if (!result.rows[0]) {
        res.status(404).json({
          error: "Event registration does not exist",
        });
        return;
      }

      res.json({
        event_registration: result.rows[0],
      });
    } catch (error) {
      const dbError = error as Error & {
        code?: string;
        message?: string;
      };

      if (
        dbError.code === "P0001" &&
        dbError.message === "EVENT_REGISTRATION_BELOW_SELECTED_ATTENDEES"
      ) {
        res.status(409).json({
          error:
            "Paid spots cannot be lower than the number of selected attendees",
        });
        return;
      }

      console.error(error);
      res.status(500).json({
        error: "Could not update event registration",
      });
    }
  }
);

eventRegistrationsRouter.delete(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed =
      eventRegistrationIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid event registration id",
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

      const current = await client.query<{
        id: string;
        user_id: string;
        event_id: string;
      }>(
        `
          SELECT id, user_id, event_id
          FROM event_registrations
          WHERE id = $1
          FOR UPDATE
        `,
        [parsed.data.id]
      );

      const registration = current.rows[0];

      if (!registration) {
        await client.query("ROLLBACK");
        res.status(404).json({
          error: "Event registration does not exist",
        });
        return;
      }

      const attendees = await client.query<{ count: string }>(
        `
          SELECT COUNT(*)::text AS count
          FROM member_attendees ma
          JOIN user_members um ON um.id = ma.member_id
          WHERE um.user_id = $1
            AND ma.event_id = $2
        `,
        [registration.user_id, registration.event_id]
      );

      if (Number(attendees.rows[0]?.count ?? 0) > 0) {
        await client.query("ROLLBACK");
        res.status(409).json({
          error:
            "Remove selected attendees before deleting this event registration",
        });
        return;
      }

      await client.query(
        `DELETE FROM event_registrations WHERE id = $1`,
        [parsed.data.id]
      );

      await client.query("COMMIT");

      res.json({
        ok: true,
        deleted_event_registration_id: String(parsed.data.id),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(error);
      res.status(500).json({
        error: "Could not delete event registration",
      });
    } finally {
      client.release();
    }
  }
);
