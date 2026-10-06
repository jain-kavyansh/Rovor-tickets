import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db/client";
import { tickets, type TicketRow } from "@/server/db/schema";
import { notFound } from "@/server/errors";
import { getProject } from "./projects";
import type { TicketPriority, TicketStatus } from "@/lib/constants";

export type TicketFilters = { search?: string; status?: TicketStatus; priority?: TicketPriority };

/** Escape LIKE wildcards so user input like "100%" or "_" matches literally. */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function listTickets(projectId: string, f: TicketFilters = {}): Promise<TicketRow[]> {
  await getProject(projectId); // 404 for unknown project
  const conds: SQL[] = [eq(tickets.projectId, projectId)];
  if (f.status) conds.push(eq(tickets.status, f.status));
  if (f.priority) conds.push(eq(tickets.priority, f.priority));
  if (f.search) {
    const pattern = `%${escapeLike(f.search)}%`;
    conds.push(or(ilike(tickets.title, pattern), ilike(tickets.description, pattern))!);
  }
  return db.select().from(tickets).where(and(...conds)).orderBy(desc(tickets.updatedAt));
}

export async function getTicket(id: string): Promise<TicketRow> {
  const [t] = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
  if (!t) throw notFound("Ticket");
  return t;
}

export async function createTicket(
  projectId: string,
  input: { title: string; description: string; status: TicketStatus; priority: TicketPriority },
): Promise<TicketRow> {
  await getProject(projectId);
  const [t] = await db.insert(tickets).values({ projectId, ...input }).returning();
  return t;
}

export async function updateTicket(
  id: string,
  patch: Partial<{ title: string; description: string; status: TicketStatus; priority: TicketPriority }>,
): Promise<TicketRow> {
  const [t] = await db
    .update(tickets)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(eq(tickets.id, id))
    .returning();
  if (!t) throw notFound("Ticket");
  return t;
}
