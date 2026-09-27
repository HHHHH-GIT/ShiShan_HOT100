import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { getProblem } from "@/lib/problems";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const problem = await getProblem(id);
    return NextResponse.json({ problem });
  } catch (error) {
    return errorResponse(error);
  }
}