import path from "node:path";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { getProblem } from "@/lib/problems";
import { startRun } from "@/lib/runner";
import { workspaceProblemDir } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { problemId?: string };
    if (!body.problemId) {
      return NextResponse.json({ error: "缺少 problemId" }, { status: 400 });
    }

    const problem = await getProblem(body.problemId);
    const workspace = workspaceProblemDir(problem.id);
    const logFile = path.resolve(workspace, problem.meta.logPath);

    const runId = await startRun({
      problemId: problem.id,
      problemTitle: problem.meta.title,
      tests: problem.spec.tests,
      specVars: problem.spec.vars,
      baseUrl: problem.spec.baseUrl,
      heartbeat: problem.meta.heartbeat,
      startCommand: problem.meta.startCommand,
      workspacePath: problem.workspacePath,
      logFile,
      logBaseDir: workspace,
    });

    return NextResponse.json({ runId });
  } catch (error) {
    return errorResponse(error);
  }
}