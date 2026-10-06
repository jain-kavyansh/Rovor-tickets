import { NextResponse } from "next/server";
import { readJson, route } from "@/server/errors";
import { createProjectSchema } from "@/server/validation/schemas";
import { createProject, listProjects } from "@/server/services/projects";

export const dynamic = "force-dynamic";

export const GET = route(async () => NextResponse.json({ projects: await listProjects() }));

export const POST = route(async (req) => {
  const input = createProjectSchema.parse(await readJson(req));
  const project = await createProject(input);
  return NextResponse.json({ project }, { status: 201 });
});
