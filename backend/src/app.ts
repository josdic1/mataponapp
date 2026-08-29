import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { pool } from "./db/pool.js";
import { authRouter } from "./routes/auth.js";

export const app = express();

app.use(
  cors({
    origin:
      process.env.FRONTEND_ORIGIN ||
      "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
  });
});

app.get("/db-check", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT NOW() AS now"
    );

    res.json({
      ok: true,
      database: true,
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      database: false,
    });
  }
});

app.use("/api/auth", authRouter);
