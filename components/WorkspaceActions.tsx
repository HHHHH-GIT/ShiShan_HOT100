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
  const [copied, setCopied] = useState<string | null>(null);

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

  const copyText = (text: string, type: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 1500);
  };

  const disabled = busy !== null || pending;

  return (
    <div className="space-y-3.5">
      {/* 按钮操作组 */}
      <div className="flex gap-2.5">
        <button
          className="btn btn-primary flex-1 py-2.5 text-sm font-semibold shadow-xs"
          onClick={() => call("download")}
          disabled={disabled}
        >
          {busy === "download" ? "下发中…" : downloaded ? "已就绪 (可重下)" : "下发工程到本地"}
        </button>
        <button
          className="btn py-2.5 text-sm font-medium"
          onClick={() => call("reset")}
          disabled={disabled}
        >
          {busy === "reset" ? "重置中…" : "重置工作区"}
        </button>
      </div>

      {feedback && (
        <div
          className={`animate-fade-up rounded-lg border px-3.5 py-2.5 text-sm leading-relaxed ${
            feedback.tone === "ok"
              ? "border-ok/30 bg-ok-soft/70 text-ok font-semibold"
              : feedback.tone === "warn"
                ? "border-warn/30 bg-warn-soft/70 text-warn font-semibold"
                : "border-bad/30 bg-bad-soft/70 text-bad font-semibold"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* 工作区路径与启动命令展示卡 */}
      <div className="rounded-lg border border-line bg-paper p-3.5 text-sm space-y-3">
        <div>
          <div className="flex items-center justify-between text-muted text-xs font-bold uppercase tracking-wider">
            <span>工作区路径</span>
            <button
              type="button"
              onClick={() => copyText(workspacePath, "path")}
              className="hover:text-ink cursor-pointer transition-colors text-xs font-semibold"
            >
              {copied === "path" ? "已复制" : "复制"}
            </button>
          </div>
          <p className="mt-1 font-mono text-xs sm:text-[13px] text-ink font-medium select-all break-all leading-normal">
            {workspacePath}
          </p>
        </div>

        <div className="border-t border-line/60 pt-2.5">
          <div className="flex items-center justify-between text-muted text-xs font-bold uppercase tracking-wider">
            <span>启动命令</span>
            {startCommand && (
              <button
                type="button"
                onClick={() => copyText(startCommand, "cmd")}
                className="hover:text-ink cursor-pointer transition-colors text-xs font-semibold"
              >
                {copied === "cmd" ? "已复制" : "复制"}
              </button>
            )}
          </div>
          <p className="mt-1 font-mono text-xs sm:text-[13px] text-ink font-bold select-all leading-normal">
            $ {startCommand || "—"}
          </p>
        </div>
      </div>
    </div>
  );
}