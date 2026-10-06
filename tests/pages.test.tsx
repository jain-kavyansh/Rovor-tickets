// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast";
import DashboardPage from "@/app/page";
import ProjectPage from "@/app/projects/[projectId]/page";

vi.mock("next/navigation", () => ({ useParams: () => ({ projectId: "11111111-1111-4111-8111-111111111111" }) }));

const PID = "11111111-1111-4111-8111-111111111111";
type T = { id: string; projectId: string; title: string; description: string; status: string; priority: string; createdAt: string; updatedAt: string };
const now = "2026-10-06T10:00:00.000Z";
let tickets: T[];
let calls: string[];

const counts = () => ({
  TODO: tickets.filter((t) => t.status === "TODO").length,
  ACTIVE: tickets.filter((t) => t.status === "ACTIVE").length,
  DONE: tickets.filter((t) => t.status === "DONE").length,
  total: tickets.length,
});
const project = () => ({ id: PID, name: "Proj", description: "Desc", githubRepo: null, createdAt: now, updatedAt: now, counts: counts() });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  tickets = [{ id: "t1", projectId: PID, title: "Fix PDF", description: "", status: "TODO", priority: "HIGH", createdAt: now, updatedAt: now }];
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? "GET"} ${input}`);
    const url = new URL(input, "http://x");
    if (url.pathname === "/api/projects" && !init?.method) return json({ projects: [{ ...project(), recentTickets: tickets }] });
    if (url.pathname === `/api/projects/${PID}` ) return json({ project: project() });
    if (url.pathname === `/api/projects/${PID}/tickets` && init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      tickets = [{ id: `t${tickets.length + 1}`, projectId: PID, createdAt: now, updatedAt: now, ...body }, ...tickets];
      return json({ ticket: tickets[0] }, 201);
    }
    if (url.pathname === `/api/projects/${PID}/tickets`) {
      const s = url.searchParams.get("search")?.toLowerCase();
      const st = url.searchParams.get("status");
      return json({ tickets: tickets.filter((t) => (!s || t.title.toLowerCase().includes(s)) && (!st || t.status === st)) });
    }
    return json({ error: { code: "NOT_FOUND", message: "nf" } }, 404);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const wrap = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ToastProvider>{ui}</ToastProvider></QueryClientProvider>);

describe("project page search/filters are backend-powered", () => {
  it("sends search + status to the API and shows the empty state for no matches", async () => {
    wrap(<ProjectPage />);
    await screen.findByText("Fix PDF");
    await userEvent.type(screen.getByLabelText("Search tickets"), "  pdf ");
    await userEvent.selectOptions(screen.getByLabelText("Filter by status"), "TODO");
    await waitFor(() => expect(calls.some((c) => c.includes("search=pdf") && c.includes("status=TODO"))).toBe(true));
    await userEvent.clear(screen.getByLabelText("Search tickets"));
    await userEvent.type(screen.getByLabelText("Search tickets"), "zzz");
    expect(await screen.findByText("No tickets match your search")).toBeTruthy();
  });
});

describe("dashboard reflects saved state without a manual refresh", () => {
  it("updates counts after creating a ticket from the + action", async () => {
    wrap(<DashboardPage />);
    const card = (await screen.findByRole("heading", { name: "Proj" })).closest("article")!;
    expect(within(card).getByText("Todo").previousSibling?.textContent).toBe("1");
    await userEvent.click(screen.getByRole("button", { name: "Create ticket in Proj" }));
    await userEvent.type(await screen.findByLabelText("Title"), "Brand new");
    await userEvent.click(screen.getByRole("button", { name: "Create ticket" }));
    await waitFor(() => expect(within(card).getByText("Todo").previousSibling?.textContent).toBe("2"));
    expect(within(card).getByText("Brand new")).toBeTruthy();
    expect(calls.filter((c) => c === "GET /api/projects").length).toBeGreaterThanOrEqual(2); // refetched after mutation
  });

  it("shows an empty state with zero projects", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () => json({ projects: [] }));
    wrap(<DashboardPage />);
    expect(await screen.findByText("No projects yet")).toBeTruthy();
  });

  it("shows an error state with retry when the API fails", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () => json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } }, 500));
    wrap(<DashboardPage />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});
