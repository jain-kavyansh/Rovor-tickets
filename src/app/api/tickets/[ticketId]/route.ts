import { NextResponse } from "next/server";
import { readJson, route } from "@/server/errors";
import { parseId } from "@/server/http";
import { updateTicketSchema } from "@/server/validation/schemas";
import { getTicket, updateTicket } from "@/server/services/tickets";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ ticketId: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const id = parseId((await params).ticketId, "ticket");
  return NextResponse.json({ ticket: await getTicket(id) });
});

const update = route<Ctx>(async (req, { params }) => {
  const id = parseId((await params).ticketId, "ticket");
  const patch = updateTicketSchema.parse(await readJson(req));
  return NextResponse.json({ ticket: await updateTicket(id, patch) });
});
export const PATCH = update;
export const PUT = update;
