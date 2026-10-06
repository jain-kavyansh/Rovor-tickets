import Link from "next/link";
import { STATUS_LABEL, TICKET_STATUSES } from "@/lib/constants";
import type { ProjectSummary } from "@/lib/types";
import { PriorityBadge } from "./ui/badges";
import { btnSecondary } from "./ui/states";

export function ProjectCard({ project, onAddTicket }: { project: ProjectSummary; onAddTicket: () => void }) {
  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-semibold">{project.name}</h2>
          <p className="mt-1 line-clamp-2 break-words text-sm text-slate-600">{project.description}</p>
        </div>
        <button onClick={onAddTicket} aria-label={`Create ticket in ${project.name}`} title="Create ticket" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xl leading-none text-white hover:bg-indigo-700">
          +
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        {TICKET_STATUSES.map((s) => (
          <div key={s} className="rounded-lg bg-slate-50 p-2">
            <dd className="text-xl font-semibold">{project.counts[s]}</dd>
            <dt className="text-xs text-slate-500">{STATUS_LABEL[s]}</dt>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex-1">
        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">Recent tickets</h3>
        {project.recentTickets.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No tickets yet.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {project.recentTickets.map((t) => (
              <li key={t.id}>
                <Link href={`/projects/${project.id}/tickets/${t.id}`} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-slate-50">
                  <span className="min-w-0 truncate">{t.title}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <PriorityBadge priority={t.priority} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link href={`/projects/${project.id}`} className={`${btnSecondary} mt-4`}>Open project</Link>
    </article>
  );
}
