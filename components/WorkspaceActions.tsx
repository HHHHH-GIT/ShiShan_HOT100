"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  problemId: string;
  workspacePath: string;
  startCommand: string;
  downloaded: boolean;
}

type Feedback = { tone: "ok" | "warn" | "bad"; text: string } | null;

export function WorkspaceActions({
  problemId,
  workspacePath,
  startCommand,
  downloaded,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"download" | "reset" | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const call = async (action: "download" | "reset") => {
    setBusy(action);
    setFeedback(null);
    try {
      const response = await fetch(`/api/problems/${problemId}/${action}`, { method: "POST" });
      const payload = (await response.json()) as
        | { message?: string; workspacePath?: string; alreadyExisted?: boolean; blocked?: string[] }
        | { error?: string };

      if (!response.ok) {
        setFeedback({ tone: "bad", text: (payload as { error?: string }).error ?? "操作失败" });
        return;
      }

      const result = payload as {
        message?: string;
        alreadyExisted?: boolean;
        blocked?: string[];
      };
      const hasBlocked = (result.blocked?.length ?? 0) > 0;
      setFeedback({
        tone: hasBlocked ? "warn" : result.alreadyExisted ? "warn" : "ok",
        text: result.message ?? "完成",
      });
      startTransition(() => router.refresh());
    } catch (error) {
      setFeedback({ tone: "bad", text: `请求失败：${(error as Error).message}` });
    } finally {
      setBusy(null);
    }
  };

  const disabled = busy !== null || pending;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={() => call("download")} disabled={disabled}>
          {busy === "download" ? "处理中…" : downloaded ? "已下载" : "下载题目"}
        </button>
        <button className="btn" onClick={() => call("reset")} disabled={disabled}>
          {busy === "reset" ? "重置中…" : "重置题目"}
        </button>
      </div>

      {feedback && (
        <p
          className={`animate-fade-up rounded-lg border px-3 py-2 text-xs leading-relaxed ${
            feedback.tone === "ok"
              ? "border-ok/40 bg-ok-soft text-ok"
              : feedback.tone === "warn"
                ? "border-warn/40 bg-warn-soft text-warn"
                : "border-bad/40 bg-bad-soft text-bad"
          }`}
        >
          {feedback.text}
        </p>
      )}

      <div className="rounded-lg border border-line bg-paper-2 px-3 py-2.5">
        <p className="text-[11px] uppercase tracking-wider text-muted">本地路径</p>
        <p className="mt-0.5 font-mono text-xs text-ink-soft">{workspacePath}</p>
        <p className="mt-2 text-[11px] uppercase tracking-wider text-muted">启动命令</p>
        <p className="mt-0.5 font-mono text-xs text-ink-soft">{startCommand || "—"}</p>
      </div>
    </div>
  );
}