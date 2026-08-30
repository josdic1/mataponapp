import { Router } from "express";

import { createEventActivitySignupSchema } from "@matapon/shared/schemas/eventActivitySignups";

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
  requireRole("member", "admin"),
  async (req, res) => {
    try {
      const isAdmin = req.auth!.user_type === "admin";

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
          WHERE ($1::boolean = true OR um.user_id = $2)
          ORDER BY ea.starts_at, um.full_name, eas.id
        `,
        [
          isAdmin,
          req.auth!.sub,
        ]
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
