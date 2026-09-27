import Link from "next/link";
import { notFound } from "next/navigation";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { HintsPanel } from "@/components/HintsPanel";
import { Markdown } from "@/components/Markdown";
import { WorkspaceActions } from "@/components/WorkspaceActions";
import { ProblemError, getProblem } from "@/lib/problems";
import type { TestCase } from "@/lib/types";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<TestCase["type"], string> = {
  http: "单请求断言",
  workflow: "多步流程",
  load: "并发压测",
  log: "日志断言",
};

const TYPE_CLASS: Record<TestCase["type"], string> = {
  http: "border-line bg-paper text-muted font-medium",
  workflow: "border-line bg-paper text-muted font-medium",
  load: "border-warn/40 bg-warn-soft text-warn font-semibold",
  log: "border-line bg-paper text-muted font-medium",
};

function testSummary(test: TestCase): string {
  switch (test.type) {
    case "http":
      return `${test.request.method} ${test.request.url}`;
    case "workflow":
      return `${test.steps.length} 步串联`;
    case "load":
      return `${test.concurrency} 并发 × ${test.rounds} 轮 · ${test.scenarios.length} 个场景`;
    case "log":
      return test.path ? `文件 ${test.path}` : "题目默认日志";
  }
}

/** 用例清单在首次 AC 之前只给「数量 + 类型分布」，避免把根因写进用例名里剧透 */
function typeDistribution(tests: TestCase[]): { label: string; count: number }[] {
  const order: TestCase["type"][] = ["http", "workflow", "load", "log"];
  return order
    .map((type) => ({
      label: TYPE_LABEL[type],
      count: tests.filter((test) => test.type === type).length,
    }))
    .filter((item) => item.count > 0);
}

export default async function ProblemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let problem: Awaited<ReturnType<typeof getProblem>>;
  try {
    problem = await getProblem(id);
  } catch (error) {
    if (error instanceof ProblemError && error.statusCode === 404) notFound();
    throw error;
  }

  const { meta, spec } = problem;
  const solved = problem.status === "ac";

  return (
    <div className="space-y-6">
      {/* 极简面包屑导航 */}
      <nav className="flex items-center gap-2 text-sm text-muted">
        <Link href="/" className="transition-colors hover:text-ink">
          题库
        </Link>
        <span className="text-line-strong">/</span>
        <span className="font-mono text-ink font-semibold">{meta.id}</span>
      </nav>

      {/* 题目头部信息 */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line/80 pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-xs font-bold tracking-wider text-muted">
              {meta.id}
            </span>
            <DifficultyBadge difficulty={meta.difficulty} size="lg" />
            <span className="chip text-xs">{problem.testCount} 个测试点</span>
            {solved && (
              <span className="chip border-ok/40 bg-ok-soft text-ok font-semibold text-xs">已 AC</span>
            )}
          </div>
          <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {meta.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm sm:text-base leading-relaxed text-muted">
            {meta.summary}
          </p>
        </div>
        <Link
          href={`/problems/${meta.id}/judge`}
          className="btn btn-accent shrink-0 px-5 py-2.5 text-sm font-semibold shadow-xs"
        >
          开始判题 →
        </Link>
      </header>

      {/* 两栏主体结构 */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_310px]">
        {/* 左侧主体内容 */}
        <div className="space-y-5">
          <section className="card p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-line/80 pb-3">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-ink">题目描述</h2>
              <span className="font-mono text-xs text-muted">
                来源：{problem.readmeSource}
              </span>
            </div>
            <Markdown source={problem.readme} />
          </section>

          <section className="card p-5 sm:p-6">
            <div className="mb-4 border-b border-line/80 pb-3">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-ink">API 契约与预期效果</h2>
            </div>
            <Markdown source={meta.apiContract} />
          </section>

          <section className="card p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-line/80 pb-3">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-ink">
                回归测试点
                <span className="ml-2 text-xs font-normal text-muted">
                  全部通过即为 AC
                </span>
              </h2>
              {!solved && (
                <span className="chip border-line bg-paper text-muted text-xs">
                  未解锁完整清单
                </span>
              )}
            </div>

            {solved ? (
              <ol className="divide-y divide-line/60">
                {spec.tests.map((test, index) => (
                  <li key={test.id} className="flex gap-3.5 py-3.5 first:pt-0 last:pb-0">
                    <span className="mt-0.5 shrink-0 font-mono text-sm text-muted">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-ink">
                          {test.displayName ?? test.name}
                        </span>
                        <span className={`chip text-xs ${TYPE_CLASS[test.type]}`}>
                          {TYPE_LABEL[test.type]}
                        </span>
                      </div>
                      {test.description && (
                        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
                          {test.description}
                        </p>
                      )}
                      <p className="mt-1.5 font-mono text-xs text-muted/80">
                        {testSummary(test)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="space-y-3.5">
                <p className="text-sm text-ink-soft">
                  共 <span className="font-bold text-ink">{problem.testCount}</span> 个测试点：
                  {typeDistribution(spec.tests)
                    .map((item) => `${item.label} ×${item.count}`)
                    .join("、")}
                </p>
                <div className="rounded-lg border border-line bg-paper px-4 py-3">
                  <p className="text-sm leading-relaxed text-muted">
                    具体的测试用例名称与断言说明在
                    <strong className="font-semibold text-ink"> 首次 AC 之后解锁</strong>
                    。用例名中包含验证指标，为保护排障探索体验，未通过前隐藏技术细节。
                  </p>
                </div>
              </div>
            )}
          </section>

          <HintsPanel
            problemId={problem.id}
            levels={problem.hintLevels}
            solved={problem.status === "ac"}
          />
        </div>

        {/* 右侧悬浮侧边栏 */}
        <aside className="space-y-4 lg:sticky lg:top-18 lg:self-start">
          <section className="card p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
              本地工作区
            </h2>
            <WorkspaceActions
              problemId={meta.id}
              workspacePath={problem.workspacePath}
              startCommand={meta.startCommand}
              downloaded={problem.status !== "not_downloaded"}
            />
          </section>

          <section className="card p-5">
            <h2 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted">
              参考题解
            </h2>
            {problem.hasSolution ? (
              <>
                <a
                  className="btn w-full justify-center text-sm font-semibold py-2"
                  href={`/api/problems/${meta.id}/solution`}
                  download
                >
                  下载题解 (.md)
                </a>
                <p className="mt-2.5 text-xs leading-relaxed text-muted">
                  题解不在页面中直接展示，建议在独立排查确实遇到阻碍后再下载对照。
                </p>
              </>
            ) : (
              <p className="text-sm text-muted">该题目暂未提供独立题解附件。</p>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
              服务探活约定
            </h2>
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">监听端口</dt>
                <dd className="font-mono font-semibold text-ink">{meta.heartbeat.port}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">心跳路径</dt>
                <dd className="font-mono font-semibold text-ink">{meta.heartbeat.path}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">日志文件</dt>
                <dd className="font-mono text-muted">{meta.logPath}</dd>
              </div>
            </dl>
            <p className="mt-3.5 text-xs leading-relaxed text-muted border-t border-line/70 pt-3">
              判题开始前会自动发起 HTTP 探活。探活不通将直接终止并提示启动本地服务。
            </p>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
              核心技术标签
            </h2>
            <div className="flex flex-wrap gap-2">
              {meta.tags.map((tag) => (
                <span key={tag} className="chip text-xs px-2.5 py-1">
                  {tag}
                </span>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}