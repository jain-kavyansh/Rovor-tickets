import { NextResponse } from "next/server";
import { route } from "@/server/errors";
import { parseId } from "@/server/http";
import { getProject } from "@/server/services/projects";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ projectId: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const id = parseId((await params).projectId, "project");
  return NextResponse.json({ project: await getProject(id) });
});
