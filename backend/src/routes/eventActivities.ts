import { Router } from "express";

import {
  createEventActivitySchema,
  updateEventActivitySchema,
  eventActivityIdParamsSchema,
  type EventActivity,
} from "@matapon/shared/schemas/eventActivities";

import { pool } from "../db/pool.js";
import { query } from "../db/db.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
} from "../middleware/auth.js";

type CurrentEventActivity = {
  id: string;
  event_id: string;
  activity_id: string;
  starts_at: string;
  ends_at: string;
};

function validTimeRange(
  startsAt: string,
  endsAt: string
) {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);

  return (
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start < end
  );
}

export const eventActivitiesRouter = Router();

eventActivitiesRouter.get(
  "/",
  requireAuth,
  requirePasswordChanged,
  async (req, res) => {
    try {
      const isMember = req.auth!.user_type === "member";

      const result = await query<EventActivity>(
        `
          SELECT
            ea.id,
            ea.event_id,
            e.name AS event_name,
            ea.activity_id,
            a.name AS activity_name,
            ea.starts_at,
            ea.ends_at,
            ea.created_at,
            ea.updated_at
          FROM event_activities ea
          JOIN events e
            ON e.id = ea.event_id
          JOIN activities a
            ON a.id = ea.activity_id
          WHERE (
            $1::boolean = false
            OR EXISTS (
              SELECT 1
              FROM event_registrations er
              WHERE er.event_id = ea.event_id
                AND er.user_id = $2
            )
          )
          ORDER BY ea.starts_at, ea.id
        `,
        [isMember, req.auth!.sub]
      );

      res.json({
        event_activities: result.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not load event activities",
      });
    }
  }
);

eventActivitiesRouter.get(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  async (req, res) => {
    const parsed =
      eventActivityIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid event activity id",
      });
      return;
    }

    try {
      const result = await query<EventActivity>(
        `
          SELECT
            ea.id,
            ea.event_id,
            e.name AS event_name,
            ea.activity_id,
            a.name AS activity_name,
            ea.starts_at,
            ea.ends_at,
            ea.created_at,
            ea.updated_at
          FROM event_activities ea
          JOIN events e
            ON e.id = ea.event_id
          JOIN activities a
            ON a.id = ea.activity_id
          WHERE ea.id = $1
            AND (
              $2::boolean = false
              OR EXISTS (
                SELECT 1
                FROM event_registrations er
                WHERE er.event_id = ea.event_id
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

      const eventActivity = result.rows[0];

      if (!eventActivity) {
        res.status(404).json({
          error: "Event activity does not exist",
        });
        return;
      }

      res.json({
        event_activity: eventActivity,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not load event activity",
      });
    }
  }
);

eventActivitiesRouter.post(
  "/",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed =
      createEventActivitySchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid event activity data",
      });
      return;
    }

    if (
      !validTimeRange(
        parsed.data.starts_at,
        parsed.data.ends_at
      )
    ) {
      res.status(400).json({
        error:
          "Event activity end time must be after start time",
      });
      return;
    }

    try {
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

      const activityResult = await query<{ id: string }>(
        `
          SELECT id
          FROM activities
          WHERE id = $1
          LIMIT 1
        `,
        [parsed.data.activity_id]
      );

      if (!activityResult.rows[0]) {
        res.status(400).json({
          error: "Activity does not exist",
        });
        return;
      }

      const result = await query<EventActivity>(
        `
          WITH inserted AS (
            INSERT INTO event_activities (
              event_id,
              activity_id,
              starts_at,
              ends_at
            )
            VALUES ($1, $2, $3, $4)
            RETURNING *
          )
          SELECT
            i.id,
            i.event_id,
            e.name AS event_name,
            i.activity_id,
            a.name AS activity_name,
            i.starts_at,
            i.ends_at,
            i.created_at,
            i.updated_at
          FROM inserted i
          JOIN events e
            ON e.id = i.event_id
          JOIN activities a
            ON a.id = i.activity_id
        `,
        [
          parsed.data.event_id,
          parsed.data.activity_id,
          parsed.data.starts_at,
          parsed.data.ends_at,
        ]
      );

      res.status(201).json({
        event_activity: result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not schedule activity",
      });
    }
  }
);

eventActivitiesRouter.patch(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const params =
      eventActivityIdParamsSchema.safeParse(req.params);

    const body =
      updateEventActivitySchema.safeParse(req.body);

    if (!params.success) {
      res.status(400).json({
        error: "Invalid event activity id",
      });
      return;
    }

    if (!body.success) {
      res.status(400).json({
        error: "Invalid event activity data",
      });
      return;
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `SELECT set_config(
          'matapon.actor_user_id',
          $1,
          true
        )`,
        [req.auth!.sub]
      );

      const currentResult =
        await client.query<CurrentEventActivity>(
          `
            SELECT
              id,
              event_id,
              activity_id,
              starts_at,
              ends_at
            FROM event_activities
            WHERE id = $1
            LIMIT 1
            FOR UPDATE
          `,
          [params.data.id]
        );

      const current = currentResult.rows[0];

      if (!current) {
        await client.query("ROLLBACK");

        res.status(404).json({
          error: "Event activity does not exist",
        });
        return;
      }

      const nextEventId =
        body.data.event_id ??
        Number(current.event_id);

      const nextActivityId =
        body.data.activity_id ??
        Number(current.activity_id);

      const nextStartsAt =
        body.data.starts_at ??
        current.starts_at;

      const nextEndsAt =
        body.data.ends_at ??
        current.ends_at;

      if (
        !validTimeRange(
          nextStartsAt,
          nextEndsAt
        )
      ) {
        await client.query("ROLLBACK");

        res.status(400).json({
          error:
            "Event activity end time must be after start time",
        });
        return;
      }

      const checkedInResult =
        await client.query<{ count: string }>(
          `
            SELECT COUNT(*)::text AS count
            FROM event_activity_signups
            WHERE event_activity_id = $1
              AND checked_in_at IS NOT NULL
          `,
          [params.data.id]
        );

      if (
        Number(
          checkedInResult.rows[0]?.count ?? 0
        ) > 0
      ) {
        await client.query("ROLLBACK");

        res.status(409).json({
          error:
            "Cannot change a scheduled activity after participation has been confirmed",
        });
        return;
      }

      const eventResult =
        await client.query<{
          id: string;
          name: string;
        }>(
          `
            SELECT id, name
            FROM events
            WHERE id = $1
            LIMIT 1
          `,
          [nextEventId]
        );

      if (!eventResult.rows[0]) {
        await client.query("ROLLBACK");

        res.status(400).json({
          error: "Event does not exist",
        });
        return;
      }

      const activityResult =
        await client.query<{
          id: string;
          name: string;
        }>(
          `
            SELECT id, name
            FROM activities
            WHERE id = $1
            LIMIT 1
          `,
          [nextActivityId]
        );

      if (!activityResult.rows[0]) {
        await client.query("ROLLBACK");

        res.status(400).json({
          error: "Activity does not exist",
        });
        return;
      }

      const wrongEventSignup =
        await client.query<{
          full_name: string;
        }>(
          `
            SELECT
              um.full_name
            FROM event_activity_signups eas
            JOIN member_attendees ma
              ON ma.id = eas.member_attendee_id
            JOIN user_members um
              ON um.id = ma.member_id
            WHERE eas.event_activity_id = $1
              AND ma.event_id <> $2
            LIMIT 1
          `,
          [
            params.data.id,
            nextEventId,
          ]
        );

      if (wrongEventSignup.rows[0]) {
        await client.query("ROLLBACK");

        res.status(409).json({
          error:
            "Cannot move a scheduled activity to another event while members are signed up",
        });
        return;
      }

      const signupConflict =
        await client.query<{
          full_name: string;
          activity_name: string;
        }>(
          `
            SELECT
              um.full_name,
              a.name AS activity_name
            FROM event_activity_signups current_signup
            JOIN member_attendees current_attendee
              ON current_attendee.id =
                 current_signup.member_attendee_id
            JOIN user_members um
              ON um.id =
                 current_attendee.member_id
            JOIN member_attendees other_attendee
              ON other_attendee.member_id =
                 current_attendee.member_id
             AND other_attendee.event_id = $2
            JOIN event_activity_signups other_signup
              ON other_signup.member_attendee_id =
                 other_attendee.id
            JOIN event_activities other_ea
              ON other_ea.id =
                 other_signup.event_activity_id
            JOIN activities a
              ON a.id =
                 other_ea.activity_id
            WHERE current_signup.event_activity_id = $1
              AND other_ea.id <> $1
              AND $3::timestamptz <
                  other_ea.ends_at::timestamptz
              AND $4::timestamptz >
                  other_ea.starts_at::timestamptz
            LIMIT 1
          `,
          [
            params.data.id,
            nextEventId,
            nextStartsAt,
            nextEndsAt,
          ]
        );

      if (signupConflict.rows[0]) {
        await client.query("ROLLBACK");

        res.status(409).json({
          error:
            `${signupConflict.rows[0].full_name} would conflict with ${signupConflict.rows[0].activity_name}`,
        });
        return;
      }

      const updated =
        await client.query<EventActivity>(
          `
            WITH changed AS (
              UPDATE event_activities
              SET
                event_id = $2,
                activity_id = $3,
                starts_at = $4,
                ends_at = $5,
                updated_at =
                  CURRENT_TIMESTAMP::text
              WHERE id = $1
              RETURNING *
            )
            SELECT
              c.id,
              c.event_id,
              e.name AS event_name,
              c.activity_id,
              a.name AS activity_name,
              c.starts_at,
              c.ends_at,
              c.created_at,
              c.updated_at
            FROM changed c
            JOIN events e
              ON e.id = c.event_id
            JOIN activities a
              ON a.id = c.activity_id
          `,
          [
            params.data.id,
            nextEventId,
            nextActivityId,
            nextStartsAt,
            nextEndsAt,
          ]
        );

      await client.query("COMMIT");

      res.json({
        event_activity:
          updated.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(error);

      res.status(500).json({
        error:
          "Could not update event activity",
      });
    } finally {
      client.release();
    }
  }
);

eventActivitiesRouter.delete(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed =
      eventActivityIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid event activity id",
      });
      return;
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `SELECT set_config(
          'matapon.actor_user_id',
          $1,
          true
        )`,
        [req.auth!.sub]
      );

      const exists =
        await client.query<{ id: string }>(
          `
            SELECT id
            FROM event_activities
            WHERE id = $1
            LIMIT 1
            FOR UPDATE
          `,
          [parsed.data.id]
        );

      if (!exists.rows[0]) {
        await client.query("ROLLBACK");

        res.status(404).json({
          error:
            "Event activity does not exist",
        });
        return;
      }

      const dependencies =
        await client.query<{
          staff_count: string;
          signup_count: string;
        }>(
          `
            SELECT
              (
                SELECT COUNT(*)::text
                FROM event_activity_staff
                WHERE event_activity_id = $1
              ) AS staff_count,
              (
                SELECT COUNT(*)::text
                FROM event_activity_signups
                WHERE event_activity_id = $1
              ) AS signup_count
          `,
          [parsed.data.id]
        );

      const counts = dependencies.rows[0];

      if (
        Number(counts.staff_count) > 0 ||
        Number(counts.signup_count) > 0
      ) {
        await client.query("ROLLBACK");

        res.status(409).json({
          error:
            "Cannot delete a scheduled activity that has assigned staff or member signups",
        });
        return;
      }

      await client.query(
        `
          DELETE FROM event_activities
          WHERE id = $1
        `,
        [parsed.data.id]
      );

      await client.query("COMMIT");

      res.json({
        ok: true,
        deleted_event_activity_id:
          String(parsed.data.id),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(error);

      res.status(500).json({
        error:
          "Could not delete event activity",
      });
    } finally {
      client.release();
    }
  }
);
