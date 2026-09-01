import { Router } from "express";

import { pool } from "../db/pool.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
} from "../middleware/auth.js";

const BUILDER_TABLES = [
  "users",
  "user_members",
  "event_types",
  "events",
  "event_type_others",
  "staff_members",
  "staff_areas",
  "staff_member_areas",
  "activities",
  "activity_others",
  "event_activities",
  "event_activity_staff",
  "event_registrations",
  "member_attendees",
  "event_activity_signups",
  "audit_log",
] as const;

const BUILDER_TABLE_SET = new Set<string>(BUILDER_TABLES);

export const builderDataRouter = Router();

builderDataRouter.use((_req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({
      error: "Builder database inspection is disabled in production",
    });
    return;
  }

  next();
});

builderDataRouter.get(
  "/schema",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (_req, res) => {
  try {
    const [columnsResult, foreignKeysResult, indexesResult] = await Promise.all([
      pool.query<{
        table_name: string;
        column_name: string;
        data_type: string;
        is_nullable: "YES" | "NO";
        column_default: string | null;
        ordinal_position: number;
      }>(
        `
          SELECT
            table_name,
            column_name,
            data_type,
            is_nullable,
            column_default,
            ordinal_position
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = ANY($1::text[])
          ORDER BY table_name, ordinal_position
        `,
        [BUILDER_TABLES]
      ),
      pool.query<{
        table_name: string;
        column_name: string;
        foreign_table_name: string;
        foreign_column_name: string;
        constraint_name: string;
      }>(
        `
          SELECT
            tc.table_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name,
            tc.constraint_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
           AND ccu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
            AND tc.table_name = ANY($1::text[])
          ORDER BY tc.table_name, kcu.ordinal_position
        `,
        [BUILDER_TABLES]
      ),
      pool.query<{
        table_name: string;
        index_name: string;
        index_definition: string;
      }>(
        `
          SELECT
            tablename AS table_name,
            indexname AS index_name,
            indexdef AS index_definition
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND tablename = ANY($1::text[])
          ORDER BY tablename, indexname
        `,
        [BUILDER_TABLES]
      ),
    ]);

    const rowCountEntries = await Promise.all(
      BUILDER_TABLES.map(async (tableName) => {
        const result = await pool.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM "${tableName}"`
        );

        return [tableName, Number(result.rows[0]?.count ?? 0)] as const;
      })
    );

    const tables = BUILDER_TABLES.map((tableName) => ({
      name: tableName,
      row_count:
        rowCountEntries.find(([name]) => name === tableName)?.[1] ?? 0,
      columns: columnsResult.rows
        .filter((column) => column.table_name === tableName)
        .map((column) => ({
          name: column.column_name,
          data_type: column.data_type,
          nullable: column.is_nullable === "YES",
          default: column.column_default,
        })),
      foreign_keys: foreignKeysResult.rows
        .filter((fk) => fk.table_name === tableName)
        .map((fk) => ({
          column: fk.column_name,
          target_table: fk.foreign_table_name,
          target_column: fk.foreign_column_name,
          constraint_name: fk.constraint_name,
        })),
      indexes: indexesResult.rows
        .filter((index) => index.table_name === tableName)
        .map((index) => ({
          name: index.index_name,
          definition: index.index_definition,
        })),
    }));

    res.json({
      ok: true,
      tables,
      summary: {
        table_count: tables.length,
        column_count: tables.reduce(
          (sum, table) => sum + table.columns.length,
          0
        ),
        foreign_key_count: tables.reduce(
          (sum, table) => sum + table.foreign_keys.length,
          0
        ),
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Could not inspect live database schema",
    });
  }
  }
);

builderDataRouter.get(
  "/data/:table",
  requireAuth,
  requirePasswordChanged,
  requireRole("admin"),
  async (req, res) => {
    const tableName = String(req.params.table || "");

    if (!BUILDER_TABLE_SET.has(tableName)) {
      res.status(404).json({
        error: "Builder table does not exist",
      });
      return;
    }

    const parsedLimit = Number(req.query.limit ?? 100);
    const parsedOffset = Number(req.query.offset ?? 0);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 200)
      : 100;
    const offset = Number.isFinite(parsedOffset)
      ? Math.max(Math.trunc(parsedOffset), 0)
      : 0;
    const search = String(req.query.q ?? "").trim();

    try {
      const rowExpression =
        tableName === "users"
          ? "to_jsonb(t) - 'password_hash'"
          : tableName === "audit_log"
            ? `to_jsonb(t) || jsonb_build_object(
                'old_values',
                CASE
                  WHEN t.table_name = 'users' AND t.old_values IS NOT NULL
                    THEN t.old_values - 'password_hash'
                  ELSE t.old_values
                END,
                'new_values',
                CASE
                  WHEN t.table_name = 'users' AND t.new_values IS NOT NULL
                    THEN t.new_values - 'password_hash'
                  ELSE t.new_values
                END
              )`
            : "to_jsonb(t)";

      const values: unknown[] = [];
      let where = "";

      if (search) {
        values.push(`%${search}%`);
        where = `WHERE (${rowExpression})::text ILIKE $${values.length}`;
      }

      const countResult = await pool.query<{ count: string }>(
        `
          SELECT COUNT(*)::text AS count
          FROM "${tableName}" t
          ${where}
        `,
        values
      );

      values.push(limit);
      const limitParam = `$${values.length}`;
      values.push(offset);
      const offsetParam = `$${values.length}`;

      const rowsResult = await pool.query<{ row: Record<string, unknown> }>(
        `
          SELECT ${rowExpression} AS row
          FROM "${tableName}" t
          ${where}
          ORDER BY t.id DESC
          LIMIT ${limitParam}
          OFFSET ${offsetParam}
        `,
        values
      );

      res.json({
        ok: true,
        table: tableName,
        rows: rowsResult.rows.map((entry) => entry.row),
        total: Number(countResult.rows[0]?.count ?? 0),
        limit,
        offset,
        redacted_fields:
          tableName === "users"
            ? ["password_hash"]
            : tableName === "audit_log"
              ? ["users.old_values.password_hash", "users.new_values.password_hash"]
              : [],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Could not load live database rows",
      });
    }
  }
);
