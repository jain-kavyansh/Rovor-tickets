import type {
  InsightsResponse, Project, ProjectInput, ProjectSummary, Ticket, TicketFilters, TicketInput,
} from "./types";

export class ApiClientError extends Error {
  constructor(public status: number, public code: string, message: string, public fields?: Record<string, string>) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiClientError(0, "NETWORK", "Network error — check your connection and try again.");
  }
  let body: unknown = null;
  try { body = await res.json(); } catch { /* non-JSON body */ }
  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string; fields?: Record<string, string> } } | null)?.error;
    throw new ApiClientError(res.status, err?.code ?? "UNKNOWN", err?.message ?? `Request failed (${res.status})`, err?.fields);
  }
  return body as T;
}

const json = (method: string, data: unknown): RequestInit => ({ method, body: JSON.stringify(data) });

export const api = {
  listProjects: (signal?: AbortSignal) => request<{ projects: ProjectSummary[] }>("/api/projects", { signal }).then((r) => r.projects),
  getProject: (id: string, signal?: AbortSignal) => request<{ project: Project }>(`/api/projects/${id}`, { signal }).then((r) => r.project),
  createProject: (input: ProjectInput) => request<{ project: Project }>("/api/projects", json("POST", input)).then((r) => r.project),
  listTickets: (projectId: string, f: TicketFilters, signal?: AbortSignal) => {
    const qs = new URLSearchParams();
    if (f.search.trim()) qs.set("search", f.search.trim());
    if (f.status) qs.set("status", f.status);
    if (f.priority) qs.set("priority", f.priority);
    return request<{ tickets: Ticket[] }>(`/api/projects/${projectId}/tickets?${qs}`, { signal }).then((r) => r.tickets);
  },
  getTicket: (id: string, signal?: AbortSignal) => request<{ ticket: Ticket }>(`/api/tickets/${id}`, { signal }).then((r) => r.ticket),
  createTicket: (projectId: string, input: TicketInput) =>
    request<{ ticket: Ticket }>(`/api/projects/${projectId}/tickets`, json("POST", input)).then((r) => r.ticket),
  updateTicket: (id: string, input: Partial<TicketInput>) =>
    request<{ ticket: Ticket }>(`/api/tickets/${id}`, json("PATCH", input)).then((r) => r.ticket),
  getInsights: (projectId: string, signal?: AbortSignal) => request<InsightsResponse>(`/api/projects/${projectId}/github`, { signal }),
};
