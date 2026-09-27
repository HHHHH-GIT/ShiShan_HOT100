import type { Verdict } from "../types";
import type {
  LogLevel,
  RunEvent,
  RunLog,
  RunProgress,
  RunState,
  TestResult,
} from "./types";

const MAX_RUNS = 20;
const MAX_LOGS_PER_RUN = 4000;

type Listener = (event: RunEvent) => void;

class RunStore {
  private runs = new Map<string, RunState>();
  private listeners = new Map<string, Set<Listener>>();
  private seq = 0;

  createRun(problemId: string, problemTitle: string, tests: TestResult[]): RunState {
    this.prune();

    const run: RunState = {
      id: `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      problemId,
      problemTitle,
      status: "running",
      verdict: null,
      startedAt: Date.now(),
      heartbeat: null,
      tests,
      progress: { done: 0, total: tests.length, current: null },
      logs: [],
    };
    this.runs.set(run.id, run);
    return run;
  }

  get(id: string): RunState | undefined {
    return this.runs.get(id);
  }

  private prune(): void {
    if (this.runs.size < MAX_RUNS) return;
    const sorted = [...this.runs.values()].sort((a, b) => a.startedAt - b.startedAt);
    for (const run of sorted.slice(0, this.runs.size - MAX_RUNS + 1)) {
      this.runs.delete(run.id);
      this.listeners.delete(run.id);
    }
  }

  private emit(id: string, event: RunEvent): void {
    const set = this.listeners.get(id);
    if (!set) return;
    for (const listener of set) {
      try {
        listener(event);
      } catch (error) {
        console.error("[runner] SSE 监听器异常：", error);
      }
    }
  }

  subscribe(id: string, listener: Listener): () => void {
    let set = this.listeners.get(id);
    if (!set) {
      set = new Set();
      this.listeners.set(id, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
    };
  }

  /** 订阅时先把已有日志回放给新连接，保证刷新页面不丢日志 */
  replay(id: string, listener: Listener): void {
    const run = this.runs.get(id);
    if (!run) return;
    listener({ kind: "snapshot", state: run });
  }

  appendLog(
    id: string,
    testId: string | null,
    level: LogLevel,
    message: string,
  ): void {
    const run = this.runs.get(id);
    if (!run) return;
    this.seq += 1;
    const log: RunLog = { seq: this.seq, ts: Date.now(), testId, level, message };
    run.logs.push(log);
    if (run.logs.length > MAX_LOGS_PER_RUN) {
      run.logs.splice(0, run.logs.length - MAX_LOGS_PER_RUN);
    }
    this.emit(id, { kind: "log", log });
  }

  setHeartbeat(id: string, heartbeat: RunState["heartbeat"], hint: string): void {
    const run = this.runs.get(id);
    if (!run || !heartbeat) return;
    run.heartbeat = heartbeat;
    run.hint = hint;
    this.emit(id, { kind: "heartbeat", heartbeat, hint });
  }

  updateTest(id: string, testId: string, patch: Partial<TestResult>): void {
    const run = this.runs.get(id);
    if (!run) return;
    const index = run.tests.findIndex((test) => test.id === testId);
    if (index < 0) return;
    run.tests[index] = { ...run.tests[index], ...patch };
    this.emit(id, { kind: "test", test: run.tests[index], progress: run.progress });
  }

  setProgress(id: string, progress: RunProgress): void {
    const run = this.runs.get(id);
    if (!run) return;
    run.progress = progress;
    this.emit(id, { kind: "progress", progress });
  }

  finish(id: string, verdict: Verdict): void {
    const run = this.runs.get(id);
    if (!run) return;
    run.status = "done";
    run.verdict = verdict;
    run.finishedAt = Date.now();
    run.progress = { ...run.progress, current: null };
    this.emit(id, { kind: "done", verdict, finishedAt: run.finishedAt });
  }
}

const globalRef = globalThis as unknown as { __shishanRunStore?: RunStore };

export const runStore: RunStore =
  globalRef.__shishanRunStore ?? (globalRef.__shishanRunStore = new RunStore());