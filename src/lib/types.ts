import type { TicketPriority, TicketStatus } from "./constants";

export type StatusCounts = Record<TicketStatus, number> & { total: number };

export type Ticket = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  githubRepo: string | null;
  createdAt: string;
  updatedAt: string;
  counts: StatusCounts;
};

export type ProjectSummary = Project & { recentTickets: Ticket[] };

export type RepoInsights = {
  fullName: string;
  url: string;
  description: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  watchers: number;
  language: string | null;
  pushedAt: string;
};

export type InsightsResponse = {
  insights: RepoInsights;
  fetchedAt: string;
  expiresAt: string;
  source: "fresh" | "cache" | "stale";
  warning?: string;
};

export type TicketFilters = { search: string; status: TicketStatus | ""; priority: TicketPriority | "" };
export type TicketInput = { title: string; description: string; status: TicketStatus; priority: TicketPriority };
export type ProjectInput = { name: string; description: string; githubRepo: string };
