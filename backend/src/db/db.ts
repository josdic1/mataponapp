import type { QueryResult, QueryResultRow } from "pg";

import { getAuditActorUserId } from "./auditContext.js";
import { pool } from "./pool.js";

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = []
): Promise<QueryResult<T>> {
  const actorUserId = getAuditActorUserId();

  if (!actorUserId) {
    return pool.query<T>(text, values);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
        SELECT set_config(
          'matapon.actor_user_id',
          $1,
          true
        )
      `,
      [actorUserId]
    );

    const result = await client.query<T>(text, values);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
