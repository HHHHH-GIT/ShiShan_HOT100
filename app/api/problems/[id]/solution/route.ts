import fs from "node:fs/promises";
import { errorResponse } from "@/lib/http";
import { problemSolutionFile } from "@/lib/paths";
import { ProblemError, readMeta } from "@/lib/problems";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 题解只提供下载，不在页面内展示 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const meta = await readMeta(id);

    let content: string;
    try {
      content = await fs.readFile(problemSolutionFile(id), "utf8");
    } catch {
      throw new ProblemError(`题目 ${id} 还没有提供题解文件`, 404);
    }

    return new Response(content, {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="${meta.id}-solution.md"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}