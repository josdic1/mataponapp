import { pool } from "./pool.js";

export async function query<T = unknown>(
  text: string,
  values: unknown[] = []
) {
  return pool.query<T & pg.QueryResultRow>(text, values);
}
