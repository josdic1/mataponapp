import "dotenv/config";

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { createUserSchema } from "@matapon/shared/schemas/users";

import { pool } from "../db/pool.js";
import { createUserAccount } from "../services/users.js";

const rl = createInterface({
  input,
  output,
});

try {
  const username = (await rl.question("Username: ")).trim();
  const password = await rl.question("Temporary password: ");
  const userType = (
    await rl.question("User type [member/staff/admin]: ")
  )
    .trim()
    .toLowerCase();

  const parsed = createUserSchema.safeParse({
    username,
    password,
    user_type: userType,
  });

  if (!parsed.success) {
    throw new Error(
      "Username, temporary password, and valid user type are required"
    );
  }

  const user = await createUserAccount(parsed.data);

  console.log("");
  console.log("USER CREATED");
  console.log(user);
} finally {
  rl.close();
  await pool.end();
}
