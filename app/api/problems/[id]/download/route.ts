import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { downloadProblem } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await downloadProblem(id, false);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}