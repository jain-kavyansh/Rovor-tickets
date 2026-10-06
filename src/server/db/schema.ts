import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const ticketStatus = pgEnum("ticket_status", ["TODO", "ACTIVE", "DONE"]);
export const ticketPriority = pgEnum("ticket_priority", ["LOW", "MEDIUM", "HIGH"]);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  githubRepo: text("github_repo"), // normalized "owner/repo", nullable
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: ticketStatus("status").notNull().default("TODO"),
    priority: ticketPriority("priority").notNull().default("MEDIUM"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tickets_project_status_idx").on(t.projectId, t.status),
    index("tickets_project_priority_idx").on(t.projectId, t.priority),
    index("tickets_project_updated_idx").on(t.projectId, t.updatedAt),
  ],
);

// DB-backed GitHub cache: shared across serverless instances.
export const githubCache = pgTable("github_repo_cache", {
  repo: text("repo").primaryKey(), // "owner/repo" lowercased
  payload: jsonb("payload").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type ProjectRow = typeof projects.$inferSelect;
export type TicketRow = typeof tickets.$inferSelect;
