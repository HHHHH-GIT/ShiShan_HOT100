import fs from "node:fs/promises";
import path from "node:path";
import AdmZip from "adm-zip";
import { WORKSPACE_DIR, problemDistZip, workspaceProblemDir } from "./paths";
import { ProblemError } from "./problems";
import { clearRecord } from "./state";

export interface WorkspaceResult {
  problemId: string;
  workspacePath: string;
  fileCount: number;
  alreadyExisted: boolean;
  reset: boolean;
  /** 成功替换后未能清理的备份目录 */
  blocked: string[];
  message: string;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.stat(target);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function extractZip(problemId: string, target: string): Promise<number> {
  const zipPath = problemDistZip(problemId);
  if (!(await pathExists(zipPath))) {
    throw new ProblemError(
      `题目包不存在：${path.relative(process.cwd(), zipPath)}。请先执行 npm run pack:problem -- --problem ${problemId}`,
      409,
    );
  }
  try {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    if (!entries.some((entry) => !entry.isDirectory)) throw new Error("题目包为空");
    for (const entry of entries) {
      const relative = path.relative(target, path.resolve(target, entry.entryName));
      if (relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
        throw new Error("题目包包含越界路径");
      }
    }
    // 完整解压并校验条目之后，才能替换工作区。
    zip.extractAllTo(target, true);
    return entries.length;
  } catch (error) {
    throw new ProblemError(`题目包无法解压：${(error as Error).message}。原工作区未修改。`, 409);
  }
}

async function installProblem(problemId: string, force: boolean): Promise<WorkspaceResult> {
  const target = workspaceProblemDir(problemId);
  const existed = await pathExists(target);
  const workspacePath = `workspace/${problemId}`;
  if (existed && !force) {
    return {
      problemId, workspacePath, fileCount: 0, alreadyExisted: true, reset: false, blocked: [],
      message: `本地已存在 ${workspacePath}，为避免覆盖你的修改已跳过解压。如需重新开始请使用「重置题目」。`,
    };
  }

  await fs.mkdir(WORKSPACE_DIR, { recursive: true });
  const staging = await fs.mkdtemp(path.join(WORKSPACE_DIR, `.reset-${problemId}-`));
  const next = path.join(staging, "next");
  const backup = path.join(staging, "previous");
  let backedUp = false;
  let installed = false;
  let preserveBackup = false;
  let fileCount = 0;
  const blocked: string[] = [];
  try {
    await fs.mkdir(next);
    fileCount = await extractZip(problemId, next);
    if (existed) {
      // 同卷重命名失败（例如 Windows 文件占用）时不删除旧文件。
      await fs.rename(target, backup);
      backedUp = true;
    }
    await fs.rename(next, target);
    installed = true;
    await clearRecord(problemId);
  } catch (error) {
    try {
      if (installed) await fs.rename(target, next);
      if (backedUp) await fs.rename(backup, target);
    } catch (rollbackError) {
      preserveBackup = true;
      throw new ProblemError(
        `工作区替换失败且自动恢复失败：${(rollbackError as Error).message}。恢复文件保留在 ${staging}（原文件位于 previous），请停止服务后恢复。`,
        409,
      );
    }
    if (error instanceof ProblemError) throw error;
    throw new ProblemError(`工作区替换失败，原文件已保留：${(error as Error).message}。请先停止服务再重试。`, 409);
  } finally {
    if (!preserveBackup) {
      try {
        await fs.rm(staging, { recursive: true, force: true });
      } catch {
        blocked.push(path.relative(process.cwd(), staging).split(path.sep).join("/"));
      }
    }
  }

  const warning = blocked.length ? ` 备份目录未能清理：${blocked.join("、")}；停止服务后可手动清理。` : "";
  return {
    problemId, workspacePath, fileCount, alreadyExisted: false, reset: existed, blocked,
    message: `${existed ? "已重置" : "已下载到"} ${workspacePath}，共解压 ${fileCount} 个文件。${warning}`,
  };
}

// 同一道题的下载与重置串行，防止两个替换操作交叉移动工作区。
const globalRef = globalThis as unknown as { __shishanWorkspaceJobs?: Map<string, Promise<unknown>> };
const jobs = globalRef.__shishanWorkspaceJobs ?? (globalRef.__shishanWorkspaceJobs = new Map());

export async function downloadProblem(problemId: string, force = false): Promise<WorkspaceResult> {
  workspaceProblemDir(problemId);
  const previous = jobs.get(problemId) ?? Promise.resolve();
  const job = previous.catch(() => undefined).then(() => installProblem(problemId, force));
  jobs.set(problemId, job);
  try {
    return await job;
  } finally {
    if (jobs.get(problemId) === job) jobs.delete(problemId);
  }
}

export async function resetProblem(problemId: string): Promise<WorkspaceResult> {
  return downloadProblem(problemId, true);
}
