import { Router } from "express";

import {
  createMemberAttendeeSchema,
  memberAttendeeIdParamsSchema,
} from "@matapon/shared/schemas/memberAttendees";

import { pool } from "../db/pool.js";
import { query } from "../db/db.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
} from "../middleware/auth.js";

type MemberAttendeeRow = {
  id: string;
  member_id: string;
  member_name: string;
  user_id: string;
  household_name: string;
  event_id: string;
  event_name: string;
  created_at: string;
  updated_at: string;
};

export const memberAttendeesRouter = Router();

memberAttendeesRouter.get(
  "/",
  requireAuth,
  requirePasswordChanged,
  requireRole("member", "admin"),
  async (req, res) => {
    try {
      const isAdmin = req.auth!.user_type === "admin";

      const result = await query<MemberAttendeeRow>(
        `
          SELECT
            ma.id,
            ma.member_id,
            um.full_name AS member_name,
            um.user_id,
            u.username AS household_name,
            ma.event_id,
            e.name AS event_name,
            ma.created_at,
            ma.updated_at
          FROM member_attendees ma
          JOIN user_members um
            ON um.id = ma.member_id
          JOIN users u
            ON u.id = um.user_id
          JOIN events e
            ON e.id = ma.event_id
          WHERE ($1::boolean = true OR um.user_id = $2)
          ORDER BY ma.id
        `,
        [
          isAdmin,
          req.auth!.sub,
        ]
      );

      res.json({
        member_attendees: result.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not load member attendees",
      });
    }
  }
);

memberAttendeesRouter.post(
  "/",
  requireAuth,
  requirePasswordChanged,
  requireRole("member", "admin"),
  async (req, res) => {
    const parsed = createMemberAttendeeSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid event attendee",
      });
      return;
    }

    try {
      const memberResult = await query<{
        id: string;
        user_id: string;
      }>(
        `
          SELECT id, user_id
          FROM user_members
          WHERE id = $1
          LIMIT 1
        `,
        [parsed.data.member_id]
      );

      const member = memberResult.rows[0];

      if (!member) {
        res.status(400).json({
          error: "Household member does not exist",
        });
        return;
      }

      if (
        req.auth!.user_type === "member" &&
        String(member.user_id) !== String(req.auth!.sub)
      ) {
        res.status(403).json({
          error: "Cannot register another household's member",
        });
        return;
      }

      const eventResult = await query<{ id: string }>(
        `
          SELECT id
          FROM events
          WHERE id = $1
          LIMIT 1
        `,
        [parsed.data.event_id]
      );

      if (!eventResult.rows[0]) {
        res.status(400).json({
          error: "Event does not exist",
        });
        return;
      }

      const result = await query<MemberAttendeeRow>(
        `
          WITH inserted AS (
            INSERT INTO member_attendees (
              member_id,
              event_id
            )
            VALUES ($1, $2)
            RETURNING *
          )
          SELECT
            i.id,
            i.member_id,
            um.full_name AS member_name,
            um.user_id,
            u.username AS household_name,
            i.event_id,
            e.name AS event_name,
            i.created_at,
            i.updated_at
          FROM inserted i
          JOIN user_members um
            ON um.id = i.member_id
          JOIN users u
            ON u.id = um.user_id
          JOIN events e
            ON e.id = i.event_id
        `,
        [
          parsed.data.member_id,
          parsed.data.event_id,
        ]
      );

      res.status(201).json({
        member_attendee: result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not register event attendee",
      });
    }
  }
);

memberAttendeesRouter.delete(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("member", "admin"),
  async (req, res) => {
    const parsed = memberAttendeeIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid event attendee id",
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
      }>(
        `
          SELECT
            ma.id,
            um.user_id
          FROM member_attendees ma
          JOIN user_members um
            ON um.id = ma.member_id
          WHERE ma.id = $1
          FOR UPDATE OF ma
        `,
        [parsed.data.id]
      );

      const attendee = current.rows[0];

      if (!attendee) {
        await client.query("ROLLBACK");

        res.status(404).json({
          error: "Event attendee does not exist",
        });
        return;
      }

      if (
        req.auth!.user_type === "member" &&
        String(attendee.user_id) !== String(req.auth!.sub)
      ) {
        await client.query("ROLLBACK");

        res.status(403).json({
          error: "Cannot remove another household's member from an event",
        });
        return;
      }

      const signups = await client.query<{ count: string }>(
        `
          SELECT COUNT(*)::text AS count
          FROM event_activity_signups
          WHERE member_attendee_id = $1
        `,
        [parsed.data.id]
      );

      if (Number(signups.rows[0]?.count ?? 0) > 0) {
        await client.query("ROLLBACK");

        res.status(409).json({
          error:
            "Cannot remove a member from an event while they still have activity signups",
        });
        return;
      }

      await client.query(
        `
          DELETE FROM member_attendees
          WHERE id = $1
        `,
        [parsed.data.id]
      );

      await client.query("COMMIT");

      res.json({
        ok: true,
        deleted_member_attendee_id: String(parsed.data.id),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(error);

      res.status(500).json({
        error: "Could not remove member from event",
      });
    } finally {
      client.release();
    }
  }
);
