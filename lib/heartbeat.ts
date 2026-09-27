import type { Heartbeat } from "./types";

/** 心跳探活超时上限（规格要求不超过 3 秒） */
export const HEARTBEAT_TIMEOUT_MS = 3000;

export type HeartbeatReason = "ok" | "timeout" | "refused" | "bad_status" | "error";

export interface HeartbeatResult {
  ok: boolean;
  port: number;
  path: string;
  url: string;
  status: number | null;
  elapsedMs: number;
  reason: HeartbeatReason;
  /** 给用户看的失败原因 */
  detail: string;
  /** 响应体片段（截断） */
  bodySnippet: string | null;
}

export function heartbeatUrl(heartbeat: Heartbeat): string {
  const suffix = heartbeat.path.startsWith("/") ? heartbeat.path : `/${heartbeat.path}`;
  return `http://127.0.0.1:${heartbeat.port}${suffix}`;
}

function errorCode(error: unknown): string {
  const candidate = error as { cause?: { code?: string }; code?: string };
  return candidate?.cause?.code ?? candidate?.code ?? "";
}

export async function checkHeartbeat(
  heartbeat: Heartbeat,
  timeoutMs: number = HEARTBEAT_TIMEOUT_MS,
): Promise<HeartbeatResult> {
  const url = heartbeatUrl(heartbeat);
  const base = { port: heartbeat.port, path: heartbeat.path, url };
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
      headers: { accept: "application/json, text/plain, */*" },
    });
    const elapsedMs = Date.now() - startedAt;
    const text = await response.text().catch(() => "");
    const bodySnippet = text.slice(0, 200);

    if (!response.ok) {
      return {
        ...base,
        ok: false,
        status: response.status,
        elapsedMs,
        reason: "bad_status",
        detail: `心跳接口返回了 HTTP ${response.status}，服务虽然活着但未就绪。`,
        bodySnippet,
      };
    }

    return {
      ...base,
      ok: true,
      status: response.status,
      elapsedMs,
      reason: "ok",
      detail: `心跳正常，耗时 ${elapsedMs}ms。`,
      bodySnippet,
    };
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    const code = errorCode(error);

    if (controller.signal.aborted || (error as Error)?.name === "AbortError") {
      return {
        ...base,
        ok: false,
        status: null,
        elapsedMs,
        reason: "timeout",
        detail: `${timeoutMs}ms 内没有响应，服务可能正在启动或卡住了。`,
        bodySnippet: null,
      };
    }

    if (code === "ECONNREFUSED" || code === "ECONNRESET") {
      return {
        ...base,
        ok: false,
        status: null,
        elapsedMs,
        reason: "refused",
        detail: `端口 ${heartbeat.port} 没有服务在监听（连接被拒绝）。`,
        bodySnippet: null,
      };
    }

    return {
      ...base,
      ok: false,
      status: null,
      elapsedMs,
      reason: "error",
      detail: `探活失败：${(error as Error)?.message ?? String(error)}`,
      bodySnippet: null,
    };
  } finally {
    clearTimeout(timer);
  }
}