import { Router } from "express";

import {
  createStaffQualificationSchema,
  relationshipIdParamsSchema,
  type StaffQualification,
} from "@matapon/shared/schemas/qualifications";

import { query } from "../db/db.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
} from "../middleware/auth.js";

export const staffQualificationsRouter = Router();

staffQualificationsRouter.get(
  "/",
  requireAuth,
  requirePasswordChanged,
  requireRole("staff", "admin"),
  async (req, res) => {
    try {
      const isAdmin = req.auth!.user_type === "admin";

      const result = await query<StaffQualification>(
        `
          SELECT
            sq.id,
            sq.staff_member_id,
            sm.full_name AS staff_member_name,
            sq.qualification_id,
            q.name AS qualification_name,
            sq.created_at,
            sq.updated_at
          FROM staff_qualifications sq
          JOIN staff_members sm
            ON sm.id = sq.staff_member_id
          JOIN qualifications q
            ON q.id = sq.qualification_id
          WHERE ($1::boolean = TRUE OR sm.user_id = $2)
          ORDER BY sm.full_name, q.name, sq.id
        `,
        [
          isAdmin,
          req.auth!.sub,
        ],
      );

      res.json({
        staff_qualifications: result.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not load staff qualifications",
      });
    }
  },
);

staffQualificationsRouter.post(
  "/",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed =
      createStaffQualificationSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid staff qualification",
      });
      return;
    }

    try {
      const result = await query<StaffQualification>(
        `
          WITH inserted AS (
            INSERT INTO staff_qualifications (
              staff_member_id,
              qualification_id
            )
            VALUES ($1, $2)
            RETURNING *
          )
          SELECT
            i.id,
            i.staff_member_id,
            sm.full_name AS staff_member_name,
            i.qualification_id,
            q.name AS qualification_name,
            i.created_at,
            i.updated_at
          FROM inserted i
          JOIN staff_members sm
            ON sm.id = i.staff_member_id
          JOIN qualifications q
            ON q.id = i.qualification_id
        `,
        [
          parsed.data.staff_member_id,
          parsed.data.qualification_id,
        ],
      );

      res.status(201).json({
        staff_qualification: result.rows[0],
      });
    } catch (error: any) {
      if (error?.code === "23505") {
        res.status(409).json({
          error: "Staff member already has this qualification",
        });
        return;
      }

      if (error?.code === "23503") {
        res.status(400).json({
          error: "Staff member or qualification does not exist",
        });
        return;
      }

      console.error(error);

      res.status(500).json({
        error: "Could not add staff qualification",
      });
    }
  },
);

staffQualificationsRouter.delete(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed =
      relationshipIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid staff qualification id",
      });
      return;
    }

    try {
      const currentResult = await query<{
        id: string;
        staff_member_id: string;
        qualification_id: string;
        staff_member_name: string;
        qualification_name: string;
      }>(
        `
          SELECT
            sq.id,
            sq.staff_member_id,
            sq.qualification_id,
            sm.full_name AS staff_member_name,
            q.name AS qualification_name
          FROM staff_qualifications sq
          JOIN staff_members sm
            ON sm.id = sq.staff_member_id
          JOIN qualifications q
            ON q.id = sq.qualification_id
          WHERE sq.id = $1
          LIMIT 1
        `,
        [parsed.data.id],
      );

      const current = currentResult.rows[0];

      if (!current) {
        res.status(404).json({
          error: "Staff qualification does not exist",
        });
        return;
      }

      const uncoveredResult = await query<{
        event_name: string;
        activity_name: string;
      }>(
        `
          SELECT
            e.name AS event_name,
            a.name AS activity_name
          FROM event_activity_staff eas
          JOIN event_activities ea
            ON ea.id = eas.event_activity_id
          JOIN events e
            ON e.id = ea.event_id
          JOIN activities a
            ON a.id = ea.activity_id
          JOIN activity_qualifications aq
            ON aq.activity_id = ea.activity_id
           AND aq.qualification_id = $2
          WHERE eas.staff_member_id = $1
            AND NOT EXISTS (
              SELECT 1
              FROM event_activity_staff other_eas
              JOIN staff_qualifications other_sq
                ON other_sq.staff_member_id =
                   other_eas.staff_member_id
              WHERE other_eas.event_activity_id =
                    eas.event_activity_id
                AND other_sq.qualification_id = $2
                AND other_sq.id <> $3
            )
          LIMIT 1
        `,
        [
          current.staff_member_id,
          current.qualification_id,
          current.id,
        ],
      );

      const uncovered = uncoveredResult.rows[0];

      if (uncovered) {
        res.status(409).json({
          error:
            `Cannot remove ${current.qualification_name} from ` +
            `${current.staff_member_name}; they are the only qualified ` +
            `staff member covering ${uncovered.activity_name} in ` +
            `${uncovered.event_name}`,
        });
        return;
      }

      await query(
        `
          DELETE FROM staff_qualifications
          WHERE id = $1
        `,
        [parsed.data.id],
      );

      res.json({
        ok: true,
        deleted_staff_qualification_id: String(parsed.data.id),
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not remove staff qualification",
      });
    }
  },
);
