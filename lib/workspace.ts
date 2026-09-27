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
  /** 已存在且未覆盖 */
  alreadyExisted: boolean;
  /** 本次是否执行了重置（清空后重新解压） */
  reset: boolean;
  /** 重置时被占用、没能删掉的残留项（通常是 logs / target） */
  blocked: string[];
  message: string;
}

const REMOVE_RETRIES = 3;
const REMOVE_RETRY_DELAY_MS = 200;

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.stat(target);
    return true;
  } catch {
    return false;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 清空工作区目录，返回没能删掉的顶层项。
 *
 * Windows 上正在运行的服务会占住 logs/ 与 target/，整目录删除会中途失败 ——
 * 那种情况下退化成逐个删除，把删不掉的记下来但不阻断后续解压：
 * 解压本身是覆盖写，源码一定是最新的。
 */
async function clearWorkspace(target: string): Promise<string[]> {
  for (let attempt = 1; attempt <= REMOVE_RETRIES; attempt += 1) {
    try {
      await fs.rm(target, { recursive: true, force: true });
      return [];
    } catch {
      if (attempt < REMOVE_RETRIES) await delay(REMOVE_RETRY_DELAY_MS * attempt);
    }
  }

  let entries: string[];
  try {
    entries = await fs.readdir(target);
  } catch {
    return [];
  }

  const blocked: string[] = [];
  for (const entry of entries) {
    try {
      await fs.rm(path.join(target, entry), { recursive: true, force: true });
    } catch {
      blocked.push(entry);
    }
  }
  return blocked;
}

async function extractZip(problemId: string): Promise<number> {
  const zipPath = problemDistZip(problemId);
  if (!(await pathExists(zipPath))) {
    throw new ProblemError(
      `题目包不存在：${path.relative(process.cwd(), zipPath)}。请先执行 npm run pack:problem -- --problem ${problemId}`,
      409,
    );
  }

  let zip: AdmZip;
  try {
    zip = new AdmZip(zipPath);
  } catch (error) {
    throw new ProblemError(`题目包无法读取：${(error as Error).message}`, 500);
  }

  const target = workspaceProblemDir(problemId);
  await fs.mkdir(target, { recursive: true });
  try {
    zip.extractAllTo(target, true);
  } catch (error) {
    throw new ProblemError(
      `题目解压失败：${(error as Error).message}。如果服务正在运行，请先停止它再重试。`,
      409,
    );
  }
  return zip.getEntries().length;
}

/**
 * 下载题目：解压到工作区。
 * 默认不覆盖已有改动；force 为 true 时等价于重置。
 */
export async function downloadProblem(
  problemId: string,
  force = false,
): Promise<WorkspaceResult> {
  const target = workspaceProblemDir(problemId);
  const existed = await pathExists(target);
  const rel = path.relative(WORKSPACE_DIR, target).split(path.sep).join("/");

  if (existed && !force) {
    return {
      problemId,
      workspacePath: `workspace/${rel}`,
      fileCount: 0,
      alreadyExisted: true,
      reset: false,
      blocked: [],
      message: `本地已存在 workspace/${rel}，为避免覆盖你的修改已跳过解压。如需重新开始请使用「重置题目」。`,
    };
  }

  const blocked = existed ? await clearWorkspace(target) : [];
  const fileCount = await extractZip(problemId);
  // 代码已换成全新一份，之前的判题结果作废
  await clearRecord(problemId);

  const warning =
    blocked.length > 0
      ? `（${blocked.join("、")} 被占用没能删除，通常是服务还在运行；源码已是最新，停掉服务后可以再重置一次清干净）`
      : "";

  return {
    problemId,
    workspacePath: `workspace/${rel}`,
    fileCount,
    alreadyExisted: false,
    reset: existed,
    blocked,
    message: existed
      ? `已重置 workspace/${rel}，重新解压 ${fileCount} 个文件。${warning}`
      : `已下载到 workspace/${rel}，共解压 ${fileCount} 个文件。`,
  };
}

/** 重置题目：清空工作区目录后重新解压 */
export async function resetProblem(problemId: string): Promise<WorkspaceResult> {
  return downloadProblem(problemId, true);
}