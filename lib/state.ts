import fs from "node:fs/promises";
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
    ac: record.ac ?? record.verdict === "AC",
    lastRunAt: record.lastRunAt ?? 0,
    history: record.history ?? [],
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
  await fs.writeFile(WORKSPACE_STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

/** 记录一次判题结果，并追加到提交记录（最新在前） */
export async function saveRun(problemId: string, entry: RunHistoryEntry): Promise<void> {
  const state = await readState();
  const previous = normalize(state[problemId]);
  const history = [entry, ...(previous?.history ?? [])].slice(0, MAX_HISTORY);

  state[problemId] = {
    verdict: entry.verdict,
    ac: entry.verdict === "AC",
    lastRunAt: entry.at,
    history,
  };
  await writeState(state);
}

/** 重新下载 / 重置题目后，之前的判题结果不再对应当前代码，需要清掉 */
export async function clearRecord(problemId: string): Promise<void> {
  const state = await readState();
  if (!(problemId in state)) return;
  delete state[problemId];
  await writeState(state);
}