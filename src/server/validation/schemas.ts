import { z } from "zod";
import { LIMITS, TICKET_PRIORITIES, TICKET_STATUSES } from "@/lib/constants";
import { InvalidRepoError, normalizeRepo } from "@/server/github/repo";

const trimmed = (label: string, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .optional()
    .default("");

export const uuidSchema = z.string().uuid("Invalid id");

export const createProjectSchema = z.object({
  name: trimmed("Name", LIMITS.projectName),
  description: trimmed("Description", LIMITS.projectDescription),
  githubRepo: z
    .string()
    .nullish()
    .transform((v, ctx) => {
      if (v == null || v.trim() === "") return null;
      try {
        return normalizeRepo(v);
      } catch (e) {
        ctx.addIssue({ code: "custom", message: e instanceof InvalidRepoError ? e.message : "Invalid repository" });
        return z.NEVER;
      }
    }),
});

export const createTicketSchema = z.object({
  title: trimmed("Title", LIMITS.ticketTitle),
  description: optionalText("Description", LIMITS.ticketDescription),
  status: z.enum(TICKET_STATUSES, { error: "Invalid status" }).default("TODO"),
  priority: z.enum(TICKET_PRIORITIES, { error: "Invalid priority" }).default("MEDIUM"),
});

// No defaults here: an omitted field must stay omitted so a partial update never overwrites data.
export const updateTicketSchema = z
  .object({
    title: trimmed("Title", LIMITS.ticketTitle).optional(),
    description: z
      .string()
      .trim()
      .max(LIMITS.ticketDescription, `Description must be at most ${LIMITS.ticketDescription} characters`)
      .optional(),
    status: z.enum(TICKET_STATUSES, { error: "Invalid status" }).optional(),
    priority: z.enum(TICKET_PRIORITIES, { error: "Invalid priority" }).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Provide at least one field to update");

/** Lenient: invalid filter values are ignored rather than failing the request. */
export function parseTicketQuery(sp: URLSearchParams) {
  const search = (sp.get("search") ?? "").trim().slice(0, LIMITS.search);
  const status = TICKET_STATUSES.find((s) => s === sp.get("status")) ?? undefined;
  const priority = TICKET_PRIORITIES.find((p) => p === sp.get("priority")) ?? undefined;
  return { search, status, priority };
}
