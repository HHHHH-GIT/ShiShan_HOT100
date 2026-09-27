import path from "node:path";

/** 项目根目录（Next dev 与 tsx 脚本均在根目录运行） */
export const ROOT = process.cwd();

/** 题目源目录：相当于「服务器」下发的题目仓库 */
export const PROBLEMS_DIR = path.join(ROOT, "problems");

/** 本地工作区：用户下载并修改题目代码的地方 */
export const WORKSPACE_DIR = path.join(ROOT, "workspace");

/** 工作区状态记录（判题结果 / 是否已 AC） */
export const WORKSPACE_STATE_FILE = path.join(WORKSPACE_DIR, ".state.json");

const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export function assertProblemId(id: string): string {
  if (!ID_PATTERN.test(id)) {
    throw new Error(`非法题目 id：${id}`);
  }
  return id;
}

export function problemDir(id: string): string {
  return path.join(PROBLEMS_DIR, assertProblemId(id));
}

export function workspaceProblemDir(id: string): string {
  return path.join(WORKSPACE_DIR, assertProblemId(id));
}

export function problemDistZip(id: string): string {
  return path.join(problemDir(id), "dist", `${assertProblemId(id)}.zip`);
}

/** 题解文件，仅提供下载，不在页面内展示 */
export function problemSolutionFile(id: string): string {
  return path.join(problemDir(id), "solution.md");
}

/**
 * 题目工作区自带的 README，同时是页面「题目描述」的唯一内容来源，
 * 保证工作区里读到的内容与页面上看到的完全一致。
 */
export function problemReadmeFile(id: string): string {
  return path.join(problemDir(id), "starter", "README.md");
}

/** 「卡住了再看」的提示，独立于 README，不随题目下发 */
export function problemHintsFile(id: string): string {
  return path.join(problemDir(id), "hints.md");
}