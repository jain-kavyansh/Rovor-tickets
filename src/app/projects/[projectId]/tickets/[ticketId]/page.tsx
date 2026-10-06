"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { TicketForm } from "@/components/forms";
import { PriorityBadge, StatusBadge } from "@/components/ui/badges";
import { EmptyState, ErrorState, Skeleton, btnPrimary, btnSecondary } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { ApiClientError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useTicket, useUpdateTicket } from "@/lib/hooks";

export default function TicketPage() {
  const { projectId, ticketId } = useParams<{ projectId: string; ticketId: string }>();
  const ticket = useTicket(ticketId);
  const update = useUpdateTicket(ticketId, projectId);
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const back = `/projects/${projectId}`;

  if (ticket.isPending) return <div aria-busy="true" className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-48" /></div>;
  if (ticket.isError && !ticket.data) {
    const missing = ticket.error instanceof ApiClientError && (ticket.error.status === 404 || ticket.error.status === 400);
    return missing ? (
      <EmptyState title="Ticket not found" action={<Link href={back} className={btnPrimary}>Back to project</Link>} />
    ) : (
      <ErrorState error={ticket.error} onRetry={() => ticket.refetch()} />
    );
  }
  const t = ticket.data!;
  // Guard against URLs mixing a project id with another project's ticket.
  if (t.projectId !== projectId) {
    return <EmptyState title="Ticket not found in this project" action={<Link href={`/projects/${t.projectId}/tickets/${t.id}`} className={btnPrimary}>Open in correct project</Link>} />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href={back} className="text-sm text-indigo-600 hover:underline">← Back to project</Link>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        {editing ? (
          <>
            <h1 className="mb-4 text-lg font-semibold">Edit ticket</h1>
            <TicketForm
              initial={t}
              submitLabel="Save changes"
              onCancel={() => setEditing(false)}
              onSubmit={async (v) => {
                await update.mutateAsync(v);
                toast("success", "Ticket updated");
                setEditing(false);
              }}
            />
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="min-w-0 break-words text-2xl font-semibold">{t.title}</h1>
              <button className={btnSecondary} onClick={() => setEditing(true)}>Edit</button>
            </div>
            <div className="mt-3 flex gap-2"><StatusBadge status={t.status} /><PriorityBadge priority={t.priority} /></div>
            <p className="mt-4 whitespace-pre-wrap break-words text-slate-700">{t.description || <span className="text-slate-400">No description.</span>}</p>
            <dl className="mt-6 grid gap-2 text-sm text-slate-500 sm:grid-cols-2">
              <div><dt className="inline">Created: </dt><dd className="inline">{formatDateTime(t.createdAt)}</dd></div>
              <div><dt className="inline">Updated: </dt><dd className="inline">{formatDateTime(t.updatedAt)}</dd></div>
            </dl>
          </>
        )}
      </section>
    </div>
  );
}
