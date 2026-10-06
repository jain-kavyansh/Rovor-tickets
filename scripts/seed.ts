import { sql } from "drizzle-orm";
import { db } from "../src/server/db/client";
import { projects, tickets } from "../src/server/db/schema";

type T = [title: string, description: string, status: "TODO" | "ACTIVE" | "DONE", priority: "LOW" | "MEDIUM" | "HIGH"];

const seed: { name: string; description: string; githubRepo: string | null; tickets: T[] }[] = [
  {
    name: "Customer Portal Redesign",
    description: "Revamp the customer-facing portal: faster pages, accessible components and a cleaner billing flow.",
    githubRepo: "vercel/next.js",
    tickets: [
      ["Audit current Lighthouse scores", "Capture baseline performance and accessibility scores for the top 5 pages.", "DONE", "MEDIUM"],
      ["Migrate navigation to new design system", "Replace legacy navbar with the shared component; keep keyboard navigation working.", "ACTIVE", "HIGH"],
      ["Fix invoice PDF download on Safari", "PDF opens blank in Safari 17. Likely a content-disposition header issue.", "TODO", "HIGH"],
      ["Add skeleton loaders to dashboard", "Replace spinners with skeletons to avoid layout shift on slow networks.", "TODO", "LOW"],
      ["Write accessibility checklist", "Document WCAG 2.2 AA checks for new components, including focus order and contrast.", "DONE", "LOW"],
      ["Optimise hero image delivery", "Serve responsive AVIF/WebP variants and lazy-load below-the-fold images.", "ACTIVE", "MEDIUM"],
      ["Billing page: show next invoice date", "Surface the upcoming invoice date and amount at the top of the billing page.", "TODO", "MEDIUM"],
    ],
  },
  {
    name: "Mobile Companion App",
    description: "React Native app giving field engineers offline access to work orders and checklists.",
    githubRepo: null,
    tickets: [
      ["Offline sync conflict resolution", "Define last-write-wins vs. manual merge for work orders edited offline on two devices.", "ACTIVE", "HIGH"],
      ["Push notification opt-in screen", "Design and implement the permission prompt with a clear explanation of value.", "TODO", "MEDIUM"],
      ["Crash on photo upload (Android 12)", "App crashes when attaching more than 3 photos; investigate memory usage.", "TODO", "HIGH"],
      ["Set up Detox end-to-end tests", "Smoke tests for login, open work order and submit checklist.", "DONE", "MEDIUM"],
      ["Dark mode support", "Respect system theme across all screens; verify contrast ratios.", "TODO", "LOW"],
      ["Release pipeline to TestFlight / Play beta", "Automate beta builds from the main branch with versioned release notes.", "DONE", "HIGH"],
    ],
  },
  {
    name: "Analytics Data Pipeline",
    description: "Nightly ETL that aggregates product events into the warehouse for reporting and dashboards.",
    githubRepo: "facebook/react",
    tickets: [
      ["Backfill events for September", "Re-run ingestion for 2026-09-01..30 after the schema change; verify row counts.", "ACTIVE", "MEDIUM"],
      ["Add data-quality alerts", "Alert when daily event volume drops more than 30% versus the 7-day average.", "TODO", "HIGH"],
      ["Document warehouse tables", "Add column descriptions and owners to the data catalog (100% coverage for core tables).", "TODO", "LOW"],
      ["Deduplicate session events", "Sessions are double-counted when clients retry; add idempotency key.", "DONE", "HIGH"],
      ["Reduce nightly job runtime", "Job takes 95 min; partition by day and parallelise the heaviest transforms.", "DONE", "MEDIUM"],
    ],
  },
];

async function main() {
  await db.execute(sql`truncate table tickets, projects, github_repo_cache restart identity cascade`);
  let n = 0;
  for (const p of seed) {
    const [proj] = await db.insert(projects).values({ name: p.name, description: p.description, githubRepo: p.githubRepo }).returning();
    // Stagger createdAt/updatedAt so "recent tickets" ordering is meaningful.
    const rows = p.tickets.map(([title, description, status, priority], i) => {
      const ts = new Date(Date.now() - (p.tickets.length - i) * 3_600_000 * 5);
      return { projectId: proj.id, title, description, status, priority, createdAt: ts, updatedAt: ts };
    });
    await db.insert(tickets).values(rows);
    n += rows.length;
  }
  console.log(`Seeded ${seed.length} projects and ${n} tickets`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
