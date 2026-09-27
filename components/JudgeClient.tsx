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
  info: "text-neutral-300",
  debug: "text-neutral-500",
  success: "text-emerald-400 font-medium",
  warn: "text-amber-400",
  error: "text-rose-400 font-medium",
};

const VERDICT_STYLE: Record<string, { label: string; className: string }> = {
  AC: { label: "AC", className: "border-ok/40 bg-ok-soft text-ok font-semibold" },
  FAIL: { label: "FAIL", className: "border-bad/40 bg-bad-soft text-bad font-semibold" },
  heartbeat_failed: { label: "未探活", className: "border-warn/40 bg-warn-soft text-warn font-semibold" },
};

const SEGMENT_STYLE: Record<TestResult["status"], string> = {
  pending: "border-line bg-paper text-muted",
  running: "border-accent bg-accent-soft/40 text-ink shadow-2xs",
  passed: "border-ok/40 bg-ok-soft/60 text-ok",
  failed: "border-bad/40 bg-bad-soft/60 text-bad",
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

    const colors = ["#ffa116", "#00af9b", "#f59e0b", "#111827", "#3b82f6"];
    confetti({ particleCount: 90, spread: 70, origin: { x: 0.5, y: 0.42 }, colors, scalar: 0.9 });
    setTimeout(
      () => confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.6 }, colors }),
      220,
    );
    setTimeout(
      () => confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.6 }, colors }),
      420,
    );
  }, []);

  /** 载入一次历史快照 */
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

  /** 处理后端推过来的 SSE 事件 */
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

  /** 点击开始判题：POST 创建 runId，再打开 SSE 流 */
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
        className={`card p-5 sm:p-6 transition-all duration-200 ${
          verdict === "AC"
            ? "animate-pop-in border-ok/50 ring-1 ring-ok/20"
            : verdict
              ? "animate-shake border-bad/50 ring-1 ring-bad/20"
              : ""
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted">
                {problemId}
              </span>
              <DifficultyBadge difficulty={difficulty} />
              {verdict && verdict !== "heartbeat_failed" && (
                <span className={`chip ${VERDICT_STYLE[verdict].className}`}>
                  {VERDICT_STYLE[verdict].label}
                </span>
              )}
            </div>
            <h1 className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-ink">
              {problemTitle}
            </h1>
            <p className="mt-1 max-w-2xl text-xs sm:text-sm leading-relaxed text-muted">
              {problemSummary}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full transition-colors ${
                    heartbeat?.ok
                      ? "bg-ok animate-pulse-ring"
                      : heartbeat
                        ? "bg-bad"
                        : running
                          ? "bg-accent animate-pulse"
                          : "bg-line-strong"
                  }`}
                />
                <span className="font-medium text-ink-soft">
                  {heartbeat?.ok
                    ? "服务心跳正常"
                    : heartbeat
                      ? "心跳未通过"
                      : running
                        ? "正在探活…"
                        : "等待开始判题"}
                </span>
              </span>
              <span className="font-mono text-muted/80">
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
            <button className="btn btn-accent px-4 py-2 font-semibold shadow-xs" onClick={start} disabled={running}>
              {running ? "判题中…" : verdict ? "重新判题" : "开始判题"}
            </button>
          </div>
        </div>

        {/* 结果说明 */}
        {verdict && verdict !== "heartbeat_failed" && (
          <div
            className={`mt-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-line/80 pt-3 text-xs sm:text-sm ${
              verdict === "AC" ? "text-ok" : "text-bad"
            }`}
          >
            <span className="font-medium">
              {verdict === "AC"
                ? `🎉 全部 ${total} 个测试点全部通过，AC！`
                : `✘ 未通过：${total - passedCount} 个测试点断言失败，请检查下方执行日志。`}
            </span>
            {verdict === "AC" && (
              <span
                className={`text-[11px] font-mono ${
                  hintLevel > 0 ? "text-warn" : "text-muted"
                }`}
              >
                {hintLevel > 0 ? `使用过 L${hintLevel} 提示` : "零提示独立解答"}
              </span>
            )}
          </div>
        )}

        {/* 心跳失败引导 */}
        {heartbeat && !heartbeat.ok && (
          <div className="animate-shake mt-4 rounded-xl border border-bad/30 bg-bad-soft/60 p-4">
            <p className="text-sm font-semibold text-bad">本地服务未运行或无法连接</p>
            <p className="mt-1 text-xs leading-relaxed text-bad/90">{heartbeat.detail}</p>
            <div className="mt-2.5 space-y-1 rounded-lg border border-bad/20 bg-surface/80 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-bad/80">
                请先在本地终端执行启动命令
              </p>
              <p className="font-mono text-xs text-ink-soft">{workspacePath}</p>
              <p className="font-mono text-xs font-semibold text-ink">$ {startCommand || "mvn spring-boot:run"}</p>
            </div>
            <p className="mt-2.5 text-[11px] leading-relaxed text-bad/80">
              服务启动并监听端口后，返回此处点击「重新判题」即可。
            </p>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-bad/40 bg-bad-soft px-3.5 py-2 text-xs text-bad">
            {error}
          </p>
        )}
      </section>

      {/* ================= 测试点：水平测试流水线 ================= */}
      <section className="card p-4 sm:p-5">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">
            测试执行流水线
          </span>
          <span className="truncate text-xs text-muted">
            {progress?.current
              ? `正在执行：${progress.current}`
              : verdict
                ? "测试执行完成"
                : running
                  ? "准备中…"
                  : "尚未开始"}
          </span>
          <span className="shrink-0 font-mono text-xs font-medium text-ink">
            {done}/{total}
          </span>
        </div>

        <div className="log-scroll flex items-stretch overflow-x-auto pb-1.5">
          {tests.length === 0 ? (
            <div className="flex h-18 w-full items-center justify-center text-xs text-muted">
              点击「开始判题」后，此处将按序执行并点亮各个回归测试节点
            </div>
          ) : (
            tests.map((test, index) => (
              <Fragment key={test.id}>
                {index > 0 && (
                  <span
                    aria-hidden
                    className={`flex shrink-0 items-center px-1 text-xs font-mono transition-colors ${
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
                  className={`flex min-w-[130px] flex-1 flex-col overflow-hidden rounded-xl border transition-all ${
                    SEGMENT_STYLE[test.status]
                  }`}
                  title={test.reason ?? test.name}
                >
                  <div className="flex items-baseline justify-between gap-2 px-2.5 pt-2">
                    <span className="font-mono text-[10px] opacity-70">
                      {pad(index + 1)}
                    </span>
                    <span className="font-mono text-[10px] font-bold">
                      {test.status === "passed"
                        ? "PASS"
                        : test.status === "failed"
                          ? "FAIL"
                          : test.status === "running"
                            ? "RUN"
                            : "—"}
                    </span>
                  </div>
                  <p className="min-h-[2.2rem] px-2.5 pt-1 text-[11px] font-medium leading-snug">
                    {test.name}
                  </p>
                  <div className="mt-1.5 px-2.5 pb-2">
                    <div className="h-1 overflow-hidden rounded-full bg-black/10">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ease-out ${
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

      {/* ================= 实时日志终端 + 提交记录 ================= */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_290px]">
        {/* 现代深色终端控制台 */}
        <section className="card flex min-w-0 flex-col overflow-hidden border-neutral-800 bg-[#18181b] shadow-card">
          <header className="flex items-center justify-between border-b border-neutral-800 bg-[#1f1f23] px-3.5 py-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
              </div>
              <span className="font-mono text-[11px] font-semibold text-neutral-300 uppercase tracking-wider ml-1">
                RUNNER CONSOLE
              </span>
            </div>
            <span className="font-mono text-[10px] text-neutral-400">
              {logs.length} lines
            </span>
          </header>
          <div className="log-scroll h-[390px] overflow-y-auto p-3.5 font-mono text-[11.5px]">
            {logs.length === 0 ? (
              <p className="py-12 text-center text-xs text-neutral-500 font-sans">
                判题执行的实时链路日志将输出至此处
              </p>
            ) : (
              logs.map((log) => (
                <p key={log.seq} className="flex gap-2 font-mono text-[11px] leading-relaxed">
                  <span className="shrink-0 text-neutral-500">{formatClock(log.ts)}</span>
                  <span className="w-5 shrink-0 text-neutral-400">
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

        {/* 历史提交记录 */}
        <section className="card flex min-w-0 flex-col overflow-hidden">
          <header className="flex items-center justify-between border-b border-line/80 px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              提交记录
            </span>
            <span className="font-mono text-xs font-medium text-ink">{history.length}</span>
          </header>
          <div className="log-scroll h-[390px] overflow-y-auto p-2">
            {history.length === 0 ? (
              <p className="py-12 text-center text-xs text-muted">暂无历史提交记录</p>
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
                        className={`w-full rounded-lg border px-2.5 py-2 text-left transition-all ${
                          isActive
                            ? "border-ink/30 bg-paper shadow-2xs"
                            : "border-transparent hover:bg-paper"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`chip ${style.className}`}>{style.label}</span>
                          <span className="font-mono text-[10px] text-muted">
                            {formatStamp(entry.at)}
                          </span>
                        </div>
                        <p className="mt-1.5 flex items-center justify-between font-mono text-[10.5px] text-muted">
                          <span className="font-medium text-ink-soft">
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