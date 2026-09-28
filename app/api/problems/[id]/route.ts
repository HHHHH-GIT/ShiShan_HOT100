import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { getProblem } from "@/lib/problems";
import { publicProblem } from "@/lib/public";
import { getRecord } from "@/lib/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const problem = await getProblem(id);
    const record = await getRecord(id);
    return NextResponse.json({ problem: publicProblem(problem, record?.passedTestIds) });
  } catch (error) {
    return errorResponse(error);
  }
}
