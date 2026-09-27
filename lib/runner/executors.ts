import fs from "node:fs/promises";
import path from "node:path";
import type {
  HttpTest,
  LoadTest,
  LogTest,
  TestCase,
  WorkflowStep,
  WorkflowTest,
} from "../types";
import { describeRequest, evaluateExpect, sendRequest, type SendResult } from "./request";
import { interpolate, percentile, pickWeighted, preview, resolvePath } from "./values";
import type { RunnerContext } from "./types";

export interface ExecOutcome {
  passed: boolean;
  reason?: string;
  metrics?: Record<string, unknown>;
}

function describeResult(result: SendResult): string {
  if (!result.ok) return `请求失败 ${result.elapsedMs}ms（${result.error}）`;
  return `HTTP ${result.status} ${result.elapsedMs}ms body=${preview(result.body, 200)}`;
}

function isSuccess(result: { ok: boolean; status: number | null }): boolean {
  return result.ok && result.status !== null && result.status >= 200 && result.status < 300;
}

function isRecordSuccess(record: LoadRecord): boolean {
  return record.status !== null && record.status >= 200 && record.status < 300 && !record.error;
}

/* ------------------------------------------------------------------ */
/* http：单请求断言                                                     */
/* ------------------------------------------------------------------ */

async function execHttp(test: HttpTest, ctx: RunnerContext): Promise<ExecOutcome> {
  ctx.log("info", `→ ${describeRequest(test.request, ctx.vars)}`, test.id);
  const result = await sendRequest(test.request, ctx.vars);
  ctx.log(result.ok ? "debug" : "error", `← ${describeResult(result)}`, test.id);

  const failures = evaluateExpect(interpolate(test.expect, ctx.vars), result);
  if (failures.length > 0) {
    failures.forEach((failure) => ctx.log("error", failure, test.id));
    return {
      passed: false,
      reason: failures.join("；"),
      metrics: { status: result.status, elapsedMs: result.elapsedMs },
    };
  }

  ctx.log("success", `断言通过（HTTP ${result.status}，${result.elapsedMs}ms）`, test.id);
  return { passed: true, metrics: { status: result.status, elapsedMs: result.elapsedMs } };
}

/* ------------------------------------------------------------------ */
/* workflow：多步串联 + extract                                        */
/* ------------------------------------------------------------------ */

async function runStep(
  step: WorkflowStep,
  ctx: RunnerContext,
  testId: string,
  label: string,
): Promise<{ failures: string[]; result: SendResult }> {
  ctx.log("info", `${label} → ${describeRequest(step.request, ctx.vars)}`, testId);
  const result = await sendRequest(step.request, ctx.vars);
  ctx.log(result.ok ? "debug" : "error", `${label} ← ${describeResult(result)}`, testId);

  if (step.extract) {
    for (const [name, expression] of Object.entries(step.extract)) {
      const value = resolvePath(result.json, expression);
      ctx.vars[name] = value;
      ctx.log("debug", `${label} 提取变量 ${name} = ${preview(value, 160)}`, testId);
    }
  }

  return { failures: [], result };
}

async function execWorkflow(test: WorkflowTest, ctx: RunnerContext): Promise<ExecOutcome> {
  const failures: string[] = [];
  const total = test.steps.length;

  for (let index = 0; index < total; index += 1) {
    const step = test.steps[index];
    const label = `[${index + 1}/${total}] ${step.name ?? step.id}`;
    const isLast = index === total - 1;
    const { result } = await runStep(step, ctx, test.id, label);

    const expect = {
      ...(step.expect ?? {}),
      ...((isLast ? test.expect : undefined) ?? {}),
    };
    const stepFailures =
      Object.keys(expect).length > 0
        ? evaluateExpect(interpolate(expect, ctx.vars), result)
        : result.ok
          ? []
          : [`请求失败：${result.error ?? "未知错误"}`];

    if (stepFailures.length > 0) {
      stepFailures.forEach((failure) =>
        ctx.log("error", `步骤「${step.name ?? step.id}」断言失败：${failure}`, test.id),
      );
      failures.push(`步骤「${step.name ?? step.id}」：${stepFailures.join("；")}`);
      if (!step.continueOnFail) break;
    } else {
      ctx.log("success", `步骤「${step.name ?? step.id}」通过`, test.id);
    }
  }

  return failures.length > 0 ? { passed: false, reason: failures.join("\n") } : { passed: true };
}

/* ------------------------------------------------------------------ */
/* load：并发压测                                                       */
/* ------------------------------------------------------------------ */

interface LoadRecord {
  scenario: string;
  status: number | null;
  elapsedMs: number;
  body: string;
  error?: string;
}

async function execLoad(test: LoadTest, ctx: RunnerContext): Promise<ExecOutcome> {
  // 1) 预置数据
  for (const [index, step] of (test.pre ?? []).entries()) {
    const label = `[pre ${index + 1}] ${step.name ?? step.id}`;
    const { result } = await runStep(step, ctx, test.id, label);
    const failures = step.expect
      ? evaluateExpect(interpolate(step.expect, ctx.vars), result)
      : isSuccess(result)
        ? []
        : [`请求失败：${result.error}`];
    if (failures.length > 0) {
      const reason = `压测前置步骤「${step.name ?? step.id}」失败：${failures.join("；")}`;
      ctx.log("error", reason, test.id);
      return { passed: false, reason };
    }
  }

  // 2) 并发压测
  const weights = test.scenarios.map((scenario) => scenario.weight);
  const total = test.concurrency * test.rounds;
  const notifyEvery = Math.max(1, Math.floor(total / 8));
  const records: LoadRecord[] = [];
  let finished = 0;
  let loggedSamples = 0;

  const statusCounts = () => {
    const counts: Record<string, number> = {};
    for (const record of records) {
      const key = record.status === null ? (record.error ?? "无响应") : String(record.status);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  };

  ctx.log(
    "info",
    `开始压测：并发 ${test.concurrency} × 轮次 ${test.rounds} = ${total} 次请求；场景 ${test.scenarios
      .map((scenario, index) => `${scenario.name ?? `场景${index + 1}`}(权重 ${scenario.weight})`)
      .join("、")}`,
    test.id,
  );

  const worker = async (workerIndex: number): Promise<void> => {
    for (let round = 0; round < test.rounds; round += 1) {
      const iteration = workerIndex * test.rounds + round;
      const scenarioIndex = pickWeighted(weights, iteration);
      const scenario = test.scenarios[scenarioIndex];
      const scenarioName = scenario.name ?? `场景${scenarioIndex + 1}`;

      const result = await sendRequest(scenario.request, ctx.vars);
      records.push({
        scenario: scenarioName,
        status: result.status,
        elapsedMs: result.elapsedMs,
        body: result.body,
        error: result.error,
      });

      if (!isSuccess(result) && loggedSamples < 5) {
        loggedSamples += 1;
        ctx.log(
          "warn",
          `失败样本 #${loggedSamples}：${scenarioName} → HTTP ${result.status ?? "-"} ${result.elapsedMs}ms ${
            result.error ?? preview(result.body, 180)
          }`,
          test.id,
        );
      }

      finished += 1;
      if (finished % notifyEvery === 0) {
        const okCount = records.filter(isRecordSuccess).length;
        ctx.log("info", `压测进度 ${finished}/${total}，成功 ${okCount}`, test.id);
      }
    }
  };

  await Promise.all(Array.from({ length: test.concurrency }, (_, index) => worker(index)));

  // 3) 统计
  const okCount = records.filter(isRecordSuccess).length;
  const successRate = records.length > 0 ? okCount / records.length : 0;
  const sorted = records.map((record) => record.elapsedMs).sort((a, b) => a - b);
  const p50 = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);
  const maxElapsed = sorted.length > 0 ? sorted[sorted.length - 1] : 0;

  ctx.log(
    "info",
    `压测完成：成功 ${okCount}/${records.length}（${(successRate * 100).toFixed(1)}%），P50 ${p50}ms / P95 ${p95}ms / P99 ${p99}ms / 最慢 ${maxElapsed}ms`,
    test.id,
  );

  const counts = statusCounts();
  ctx.log(
    "info",
    `状态码分布：${Object.entries(counts)
      .map(([key, value]) => `${key}×${value}`)
      .join("，")}`,
    test.id,
  );

  // 4) 断言
  const expect = test.expect;
  const failures: string[] = [];

  if (expect.minSuccessRate !== undefined && successRate < expect.minSuccessRate) {
    failures.push(
      `期望成功率 ≥ ${(expect.minSuccessRate * 100).toFixed(1)}%，实际 ${(successRate * 100).toFixed(1)}%（失败 ${records.length - okCount} 次）`,
    );
  }
  if (expect.maxP95Ms !== undefined && p95 > expect.maxP95Ms) {
    failures.push(`期望 P95 ≤ ${expect.maxP95Ms}ms，实际 ${p95}ms`);
  }
  if (expect.maxMs !== undefined && maxElapsed > expect.maxMs) {
    failures.push(`期望单请求耗时 ≤ ${expect.maxMs}ms，实际最慢 ${maxElapsed}ms`);
  }

  const forbiddenStatus = new Set(expect.forbidStatus ?? []);
  for (const status of forbiddenStatus) {
    const hits = records.filter((record) => record.status === status);
    if (hits.length > 0) {
      failures.push(`不应出现 HTTP ${status}，实际出现 ${hits.length} 次（示例：${preview(hits[0].body, 200)}）`);
    }
  }

  for (const fragment of expect.forbidBodyContains ?? []) {
    const hits = records.filter((record) => record.body.includes(fragment));
    if (hits.length > 0) {
      failures.push(
        `响应中不应出现 ${preview(fragment, 80)}，实际出现 ${hits.length} 次（示例：${preview(hits[0].body, 200)}）`,
      );
    }
  }

  const representative = new Map<string, LoadRecord>();
  for (const record of records) {
    const key = record.status === null ? (record.error ?? "无响应") : String(record.status);
    if (!representative.has(key)) representative.set(key, record);
  }
  for (const [key, record] of representative) {
    ctx.log(
      "debug",
      `响应样本 HTTP ${key}（${record.scenario}，${record.elapsedMs}ms）：${preview(record.body, 240)}`,
      test.id,
    );
  }

  const metrics = {
    总请求: records.length,
    成功: okCount,
    成功率: `${(successRate * 100).toFixed(1)}%`,
    P50: `${p50}ms`,
    P95: `${p95}ms`,
    P99: `${p99}ms`,
    最慢: `${maxElapsed}ms`,
    状态码分布: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v])),
  };

  if (failures.length > 0) {
    failures.forEach((failure) => ctx.log("error", failure, test.id));
    return { passed: false, reason: failures.join("；"), metrics };
  }

  ctx.log("success", "并发压测通过：无超时、无降级响应", test.id);
  return { passed: true, metrics };
}

/* ------------------------------------------------------------------ */
/* log：日志 / 资源侧断言                                               */
/* ------------------------------------------------------------------ */

function compileMatcher(pattern: string): (line: string) => boolean {
  try {
    const regex = new RegExp(pattern);
    return (line: string) => regex.test(line);
  } catch {
    return (line: string) => line.includes(pattern);
  }
}

async function execLog(test: LogTest, ctx: RunnerContext): Promise<ExecOutcome> {
  const file = test.path ? path.resolve(ctx.logBaseDir, test.path) : ctx.logFile;
  ctx.log("info", `读取日志：${file}`, test.id);

  let raw: Buffer;
  try {
    raw = await fs.readFile(file);
  } catch {
    const reason = `日志文件不存在或不可读：${file}`;
    ctx.log("error", reason, test.id);
    return { passed: false, reason };
  }

  const offset = ctx.logOffsets.get(file) ?? 0;
  const appended = raw.subarray(Math.min(offset, raw.length)).toString("utf8");
  const lines = appended.split(/\r?\n/).filter((line) => line.trim().length > 0);
  ctx.log(
    "info",
    `本次运行新增日志 ${lines.length} 行（自偏移 ${Math.min(offset, raw.length)} 起）`,
    test.id,
  );

  const failures: string[] = [];

  for (const pattern of test.match ?? []) {
    const matcher = compileMatcher(pattern);
    if (!lines.some(matcher)) {
      failures.push(`日志中应出现 ${preview(pattern, 80)}，但未找到`);
    }
  }

  for (const pattern of test.notMatch ?? []) {
    const matcher = compileMatcher(pattern);
    const hits = lines.filter(matcher);
    if (hits.length > 0) {
      failures.push(
        `日志中不应出现 ${preview(pattern, 80)}，实际出现 ${hits.length} 行（示例：${preview(hits[0], 240)}）`,
      );
    }
  }

  if (failures.length > 0) {
    failures.forEach((failure) => ctx.log("error", failure, test.id));
    return { passed: false, reason: failures.join("；"), metrics: { 日志行数: lines.length } };
  }

  ctx.log("success", "日志断言通过（没有出现被禁止的内容）", test.id);
  return { passed: true, metrics: { 日志行数: lines.length } };
}

/* ------------------------------------------------------------------ */

export async function runTestCase(
  test: TestCase,
  ctx: RunnerContext,
): Promise<ExecOutcome> {
  switch (test.type) {
    case "http":
      return execHttp(test, ctx);
    case "workflow":
      return execWorkflow(test, ctx);
    case "load":
      return execLoad(test, ctx);
    case "log":
      return execLog(test, ctx);
    default: {
      const exhaustive: never = test;
      return { passed: false, reason: `未知测试点类型：${String(exhaustive)}` };
    }
  }
}