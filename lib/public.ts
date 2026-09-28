import type { ProblemDetail } from "./problems";
import type { RunEvent, RunLog, RunProgress, RunState, TestResult } from "./runner/types";

/** 在服务端输出边界隐藏测试规格，不能只依赖页面折叠。 */
export function publicProblem(problem: ProblemDetail, passedTestIds: readonly string[] = []) {
  const passed = new Set(passedTestIds);
  return {
    ...problem,
    spec: {
      tests: problem.spec.tests.map((test, index) => passed.has(test.id) ? { ...test, id: `test-${index + 1}` } : ({
        id: `test-${index + 1}`,
        name: `测试点 ${index + 1}`,
        type: test.type,
      })),
    },
  };
}

function publicTest(test: TestResult, run: RunState): TestResult {
  const index = run.tests.findIndex((item) => item.id === test.id) + 1;
  if (test.status === "passed") return { ...test, id: `test-${index}` };
  return {
    id: `test-${index}`,
    name: `测试点 ${index}`,
    type: test.type,
    status: test.status,
    startedAt: test.startedAt,
    finishedAt: test.finishedAt,
    durationMs: test.durationMs,
    reason: test.status === "failed" ? "检查未通过；通过此测试点后解锁详细结果与日志。" : undefined,
  };
}

function publicProgress(progress: RunProgress): RunProgress {
  return { ...progress, current: progress.current === null ? null : "正在执行测试" };
}

function publicLog(log: RunLog, run: RunState): RunLog {
  const index = run.tests.findIndex((test) => test.id === log.testId) + 1;
  if (index > 0 && run.tests[index - 1].status === "passed") {
    return { ...log, testId: `test-${index}` };
  }
  const prefix = log.testId === null ? "判题" : `测试点 ${index}`;
  const labels = { info: "执行中", debug: "执行中", success: "检查通过", warn: "检查提示", error: "检查未通过" };
  return {
    ...log,
    testId: log.testId === null ? null : `test-${index}`,
    message: log.testId === null
      ? `${prefix}：${labels[log.level]}`
      : `${prefix}：${labels[log.level]}（通过此测试点后解锁详细日志）`,
  };
}

export function publicRun(run: RunState): RunState {
  return {
    ...run,
    tests: run.tests.map((test) => publicTest(test, run)),
    progress: publicProgress(run.progress),
    logs: run.logs.map((log) => publicLog(log, run)),
  };
}

/** SSE 的实时事件与重连快照必须采用同一套过滤规则。 */
export function publicRunEvent(event: RunEvent, run: RunState): RunEvent {
  switch (event.kind) {
    case "snapshot": return { ...event, state: publicRun(event.state) };
    case "test": return { ...event, test: publicTest(event.test, run), progress: publicProgress(event.progress) };
    case "progress": return { ...event, progress: publicProgress(event.progress) };
    case "log": return { ...event, log: publicLog(event.log, run) };
    default: return event;
  }
}
