import type { TestCase, TestType, Verdict } from "../types";

export type LogLevel = "info" | "success" | "warn" | "error" | "debug";
export type TestStatus = "pending" | "running" | "passed" | "failed";
export type RunStatus = "running" | "done";

export interface RunLog {
  seq: number;
  ts: number;
  /** 所属测试点 id；null 表示运行级日志 */
  testId: string | null;
  level: LogLevel;
  message: string;
}

export interface TestResult {
  id: string;
  name: string;
  type: TestType;
  description?: string;
  status: TestStatus;
  startedAt?: number;
  finishedAt?: number;
  durationMs?: number;
  /** 失败原因（期望 vs 实际） */
  reason?: string;
  metrics?: Record<string, unknown>;
}

export interface HeartbeatInfo {
  ok: boolean;
  port: number;
  url: string;
  status: number | null;
  elapsedMs: number;
  reason: string;
  detail: string;
}

export interface RunProgress {
  done: number;
  total: number;
  current: string | null;
}

export interface RunState {
  id: string;
  problemId: string;
  problemTitle: string;
  status: RunStatus;
  verdict: Verdict | null;
  startedAt: number;
  finishedAt?: number;
  heartbeat: HeartbeatInfo | null;
  hint?: string;
  tests: TestResult[];
  progress: RunProgress;
  logs: RunLog[];
}

export type RunEvent =
  | { kind: "snapshot"; state: RunState }
  | { kind: "heartbeat"; heartbeat: HeartbeatInfo; hint: string }
  | { kind: "log"; log: RunLog }
  | { kind: "test"; test: TestResult; progress: RunProgress }
  | { kind: "progress"; progress: RunProgress }
  | { kind: "done"; verdict: Verdict; finishedAt: number };

export interface RunnerContext {
  problemId: string;
  /** 变量表（spec.vars + baseUrl + 运行时提取的变量） */
  vars: Record<string, unknown>;
  /** 有效日志文件绝对路径 */
  logFile: string;
  /** 日志测试点中相对路径的解析基准目录 */
  logBaseDir: string;
  /** 判题开始时日志文件的字节偏移，只断言本次运行新产生的日志 */
  logOffsets: Map<string, number>;
  log: (level: LogLevel, message: string, testId?: string | null) => void;
}

export interface RunOptions {
  problemId: string;
  problemTitle: string;
  tests: TestCase[];
  /** tests.yaml 中的变量声明 */
  specVars?: Record<string, string>;
  baseUrl: string;
  heartbeat: { port: number; path: string };
  /** 题目服务启动命令，用于心跳失败时的引导 */
  startCommand: string;
  workspacePath: string;
  /** 默认日志文件绝对路径 */
  logFile: string;
  /** 日志测试点相对路径的解析基准目录 */
  logBaseDir: string;
}