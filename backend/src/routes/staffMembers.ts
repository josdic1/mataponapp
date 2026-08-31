import { Router } from "express";

import {
  createStaffMemberSchema,
  updateStaffMemberSchema,
  staffMemberIdParamsSchema,
} from "@matapon/shared/schemas/staffMembers";

import { pool } from "../db/pool.js";
import { query } from "../db/db.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
} from "../middleware/auth.js";

type StaffMemberRow = {
  id: string;
  user_id: string;
  username: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: "staff" | "manager";
  created_at: string;
  updated_at: string;
};

export const staffMembersRouter = Router();

staffMembersRouter.get(
  "/",
  requireAuth,
  requirePasswordChanged,
  async (_req, res) => {
    try {
      const result = await query<StaffMemberRow>(
        `
          SELECT
            sm.id,
            sm.user_id,
            u.username,
            sm.full_name,
            sm.email,
            sm.phone,
            sm.role,
            sm.created_at,
            sm.updated_at
          FROM staff_members sm
          JOIN users u
            ON u.id = sm.user_id
          ORDER BY sm.full_name, sm.id
        `
      );

      res.json({
        staff_members: result.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not load staff members",
      });
    }
  }
);

staffMembersRouter.get(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  async (req, res) => {
    const parsed = staffMemberIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid staff member id",
      });
      return;
    }

    try {
      const result = await query<StaffMemberRow>(
        `
          SELECT
            sm.id,
            sm.user_id,
            u.username,
            sm.full_name,
            sm.email,
            sm.phone,
            sm.role,
            sm.created_at,
            sm.updated_at
          FROM staff_members sm
          JOIN users u
            ON u.id = sm.user_id
          WHERE sm.id = $1
          LIMIT 1
        `,
        [parsed.data.id]
      );

      const staffMember = result.rows[0];

      if (!staffMember) {
        res.status(404).json({
          error: "Staff member does not exist",
        });
        return;
      }

      res.json({
        staff_member: staffMember,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not load staff member",
      });
    }
  }
);

staffMembersRouter.post(
  "/",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed = createStaffMemberSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid staff member data",
      });
      return;
    }

    try {
      const userResult = await query<{
        id: string;
        username: string;
        user_type: string;
      }>(
        `
          SELECT
            id,
            username,
            user_type
          FROM users
          WHERE id = $1
          LIMIT 1
        `,
        [parsed.data.user_id]
      );

      const user = userResult.rows[0];

      if (!user) {
        res.status(400).json({
          error: "User does not exist",
        });
        return;
      }

      if (user.user_type !== "staff") {
        res.status(400).json({
          error: "User must be a staff account",
        });
        return;
      }

      const result = await query<StaffMemberRow>(
        `
          WITH inserted AS (
            INSERT INTO staff_members (
              user_id,
              full_name,
              email,
              phone,
              role
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
          )
          SELECT
            i.id,
            i.user_id,
            u.username,
            i.full_name,
            i.email,
            i.phone,
            i.role,
            i.created_at,
            i.updated_at
          FROM inserted i
          JOIN users u
            ON u.id = i.user_id
        `,
        [
          parsed.data.user_id,
          parsed.data.full_name,
          parsed.data.email ?? null,
          parsed.data.phone ?? null,
          parsed.data.role,
        ]
      );

      res.status(201).json({
        staff_member: result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not create staff member",
      });
    }
  }
);

staffMembersRouter.patch(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const params = staffMemberIdParamsSchema.safeParse(req.params);
    const body = updateStaffMemberSchema.safeParse(req.body);

    if (!params.success) {
      res.status(400).json({
        error: "Invalid staff member id",
      });
      return;
    }

    if (!body.success) {
      res.status(400).json({
        error: "Invalid staff member data",
      });
      return;
    }

    try {
      const result = await query<StaffMemberRow>(
        `
          WITH updated AS (
            UPDATE staff_members
            SET
              full_name = COALESCE($2, full_name),
              email = CASE
                WHEN $3::boolean THEN $4
                ELSE email
              END,
              phone = CASE
                WHEN $5::boolean THEN $6
                ELSE phone
              END,
              role = COALESCE($7, role),
              updated_at = CURRENT_TIMESTAMP::text
            WHERE id = $1
            RETURNING *
          )
          SELECT
            u2.id,
            u2.user_id,
            u.username,
            u2.full_name,
            u2.email,
            u2.phone,
            u2.role,
            u2.created_at,
            u2.updated_at
          FROM updated u2
          JOIN users u
            ON u.id = u2.user_id
        `,
        [
          params.data.id,
          body.data.full_name ?? null,
          Object.prototype.hasOwnProperty.call(body.data, "email"),
          body.data.email ?? null,
          Object.prototype.hasOwnProperty.call(body.data, "phone"),
          body.data.phone ?? null,
          body.data.role ?? null,
        ]
      );

      const staffMember = result.rows[0];

      if (!staffMember) {
        res.status(404).json({
          error: "Staff member does not exist",
        });
        return;
      }

      res.json({
        staff_member: staffMember,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not update staff member",
      });
    }
  }
);

staffMembersRouter.delete(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed = staffMemberIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid staff member id",
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
          FROM staff_members
          WHERE id = $1
          LIMIT 1
        `,
        [parsed.data.id]
      );

      if (!exists.rows[0]) {
        await client.query("ROLLBACK");

        res.status(404).json({
          error: "Staff member does not exist",
        });
        return;
      }

      const dependencies = await client.query<{
        staff_member_areas: string;
        staff_activities: string;
        event_activity_staff: string;
      }>(
        `
          SELECT
            (
              SELECT COUNT(*)::text
              FROM staff_member_areas
              WHERE staff_member_id = $1
            ) AS staff_member_areas,
            (
              SELECT COUNT(*)::text
              FROM staff_activities
              WHERE staff_member_id = $1
            ) AS staff_activities,
            (
              SELECT COUNT(*)::text
              FROM event_activity_staff
              WHERE staff_member_id = $1
            ) AS event_activity_staff
        `,
        [parsed.data.id]
      );

      const counts = dependencies.rows[0];

      if (
        Number(counts.staff_member_areas) > 0 ||
        Number(counts.staff_activities) > 0 ||
        Number(counts.event_activity_staff) > 0
      ) {
        await client.query("ROLLBACK");

        res.status(409).json({
          error:
            "Cannot delete a staff member while they have area, activity, or scheduled-event assignments",
        });
        return;
      }

      await client.query(
        `
          DELETE FROM staff_members
          WHERE id = $1
        `,
        [parsed.data.id]
      );

      await client.query("COMMIT");

      res.json({
        ok: true,
        deleted_staff_member_id: String(parsed.data.id),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(error);

      res.status(500).json({
        error: "Could not delete staff member",
      });
    } finally {
      client.release();
    }
  }
);
