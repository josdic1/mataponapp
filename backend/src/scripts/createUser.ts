import "dotenv/config";

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import type { UserType } from "@matapon/shared/schemas/users";

import { pool } from "../db/pool.js";
import { query } from "../db/db.js";
import { hashPassword } from "../services/auth.js";

const rl = createInterface({
  input,
  output,
});

try {
  const username = (await rl.question("Username: ")).trim();
  const temporaryPassword = await rl.question("Temporary password: ");
  const userTypeInput = (
    await rl.question("User type [member/staff/admin]: ")
  )
    .trim()
    .toLowerCase();

  if (!username) {
    throw new Error("Username is required");
  }

  if (!temporaryPassword) {
    throw new Error("Temporary password is required");
  }

  if (!["member", "staff", "admin"].includes(userTypeInput)) {
    throw new Error("User type must be member, staff, or admin");
  }

  const userType = userTypeInput as UserType;
  const passwordHash = await hashPassword(temporaryPassword);

  const result = await query<{
    id: string;
    username: string;
    user_type: UserType;
    must_change_password: boolean;
  }>(
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
        must_change_password
    `,
    [
      username,
      passwordHash,
      userType,
    ]
  );

  console.log("");
  console.log("USER CREATED");
  console.log(result.rows[0]);
} finally {
  rl.close();
  await pool.end();
}
