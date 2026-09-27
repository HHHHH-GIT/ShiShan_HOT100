import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { readMeta } from "@/lib/problems";
import { getHistory } from "@/lib/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 提交记录（最新在前），供判题页右下角展示 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await readMeta(id);
    const runs = await getHistory(id);
    return NextResponse.json({ runs });
  } catch (error) {
    return errorResponse(error);
  }
}