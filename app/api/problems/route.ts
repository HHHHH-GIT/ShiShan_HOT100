import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { listProblems } from "@/lib/problems";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const problems = await listProblems();
    return NextResponse.json({ problems });
  } catch (error) {
    return errorResponse(error);
  }
}