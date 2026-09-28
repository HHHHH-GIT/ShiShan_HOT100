import fs from "node:fs/promises";
import path from "node:path";
import { checkHeartbeat } from "../heartbeat";
import { saveRun } from "../state";
import type { TestType, Verdict } from "../types";
import { runTestCase } from "./executors";
import { runStore } from "./store";
import type { RunOptions, RunnerContext, LogLevel, TestResult } from "./types";

const TYPE_LABELS: Record<TestType, string> = {
  http: "单请求断言",
  workflow: "多步流程",
  load: "并发压测",
  log: "日志断言",
};

async function fileSize(file: string): Promise<number> {
  try {
    const stat = await fs.stat(file);
    return stat.size;
  } catch {
    return 0;
  }
}

/** 启动一次判题，立即返回 runId；执行过程通过 runStore 事件流推送 */
export async function startRun(options: RunOptions): Promise<string> {
  const tests: TestResult[] = options.tests.map((test) => ({
    id: test.id,
    name: test.name,
    type: test.type,
    description: test.description,
    status: "pending",
  }));

  const run = runStore.createRun(options.problemId, options.problemTitle, tests);
  void execute(run.id, options).catch(async (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    runStore.appendLog(run.id, null, "error", `判题过程异常终止：${message}`);
    runStore.finish(run.id, "FAIL");
    await recordRun(run.id, options.problemId, "FAIL").catch(() => undefined);
  });
  return run.id;
}

/** 把这次运行写进提交记录 */
async function recordRun(runId: string, problemId: string, verdict: Verdict): Promise<void> {
  const state = runStore.get(runId);
  const tests = state?.tests ?? [];
  await saveRun(problemId, {
    runId,
    verdict,
    at: Date.now(),
    passed: tests.filter((test) => test.status === "passed").length,
    total: tests.length,
    durationMs: state ? (state.finishedAt ?? Date.now()) - state.startedAt : 0,
  }, tests.filter((test) => test.status === "passed").map((test) => test.id));
}

async function execute(runId: string, options: RunOptions): Promise<void> {
  const log = (
    level: LogLevel,
    message: string,
    testId: string | null = null,
  ): void => {
    runStore.appendLog(runId, testId, level, message);
  };

  const total = options.tests.length;

  // 记录日志文件当前大小，日志断言只检查本次运行新产生的行
  const logFiles = new Set<string>([options.logFile]);
  for (const test of options.tests) {
    if (test.type === "log" && test.path) {
      logFiles.add(path.resolve(options.logBaseDir, test.path));
    }
  }
  const logOffsets = new Map<string, number>();
  for (const file of logFiles) {
    logOffsets.set(file, await fileSize(file));
  }

  log("info", `开始判题：${options.problemId} · ${options.problemTitle}（共 ${total} 个测试点）`);
  log("debug", `工作区：${options.workspacePath}`);
  log("debug", `日志文件：${options.logFile}`);

  // ---------- 心跳预检 ----------
  const heartbeatUrl = `http://127.0.0.1:${options.heartbeat.port}${
    options.heartbeat.path.startsWith("/") ? options.heartbeat.path : `/${options.heartbeat.path}`
  }`;
  log("info", `心跳预检：GET ${heartbeatUrl}`);

  const heartbeat = await checkHeartbeat(options.heartbeat);
  const hint = heartbeat.ok
    ? "服务已就绪。"
    : `服务未启动或未就绪：${heartbeat.detail}\n请先在 ${options.workspacePath} 目录执行：\n${
        options.startCommand || "（meta.json 未声明启动命令）"
      }`;

  runStore.setHeartbeat(
    runId,
    {
      ok: heartbeat.ok,
      port: heartbeat.port,
      url: heartbeat.url,
      status: heartbeat.status,
      elapsedMs: heartbeat.elapsedMs,
      reason: heartbeat.reason,
      detail: heartbeat.detail,
    },
    hint,
  );

  if (!heartbeat.ok) {
    log("error", `心跳未通过：${heartbeat.detail}`);
    log("error", hint.replace(/\n/g, " "));
    runStore.setProgress(runId, { done: 0, total, current: null });
    await recordRun(runId, options.problemId, "heartbeat_failed");
    runStore.finish(runId, "heartbeat_failed");
    return;
  }

  log("success", `心跳通过（HTTP ${heartbeat.status}，耗时 ${heartbeat.elapsedMs}ms）`);

  // ---------- 顺序执行测试点 ----------
  const ctx: RunnerContext = {
    problemId: options.problemId,
    vars: { baseUrl: options.baseUrl, ...(options.specVars ?? {}) },
    logFile: options.logFile,
    logBaseDir: options.logBaseDir,
    logOffsets,
    log: (level, message, testId) => runStore.appendLog(runId, testId ?? null, level, message),
  };

  let allPassed = true;

  for (const [index, test] of options.tests.entries()) {
    runStore.updateTest(runId, test.id, { status: "running", startedAt: Date.now() });
    runStore.setProgress(runId, { done: index, total, current: test.name });
    log("info", `▶ 测试点 ${index + 1}/${total}：${test.name} · ${TYPE_LABELS[test.type]}`, test.id);

    const startedAt = Date.now();
    let passed: boolean;
    let reason: string | undefined;
    let metrics: Record<string, unknown> | undefined;

    try {
      const outcome = await runTestCase(test, ctx);
      passed = outcome.passed;
      reason = outcome.reason;
      metrics = outcome.metrics;
    } catch (error) {
      passed = false;
      reason = `执行异常：${error instanceof Error ? error.message : String(error)}`;
      log("error", reason, test.id);
    }

    const durationMs = Date.now() - startedAt;
    runStore.updateTest(runId, test.id, {
      status: passed ? "passed" : "failed",
      finishedAt: Date.now(),
      durationMs,
      reason,
      metrics,
    });
    runStore.setProgress(runId, { done: index + 1, total, current: test.name });

    if (passed) {
      log("success", `✔ ${test.name} 通过（${durationMs}ms）`, test.id);
    } else {
      allPassed = false;
      log("error", `✘ ${test.name} 未通过（${durationMs}ms）：${reason ?? "未给出原因"}`, test.id);
    }
  }

  const verdict: Verdict = allPassed ? "AC" : "FAIL";
  log(
    allPassed ? "success" : "error",
    allPassed
      ? `全部 ${total} 个测试点通过 → AC`
      : `存在未通过的测试点 → FAIL`,
  );
  await recordRun(runId, options.problemId, verdict);
  runStore.finish(runId, verdict);
}
