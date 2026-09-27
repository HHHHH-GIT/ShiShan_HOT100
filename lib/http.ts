import { NextResponse } from "next/server";
import { ProblemError } from "./problems";

/** 统一的 JSON 错误响应，保证错误信息可读而非静默失败 */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ProblemError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode });
  }
  console.error("[api] 未处理异常：", error);
  const message = error instanceof Error ? error.message : String(error);
  return NextResponse.json({ error: message || "服务器内部错误" }, { status: 500 });
}