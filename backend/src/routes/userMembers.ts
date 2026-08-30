import { Router } from "express";

import { createUserMemberSchema } from "@matapon/shared/schemas/users";

import { query } from "../db/db.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
} from "../middleware/auth.js";

type UserMemberRow = {
  id: string;
  user_id: string;
  username: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  dietary_restrictions: string | null;
  member_role: "primary" | "adult" | "child";
  created_at: string;
  updated_at: string;
};

export const userMembersRouter = Router();

userMembersRouter.get(
  "/",
  requireAuth,
  requirePasswordChanged,
  requireRole("member", "admin"),
  async (req, res) => {
    try {
      const isAdmin = req.auth!.user_type === "admin";

      const result = await query<UserMemberRow>(
        `
          SELECT
            um.id,
            um.user_id,
            u.username,
            um.full_name,
            um.email,
            um.phone,
            um.dietary_restrictions,
            um.member_role,
            um.created_at,
            um.updated_at
          FROM user_members um
          JOIN users u
            ON u.id = um.user_id
          WHERE ($1::boolean = true OR um.user_id = $2)
          ORDER BY um.user_id, um.id
        `,
        [
          isAdmin,
          req.auth!.sub,
        ]
      );

      res.json({
        user_members: result.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not load user members",
      });
    }
  }
);

userMembersRouter.post(
  "/",
  requireAuth,
  requirePasswordChanged,
  requireRole("member", "admin"),
  async (req, res) => {
    const parsed = createUserMemberSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid household member",
      });
      return;
    }

    if (
      req.auth!.user_type === "member" &&
      String(parsed.data.user_id) !== String(req.auth!.sub)
    ) {
      res.status(403).json({
        error: "Cannot add members to another household",
      });
      return;
    }

    try {
      const userResult = await query<{
        id: string;
        user_type: string;
      }>(
        `
          SELECT id, user_type
          FROM users
          WHERE id = $1
          LIMIT 1
        `,
        [parsed.data.user_id]
      );

      const user = userResult.rows[0];

      if (!user) {
        res.status(400).json({
          error: "User account does not exist",
        });
        return;
      }

      if (user.user_type !== "member") {
        res.status(400).json({
          error: "Household members can only belong to member accounts",
        });
        return;
      }

      const result = await query<UserMemberRow>(
        `
          WITH inserted AS (
            INSERT INTO user_members (
              user_id,
              full_name,
              email,
              phone,
              dietary_restrictions,
              member_role
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
          )
          SELECT
            i.id,
            i.user_id,
            u.username,
            i.full_name,
            i.email,
            i.phone,
            i.dietary_restrictions,
            i.member_role,
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
          parsed.data.dietary_restrictions ?? null,
          parsed.data.member_role,
        ]
      );

      res.status(201).json({
        user_member: result.rows[0],
      });
    } catch (error: any) {
      if (
        error?.code === "23505" &&
        String(error?.constraint || "").includes(
          "user_members_one_primary_per_household"
        )
      ) {
        res.status(409).json({
          error: "Household already has a primary member",
        });
        return;
      }

      if (
        error?.code === "P0001" &&
        String(error?.message || "").includes(
          "FIRST_HOUSEHOLD_MEMBER_MUST_BE_PRIMARY"
        )
      ) {
        res.status(409).json({
          error: "First household member must be primary",
        });
        return;
      }

      if (
        error?.code === "P0001" &&
        String(error?.message || "").includes(
          "HOUSEHOLD_PRIMARY_REQUIRED"
        )
      ) {
        res.status(409).json({
          error: "Household must have exactly one primary member",
        });
        return;
      }

      console.error(error);

      res.status(500).json({
        error: "Could not create user member",
      });
    }
  }
);
