import { Router } from "express";

import { createStaffMemberSchema } from "@matapon/shared/schemas/staffMembers";

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
