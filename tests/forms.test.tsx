// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectForm, TicketForm } from "@/components/forms";
import { ApiClientError } from "@/lib/api";

afterEach(cleanup);

describe("ProjectForm", () => {
  it("shows validation messages for whitespace-only values and does not submit", async () => {
    const onSubmit = vi.fn();
    render(<ProjectForm onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText("Name"), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));
    expect(screen.getByText("Name is required")).toBeTruthy();
    expect(screen.getByText("Description is required")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables the button while saving and ignores duplicate submits", async () => {
    let resolve!: () => void;
    const onSubmit = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    render(<ProjectForm onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText("Name"), "P");
    await userEvent.type(screen.getByLabelText("Description"), "D");
    const btn = screen.getByRole("button", { name: "Create project" });
    await userEvent.click(btn);
    const saving = await screen.findByRole("button", { name: "Creating…" });
    expect((saving as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(saving);
    await userEvent.type(screen.getByLabelText("Name"), "{enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    resolve();
  });

  it("renders backend field errors and re-enables the form", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiClientError(400, "VALIDATION_ERROR", "Invalid input", { githubRepo: "Only github.com repositories are supported" }));
    render(<ProjectForm onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText("Name"), "P");
    await userEvent.type(screen.getByLabelText("Description"), "D");
    await userEvent.type(screen.getByLabelText(/GitHub repository/), "https://gitlab.com/a/b");
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));
    expect(await screen.findByText("Only github.com repositories are supported")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Create project" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows a generic message for network/500 failures", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiClientError(500, "INTERNAL_ERROR", "Something went wrong. Please try again."));
    render(<ProjectForm onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText("Name"), "P");
    await userEvent.type(screen.getByLabelText("Description"), "D");
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));
    expect(await screen.findByText("Something went wrong. Please try again.")).toBeTruthy();
  });
});

describe("TicketForm", () => {
  it("requires a non-blank title and submits trimmed-able values with defaults", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TicketForm submitLabel="Create ticket" onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Create ticket" }));
    expect(screen.getByText("Title is required")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("Title"), "Fix bug");
    await userEvent.click(screen.getByRole("button", { name: "Create ticket" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ title: "Fix bug", description: "", status: "TODO", priority: "MEDIUM" }));
  });
});
