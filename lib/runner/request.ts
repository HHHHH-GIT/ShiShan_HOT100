import { createHash } from "node:crypto";
import type { HttpExpect, HttpRequest } from "../types";
import { deepPartialMatch, interpolate, preview } from "./values";

export const DEFAULT_TIMEOUT_MS = 10_000;

export interface SendResult {
  /** 是否拿到了 HTTP 响应（状态码非 2xx 时仍为 true） */
  ok: boolean;
  status: number | null;
  statusText: string;
  body: string;
  bodySha256?: string;
  json: unknown;
  elapsedMs: number;
  /** 连接层错误（超时 / 连接被拒等） */
  error?: string;
}

export function describeRequest(request: HttpRequest, vars: Record<string, unknown>): string {
  const resolved = interpolate(request, vars);
  const parts = [`${resolved.method} ${resolved.url}`];
  if (resolved.json !== undefined) parts.push(`body=${preview(resolved.json, 240)}`);
  else if (resolved.body) parts.push(`body=${preview(resolved.body, 240)}`);
  return parts.join(" ");
}

export async function sendRequest(
  request: HttpRequest,
  vars: Record<string, unknown>,
  fallbackTimeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<SendResult> {
  const resolved = interpolate(request, vars);
  const timeoutMs = resolved.timeoutMs ?? fallbackTimeoutMs;
  const headers = new Headers(resolved.headers ?? {});

  let body: string | undefined;
  if (resolved.json !== undefined) {
    body = JSON.stringify(resolved.json);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
  } else if (resolved.body !== undefined) {
    body = resolved.body;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(resolved.url, {
      method: resolved.method,
      headers,
      body,
      signal: controller.signal,
      cache: "no-store",
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    const text = bytes.toString("utf8");
    const elapsedMs = Date.now() - startedAt;

    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }

    return {
      ok: true,
      status: response.status,
      statusText: response.statusText,
      body: text,
      bodySha256: createHash("sha256").update(bytes).digest("hex"),
      json,
      elapsedMs,
    };
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    const cause = (error as { cause?: { code?: string } })?.cause?.code;
    const aborted = controller.signal.aborted || (error as Error)?.name === "AbortError";
    const detail = aborted
      ? `${timeoutMs}ms 超时未返回`
      : cause === "ECONNREFUSED"
        ? "连接被拒绝（服务未启动？）"
        : cause === "ECONNRESET"
          ? "连接被重置"
          : ((error as Error)?.message ?? String(error));

    return {
      ok: false,
      status: null,
      statusText: "",
      body: "",
      json: null,
      elapsedMs,
      error: detail,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** 返回空数组表示全部断言通过；否则返回可读的失败原因列表 */
export function evaluateExpect(expect: HttpExpect, result: SendResult): string[] {
  const failures: string[] = [];

  if (!result.ok) {
    failures.push(`请求失败：${result.error ?? "未知错误"}`);
    return failures;
  }

  if (expect.status !== undefined && result.status !== expect.status) {
    failures.push(`期望 HTTP ${expect.status}，实际 HTTP ${result.status}`);
  }

  if (expect.bodySha256 !== undefined && result.bodySha256 !== expect.bodySha256.toLowerCase()) {
    failures.push(`响应字节 SHA-256 不匹配：期望 ${expect.bodySha256.toLowerCase()}，实际 ${result.bodySha256 ?? "未获取"}`);
  }

  if (expect.json) {
    if (result.json === null) {
      failures.push(
        `期望响应 JSON 匹配 ${preview(expect.json)}，但响应不是合法 JSON：${preview(result.body, 200)}`,
      );
    } else if (!deepPartialMatch(result.json, expect.json)) {
      failures.push(
        `期望响应 JSON 包含 ${preview(expect.json)}，实际为 ${preview(result.json, 300)}`,
      );
    }
  }

  for (const fragment of expect.contains ?? []) {
    if (!result.body.includes(fragment)) {
      failures.push(`期望响应包含 ${preview(fragment, 120)}，实际为 ${preview(result.body, 240)}`);
    }
  }

  for (const fragment of expect.notContains ?? []) {
    if (result.body.includes(fragment)) {
      failures.push(`响应中不应出现 ${preview(fragment, 120)}，实际为 ${preview(result.body, 240)}`);
    }
  }

  if (expect.maxMs !== undefined && result.elapsedMs > expect.maxMs) {
    failures.push(`期望耗时 ≤ ${expect.maxMs}ms，实际 ${result.elapsedMs}ms`);
  }

  return failures;
}
