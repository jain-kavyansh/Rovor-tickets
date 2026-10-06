"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiClientError, api } from "./api";
import type { ProjectInput, TicketFilters, TicketInput } from "./types";

export const keys = {
  projects: ["projects"] as const,
  project: (id: string) => ["project", id] as const,
  tickets: (id: string) => ["tickets", id] as const,
  ticketList: (id: string, f: TicketFilters) => ["tickets", id, f] as const,
  ticket: (id: string) => ["ticket", id] as const,
  insights: (id: string) => ["insights", id] as const,
};

export const useProjects = () => useQuery({ queryKey: keys.projects, queryFn: ({ signal }) => api.listProjects(signal) });

export const useProject = (id: string) =>
  useQuery({ queryKey: keys.project(id), queryFn: ({ signal }) => api.getProject(id, signal), retry: retryUnlessClientError });

// keepPreviousData: changing search/filters keeps the old list on screen (dimmed) instead of flashing empty.
export const useTickets = (projectId: string, filters: TicketFilters) =>
  useQuery({
    queryKey: keys.ticketList(projectId, filters),
    queryFn: ({ signal }) => api.listTickets(projectId, filters, signal),
    placeholderData: keepPreviousData,
  });

export const useTicket = (id: string) =>
  useQuery({ queryKey: keys.ticket(id), queryFn: ({ signal }) => api.getTicket(id, signal), retry: retryUnlessClientError });

// GitHub insights are cached server-side; the client only keeps them briefly to avoid duplicate calls.
export const useInsights = (projectId: string, enabled: boolean) =>
  useQuery({
    queryKey: keys.insights(projectId),
    queryFn: ({ signal }) => api.getInsights(projectId, signal),
    enabled,
    staleTime: 60_000,
    retry: retryUnlessClientError,
  });

function retryUnlessClientError(count: number, err: unknown) {
  if (err instanceof ApiClientError && err.status >= 400 && err.status < 500) return false;
  return count < 1;
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectInput) => api.createProject(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.projects }),
  });
}

export function useCreateTicket(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TicketInput) => api.createTicket(projectId, input),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: keys.projects }),
        qc.invalidateQueries({ queryKey: keys.project(projectId) }),
        qc.invalidateQueries({ queryKey: keys.tickets(projectId) }),
      ]),
  });
}

export function useUpdateTicket(ticketId: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<TicketInput>) => api.updateTicket(ticketId, input),
    onSuccess: (ticket) => {
      qc.setQueryData(keys.ticket(ticketId), ticket);
      return Promise.all([
        qc.invalidateQueries({ queryKey: keys.projects }),
        qc.invalidateQueries({ queryKey: keys.project(projectId) }),
        qc.invalidateQueries({ queryKey: keys.tickets(projectId) }),
      ]);
    },
  });
}
