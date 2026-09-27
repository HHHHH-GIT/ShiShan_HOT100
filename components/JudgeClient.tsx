"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { hintStorageKey } from "@/components/HintsPanel";
import type { RunHistoryEntry } from "@/lib/state";
import type {
  HeartbeatInfo,
  LogLevel,
  RunEvent,
  RunLog,
  RunProgress,
  RunState,
  TestResult,
} from "@/lib/runner/types";
import type { Difficulty } from "@/lib/types";

interface Props {
  problemId: string;
  problemTitle: string;
  problemSummary: string;
  difficulty: Difficulty;
  heartbeatPort: number;
  heartbeatPath: string;
  workspacePath: string;
  startCommand: string;
}

const LEVEL_STYLE: Record<LogLevel, string> = {
  info: "text-[#c8c2b4]",
  debug: "text-[#8f8a7c]",
  success: "text-[#8fc79b]",
  warn: "text-[#e0b561]",
  error: "text-[#ef8f8a]",
};

const VERDICT_STYLE: Record<string, { label: string; className: string }> = {
  AC: { label: "AC", className: "border-ok/40 bg-ok-soft text-ok" },
  FAIL: { label: "FAIL", className: "border-bad/40 bg-bad-soft text-bad" },
  heartbeat_failed: { label: "无信号", className: "border-warn/40 bg-warn-soft text-warn" },
};

const SEGMENT_STYLE: Record<TestResult["status"], string> = {
  pending: "border-line bg-paper-2 text-muted",
  running: "border-accent bg-accent-soft text-ink",
  passed: "border-ok/50 bg-ok-soft text-ok",
  failed: "border-bad/50 bg-bad-soft text-bad",
};

const FILL_STYLE: Record<TestResult["status"], string> = {
  pending: "w-0 bg-line-strong",
  running: "w-full progress-sweep",
  passed: "w-full bg-ok",
  failed: "w-full bg-bad",
};

function pad(value: number, size = 2): string {
  return String(value).padStart(size, "0");
}

function formatClock(ts: number): string {
  const date = new Date(ts);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(
    date.getMilliseconds(),
    3,
  )}`;
}

function formatStamp(ts: number): string {
  const date = new Date(ts);
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function JudgeClient({
  problemId,
  problemTitle,
  problemSummary,
  difficulty,
  heartbeatPort,
  heartbeatPath,
  workspacePath,
  startCommand,
}: Props) {
  const [runState, setRunState] = useState<RunState | null>(null);
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [heartbeat, setHeartbeat] = useState<HeartbeatInfo | null>(null);
  const [hint, setHint] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultAnim, setResultAnim] = useState<"ac" | "fail" | null>(null);
  const [history, setHistory] = useState<RunHistoryEntry[]>([]);
  const [historyNote, setHistoryNote] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  /** 这道题解锁到第几级提示（0 = 没用过），用于在结果里标注 */
  const [hintLevel, setHintLevel] = useState(0);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(hintStorageKey(problemId));
      const value = raw ? Number(raw) : 0;
      if (Number.isFinite(value) && value > 0) setHintLevel(value);
    } catch {
      /* 隐私模式下读不到，按「未使用提示」处理 */
    }
  }, [problemId]);

  const sourceRef = useRef<EventSource | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const confettiFiredRef = useRef(false);

  const stopStream = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  useEffect(() => stopStream, [stopStream]);

  const refreshHistory = useCallback(async () => {
    try {
      const response = await fetch(`/api/problems/${problemId}/runs`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { runs?: RunHistoryEntry[] };
      setHistory(payload.runs ?? []);
    } catch {
      /* 历史拉取失败不影响判题 */
    }
  }, [problemId]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  const fireConfetti = useCallback(() => {
    if (confettiFiredRef.current) return;
    confettiFiredRef.current = true;

    const colors = ["#c96442", "#4a7c59", "#e0b561", "#1f1e1c", "#e8e3d8"];
    confetti({ particleCount: 90, spread: 70, origin: { x: 0.5, y: 0.42 }, colors, scalar: 0.9 });
    setTimeout(
      () => confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.6 }, colors }),
      180,
    );
    setTimeout(
      () =>
        confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.6 }, colors }),
      320,
    );
  }, []);

  const applySnapshot = useCallback((state: RunState) => {
    setRunState(state);
    setLogs(state.logs);
    setProgress(state.progress);
    setHeartbeat(state.heartbeat);
    setHint(state.hint ?? "");
    setRunning(state.status === "running");
    setActiveRunId(state.id);
    if (state.verdict === "AC") setResultAnim("ac");
    else if (state.verdict) setResultAnim("fail");
    else setResultAnim(null);
  }, []);

  const handleEvent = useCallback(
    (event: RunEvent) => {
      switch (event.kind) {
        case "snapshot":
          applySnapshot(event.state);
          break;
        case "heartbeat":
          setHeartbeat(event.heartbeat);
          setHint(event.hint);
          break;
        case "log":
          setLogs((previous) => [...previous, event.log]);
          break;
        case "test":
          setRunState((previous) =>
            previous
              ? {
                  ...previous,
                  tests: previous.tests.map((test) =>
                    test.id === event.test.id ? event.test : test,
                  ),
                }
              : previous,
          );
          setProgress(event.progress);
          break;
        case "progress":
          setProgress(event.progress);
          break;
        case "done":
          setRunning(false);
          setRunState((previous) =>
            previous ? { ...previous, status: "done", verdict: event.verdict } : previous,
          );
          if (event.verdict === "AC") {
            setResultAnim("ac");
            fireConfetti();
          } else {
            setResultAnim("fail");
          }
          void refreshHistory();
          break;
      }
    },
    [applySnapshot, fireConfetti, refreshHistory],
  );

  const start = useCallback(async () => {
    stopStream();
    setLogs([]);
    setProgress(null);
    setHeartbeat(null);
    setHint("");
    setRunState(null);
    setError(null);
    setResultAnim(null);
    setHistoryNote(null);
    confettiFiredRef.current = false;

    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ problemId }),
      });
      const payload = (await response.json()) as { runId?: string; error?: string };
      if (!response.ok || !payload.runId) {
        setError(payload.error ?? "无法启动判题");
        return;
      }

      setActiveRunId(payload.runId);
      setRunning(true);
      const source = new EventSource(`/api/runs/${payload.runId}/stream`);
      sourceRef.current = source;

      const kinds: RunEvent["kind"][] = ["snapshot", "heartbeat", "log", "test", "progress", "done"];
      for (const kind of kinds) {
        source.addEventListener(kind, (message) => {
          try {
            handleEvent(JSON.parse((message as MessageEvent<string>).data) as RunEvent);
          } catch (parseError) {
            console.error("[judge] 事件解析失败", parseError);
          }
        });
      }

      source.onerror = () => {
        // 服务端在 done 后会主动关闭连接，此时属于正常结束
        setRunning((previous) => {
          if (!previous) source.close();
          return previous;
        });
      };
    } catch (requestError) {
      setError(`无法启动判题：${(requestError as Error).message}`);
    }
  }, [handleEvent, problemId, stopStream]);

  /** 点击提交记录：把该次运行的状态与日志载入页面 */
  const loadRun = useCallback(
    async (runId: string) => {
      if (running) return;
      setHistoryNote(null);
      try {
        const response = await fetch(`/api/runs/${runId}`, { cache: "no-store" });
        if (!response.ok) {
          setHistoryNote("这次运行的详细日志已经过期了（只保留最近 20 次的日志）。");
          return;
        }
        const payload = (await response.json()) as { run: RunState };
        stopStream();
        confettiFiredRef.current = true; // 回看历史不再放彩带
        applySnapshot(payload.run);
      } catch (loadError) {
        setHistoryNote(`读取失败：${(loadError as Error).message}`);
      }
    },
    [applySnapshot, running, stopStream],
  );

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [logs.length]);

  const tests = runState?.tests ?? [];
  const verdict = runState?.verdict ?? null;
  const total = progress?.total ?? tests.length;
  const done = progress?.done ?? 0;
  const passedCount = tests.filter((test) => test.status === "passed").length;

  /** 测试点 id → 序号，用于日志行前缀 */
  const indexById = useMemo(() => {
    const map = new Map<string, number>();
    tests.forEach((test, index) => map.set(test.id, index + 1));
    return map;
  }, [tests]);

  return (
    <div className="space-y-4">
      {/* ================= 描述区 + 判题按钮 ================= */}
      <section
        className={`card p-5 ${
          verdict === "AC"
            ? "animate-pop-in border-ok/50"
            : verdict
              ? "animate-shake border-bad/50"
              : ""
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                {problemId}
              </span>
              <DifficultyBadge difficulty={difficulty} />
              {verdict && verdict !== "heartbeat_failed" && (
                <span className={`chip ${VERDICT_STYLE[verdict].className}`}>
                  {VERDICT_STYLE[verdict].label}
                </span>
              )}
            </div>
            <h1 className="mt-2 font-serif text-xl tracking-tight text-ink">{problemTitle}</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{problemSummary}</p>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]">
              <span className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    heartbeat?.ok
                      ? "bg-ok animate-pulse-ring"
                      : heartbeat
                        ? "bg-bad"
                        : running
                          ? "bg-accent animate-pulse"
                          : "bg-line-strong"
                  }`}
                />
                <span className="text-muted">
                  {heartbeat?.ok
                    ? "服务心跳正常"
                    : heartbeat
                      ? "心跳未通过"
                      : running
                        ? "正在探活…"
                        : "等待开始判题"}
                </span>
              </span>
              <span className="font-mono text-muted">
                GET http://127.0.0.1:{heartbeatPort}
                {heartbeatPath}
                {heartbeat ? ` · ${heartbeat.elapsedMs}ms` : ""}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link href={`/problems/${problemId}`} className="btn">
              题目详情
            </Link>
            <button className="btn btn-accent" onClick={start} disabled={running}>
              {running ? "判题中…" : verdict ? "重新判题" : "开始判题"}
            </button>
          </div>
        </div>

        {/* 结果说明 */}
        {verdict && verdict !== "heartbeat_failed" && (
          <p
            className={`mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-line pt-3 text-sm ${
              verdict === "AC" ? "text-ok" : "text-bad"
            }`}
          >
            <span>
              {verdict === "AC"
                ? `${total} 个测试点全部通过，这道题拿下了。`
                : `${total - passedCount} 个测试点未通过，看左下角的日志。`}
            </span>
            {verdict === "AC" && (
              <span
                className={`text-[11px] ${
                  hintLevel > 0 ? "text-warn" : "text-muted"
                }`}
              >
                {hintLevel > 0 ? `使用过 L${hintLevel} 提示` : "未使用提示"}
              </span>
            )}
          </p>
        )}

        {/* 心跳失败引导 */}
        {heartbeat && !heartbeat.ok && (
          <div className="animate-shake mt-4 rounded-xl border border-bad/30 bg-bad-soft p-4">
            <p className="font-serif text-base text-bad">服务没跑起来，先启动它</p>
            <p className="mt-1.5 text-sm leading-relaxed text-bad/90">{heartbeat.detail}</p>
            <div className="mt-3 space-y-1.5 rounded-lg border border-bad/30 bg-white/70 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wider text-bad/80">在本地目录执行</p>
              <p className="font-mono text-xs text-ink-soft">{workspacePath}</p>
              <p className="font-mono text-xs text-ink-soft">$ {startCommand || "启动命令未声明"}</p>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-bad/80">
              服务起来后回到这里点「重新判题」即可。本次已提前终止，没有跑任何测试点。
            </p>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-bad/40 bg-bad-soft px-3 py-2 text-sm text-bad">
            {error}
          </p>
        )}
      </section>

      {/* ================= 测试点：既能看结果，也是一条进度条 ================= */}
      <section className="card p-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-ink">回归测试点</span>
          <span className="truncate text-[11px] text-muted">
            {progress?.current
              ? `正在执行：${progress.current}`
              : verdict
                ? "已结束"
                : running
                  ? "准备中…"
                  : "尚未开始"}
          </span>
          <span className="shrink-0 font-mono text-xs text-muted">
            {done}/{total}
          </span>
        </div>

        <div className="log-scroll flex items-stretch overflow-x-auto pb-1">
          {tests.length === 0 ? (
            <div className="flex h-20 w-full items-center justify-center text-xs text-muted">
              点「开始判题」后，这里会按顺序点亮每个测试点
            </div>
          ) : (
            tests.map((test, index) => (
              <Fragment key={test.id}>
                {index > 0 && (
                  <span
                    aria-hidden
                    className={`flex shrink-0 items-center px-1.5 text-sm ${
                      tests[index - 1].status === "passed"
                        ? "text-ok"
                        : tests[index - 1].status === "failed"
                          ? "text-bad"
                          : "text-line-strong"
                    }`}
                  >
                    →
                  </span>
                )}
                <article
                  className={`flex min-w-[124px] flex-1 flex-col overflow-hidden rounded-xl border transition-colors ${
                    SEGMENT_STYLE[test.status]
                  }`}
                  title={test.reason ?? test.name}
                >
                  <div className="flex items-baseline justify-between gap-2 px-2.5 pt-2">
                    <span className="font-mono text-[10px] opacity-70">
                      {pad(index + 1)}
                    </span>
                    <span className="font-mono text-[10px] font-medium">
                      {test.status === "passed"
                        ? "PASS"
                        : test.status === "failed"
                          ? "FAIL"
                          : test.status === "running"
                            ? "RUN"
                            : "—"}
                    </span>
                  </div>
                  <p className="min-h-[2.4rem] px-2.5 pt-1 text-[12px] leading-snug">
                    {test.name}
                  </p>
                  <div className="mt-2 px-2.5 pb-2">
                    <div className="h-1 overflow-hidden rounded-full bg-black/10">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${
                          FILL_STYLE[test.status]
                        }`}
                      />
                    </div>
                    {test.durationMs !== undefined && (
                      <p className="mt-1 font-mono text-[10px] opacity-70">
                        {formatDuration(test.durationMs)}
                      </p>
                    )}
                  </div>
                </article>
              </Fragment>
            ))
          )}
        </div>
      </section>

      {/* ================= 日志区 + 提交记录 ================= */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_288px]">
        <section className="card flex min-w-0 flex-col overflow-hidden">
          <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-sm font-medium text-ink">日志</span>
            <span className="font-mono text-[11px] text-muted">{logs.length} 行</span>
          </header>
          <div className="log-scroll h-[380px] overflow-y-auto bg-[#26241f] px-4 py-3">
            {logs.length === 0 ? (
              <p className="py-10 text-center text-xs text-[#8f8a7c]">
                判题的实时日志会出现在这里
              </p>
            ) : (
              logs.map((log) => (
                <p key={log.seq} className="flex gap-2.5 font-mono text-[11.5px] leading-relaxed">
                  <span className="shrink-0 text-[#6f6b63]">{formatClock(log.ts)}</span>
                  <span className="w-6 shrink-0 text-[#6f6b63]">
                    {log.testId ? `[${pad(indexById.get(log.testId) ?? 0)}]` : "[··]"}
                  </span>
                  <span className={`whitespace-pre-wrap break-all ${LEVEL_STYLE[log.level]}`}>
                    {log.message}
                  </span>
                </p>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </section>

        <section className="card flex min-w-0 flex-col overflow-hidden">
          <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-sm font-medium text-ink">提交记录</span>
            <span className="font-mono text-[11px] text-muted">{history.length}</span>
          </header>
          <div className="log-scroll h-[380px] overflow-y-auto p-2">
            {history.length === 0 ? (
              <p className="py-10 text-center text-xs text-muted">还没有提交记录</p>
            ) : (
              <ul className="space-y-1.5">
                {history.map((entry) => {
                  const style = VERDICT_STYLE[entry.verdict] ?? VERDICT_STYLE.FAIL;
                  const isActive = entry.runId === activeRunId;
                  return (
                    <li key={entry.runId}>
                      <button
                        type="button"
                        onClick={() => loadRun(entry.runId)}
                        disabled={running}
                        className={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors ${
                          isActive ? "border-ink/25 bg-paper-2" : "border-transparent hover:bg-paper-2"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`chip ${style.className}`}>{style.label}</span>
                          <span className="font-mono text-[10.5px] text-muted">
                            {formatStamp(entry.at)}
                          </span>
                        </div>
                        <p className="mt-1.5 flex items-center justify-between font-mono text-[10.5px] text-muted">
                          <span>
                            {entry.passed}/{entry.total} 通过
                          </span>
                          <span>{formatDuration(entry.durationMs)}</span>
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {historyNote && (
            <p className="border-t border-line px-3 py-2 text-[11px] leading-relaxed text-warn">
              {historyNote}
            </p>
          )}
        </section>
      </div>

      {/* 无障碍播报 */}
      <span className="sr-only" aria-live="polite">
        {problemTitle} 判题状态：{verdict ?? (running ? "进行中" : "未开始")}
      </span>
      {resultAnim === "fail" && <span className="sr-only">测试未通过</span>}
      {resultAnim === "ac" && <span className="sr-only">全部通过，AC</span>}
    </div>
  );
}