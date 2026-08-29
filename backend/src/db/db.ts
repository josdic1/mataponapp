import type { QueryResult, QueryResultRow } from "pg";
import { pool } from "./pool.js";

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = []
): Promise<QueryResult<T>> {
  return pool.query<T>(text, values);
}
