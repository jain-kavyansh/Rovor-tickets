import { describe, expect, it } from "vitest";
import { createProjectSchema, createTicketSchema, parseTicketQuery, updateTicketSchema } from "@/server/validation/schemas";
import { InvalidRepoError, normalizeRepo } from "@/server/github/repo";

describe("normalizeRepo", () => {
  it.each([
    ["https://github.com/owner/repo", "owner/repo"],
    ["https://github.com/owner/repo/", "owner/repo"],
    ["  owner/repo  ", "owner/repo"],
    ["github.com/owner/repo", "owner/repo"],
    ["https://www.github.com/owner/repo.git", "owner/repo"],
    ["owner/my.repo_name-1", "owner/my.repo_name-1"],
  ])("accepts %s", (input, expected) => expect(normalizeRepo(input)).toBe(expected));

  it.each(["", "   ", "owner", "a/b/c", "https://gitlab.com/a/b", "https://github.com/onlyowner", "-bad/repo", "owner/..", "owner/re po", "http://", "not a url"])(
    "rejects %j",
    (input) => expect(() => normalizeRepo(input)).toThrow(InvalidRepoError),
  );
});

describe("project schema", () => {
  it("trims and normalizes", () => {
    const r = createProjectSchema.parse({ name: "  A ", description: " d ", githubRepo: " https://github.com/o/r/ " });
    expect(r).toEqual({ name: "A", description: "d", githubRepo: "o/r" });
  });
  it("treats empty/whitespace repo as null", () => {
    expect(createProjectSchema.parse({ name: "A", description: "d", githubRepo: "  " }).githubRepo).toBeNull();
    expect(createProjectSchema.parse({ name: "A", description: "d" }).githubRepo).toBeNull();
  });
  it("rejects blank name/description and overlong name", () => {
    expect(createProjectSchema.safeParse({ name: "   ", description: "d" }).success).toBe(false);
    expect(createProjectSchema.safeParse({ name: "A", description: "  " }).success).toBe(false);
    expect(createProjectSchema.safeParse({ name: "a".repeat(101), description: "d" }).success).toBe(false);
  });
});

describe("ticket schemas", () => {
  it("create applies defaults and trims", () => {
    expect(createTicketSchema.parse({ title: " T " })).toEqual({ title: "T", description: "", status: "TODO", priority: "MEDIUM" });
  });
  it("rejects invalid enums and blank title", () => {
    expect(createTicketSchema.safeParse({ title: "t", status: "nope" }).success).toBe(false);
    expect(createTicketSchema.safeParse({ title: "t", priority: "URGENT" }).success).toBe(false);
    expect(createTicketSchema.safeParse({ title: "   " }).success).toBe(false);
  });
  // Regression: a partial update must never inject defaults (previously wiped description).
  it("update does not inject defaults for omitted fields", () => {
    expect(updateTicketSchema.parse({ status: "DONE" })).toEqual({ status: "DONE" });
  });
  it("update rejects empty body", () => {
    expect(updateTicketSchema.safeParse({}).success).toBe(false);
  });
  it("update still allows clearing description explicitly", () => {
    expect(updateTicketSchema.parse({ description: "  " })).toEqual({ description: "" });
  });
});

describe("parseTicketQuery", () => {
  it("trims, ignores invalid filters, caps length", () => {
    const q = parseTicketQuery(new URLSearchParams({ search: "  hi  ", status: "BAD", priority: "HIGH" }));
    expect(q).toEqual({ search: "hi", status: undefined, priority: "HIGH" });
    expect(parseTicketQuery(new URLSearchParams({ search: "x".repeat(500) })).search).toHaveLength(100);
    expect(parseTicketQuery(new URLSearchParams()).search).toBe("");
  });
});
