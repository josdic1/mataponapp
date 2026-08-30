import { Router } from "express";

import {
  createEventActivitySignupSchema,
  eventActivitySignupIdParamsSchema,
} from "@matapon/shared/schemas/eventActivitySignups";

import { query } from "../db/db.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
} from "../middleware/auth.js";

type EventActivitySignupRow = {
  id: string;
  event_activity_id: string;
  event_id: string;
  event_name: string;
  activity_id: string;
  activity_name: string;
  member_attendee_id: string;
  member_id: string;
  member_name: string;
  user_id: string;
  household_name: string;
  checked_in_at: string | null;
  created_at: string;
  updated_at: string;
};

export const eventActivitySignupsRouter = Router();

eventActivitySignupsRouter.get(
  "/",
  requireAuth,
  requirePasswordChanged,
  requireRole("member", "staff", "admin"),
  async (req, res) => {
    try {
      const result = await query<EventActivitySignupRow>(
        `
          SELECT
            eas.id,
            eas.event_activity_id,
            ea.event_id,
            e.name AS event_name,
            ea.activity_id,
            a.name AS activity_name,
            eas.member_attendee_id,
            ma.member_id,
            um.full_name AS member_name,
            um.user_id,
            u.username AS household_name,
            eas.checked_in_at,
            eas.created_at,
            eas.updated_at
          FROM event_activity_signups eas
          JOIN event_activities ea
            ON ea.id = eas.event_activity_id
          JOIN events e
            ON e.id = ea.event_id
          JOIN activities a
            ON a.id = ea.activity_id
          JOIN member_attendees ma
            ON ma.id = eas.member_attendee_id
          JOIN user_members um
            ON um.id = ma.member_id
          JOIN users u
            ON u.id = um.user_id
          ORDER BY ea.starts_at, um.full_name, eas.id
        `
      );

      res.json({
        event_activity_signups: result.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not load activity signups",
      });
    }
  }
);

eventActivitySignupsRouter.delete(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("member", "admin"),
  async (req, res) => {
    const parsed = eventActivitySignupIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid activity signup id",
      });
      return;
    }

    try {
      const existingResult = await query<{
        id: string;
        user_id: string;
        checked_in_at: string | null;
      }>(
        `
          SELECT
            eas.id,
            um.user_id,
            eas.checked_in_at
          FROM event_activity_signups eas
          JOIN member_attendees ma
            ON ma.id = eas.member_attendee_id
          JOIN user_members um
            ON um.id = ma.member_id
          WHERE eas.id = $1
          LIMIT 1
        `,
        [parsed.data.id]
      );

      const existing = existingResult.rows[0];

      if (!existing) {
        res.status(404).json({
          error: "Activity signup does not exist",
        });
        return;
      }

      if (
        req.auth!.user_type === "member" &&
        String(existing.user_id) !== String(req.auth!.sub)
      ) {
        res.status(403).json({
          error: "Cannot remove another household's signup",
        });
        return;
      }

      if (existing.checked_in_at) {
        res.status(409).json({
          error: "Cannot remove a checked-in participant. Undo check-in first.",
        });
        return;
      }

      const deleted = await query<{ id: string }>(
        `
          DELETE FROM event_activity_signups
          WHERE id = $1
            AND checked_in_at IS NULL
          RETURNING id
        `,
        [parsed.data.id]
      );

      if (!deleted.rows[0]) {
        res.status(409).json({
          error: "Signup changed before it could be removed",
        });
        return;
      }

      res.json({
        ok: true,
        removed_signup_id: deleted.rows[0].id,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not remove activity signup",
      });
    }
  }
);

eventActivitySignupsRouter.patch(
  "/:id/check-in",
  requireAuth,
  requirePasswordChanged,
  requireRole("staff", "admin"),
  async (req, res) => {
    const parsed = eventActivitySignupIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid activity signup id",
      });
      return;
    }

    try {
      const result = await query<EventActivitySignupRow>(
        `
          WITH updated AS (
            UPDATE event_activity_signups
            SET
              checked_in_at = CURRENT_TIMESTAMP::text,
              updated_at = CURRENT_TIMESTAMP::text
            WHERE id = $1
              AND checked_in_at IS NULL
            RETURNING *
          )
          SELECT
            u2.id,
            u2.event_activity_id,
            ea.event_id,
            e.name AS event_name,
            ea.activity_id,
            a.name AS activity_name,
            u2.member_attendee_id,
            ma.member_id,
            um.full_name AS member_name,
            um.user_id,
            u.username AS household_name,
            u2.checked_in_at,
            u2.created_at,
            u2.updated_at
          FROM updated u2
          JOIN event_activities ea
            ON ea.id = u2.event_activity_id
          JOIN events e
            ON e.id = ea.event_id
          JOIN activities a
            ON a.id = ea.activity_id
          JOIN member_attendees ma
            ON ma.id = u2.member_attendee_id
          JOIN user_members um
            ON um.id = ma.member_id
          JOIN users u
            ON u.id = um.user_id
        `,
        [parsed.data.id]
      );

      if (result.rows[0]) {
        res.json({
          event_activity_signup: result.rows[0],
        });
        return;
      }

      const existing = await query<{ checked_in_at: string | null }>(
        `
          SELECT checked_in_at
          FROM event_activity_signups
          WHERE id = $1
          LIMIT 1
        `,
        [parsed.data.id]
      );

      if (!existing.rows[0]) {
        res.status(404).json({
          error: "Activity signup does not exist",
        });
        return;
      }

      res.status(409).json({
        error: "Participant is already checked in",
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not check participant in",
      });
    }
  }
);

eventActivitySignupsRouter.patch(
  "/:id/undo-check-in",
  requireAuth,
  requirePasswordChanged,
  requireRole("staff", "admin"),
  async (req, res) => {
    const parsed = eventActivitySignupIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid activity signup id",
      });
      return;
    }

    try {
      const result = await query<EventActivitySignupRow>(
        `
          WITH updated AS (
            UPDATE event_activity_signups
            SET
              checked_in_at = NULL,
              updated_at = CURRENT_TIMESTAMP::text
            WHERE id = $1
              AND checked_in_at IS NOT NULL
            RETURNING *
          )
          SELECT
            u2.id,
            u2.event_activity_id,
            ea.event_id,
            e.name AS event_name,
            ea.activity_id,
            a.name AS activity_name,
            u2.member_attendee_id,
            ma.member_id,
            um.full_name AS member_name,
            um.user_id,
            u.username AS household_name,
            u2.checked_in_at,
            u2.created_at,
            u2.updated_at
          FROM updated u2
          JOIN event_activities ea
            ON ea.id = u2.event_activity_id
          JOIN events e
            ON e.id = ea.event_id
          JOIN activities a
            ON a.id = ea.activity_id
          JOIN member_attendees ma
            ON ma.id = u2.member_attendee_id
          JOIN user_members um
            ON um.id = ma.member_id
          JOIN users u
            ON u.id = um.user_id
        `,
        [parsed.data.id]
      );

      if (result.rows[0]) {
        res.json({
          event_activity_signup: result.rows[0],
        });
        return;
      }

      const existing = await query<{ checked_in_at: string | null }>(
        `
          SELECT checked_in_at
          FROM event_activity_signups
          WHERE id = $1
          LIMIT 1
        `,
        [parsed.data.id]
      );

      if (!existing.rows[0]) {
        res.status(404).json({
          error: "Activity signup does not exist",
        });
        return;
      }

      res.status(409).json({
        error: "Participant is not checked in",
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not undo participant check-in",
      });
    }
  }
);

eventActivitySignupsRouter.post(
  "/",
  requireAuth,
  requirePasswordChanged,
  requireRole("member", "admin"),
  async (req, res) => {
    const parsed = createEventActivitySignupSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid activity signup",
      });
      return;
    }

    try {
      const attendeeResult = await query<{
        id: string;
        event_id: string;
        user_id: string;
      }>(
        `
          SELECT
            ma.id,
            ma.event_id,
            um.user_id
          FROM member_attendees ma
          JOIN user_members um
            ON um.id = ma.member_id
          WHERE ma.id = $1
          LIMIT 1
        `,
        [parsed.data.member_attendee_id]
      );

      const attendee = attendeeResult.rows[0];

      if (!attendee) {
        res.status(400).json({
          error: "Event attendee does not exist",
        });
        return;
      }

      if (
        req.auth!.user_type === "member" &&
        String(attendee.user_id) !== String(req.auth!.sub)
      ) {
        res.status(403).json({
          error: "Cannot sign up another household's member",
        });
        return;
      }

      const eventActivityResult = await query<{
        id: string;
        event_id: string;
      }>(
        `
          SELECT id, event_id
          FROM event_activities
          WHERE id = $1
          LIMIT 1
        `,
        [parsed.data.event_activity_id]
      );

      const eventActivity = eventActivityResult.rows[0];

      if (!eventActivity) {
        res.status(400).json({
          error: "Event activity does not exist",
        });
        return;
      }

      if (
        String(eventActivity.event_id) !==
        String(attendee.event_id)
      ) {
        res.status(409).json({
          error: "Member is not attending the event for this activity",
        });
        return;
      }

      const result = await query<EventActivitySignupRow>(
        `
          WITH inserted AS (
            INSERT INTO event_activity_signups (
              event_activity_id,
              member_attendee_id
            )
            VALUES ($1, $2)
            RETURNING *
          )
          SELECT
            i.id,
            i.event_activity_id,
            ea.event_id,
            e.name AS event_name,
            ea.activity_id,
            a.name AS activity_name,
            i.member_attendee_id,
            ma.member_id,
            um.full_name AS member_name,
            um.user_id,
            u.username AS household_name,
            i.checked_in_at,
            i.created_at,
            i.updated_at
          FROM inserted i
          JOIN event_activities ea
            ON ea.id = i.event_activity_id
          JOIN events e
            ON e.id = ea.event_id
          JOIN activities a
            ON a.id = ea.activity_id
          JOIN member_attendees ma
            ON ma.id = i.member_attendee_id
          JOIN user_members um
            ON um.id = ma.member_id
          JOIN users u
            ON u.id = um.user_id
        `,
        [
          parsed.data.event_activity_id,
          parsed.data.member_attendee_id,
        ]
      );

      res.status(201).json({
        event_activity_signup: result.rows[0],
      });
    } catch (error) {
      const dbError = error as Error & {
        code?: string;
        constraint?: string;
        detail?: string;
      };

      if (
        dbError.code === "23505" &&
        dbError.constraint ===
          "event_activity_signups_event_activity_member_attendee_unique"
      ) {
        res.status(409).json({
          error: "Already signed up for this activity",
        });
        return;
      }

      if (
        dbError.code === "P0001" &&
        dbError.message === "ACTIVITY_SIGNUP_DUPLICATE"
      ) {
        let activityName: string | undefined;

        try {
          activityName = JSON.parse(
            dbError.detail ?? "{}"
          ).activity_name;
        } catch {}

        res.status(409).json({
          error: activityName
            ? `Already signed up for ${activityName}`
            : "Already signed up for this activity",
        });
        return;
      }

      if (
        dbError.code === "P0001" &&
        dbError.message === "ACTIVITY_TIME_CONFLICT"
      ) {
        let conflict: {
          activity_name?: string;
          starts_at?: string;
          ends_at?: string;
        } = {};

        try {
          conflict = JSON.parse(dbError.detail ?? "{}");
        } catch {}

        res.status(409).json({
          error: conflict.activity_name
            ? `Activity conflicts with ${conflict.activity_name}`
            : "Activity conflicts with another signup",
          conflict: {
            activity_name: conflict.activity_name ?? null,
            starts_at: conflict.starts_at ?? null,
            ends_at: conflict.ends_at ?? null,
          },
        });
        return;
      }

      if (
        dbError.code === "P0001" &&
        dbError.message === "ACTIVITY_SIGNUP_EVENT_MISMATCH"
      ) {
        res.status(409).json({
          error: "Member is not attending the event for this activity",
        });
        return;
      }

      console.error(error);

      res.status(500).json({
        error: "Could not create activity signup",
      });
    }
  }
);
