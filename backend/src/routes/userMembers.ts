import { Router } from "express";

import {
  createUserMemberSchema,
  transferPrimaryMemberSchema,
  updateUserMemberSchema,
  userMemberIdParamsSchema,
  type UserMember,
} from "@matapon/shared/schemas/users";

import { pool } from "../db/pool.js";
import { query } from "../db/db.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
} from "../middleware/auth.js";

export const userMembersRouter = Router();

userMembersRouter.get(
  "/",
  requireAuth,
  requirePasswordChanged,
  requireRole("member", "admin"),
  async (req, res) => {
    try {
      const isAdmin = req.auth!.user_type === "admin";

      const result = await query<UserMember>(
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

userMembersRouter.get(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("member", "admin"),
  async (req, res) => {
    const parsed = userMemberIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid household member id",
      });
      return;
    }

    try {
      const isAdmin = req.auth!.user_type === "admin";

      const result = await query<UserMember>(
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
          WHERE um.id = $1
            AND ($2::boolean = true OR um.user_id = $3)
          LIMIT 1
        `,
        [
          parsed.data.id,
          isAdmin,
          req.auth!.sub,
        ]
      );

      const userMember = result.rows[0];

      if (!userMember) {
        res.status(404).json({
          error: "Household member does not exist",
        });
        return;
      }

      res.json({
        user_member: userMember,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not load household member",
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

      const result = await query<UserMember>(
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

userMembersRouter.patch(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("member", "admin"),
  async (req, res) => {
    const params = userMemberIdParamsSchema.safeParse(req.params);
    const body = updateUserMemberSchema.safeParse(req.body);

    if (!params.success) {
      res.status(400).json({
        error: "Invalid household member id",
      });
      return;
    }

    if (!body.success) {
      res.status(400).json({
        error: "Invalid household member data",
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
            id,
            user_id
          FROM user_members
          WHERE id = $1
          FOR UPDATE
        `,
        [params.data.id]
      );

      const member = current.rows[0];

      if (!member) {
        await client.query("ROLLBACK");

        res.status(404).json({
          error: "Household member does not exist",
        });
        return;
      }

      if (
        req.auth!.user_type === "member" &&
        String(member.user_id) !== String(req.auth!.sub)
      ) {
        await client.query("ROLLBACK");

        res.status(403).json({
          error: "Cannot edit another household's member",
        });
        return;
      }

      const result = await client.query<UserMember>(
        `
          WITH updated AS (
            UPDATE user_members
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
              dietary_restrictions = CASE
                WHEN $7::boolean THEN $8
                ELSE dietary_restrictions
              END,
              member_role = COALESCE($9, member_role),
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
            u2.dietary_restrictions,
            u2.member_role,
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
          Object.prototype.hasOwnProperty.call(body.data, "dietary_restrictions"),
          body.data.dietary_restrictions ?? null,
          body.data.member_role ?? null,
        ]
      );

      await client.query("COMMIT");

      res.json({
        user_member: result.rows[0],
      });
    } catch (error: any) {
      await client.query("ROLLBACK");

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
          "HOUSEHOLD_PRIMARY_REQUIRED"
        )
      ) {
        res.status(409).json({
          error:
            "A household must keep exactly one primary member",
        });
        return;
      }

      console.error(error);

      res.status(500).json({
        error: "Could not update household member",
      });
    } finally {
      client.release();
    }
  }
);


userMembersRouter.post(
  "/:id/transfer-primary",
  requireAuth,
  requirePasswordChanged,
  requireRole("member", "admin"),
  async (req, res) => {
    const params = userMemberIdParamsSchema.safeParse(req.params);
    const body = transferPrimaryMemberSchema.safeParse(req.body);

    if (!params.success) {
      res.status(400).json({
        error: "Invalid primary member id",
      });
      return;
    }

    if (!body.success) {
      res.status(400).json({
        error: "Invalid primary transfer",
      });
      return;
    }

    if (params.data.id === body.data.target_member_id) {
      res.status(400).json({
        error: "Primary member and target member must be different",
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

      const sourceResult = await client.query<{
        id: string;
        user_id: string;
        member_role: "primary" | "adult" | "child";
      }>(
        `
          SELECT
            id,
            user_id,
            member_role
          FROM user_members
          WHERE id = $1
          FOR UPDATE
        `,
        [params.data.id]
      );

      const source = sourceResult.rows[0];

      if (!source) {
        await client.query("ROLLBACK");

        res.status(404).json({
          error: "Primary member does not exist",
        });
        return;
      }

      if (source.member_role !== "primary") {
        await client.query("ROLLBACK");

        res.status(409).json({
          error: "Only the current primary member can transfer primary",
        });
        return;
      }

      if (
        req.auth!.user_type === "member" &&
        String(source.user_id) !== String(req.auth!.sub)
      ) {
        await client.query("ROLLBACK");

        res.status(403).json({
          error: "Cannot transfer primary for another household",
        });
        return;
      }

      const targetResult = await client.query<{
        id: string;
        user_id: string;
        member_role: "primary" | "adult" | "child";
      }>(
        `
          SELECT
            id,
            user_id,
            member_role
          FROM user_members
          WHERE id = $1
          FOR UPDATE
        `,
        [body.data.target_member_id]
      );

      const target = targetResult.rows[0];

      if (!target) {
        await client.query("ROLLBACK");

        res.status(404).json({
          error: "Target household member does not exist",
        });
        return;
      }

      if (String(target.user_id) !== String(source.user_id)) {
        await client.query("ROLLBACK");

        res.status(409).json({
          error: "Primary can only be transferred within the same household",
        });
        return;
      }

      if (target.member_role !== "adult") {
        await client.query("ROLLBACK");

        res.status(409).json({
          error: "Primary can only be transferred to another adult",
        });
        return;
      }

      await client.query(
        `SELECT set_config('matapon.primary_transfer', 'on', true)`
      );

      await client.query(
        `
          UPDATE user_members
          SET
            member_role = 'adult',
            updated_at = CURRENT_TIMESTAMP::text
          WHERE id = $1
        `,
        [source.id]
      );

      await client.query(
        `
          UPDATE user_members
          SET
            member_role = 'primary',
            updated_at = CURRENT_TIMESTAMP::text
          WHERE id = $1
        `,
        [target.id]
      );

      const result = await client.query<UserMember>(
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
          WHERE um.user_id = $1
          ORDER BY
            CASE um.member_role
              WHEN 'primary' THEN 0
              WHEN 'adult' THEN 1
              ELSE 2
            END,
            um.id
        `,
        [source.user_id]
      );

      await client.query("COMMIT");

      res.json({
        user_members: result.rows,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(error);

      res.status(500).json({
        error: "Could not transfer primary member",
      });
    } finally {
      client.release();
    }
  }
);

userMembersRouter.delete(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("member", "admin"),
  async (req, res) => {
    const parsed = userMemberIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid household member id",
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
        member_role: "primary" | "adult" | "child";
      }>(
        `
          SELECT
            id,
            user_id,
            member_role
          FROM user_members
          WHERE id = $1
          FOR UPDATE
        `,
        [parsed.data.id]
      );

      const member = current.rows[0];

      if (!member) {
        await client.query("ROLLBACK");

        res.status(404).json({
          error: "Household member does not exist",
        });
        return;
      }

      if (
        req.auth!.user_type === "member" &&
        String(member.user_id) !== String(req.auth!.sub)
      ) {
        await client.query("ROLLBACK");

        res.status(403).json({
          error: "Cannot delete another household's member",
        });
        return;
      }

      const attendance = await client.query<{ count: string }>(
        `
          SELECT COUNT(*)::text AS count
          FROM member_attendees
          WHERE member_id = $1
        `,
        [parsed.data.id]
      );

      if (Number(attendance.rows[0]?.count ?? 0) > 0) {
        await client.query("ROLLBACK");

        res.status(409).json({
          error:
            "Cannot delete a household member while they are still registered for events",
        });
        return;
      }

      const householdCount = await client.query<{ count: string }>(
        `
          SELECT COUNT(*)::text AS count
          FROM user_members
          WHERE user_id = $1
        `,
        [member.user_id]
      );

      if (
        member.member_role === "primary" &&
        Number(householdCount.rows[0]?.count ?? 0) > 1
      ) {
        await client.query("ROLLBACK");

        res.status(409).json({
          error:
            "Cannot delete the primary member while other household members remain",
        });
        return;
      }

      await client.query(
        `
          DELETE FROM user_members
          WHERE id = $1
        `,
        [parsed.data.id]
      );

      await client.query("COMMIT");

      res.json({
        ok: true,
        deleted_user_member_id: String(parsed.data.id),
      });
    } catch (error: any) {
      await client.query("ROLLBACK");

      if (
        error?.code === "P0001" &&
        String(error?.message || "").includes(
          "HOUSEHOLD_PRIMARY_REQUIRED"
        )
      ) {
        res.status(409).json({
          error:
            "Cannot delete the primary member while other household members remain",
        });
        return;
      }

      console.error(error);

      res.status(500).json({
        error: "Could not delete household member",
      });
    } finally {
      client.release();
    }
  }
);
