import type {
  CreateUserInput,
  UserType,
} from "@matapon/shared/schemas/users";

import { query } from "../db/db.js";
import { hashPassword } from "./auth.js";

export type UserAccountRow = {
  id: string;
  username: string;
  user_type: UserType;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
};

export async function createUserAccount(
  input: CreateUserInput
): Promise<UserAccountRow> {
  const passwordHash = await hashPassword(input.password);

  const result = await query<UserAccountRow>(
    `
      INSERT INTO users (
        username,
        password_hash,
        user_type,
        must_change_password
      )
      VALUES ($1, $2, $3, TRUE)

      RETURNING
        id,
        username,
        user_type,
        must_change_password,
        created_at,
        updated_at
    `,
    [
      input.username,
      passwordHash,
      input.user_type,
    ]
  );

  return result.rows[0];
}
