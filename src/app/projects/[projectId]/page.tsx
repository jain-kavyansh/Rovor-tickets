"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { TicketForm } from "@/components/forms";
import { RepoInsights } from "@/components/repo-insights";
import { PriorityBadge, StatusBadge } from "@/components/ui/badges";
import { Modal } from "@/components/ui/modal";
import { EmptyState, ErrorState, Skeleton, btnPrimary, btnSecondary, inputCls } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { PRIORITY_LABEL, STATUS_LABEL, TICKET_PRIORITIES, TICKET_STATUSES } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { useCreateTicket, useProject, useTickets } from "@/lib/hooks";
import type { TicketFilters } from "@/lib/types";
import { useDebounced } from "@/lib/use-debounced";
import { ApiClientError } from "@/lib/api";

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const project = useProject(projectId);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TicketFilters["status"]>("");
  const [priority, setPriority] = useState<TicketFilters["priority"]>("");
  const [showNew, setShowNew] = useState(false);
  const debouncedSearch = useDebounced(search, 300);
  const filters: TicketFilters = { search: debouncedSearch.trim(), status, priority };
  const tickets = useTickets(projectId, filters);
  const createTicket = useCreateTicket(projectId);
  const toast = useToast();
  const filtering = Boolean(filters.search || status || priority);

  if (project.isPending) {
    return <div className="space-y-4" aria-busy="true"><Skeleton className="h-8 w-64" /><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  }
  if (project.isError && !project.data) {
    const notFound = project.error instanceof ApiClientError && (project.error.status === 404 || project.error.status === 400);
    return notFound ? (
      <EmptyState title="Project not found" hint="It may have been removed or the link is wrong." action={<Link href="/" className={btnPrimary}>Back to dashboard</Link>} />
    ) : (
      <ErrorState error={project.error} onRetry={() => project.refetch()} />
    );
  }
  const p = project.data!;

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-indigo-600 hover:underline">← All projects</Link>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h1 className="break-words text-2xl font-semibold">{p.name}</h1>
        <p className="mt-1 whitespace-pre-wrap break-words text-slate-600">{p.description}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-3 text-center"><dd className="text-xl font-semibold">{p.counts.total}</dd><dt className="text-xs text-slate-500">Total</dt></div>
          {TICKET_STATUSES.map((s) => (
            <div key={s} className="rounded-lg bg-slate-50 p-3 text-center"><dd className="text-xl font-semibold">{p.counts[s]}</dd><dt className="text-xs text-slate-500">{STATUS_LABEL[s]}</dt></div>
          ))}
        </dl>
      </section>

      {p.githubRepo && <RepoInsights projectId={p.id} repo={p.githubRepo} />}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Tickets</h2>
          <button className={btnPrimary} onClick={() => setShowNew(true)}>Create ticket</button>
        </div>

        <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input type="search" aria-label="Search tickets" placeholder="Search title or description…" className={inputCls} value={search} maxLength={100} onChange={(e) => setSearch(e.target.value)} />
          <select aria-label="Filter by status" className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as TicketFilters["status"])}>
            <option value="">All statuses</option>
            {TICKET_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <select aria-label="Filter by priority" className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value as TicketFilters["priority"])}>
            <option value="">All priorities</option>
            {TICKET_PRIORITIES.map((x) => <option key={x} value={x}>{PRIORITY_LABEL[x]}</option>)}
          </select>
        </div>

        {tickets.isPending ? (
          <div className="space-y-2" aria-busy="true">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : tickets.isError && !tickets.data ? (
          <ErrorState error={tickets.error} onRetry={() => tickets.refetch()} />
        ) : tickets.data!.length === 0 ? (
          filtering ? (
            <EmptyState title="No tickets match your search" hint="Try different keywords or clear the filters." action={<button className={btnSecondary} onClick={() => { setSearch(""); setStatus(""); setPriority(""); }}>Clear filters</button>} />
          ) : (
            <EmptyState title="No tickets yet" hint="Create the first ticket for this project." action={<button className={btnPrimary} onClick={() => setShowNew(true)}>Create ticket</button>} />
          )
        ) : (
          <>
            {tickets.isError && <div className="mb-3"><ErrorState error={tickets.error} onRetry={() => tickets.refetch()} /></div>}
            <p className="mb-2 text-xs text-slate-500" aria-live="polite">{tickets.data!.length} ticket{tickets.data!.length === 1 ? "" : "s"}{filtering ? " found" : ""}</p>
            <ul className={`space-y-2 transition-opacity ${tickets.isPlaceholderData ? "opacity-50" : ""}`} aria-busy={tickets.isPlaceholderData}>
              {tickets.data!.map((t) => (
                <li key={t.id}>
                  <Link href={`/projects/${p.id}/tickets/${t.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-indigo-300">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="min-w-0 break-words font-medium">{t.title}</h3>
                      <div className="flex shrink-0 gap-1.5"><StatusBadge status={t.status} /><PriorityBadge priority={t.priority} /></div>
                    </div>
                    {t.description && <p className="mt-1 line-clamp-2 break-words text-sm text-slate-600">{t.description}</p>}
                    <p className="mt-2 text-xs text-slate-400">Updated {timeAgo(t.updatedAt)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {showNew && (
        <Modal title="New ticket" onClose={() => setShowNew(false)}>
          <TicketForm
            submitLabel="Create ticket"
            onCancel={() => setShowNew(false)}
            onSubmit={async (v) => {
              await createTicket.mutateAsync(v);
              toast("success", "Ticket created");
              setShowNew(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
