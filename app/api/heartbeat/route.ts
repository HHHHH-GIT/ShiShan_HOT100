import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { checkHeartbeat } from "@/lib/heartbeat";
import { getProblem } from "@/lib/problems";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { problemId?: string };
    if (!body.problemId) {
      return NextResponse.json({ error: "缺少 problemId" }, { status: 400 });
    }

    const problem = await getProblem(body.problemId);
    const result = await checkHeartbeat(problem.meta.heartbeat);

    const hint = result.ok
      ? `服务已就绪。`
      : `服务未启动或未就绪。请先在 ${problem.workspacePath} 目录执行：\n${problem.meta.startCommand || "启动命令未在 meta.json 中声明"}`;

    return NextResponse.json({ heartbeat: result, hint });
  } catch (error) {
    return errorResponse(error);
  }
}