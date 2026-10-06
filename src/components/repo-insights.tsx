"use client";
import { ApiClientError } from "@/lib/api";
import { formatDateTime, timeAgo } from "@/lib/format";
import { useInsights } from "@/lib/hooks";
import { Skeleton } from "./ui/states";

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="min-w-0 rounded-lg bg-slate-50 p-3">
    <dd className="truncate text-lg font-semibold">{value}</dd>
    <dt className="text-xs text-slate-500">{label}</dt>
  </div>
);

export function RepoInsights({ projectId, repo }: { projectId: string; repo: string }) {
  const { data, isPending, error, refetch, isFetching } = useInsights(projectId, true);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Repository insights">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Repository insights</h2>
        <span className="break-all text-sm text-slate-500">{repo}</span>
      </div>

      {isPending ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : !data ? (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="break-words">
            {error instanceof ApiClientError ? error.message : "Could not load repository information."}
          </p>
          <p className="mt-1 text-xs text-amber-800">Your project and tickets are unaffected.</p>
          <button onClick={() => refetch()} disabled={isFetching} className="mt-2 rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-medium hover:bg-amber-100 disabled:opacity-60">
            {isFetching ? "Retrying…" : "Retry"}
          </button>
        </div>
      ) : (
        <>
          {data.warning && <p role="status" className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{data.warning}</p>}
          {data.insights.description && <p className="mb-3 break-words text-sm text-slate-600">{data.insights.description}</p>}
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Stars" value={data.insights.stars.toLocaleString()} />
            <Stat label="Forks" value={data.insights.forks.toLocaleString()} />
            <Stat label="Open issues" value={data.insights.openIssues.toLocaleString()} />
            <Stat label="Watchers" value={data.insights.watchers.toLocaleString()} />
            <Stat label="Language" value={data.insights.language ?? "—"} />
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            Last pushed {timeAgo(data.insights.pushedAt)} ({formatDateTime(data.insights.pushedAt)}) ·{" "}
            <a href={data.insights.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">View on GitHub</a>
            {" · "}data {data.source === "cache" ? "from server cache" : data.source === "stale" ? "stale" : "just fetched"}
          </p>
        </>
      )}
    </section>
  );
}
