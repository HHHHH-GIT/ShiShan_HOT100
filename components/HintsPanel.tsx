"use client";

import { useCallback, useEffect, useState } from "react";
import { Markdown } from "@/components/Markdown";
import type { HintLevel } from "@/lib/hints";

/** localStorage 里记录「这道题已经解锁到第几级提示」 */
export function hintStorageKey(problemId: string): string {
  return `shishan:hints:${problemId}`;
}

const LEVEL_LABEL: Record<number, string> = {
  1: "方向指引",
  2: "判据推演",
  3: "排障手法",
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
    <details className="card p-5 group" open={false}>
      <summary className="cursor-pointer select-none text-sm font-semibold text-ink flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>梯度线索提示</span>
          <span className="text-xs font-normal text-muted">
            （{levels.length} 级线索，逐级展开）
          </span>
        </div>
        <span className="text-xs text-muted group-open:rotate-180 transition-transform duration-200">
          ▼
        </span>
      </summary>

      <div className="mt-4 space-y-3 border-t border-line/80 pt-4">
        <p className="text-xs leading-relaxed text-muted">
          建议先尝试独立调试。确实遇到阻碍时可逐步展开提示。已使用的最高提示级别将记录在判题结果中。
        </p>

        {levels.map((item) => {
          const isNext = item.level <= unlocked + 1;
          const canOpen = solved || isNext;

          if (!canOpen) {
            return (
              <div
                key={item.level}
                className="rounded-lg border border-dashed border-line bg-paper/60 px-3.5 py-2.5"
              >
                <p className="text-xs text-muted flex items-center justify-between">
                  <span>
                    L{item.level} · {item.title ? item.title : (LEVEL_LABEL[item.level] ?? "进阶提示")}
                  </span>
                  <span className="text-[11px] text-muted/80">需先展开上一级提示</span>
                </p>
              </div>
            );
          }

          return (
            <details
              key={item.level}
              className="rounded-lg border border-line bg-paper/50 px-3.5 py-2.5 transition-colors group/item"
              open={false}
              onToggle={(event) => {
                if ((event.currentTarget as HTMLDetailsElement).open) unlock(item.level);
              }}
            >
              <summary className="cursor-pointer select-none text-xs font-medium text-ink flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>
                    L{item.level} · {item.title ? item.title : (LEVEL_LABEL[item.level] ?? "提示内容")}
                  </span>
                  {item.level <= unlocked && (
                    <span className="rounded bg-warn-soft border border-warn/30 px-1.5 py-0.2 text-[10px] text-warn font-medium">
                      已开启
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted group-open/item:rotate-180 transition-transform duration-200">
                  ▼
                </span>
              </summary>
              <div className="mt-2.5 border-t border-line/70 pt-2.5 text-xs">
                <Markdown source={item.body} />
              </div>
            </details>
          );
        })}

        {unlocked > 0 && !solved && (
          <p className="text-[11px] leading-relaxed text-warn font-medium">
            当前已解锁至 L{Math.min(unlocked, levels.length)}，判题通过时将附带提示使用标记。
          </p>
        )}
      </div>
    </details>
  );
}