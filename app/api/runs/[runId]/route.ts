import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { runStore } from "@/lib/runner/store";
import { publicRun } from "@/lib/public";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 供刷新页面后重连使用：一次性取回当前状态与已产生的日志 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await params;
    const run = runStore.get(runId);
    if (!run) {
      return NextResponse.json({ error: `找不到运行记录：${runId}` }, { status: 404 });
    }
    return NextResponse.json({ run: publicRun(run) });
  } catch (error) {
    return errorResponse(error);
  }
}
