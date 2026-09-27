import { runStore } from "@/lib/runner/store";
import type { RunEvent } from "@/lib/runner/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 判题过程 SSE 事件流：日志 / 进度 / 测试点结果 / 最终 verdict */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const run = runStore.get(runId);
  if (!run) {
    return new Response(`找不到运行记录：${runId}`, { status: 404 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let keepAlive: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      const send = (event: RunEvent) => {
        write(`event: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`);
      };

      // 首帧回放：新连接立刻拿到完整快照（含已产生的日志），实现刷新重连
      runStore.replay(runId, send);

      if (run.status === "done") {
        closed = true;
        try {
          controller.close();
        } catch {
          /* 已关闭 */
        }
        return;
      }

      unsubscribe = runStore.subscribe(runId, (event) => {
        send(event);
        if (event.kind === "done") {
          closed = true;
          unsubscribe?.();
          if (keepAlive) clearInterval(keepAlive);
          try {
            controller.close();
          } catch {
            /* 已关闭 */
          }
        }
      });

      // 心跳注释帧，避免中间层掐断长连接
      keepAlive = setInterval(() => write(`: keep-alive\n\n`), 15_000);
    },
    cancel() {
      // 客户端断开时由 ReadableStream 的 cancel 回调清理，
      // 不使用 request.signal：Next 在返回流式响应后会立刻触发它。
      unsubscribe?.();
      if (keepAlive) clearInterval(keepAlive);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}