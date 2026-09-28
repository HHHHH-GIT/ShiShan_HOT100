import { z } from "zod";

/* ------------------------------------------------------------------ */
/* 题目元信息 meta.json                                                */
/* ------------------------------------------------------------------ */

export const HeartbeatSchema = z.object({
  port: z.number().int().positive(),
  path: z.string().min(1),
});

/** 难度段位，由易到难，配色见 lib/difficulty.ts */
export const DifficultySchema = z.enum([
  "newbie",
  "pupil",
  "specialist",
  "expert",
  "candidate_master",
  "master",
  "international_master",
  "grandmaster",
  "international_grandmaster",
  "legendary_grandmaster",
]);

export const ProblemMetaSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  difficulty: DifficultySchema,
  tags: z.array(z.string()).default([]),
  summary: z.string().default(""),
  /**
   * 需要跑通的 API 与预期效果（markdown）。
   * 注意：题面正文不放在 meta 里 —— 页面上的「题目描述」直接读工作区的 README.md，
   * 保证用户在工作区里读到的和页面上看到的永远是同一份。
   */
  apiContract: z.string().default(""),
  heartbeat: HeartbeatSchema,
  /** 服务日志路径，相对题目工作区目录 */
  logPath: z.string().min(1),
  /** 题目 zip 相对题目目录的路径 */
  dist: z.string().min(1),
  /** 心跳失败时展示给用户的启动命令 */
  startCommand: z.string().default(""),
});

/* ------------------------------------------------------------------ */
/* 测试规格 tests.yaml                                                 */
/* ------------------------------------------------------------------ */

export const HttpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export const RequestSchema = z.object({
  method: HttpMethodSchema.default("GET"),
  url: z.string().min(1),
  headers: z.record(z.string(), z.string()).optional(),
  json: z.unknown().optional(),
  body: z.string().optional(),
  timeoutMs: z.number().int().positive().optional(),
});

export const ExpectSchema = z.object({
  /** 原始响应字节的 SHA-256，用于二进制完整性校验 */
  bodySha256: z.string().regex(/^[a-fA-F0-9]{64}$/).optional(),
  /** 期望 HTTP 状态码 */
  status: z.number().int().optional(),
  /** 期望响应 JSON 为「子集匹配」（支持嵌套对象） */
  json: z.record(z.string(), z.unknown()).optional(),
  /** 响应原文需包含的片段 */
  contains: z.array(z.string()).optional(),
  /** 响应原文不得包含的片段 */
  notContains: z.array(z.string()).optional(),
  /** 响应耗时上限（毫秒） */
  maxMs: z.number().int().positive().optional(),
});

export const StepSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  request: RequestSchema,
  /** 从响应中提取变量供后续步骤 / 压测使用，值为 JSONPath（如 $.data.orderId） */
  extract: z.record(z.string(), z.string()).optional(),
  expect: ExpectSchema.optional(),
  /** 为 true 时该步失败不中断后续步骤 */
  continueOnFail: z.boolean().optional(),
});

const baseFields = {
  id: z.string().min(1),
  /** 判题页/日志里用的完整名称（可以带根因关键词） */
  name: z.string().min(1),
  /**
   * 保留的中性展示名称；未通过的测试点当前只展示序号，
   * 所以不能泄露根因（例如不能出现「死锁」「脏缓存」「单位换算」）。
   */
  displayName: z.string().min(1).optional(),
  /** 展示在题目详情页/判题页的用例说明 */
  description: z.string().optional(),
};

export const HttpTestSchema = z.object({
  ...baseFields,
  type: z.literal("http"),
  request: RequestSchema,
  expect: ExpectSchema,
});

export const WorkflowTestSchema = z.object({
  ...baseFields,
  type: z.literal("workflow"),
  steps: z.array(StepSchema).min(1),
  /** 可选：额外作用于最后一步的断言 */
  expect: ExpectSchema.optional(),
});

export const LoadScenarioSchema = z.object({
  name: z.string().optional(),
  weight: z.number().positive().default(1),
  request: RequestSchema,
});

export const LoadExpectSchema = z.object({
  /** 期望最低成功率（0~1） */
  minSuccessRate: z.number().min(0).max(1).optional(),
  /** P95 耗时上限（毫秒） */
  maxP95Ms: z.number().int().positive().optional(),
  /** 单请求耗时上限（毫秒） */
  maxMs: z.number().int().positive().optional(),
  /** 禁止出现的状态码 */
  forbidStatus: z.array(z.number().int()).optional(),
  /** 禁止出现的响应体片段 */
  forbidBodyContains: z.array(z.string()).optional(),
});

export const LoadTestSchema = z.object({
  ...baseFields,
  type: z.literal("load"),
  /** 压测前置步骤：用于预置数据并提取变量 */
  pre: z.array(StepSchema).optional(),
  concurrency: z.number().int().positive(),
  rounds: z.number().int().positive(),
  scenarios: z.array(LoadScenarioSchema).min(1),
  expect: LoadExpectSchema,
});

export const LogTestSchema = z.object({
  ...baseFields,
  type: z.literal("log"),
  /** 覆盖 meta.logPath */
  path: z.string().optional(),
  /** 必须出现的片段（正则或纯文本） */
  match: z.array(z.string()).optional(),
  /** 不得出现的片段（正则或纯文本） */
  notMatch: z.array(z.string()).optional(),
});

export const TestCaseSchema = z.discriminatedUnion("type", [
  HttpTestSchema,
  WorkflowTestSchema,
  LoadTestSchema,
  LogTestSchema,
]);

export const TestSpecSchema = z.object({
  version: z.literal(1),
  baseUrl: z.string().min(1),
  vars: z.record(z.string(), z.string()).optional(),
  tests: z.array(TestCaseSchema).min(1),
});

/* ------------------------------------------------------------------ */
/* 推导类型                                                            */
/* ------------------------------------------------------------------ */

export type Heartbeat = z.infer<typeof HeartbeatSchema>;
export type ProblemMeta = z.infer<typeof ProblemMetaSchema>;
export type HttpRequest = z.infer<typeof RequestSchema>;
export type HttpExpect = z.infer<typeof ExpectSchema>;
export type WorkflowStep = z.infer<typeof StepSchema>;
export type HttpTest = z.infer<typeof HttpTestSchema>;
export type WorkflowTest = z.infer<typeof WorkflowTestSchema>;
export type LoadScenario = z.infer<typeof LoadScenarioSchema>;
export type LoadExpect = z.infer<typeof LoadExpectSchema>;
export type LoadTest = z.infer<typeof LoadTestSchema>;
export type LogTest = z.infer<typeof LogTestSchema>;
export type TestCase = z.infer<typeof TestCaseSchema>;
export type TestSpec = z.infer<typeof TestSpecSchema>;

export type TestType = TestCase["type"];
export type Verdict = "AC" | "FAIL" | "heartbeat_failed";
export type WorkspaceStatus = "not_downloaded" | "downloaded" | "ac";
export type Difficulty = z.infer<typeof DifficultySchema>;
