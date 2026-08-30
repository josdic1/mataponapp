import { z } from "zod";

import {
  changePasswordSchema,
  loginSchema,
} from "@matapon/shared/schemas/auth";
import { createEventTypeSchema } from "@matapon/shared/schemas/eventTypes";
import { createEventSchema } from "@matapon/shared/schemas/events";
import { createActivitySchema } from "@matapon/shared/schemas/activities";
import { createEventActivitySchema } from "@matapon/shared/schemas/eventActivities";
import { createStaffMemberSchema } from "@matapon/shared/schemas/staffMembers";
import { createStaffAreaSchema } from "@matapon/shared/schemas/staffAreas";
import { createStaffMemberAreaSchema } from "@matapon/shared/schemas/staffMemberAreas";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type InputLocation = "path" | "query" | "body";

type EndpointContract = {
  id: string;
  name: string;
  method: HttpMethod;
  path: string;
  notes?: string;
  auth?: boolean;
  setsSession?: boolean;
  paramsSchema?: z.ZodType;
  querySchema?: z.ZodType;
  bodySchema?: z.ZodType;
};

export const endpointContracts: Record<string, EndpointContract> = {
  health: {
    id: "health",
    name: "Health",
    method: "GET",
    path: "/health",
    notes: "Basic API health check.",
  },

  dbCheck: {
    id: "db-check",
    name: "Database Check",
    method: "GET",
    path: "/db-check",
    notes: "Confirms PostgreSQL connectivity and returns database time.",
  },

  login: {
    id: "auth-login",
    name: "Login",
    method: "POST",
    path: "/api/auth/login",
    notes: "Signs in and creates the secure session cookie.",
    bodySchema: loginSchema,
    setsSession: true,
  },

  me: {
    id: "auth-me",
    name: "Who Am I",
    method: "GET",
    path: "/api/auth/me",
    notes: "Returns the currently signed-in user.",
    auth: true,
  },

  changePassword: {
    id: "auth-change-password",
    name: "Change Password",
    method: "POST",
    path: "/api/auth/change-password",
    notes: "Changes the signed-in user's password.",
    auth: true,
    bodySchema: changePasswordSchema,
  },

  logout: {
    id: "auth-logout",
    name: "Logout",
    method: "POST",
    path: "/api/auth/logout",
    notes: "Clears the secure session cookie.",
    auth: true,
  },

  eventTypesList: {
    id: "event-types-list",
    name: "Event Types",
    method: "GET",
    path: "/api/event-types",
    notes: "Lists event types.",
    auth: true,
  },

  eventTypesCreate: {
    id: "event-types-create",
    name: "Create Event Type",
    method: "POST",
    path: "/api/event-types",
    notes: "Creates an event type.",
    auth: true,
    bodySchema: createEventTypeSchema,
  },

  eventsList: {
    id: "events-list",
    name: "Events",
    method: "GET",
    path: "/api/events",
    notes: "Lists events.",
    auth: true,
  },

  eventsCreate: {
    id: "events-create",
    name: "Create Event",
    method: "POST",
    path: "/api/events",
    notes: "Creates an event.",
    auth: true,
    bodySchema: createEventSchema,
  },

  activitiesList: {
    id: "activities-list",
    name: "Activities",
    method: "GET",
    path: "/api/activities",
    notes: "Lists activities.",
    auth: true,
  },

  activitiesCreate: {
    id: "activities-create",
    name: "Create Activity",
    method: "POST",
    path: "/api/activities",
    notes: "Creates an activity.",
    auth: true,
    bodySchema: createActivitySchema,
  },

  eventActivitiesList: {
    id: "event-activities-list",
    name: "Event Activities",
    method: "GET",
    path: "/api/event-activities",
    notes: "Lists scheduled activities inside events.",
    auth: true,
  },

  eventActivitiesCreate: {
    id: "event-activities-create",
    name: "Schedule Activity",
    method: "POST",
    path: "/api/event-activities",
    notes: "Schedules an activity inside an event.",
    auth: true,
    bodySchema: createEventActivitySchema,
  },

  staffMembersList: {
    id: "staff-members-list",
    name: "Staff Members",
    method: "GET",
    path: "/api/staff-members",
    notes: "Lists staff members.",
    auth: true,
  },

  staffMembersCreate: {
    id: "staff-members-create",
    name: "Create Staff Member",
    method: "POST",
    path: "/api/staff-members",
    notes: "Creates a staff profile for a staff account.",
    auth: true,
    bodySchema: createStaffMemberSchema,
  },

  staffAreasList: {
    id: "staff-areas-list",
    name: "Staff Areas",
    method: "GET",
    path: "/api/staff-areas",
    notes: "Lists staff areas.",
    auth: true,
  },

  staffAreasCreate: {
    id: "staff-areas-create",
    name: "Create Staff Area",
    method: "POST",
    path: "/api/staff-areas",
    notes: "Creates a staff area.",
    auth: true,
    bodySchema: createStaffAreaSchema,
  },

  staffMemberAreasList: {
    id: "staff-member-areas-list",
    name: "Staff Member Areas",
    method: "GET",
    path: "/api/staff-member-areas",
    notes: "Lists staff-to-area assignments.",
    auth: true,
  },

  staffMemberAreasCreate: {
    id: "staff-member-areas-create",
    name: "Assign Staff Area",
    method: "POST",
    path: "/api/staff-member-areas",
    notes: "Assigns a staff member to a staff area.",
    auth: true,
    bodySchema: createStaffMemberAreaSchema,
  },
};

function humanize(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function inputsFromSchema(
  schema: z.ZodType | undefined,
  location: InputLocation
) {
  if (!schema) {
    return [];
  }

  const json = z.toJSONSchema(schema) as {
    properties?: Record<string, {
      type?: string | string[];
      enum?: unknown[];
      default?: unknown;
      description?: string;
    }>;
    required?: string[];
  };

  const required = new Set(json.required ?? []);

  return Object.entries(json.properties ?? {}).map(([key, property]) => {
    const rawType = Array.isArray(property.type)
      ? property.type.find((value) => value !== "null")
      : property.type;

    return {
      key,
      label: humanize(key),
      location,
      required: required.has(key),
      type: rawType ?? "string",
      options: property.enum ?? [],
      default: property.default,
      description: property.description ?? "",
      secret: /password|secret|token/i.test(key),
    };
  });
}

export function getPublicEndpointContracts() {
  return Object.values(endpointContracts).map((endpoint) => ({
    id: endpoint.id,
    name: endpoint.name,
    method: endpoint.method,
    path: endpoint.path,
    notes: endpoint.notes ?? "",
    auth: endpoint.auth ?? false,
    setsSession: endpoint.setsSession ?? false,
    inputs: [
      ...inputsFromSchema(endpoint.paramsSchema, "path"),
      ...inputsFromSchema(endpoint.querySchema, "query"),
      ...inputsFromSchema(endpoint.bodySchema, "body"),
    ],
  }));
}
