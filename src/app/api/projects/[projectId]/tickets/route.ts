import { NextResponse } from "next/server";
import { readJson, route } from "@/server/errors";
import { parseId } from "@/server/http";
import { createTicketSchema, parseTicketQuery } from "@/server/validation/schemas";
import { createTicket, listTickets } from "@/server/services/tickets";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ projectId: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const id = parseId((await params).projectId, "project");
  const filters = parseTicketQuery(new URL(req.url).searchParams);
  return NextResponse.json({ tickets: await listTickets(id, filters), filters });
});

export const POST = route<Ctx>(async (req, { params }) => {
  const id = parseId((await params).projectId, "project");
  const input = createTicketSchema.parse(await readJson(req));
  return NextResponse.json({ ticket: await createTicket(id, input) }, { status: 201 });
});
