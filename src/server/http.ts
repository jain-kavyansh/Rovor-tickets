import { ApiError } from "@/server/errors";
import { uuidSchema } from "@/server/validation/schemas";

export function parseId(raw: string, label: string): string {
  const r = uuidSchema.safeParse(raw);
  if (!r.success) throw new ApiError(400, "INVALID_ID", `Invalid ${label} id`);
  return r.data;
}
