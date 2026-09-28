import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { WORKSPACE_DIR, WORKSPACE_STATE_FILE } from "./paths";
import type { Verdict } from "./types";

/** 一次判题的历史记录（用于判题页右下的提交记录列表） */
export interface RunHistoryEntry {
  runId: string;
  verdict: Verdict;
  at: number;
  /** 通过的测试点数 */
  passed: number;
  total: number;
  durationMs: number;
}

export interface ProblemRecord {
  verdict: Verdict;
  ac: boolean;
  lastRunAt: number;
  history: RunHistoryEntry[];
  /** 最近一次判题通过的测试点，仅供服务端控制详情页展示。 */
  passedTestIds: string[];
}

type StateFile = Record<string, Partial<ProblemRecord>>;

const MAX_HISTORY = 30;

export async function readState(): Promise<StateFile> {
  try {
    const raw = await fs.readFile(WORKSPACE_STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as StateFile;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function normalize(record: Partial<ProblemRecord> | undefined): ProblemRecord | null {
  if (!record || !record.verdict) return null;
  return {
    verdict: record.verdict,
    ac: record.ac === true || record.verdict === "AC" ||
      (record.history ?? []).some((entry) => entry.verdict === "AC"),
    lastRunAt: record.lastRunAt ?? 0,
    history: record.history ?? [],
    passedTestIds: record.passedTestIds ?? [],
  };
}

export async function getRecord(problemId: string): Promise<ProblemRecord | null> {
  const state = await readState();
  return normalize(state[problemId]);
}

export async function getHistory(problemId: string): Promise<RunHistoryEntry[]> {
  const record = await getRecord(problemId);
  return record?.history ?? [];
}

async function writeState(state: StateFile): Promise<void> {
  await fs.mkdir(WORKSPACE_DIR, { recursive: true });
  const temporary = `${WORKSPACE_STATE_FILE}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(state, null, 2), "utf8");
    await fs.rename(temporary, WORKSPACE_STATE_FILE);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
  }
}

// 并行判题不能用较早读到的状态覆盖已写入的 AC 或其他题目的记录。
const globalRef = globalThis as unknown as { __shishanStateJob?: Promise<void> };
function updateState(update: (state: StateFile) => void): Promise<void> {
  const job = (globalRef.__shishanStateJob ?? Promise.resolve())
    .catch(() => undefined)
    .then(async () => {
      const state = await readState();
      update(state);
      await writeState(state);
    });
  globalRef.__shishanStateJob = job;
  return job;
}

/** 记录一次判题结果，并追加到提交记录（最新在前） */
export async function saveRun(problemId: string, entry: RunHistoryEntry, passedTestIds: string[] = []): Promise<void> {
  await updateState((state) => {
    const previous = normalize(state[problemId]);
    const history = [entry, ...(previous?.history ?? [])].slice(0, MAX_HISTORY);

    state[problemId] = {
      verdict: entry.verdict,
      ac: previous?.ac === true || entry.verdict === "AC",
      lastRunAt: entry.at,
      history,
      passedTestIds,
    };
  });
}

/** 重新下载 / 重置题目后，之前的判题结果不再对应当前代码，需要清掉 */
export async function clearRecord(problemId: string): Promise<void> {
  await updateState((state) => { delete state[problemId]; });
}
