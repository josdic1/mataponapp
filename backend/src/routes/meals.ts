import { Router } from "express";

import {
  createEventMealSchema,
  updateEventMealSchema,
  eventMealIdParamsSchema,
  type EventMeal,
  type MealType,
} from "@matapon/shared/schemas/meals";

import { query } from "../db/db.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
} from "../middleware/auth.js";

export const mealsRouter = Router();

mealsRouter.get(
  "/types",
  requireAuth,
  requirePasswordChanged,
  async (_req, res) => {
    try {
      const result = await query<MealType>(
        `
          SELECT
            id,
            name,
            created_at,
            updated_at
          FROM meal_types
          ORDER BY id
        `,
      );

      res.json({
        meal_types: result.rows,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: "Could not load meal types",
      });
    }
  },
);

mealsRouter.get(
  "/",
  requireAuth,
  requirePasswordChanged,
  async (_req, res) => {
    try {
      const result = await query<EventMeal>(
        `
          SELECT
            em.id,
            em.event_id,
            e.name AS event_name,
            em.meal_type_id,
            mt.name AS meal_type_name,
            em.starts_at,
            em.ends_at,
            em.created_at,
            em.updated_at
          FROM event_meals em
          JOIN events e
            ON e.id = em.event_id
          JOIN meal_types mt
            ON mt.id = em.meal_type_id
          ORDER BY em.starts_at, em.id
        `,
      );

      res.json({
        event_meals: result.rows,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: "Could not load event meals",
      });
    }
  },
);

mealsRouter.post(
  "/",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed = createEventMealSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid event meal",
      });
      return;
    }

    try {
      const result = await query<EventMeal>(
        `
          WITH inserted AS (
            INSERT INTO event_meals (
              event_id,
              meal_type_id,
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
            i.meal_type_id,
            mt.name AS meal_type_name,
            i.starts_at,
            i.ends_at,
            i.created_at,
            i.updated_at
          FROM inserted i
          JOIN events e
            ON e.id = i.event_id
          JOIN meal_types mt
            ON mt.id = i.meal_type_id
        `,
        [
          parsed.data.event_id,
          parsed.data.meal_type_id,
          parsed.data.starts_at,
          parsed.data.ends_at,
        ],
      );

      res.status(201).json({
        event_meal: result.rows[0],
      });
    } catch (error: any) {
      if (error?.code === "23505") {
        res.status(409).json({
          error: "That meal is already scheduled for this time",
        });
        return;
      }

      if (error?.code === "23503") {
        res.status(400).json({
          error: "Event or meal type does not exist",
        });
        return;
      }

      console.error(error);
      res.status(500).json({
        error: "Could not create event meal",
      });
    }
  },
);

mealsRouter.patch(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const params = eventMealIdParamsSchema.safeParse(req.params);
    const body = updateEventMealSchema.safeParse(req.body);

    if (!params.success || !body.success) {
      res.status(400).json({
        error: "Invalid event meal data",
      });
      return;
    }

    try {
      const result = await query<EventMeal>(
        `
          WITH updated AS (
            UPDATE event_meals
            SET
              event_id = COALESCE($2, event_id),
              meal_type_id = COALESCE($3, meal_type_id),
              starts_at = COALESCE($4, starts_at),
              ends_at = COALESCE($5, ends_at),
              updated_at = CURRENT_TIMESTAMP::text
            WHERE id = $1
            RETURNING *
          )
          SELECT
            u.id,
            u.event_id,
            e.name AS event_name,
            u.meal_type_id,
            mt.name AS meal_type_name,
            u.starts_at,
            u.ends_at,
            u.created_at,
            u.updated_at
          FROM updated u
          JOIN events e
            ON e.id = u.event_id
          JOIN meal_types mt
            ON mt.id = u.meal_type_id
        `,
        [
          params.data.id,
          body.data.event_id ?? null,
          body.data.meal_type_id ?? null,
          body.data.starts_at ?? null,
          body.data.ends_at ?? null,
        ],
      );

      if (!result.rows[0]) {
        res.status(404).json({
          error: "Event meal does not exist",
        });
        return;
      }

      res.json({
        event_meal: result.rows[0],
      });
    } catch (error: any) {
      if (error?.code === "23505") {
        res.status(409).json({
          error: "That meal is already scheduled for this time",
        });
        return;
      }

      if (error?.code === "23503") {
        res.status(400).json({
          error: "Event or meal type does not exist",
        });
        return;
      }

      console.error(error);
      res.status(500).json({
        error: "Could not update event meal",
      });
    }
  },
);

mealsRouter.delete(
  "/:id",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const parsed = eventMealIdParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid event meal id",
      });
      return;
    }

    try {
      const result = await query<{ id: string }>(
        `
          DELETE FROM event_meals
          WHERE id = $1
          RETURNING id
        `,
        [parsed.data.id],
      );

      if (!result.rows[0]) {
        res.status(404).json({
          error: "Event meal does not exist",
        });
        return;
      }

      res.json({
        ok: true,
        deleted_event_meal_id: String(parsed.data.id),
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: "Could not delete event meal",
      });
    }
  },
);
