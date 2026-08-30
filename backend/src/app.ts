import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";

import { pool } from "./db/pool.js";
import { getPublicEndpointContracts, endpointContracts } from "./matapon/endpoints.js";
import { authRouter } from "./routes/auth.js";
import { eventTypesRouter } from "./routes/eventTypes.js";
import { eventsRouter } from "./routes/events.js";
import { activitiesRouter } from "./routes/activities.js";
import { eventActivitiesRouter } from "./routes/eventActivities.js";
import { staffMembersRouter } from "./routes/staffMembers.js";
import { staffAreasRouter } from "./routes/staffAreas.js";
import { staffMemberAreasRouter } from "./routes/staffMemberAreas.js";

export const app = express();

const frontendOrigin =
  process.env.FRONTEND_ORIGIN || "http://localhost:5173";

app.use(
  cors({
    origin(origin, callback) {
      const allowedOrigins = new Set([
        process.env.FRONTEND_ORIGIN || "http://localhost:5173",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
      ]);

      if (
        !origin ||
        allowedOrigins.has(origin) ||
        (process.env.NODE_ENV !== "production" && origin === "null")
      ) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin not allowed: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.get(endpointContracts.health.path, (_req, res) => {
  res.json({
    ok: true,
  });
});

app.get(endpointContracts.dbCheck.path, async (_req, res) => {
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

app.get("/__matapon/endpoints", (_req, res) => {
  res.json({
    endpoints: getPublicEndpointContracts(),
  });
});

const here = dirname(fileURLToPath(import.meta.url));
const builderPath = resolve(here, "../../index.html");

app.get("/__matapon/builder", (_req, res) => {
  res.sendFile(builderPath);
});

app.use("/api/auth", authRouter);
app.use("/api/event-types", eventTypesRouter);
app.use("/api/events", eventsRouter);
app.use("/api/activities", activitiesRouter);
app.use("/api/event-activities", eventActivitiesRouter);
app.use("/api/staff-members", staffMembersRouter);
app.use("/api/staff-areas", staffAreasRouter);
app.use("/api/staff-member-areas", staffMemberAreasRouter);
