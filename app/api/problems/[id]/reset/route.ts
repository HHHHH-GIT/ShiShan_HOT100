import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { resetProblem } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await resetProblem(id);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}