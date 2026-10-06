import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { projects, tickets, type ProjectRow, type TicketRow } from "@/server/db/schema";
import { notFound } from "@/server/errors";
import type { TicketStatus } from "@/lib/constants";

export type StatusCounts = Record<TicketStatus, number> & { total: number };
export type ProjectSummary = ProjectRow & { counts: StatusCounts; recentTickets: TicketRow[] };

const emptyCounts = (): StatusCounts => ({ TODO: 0, ACTIVE: 0, DONE: 0, total: 0 });
const RECENT_LIMIT = 3;

async function countsByProject(projectId?: string): Promise<Map<string, StatusCounts>> {
  const rows = await db
    .select({ projectId: tickets.projectId, status: tickets.status, n: sql<number>`count(*)::int` })
    .from(tickets)
    .where(projectId ? eq(tickets.projectId, projectId) : undefined)
    .groupBy(tickets.projectId, tickets.status);
  const map = new Map<string, StatusCounts>();
  for (const r of rows) {
    const c = map.get(r.projectId) ?? emptyCounts();
    c[r.status] = r.n;
    c.total += r.n;
    map.set(r.projectId, c);
  }
  return map;
}

/** 3 queries total regardless of project count (no N+1). */
export async function listProjects(): Promise<ProjectSummary[]> {
  const [rows, counts, recent] = await Promise.all([
    db.select().from(projects).orderBy(desc(projects.createdAt)),
    countsByProject(),
    db.execute<TicketRow & { project_id: string }>(sql`
      select * from (
        select t.id, t.project_id as "projectId", t.title, t.description, t.status, t.priority,
               t.created_at as "createdAt", t.updated_at as "updatedAt",
               row_number() over (partition by t.project_id order by t.updated_at desc) as rn
        from tickets t
      ) x where rn <= ${RECENT_LIMIT} order by "updatedAt" desc`),
  ]);
  const recentBy = new Map<string, TicketRow[]>();
  for (const r of recent.rows as unknown as TicketRow[]) {
    const list = recentBy.get(r.projectId) ?? [];
    list.push(r);
    recentBy.set(r.projectId, list);
  }
  return rows.map((p) => ({
    ...p,
    counts: counts.get(p.id) ?? emptyCounts(),
    recentTickets: recentBy.get(p.id) ?? [],
  }));
}

export async function getProject(id: string): Promise<ProjectRow & { counts: StatusCounts }> {
  const [p] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!p) throw notFound("Project");
  const counts = await countsByProject(id);
  return { ...p, counts: counts.get(id) ?? emptyCounts() };
}

export async function createProject(input: { name: string; description: string; githubRepo: string | null }) {
  const [p] = await db.insert(projects).values(input).returning();
  return p;
}
