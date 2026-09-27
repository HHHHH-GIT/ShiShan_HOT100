import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { ZodError } from "zod";
import {
  PROBLEMS_DIR,
  problemDir,
  problemHintsFile,
  problemReadmeFile,
  problemSolutionFile,
  workspaceProblemDir,
} from "./paths";
import { getRecord } from "./state";
import { parseHintLevels, type HintLevel } from "./hints";
import {
  ProblemMetaSchema,
  TestSpecSchema,
  type ProblemMeta,
  type TestSpec,
  type Verdict,
  type WorkspaceStatus,
} from "./types";

export class ProblemError extends Error {
  constructor(
    message: string,
    readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = "ProblemError";
  }
}

export interface ProblemSummary {
  id: string;
  title: string;
  difficulty: ProblemMeta["difficulty"];
  tags: string[];
  summary: string;
  heartbeat: ProblemMeta["heartbeat"];
  status: WorkspaceStatus;
  verdict: Verdict | null;
  lastRunAt: number | null;
  workspacePath: string;
  startCommand: string;
}

export interface ProblemDetail extends ProblemSummary {
  meta: ProblemMeta;
  spec: TestSpec;
  /** 「题目描述」的内容，直接取自工作区里的 README.md */
  readme: string;
  readmeSource: string;
  /** 「卡住了再看」的分级提示，取自题目目录下独立的 hints.md */
  hintLevels: HintLevel[];
  /** 是否存在可下载的题解文件 */
  hasSolution: boolean;
  testCount: number;
}

function formatZodError(file: string, error: ZodError): string {
  const lines = error.issues.map((issue) => {
    const at = issue.path.length ? issue.path.join(".") : "(根)";
    return `  · ${at}: ${issue.message}`;
  });
  return `${file} 校验失败：\n${lines.join("\n")}`;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.stat(target);
    return true;
  } catch {
    return false;
  }
}

async function readIndexIds(): Promise<string[]> {
  const indexPath = path.join(PROBLEMS_DIR, "index.json");
  let raw: string;
  try {
    raw = await fs.readFile(indexPath, "utf8");
  } catch {
    throw new ProblemError(`找不到题目清单：${indexPath}`, 500);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new ProblemError(
      `题目清单 ${indexPath} 不是合法 JSON：${(error as Error).message}`,
      500,
    );
  }
  const problems = (parsed as { problems?: unknown })?.problems;
  if (!Array.isArray(problems) || problems.some((item) => typeof item !== "string")) {
    throw new ProblemError(`${indexPath} 的 problems 字段应为字符串数组`, 500);
  }
  return problems as string[];
}

export async function readMeta(problemId: string): Promise<ProblemMeta> {
  const file = path.join(problemDir(problemId), "meta.json");
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch {
    throw new ProblemError(`题目 ${problemId} 不存在：缺少 meta.json`, 404);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new ProblemError(`meta.json 不是合法 JSON：${(error as Error).message}`, 500);
  }
  const result = ProblemMetaSchema.safeParse(parsed);
  if (!result.success) {
    throw new ProblemError(formatZodError("meta.json", result.error), 500);
  }
  if (result.data.id !== problemId) {
    throw new ProblemError(
      `meta.json 中的 id (${result.data.id}) 与目录名 (${problemId}) 不一致`,
      500,
    );
  }
  return result.data;
}

export async function readSpec(problemId: string): Promise<TestSpec> {
  const file = path.join(problemDir(problemId), "tests.yaml");
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch {
    throw new ProblemError(`题目 ${problemId} 缺少测试规格 tests.yaml`, 404);
  }
  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (error) {
    throw new ProblemError(`tests.yaml 解析失败：${(error as Error).message}`, 500);
  }
  const result = TestSpecSchema.safeParse(parsed);
  if (!result.success) {
    throw new ProblemError(formatZodError("tests.yaml", result.error), 500);
  }
  return result.data;
}

async function readSolution(problemId: string): Promise<string> {
  try {
    return await fs.readFile(problemSolutionFile(problemId), "utf8");
  } catch {
    return "";
  }
}

async function readFileIfExists(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return null;
  }
}

async function toSummary(id: string, meta: ProblemMeta): Promise<ProblemSummary> {
  const wsDir = workspaceProblemDir(id);
  const downloaded = await pathExists(wsDir);
  const record = await getRecord(id);
  let status: WorkspaceStatus = "not_downloaded";
  if (downloaded) {
    status = record?.ac ? "ac" : "downloaded";
  }
  return {
    id,
    title: meta.title,
    difficulty: meta.difficulty,
    tags: meta.tags,
    summary: meta.summary,
    heartbeat: meta.heartbeat,
    status,
    verdict: record?.verdict ?? null,
    lastRunAt: record?.lastRunAt ?? null,
    workspacePath: path.relative(process.cwd(), wsDir).split(path.sep).join("/"),
    startCommand: meta.startCommand,
  };
}

export async function listProblems(): Promise<ProblemSummary[]> {
  const ids = await readIndexIds();
  const summaries: ProblemSummary[] = [];
  for (const id of ids) {
    try {
      const meta = await readMeta(id);
      summaries.push(await toSummary(id, meta));
    } catch (error) {
      // 单题损坏不应让整个题库不可用，记录为占位条目
      summaries.push({
        id,
        title: `（题目 ${id} 加载失败）`,
        difficulty: "newbie",
        tags: [],
        summary: (error as Error).message,
        heartbeat: { port: 0, path: "/hello" },
        status: "not_downloaded",
        verdict: null,
        lastRunAt: null,
        workspacePath: `workspace/${id}`,
        startCommand: "",
      });
    }
  }
  return summaries;
}

export async function getProblem(problemId: string): Promise<ProblemDetail> {
  const meta = await readMeta(problemId);
  const spec = await readSpec(problemId);
  const summary = await toSummary(problemId, meta);

  const readmeFile = problemReadmeFile(problemId);
  const hintsFile = problemHintsFile(problemId);
  const hintsSource = await readFileIfExists(hintsFile);

  return {
    ...summary,
    meta,
    spec,
    readme: (await readFileIfExists(readmeFile)) ?? "",
    readmeSource: path.relative(process.cwd(), readmeFile).split(path.sep).join("/"),
    hintLevels: parseHintLevels(hintsSource ?? ""),
    hasSolution: (await readSolution(problemId)).length > 0,
    testCount: spec.tests.length,
  };
}