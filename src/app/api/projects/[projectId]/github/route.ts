import { NextResponse } from "next/server";
import { ApiError, route } from "@/server/errors";
import { parseId } from "@/server/http";
import { getProject } from "@/server/services/projects";
import { GithubError, githubService } from "@/server/github/service";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ projectId: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const id = parseId((await params).projectId, "project");
  const project = await getProject(id);
  if (!project.githubRepo) throw new ApiError(404, "NO_REPOSITORY", "This project has no GitHub repository configured");
  try {
    return NextResponse.json(await githubService.getInsights(project.githubRepo));
  } catch (e) {
    if (e instanceof GithubError) {
      return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.httpStatus });
    }
    throw e;
  }
});
