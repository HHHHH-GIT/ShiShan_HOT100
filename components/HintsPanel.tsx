"use client";

import { useCallback, useEffect, useState } from "react";
import { Markdown } from "@/components/Markdown";
import type { HintLevel } from "@/lib/hints";

/** localStorage 里记录「这道题已经解锁到第几级提示」 */
export function hintStorageKey(problemId: string): string {
  return `shishan:hints:${problemId}`;
}

const LEVEL_LABEL: Record<number, string> = {
  1: "方向",
  2: "判据",
  3: "手法",
};

interface Props {
  problemId: string;
  levels: HintLevel[];
  /** 已 AC 的题目不再设卡 */
  solved: boolean;
}

export function HintsPanel({ problemId, levels, solved }: Props) {
  // 已解锁的最高层级；0 表示还没点开过任何一级
  const [unlocked, setUnlocked] = useState(0);

  useEffect(() => {
    if (solved) return;
    try {
      const raw = window.localStorage.getItem(hintStorageKey(problemId));
      const value = raw ? Number(raw) : 0;
      if (Number.isFinite(value) && value > 0) setUnlocked(value);
    } catch {
      /* 隐私模式下 localStorage 不可用，静默降级为「未解锁」 */
    }
  }, [problemId, solved]);

  const unlock = useCallback(
    (level: number) => {
      try {
        const raw = window.localStorage.getItem(hintStorageKey(problemId));
        const current = raw ? Number(raw) : 0;
        if (!Number.isFinite(current) || level > current) {
          window.localStorage.setItem(hintStorageKey(problemId), String(level));
        }
      } catch {
        /* 忽略 */
      }
      setUnlocked((previous) => Math.max(previous, level));
    },
    [problemId],
  );

  if (levels.length === 0) return null;

  return (
    <details className="card animate-fade-up p-5" open={false}>
      <summary className="cursor-pointer select-none font-serif text-base text-ink">
        卡住了再看
        <span className="ml-2 text-xs font-normal text-muted">
          （{levels.length} 级提示，逐级解锁；提示不在题面里，避免剧透）
        </span>
      </summary>

      <div className="mt-4 space-y-3 border-t border-line pt-4">
        <p className="text-[11px] leading-relaxed text-muted">
          先自己定位。真卡住了再往下点 —— 用过的层级会记在本地，判题结果会标注出来。
        </p>

        {levels.map((item, index) => {
          const isNext = item.level <= unlocked + 1;
          const canOpen = solved || isNext;

          if (!canOpen) {
            return (
              <div
                key={item.level}
                className="rounded-xl border border-dashed border-line-strong bg-paper-2 px-4 py-3"
              >
                <p className="text-sm text-muted">
                  L{item.level}
                  {item.title ? ` · ${item.title}` : ` · ${LEVEL_LABEL[item.level] ?? ""}`}
                  <span className="ml-2 text-[11px]">先展开上一级</span>
                </p>
              </div>
            );
          }

          return (
            <details
              key={item.level}
              className="rounded-xl border border-line bg-paper-2/60 px-4 py-3"
              open={false}
              onToggle={(event) => {
                if ((event.currentTarget as HTMLDetailsElement).open) unlock(item.level);
              }}
            >
              <summary className="cursor-pointer select-none text-sm font-medium text-ink">
                L{item.level}
                {item.title ? ` · ${item.title}` : ` · ${LEVEL_LABEL[item.level] ?? ""}`}
                {item.level <= unlocked && (
                  <span className="ml-2 text-[11px] font-normal text-warn">已使用</span>
                )}
              </summary>
              <div className="mt-3 border-t border-line pt-3">
                <Markdown source={item.body} />
              </div>
            </details>
          );
        })}

        {unlocked > 0 && !solved && (
          <p className="text-[11px] leading-relaxed text-warn">
            本次已解锁到 L{Math.min(unlocked, levels.length)}，判题通过时会标注「使用过 L
            {Math.min(unlocked, levels.length)}」。
          </p>
        )}

        <p className="text-[11px] leading-relaxed text-muted">
          提示都看完还是没头绪的话，右栏可以下载题解 —— 但那就等于直接看答案了。
        </p>
      </div>
    </details>
  );
}