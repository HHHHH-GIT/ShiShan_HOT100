"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import type { ProblemSummary } from "@/lib/problems";

type StatusFilter = "all" | "todo" | "ac";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function ProblemList({ problems }: { problems: ProblemSummary[] }) {
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [tagsExpanded, setTagsExpanded] = useState(false);

  // 统计所有标签出现频次，降序排列
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const problem of problems) {
      for (const tag of problem.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hans-CN"),
    );
  }, [problems]);

  // 根据标签、状态与搜索词过滤题目
  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return problems.filter((problem) => {
      // 标签筛选
      if (activeTag && !problem.tags.includes(activeTag)) {
        return false;
      }
      // 状态筛选
      if (statusFilter === "ac" && problem.status !== "ac") {
        return false;
      }
      if (statusFilter === "todo" && problem.status === "ac") {
        return false;
      }
      // 关键词搜索（支持标题、ID、标签）
      if (q) {
        const inTitle = problem.title.toLowerCase().includes(q);
        const inId = problem.id.toLowerCase().includes(q);
        const inTags = problem.tags.some((tag) => tag.toLowerCase().includes(q));
        if (!inTitle && !inId && !inTags) {
          return false;
        }
      }
      return true;
    });
  }, [problems, activeTag, statusFilter, searchQuery]);

  const solvedCount = problems.filter((p) => p.status === "ac").length;
  const totalCount = problems.length;
  const progressPercent = totalCount > 0 ? Math.round((solvedCount / totalCount) * 100) : 0;
  const hasActiveFilters = activeTag !== null || statusFilter !== "all" || searchQuery.trim() !== "";

  const handleResetFilters = () => {
    setActiveTag(null);
    setSearchQuery("");
    setStatusFilter("all");
  };

  return (
    <div className="card space-y-4 p-4 sm:p-5">
      {/* 搜索框与状态快捷筛选 */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        {/* 极简搜索框 */}
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索题目、编号或核心技术标签..."
            className="w-full rounded-lg border border-line bg-paper px-3 py-1.5 pl-8 text-xs text-ink placeholder:text-muted/60 transition-colors focus:border-line-strong focus:bg-surface focus:outline-none focus:ring-2 focus:ring-ink/5"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-muted hover:text-ink cursor-pointer"
              aria-label="清空搜索"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>

        {/* 状态分段控制器（Apple / LeetCode Segmented Control） */}
        <div className="flex shrink-0 items-center rounded-lg border border-line/80 bg-paper p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`rounded-md px-3 py-1 font-medium transition-all cursor-pointer ${
              statusFilter === "all"
                ? "bg-surface text-ink shadow-2xs"
                : "text-muted hover:text-ink"
            }`}
          >
            全部
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("todo")}
            className={`rounded-md px-3 py-1 font-medium transition-all cursor-pointer ${
              statusFilter === "todo"
                ? "bg-surface text-ink shadow-2xs"
                : "text-muted hover:text-ink"
            }`}
          >
            未解答
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("ac")}
            className={`rounded-md px-3 py-1 font-medium transition-all cursor-pointer ${
              statusFilter === "ac"
                ? "bg-surface text-ink shadow-2xs"
                : "text-muted hover:text-ink"
            }`}
          >
            已通过
          </button>
        </div>
      </div>

      {/* 标签栏：无滚动条，默认单行，展开自适应 */}
      <div className="flex items-start gap-2 pt-0.5">
        <div
          className={`flex flex-1 flex-wrap gap-1.5 transition-all duration-200 ${
            tagsExpanded ? "" : "h-[28px] overflow-hidden"
          }`}
        >
          <FilterChip
            label="全部"
            count={problems.length}
            active={activeTag === null}
            onClick={() => setActiveTag(null)}
          />
          {tagCounts.map(([tag, count]) => (
            <FilterChip
              key={tag}
              label={tag}
              count={count}
              active={activeTag === tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            />
          ))}
        </div>

        {/* 展开 / 收起切换按钮 */}
        {tagCounts.length > 3 && (
          <button
            type="button"
            onClick={() => setTagsExpanded(!tagsExpanded)}
            className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:text-ink hover:bg-paper transition-colors cursor-pointer"
            title={tagsExpanded ? "收起标签" : "展开全部标签"}
          >
            <span>{tagsExpanded ? "收起" : "展开"}</span>
            <svg
              className={`h-3 w-3 transition-transform duration-200 ${
                tagsExpanded ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* 状态统计与做题进度行 */}
      <div className="flex items-center justify-between border-b border-line/80 pb-2.5 text-xs text-muted">
        <div className="flex items-center gap-2">
          {hasActiveFilters ? (
            <>
              <span>
                {activeTag && (
                  <span className="font-medium text-ink">#{activeTag} </span>
                )}
                找到 {visible.length} 题
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-accent hover:underline cursor-pointer font-medium"
              >
                重置筛选
              </button>
            </>
          ) : (
            <span>共 {totalCount} 题</span>
          )}
        </div>

        {/* 做题进度条 */}
        <div className="flex items-center gap-2 font-mono">
          <span className="text-[11px] text-muted">已解答:</span>
          <span className="font-semibold text-ink">
            {solvedCount}/{totalCount}
          </span>
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-line">
            <div
              className="h-full bg-ok transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* 极简表格头部 */}
      <div className="hidden sm:flex items-center justify-between px-3 py-2 text-[11px] font-medium tracking-wider text-muted">
        <div className="flex items-center gap-3">
          <span className="w-10 text-center whitespace-nowrap">状态</span>
          <span>题目</span>
        </div>
        <span className="w-28 text-right">难度</span>
      </div>

      {/* 题目列表主体 */}
      {visible.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <p className="text-sm font-medium text-ink">未找到匹配的题目</p>
          <p className="text-xs text-muted">请尝试调整搜索关键词或重置筛选条件</p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="btn mt-2 text-xs"
          >
            重置筛选
          </button>
        </div>
      ) : (
        <ol className="divide-y divide-line/70">
          {visible.map((problem, index) => {
            const isAc = problem.status === "ac";
            const isDownloaded = problem.status === "downloaded";

            return (
              <li key={problem.id} className="group">
                <Link
                  href={`/problems/${problem.id}`}
                  className="flex items-center justify-between gap-3 px-3 py-3.5 sm:py-4 transition-colors hover:bg-paper sm:rounded-lg"
                >
                  {/* 左侧：状态图标 + 序号 + 题目标题 + ID + 行内标签 */}
                  <div className="flex min-w-0 items-center gap-3">
                    {/* 状态图标 */}
                    <div className="flex w-10 shrink-0 items-center justify-center">
                      {isAc ? (
                        <span
                          className="flex h-4 w-4 items-center justify-center rounded-full bg-ok text-white shadow-2xs"
                          title="已通过"
                        >
                          <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </span>
                      ) : isDownloaded ? (
                        <span
                          className="flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-warn bg-warn/15"
                          title="已下载"
                        >
                          <span className="h-1 w-1 rounded-full bg-warn" />
                        </span>
                      ) : (
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-line-strong"
                          title="未开始"
                        />
                      )}
                    </div>

                    {/* 序号与标题 */}
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-xs text-muted">
                        {pad(index + 1)}.
                      </span>
                      <span className="font-medium text-sm text-ink transition-colors group-hover:text-accent">
                        {problem.title}
                      </span>
                      <span className="font-mono text-[10px] text-muted/80 bg-paper px-1.5 py-0.5 rounded border border-line">
                        {problem.id}
                      </span>

                      {/* 紧凑技术标签 */}
                      {problem.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 ml-1">
                          {problem.tags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setActiveTag(activeTag === tag ? null : tag);
                              }}
                              className={`rounded px-1.5 py-0.5 text-[10px] transition-colors cursor-pointer ${
                                activeTag === tag
                                  ? "bg-ink text-surface font-medium"
                                  : "bg-paper text-muted hover:bg-line hover:text-ink"
                              }`}
                              title={`按「${tag}」筛选`}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 右侧：难度段位 */}
                  <div className="shrink-0 text-right">
                    <DifficultyBadge difficulty={problem.difficulty} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-medium transition-all cursor-pointer ${
        active
          ? "border-ink bg-ink text-surface shadow-2xs"
          : "border-line bg-paper text-ink-soft hover:border-line-strong hover:bg-surface"
      }`}
    >
      <span>{label}</span>
      <span className={`font-mono text-[10px] ${active ? "text-surface/75" : "text-muted"}`}>
        {count}
      </span>
    </button>
  );
}