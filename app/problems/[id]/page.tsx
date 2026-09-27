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
  http: "border-line-strong bg-paper-2 text-muted",
  workflow: "border-line-strong bg-paper-2 text-muted",
  load: "border-accent/40 bg-accent-soft text-accent",
  log: "border-line-strong bg-paper-2 text-muted",
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
      <nav className="text-xs text-muted">
        <Link href="/" className="transition-colors hover:text-ink">
          题库
        </Link>
        <span className="px-2">/</span>
        <span className="font-mono">{meta.id}</span>
      </nav>

      <header className="animate-fade-up flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
              {meta.id}
            </span>
            <DifficultyBadge difficulty={meta.difficulty} size="lg" />
            <span className="chip">{problem.testCount} 个测试点</span>
            {problem.status === "ac" && (
              <span className="chip border-ok/40 bg-ok-soft text-ok">已 AC</span>
            )}
          </div>
          <h1 className="mt-2 font-serif text-2xl tracking-tight text-ink">{meta.title}</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{meta.summary}</p>
        </div>
        <Link href={`/problems/${meta.id}/judge`} className="btn btn-accent shrink-0">
          开始判题 →
        </Link>
      </header>

      <div className="rule" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_296px]">
        <div className="space-y-6">
          <section className="card animate-fade-up p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-serif text-base text-ink">题目描述</h2>
              <span className="font-mono text-[11px] text-muted">
                即工作区里的 {problem.readmeSource}
              </span>
            </div>
            <Markdown source={problem.readme} />
          </section>

          <section className="card animate-fade-up p-5">
            <h2 className="mb-3 font-serif text-base text-ink">需要通过的 API 与预期效果</h2>
            <Markdown source={meta.apiContract} />
          </section>

          <section className="card animate-fade-up p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-serif text-base text-ink">
                回归测试点
                <span className="ml-2 text-xs font-normal text-muted">
                  全部通过即为 AC
                </span>
              </h2>
              {!solved && (
                <span className="chip border-warn/40 bg-warn-soft text-warn">
                  未解锁完整清单
                </span>
              )}
            </div>

            {solved ? (
              <ol className="space-y-3">
                {spec.tests.map((test, index) => (
                  <li key={test.id} className="flex gap-3">
                    <span className="mt-0.5 shrink-0 font-mono text-xs text-muted">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-ink">
                          {test.displayName ?? test.name}
                        </span>
                        <span className={`chip ${TYPE_CLASS[test.type]}`}>
                          {TYPE_LABEL[test.type]}
                        </span>
                      </div>
                      {test.description && (
                        <p className="mt-1 text-xs leading-relaxed text-muted">
                          {test.description}
                        </p>
                      )}
                      <p className="mt-1 font-mono text-[11px] text-muted/80">
                        {testSummary(test)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-ink-soft">
                  共 <span className="font-medium text-ink">{problem.testCount}</span> 个测试点：
                  {typeDistribution(spec.tests)
                    .map((item) => `${item.label} ×${item.count}`)
                    .join("、")}
                </p>
                <div className="rounded-lg border border-line bg-paper-2 px-3 py-2.5">
                  <p className="text-xs leading-relaxed text-muted">
                    具体的用例名称与说明在
                    <strong className="font-medium text-ink-soft">首次 AC 之后解锁</strong>
                    —— 用例名里会提到要验的东西，提前看到基本等于提前拿到答案。
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

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <section className="card p-5">
            <h2 className="mb-3 font-serif text-base text-ink">本地工作区</h2>
            <WorkspaceActions
              problemId={meta.id}
              workspacePath={problem.workspacePath}
              startCommand={meta.startCommand}
              downloaded={problem.status !== "not_downloaded"}
            />
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-serif text-base text-ink">题解</h2>
            {problem.hasSolution ? (
              <>
                <a className="btn w-full" href={`/api/problems/${meta.id}/solution`} download>
                  下载题解（.md）
                </a>
                <p className="mt-3 text-[11px] leading-relaxed text-muted">
                  题解不在页面里直接展示 —— 先自己动手，实在需要了再下载对照。
                </p>
              </>
            ) : (
              <p className="text-xs text-muted">这道题还没有提供题解文件。</p>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-serif text-base text-ink">心跳约定</h2>
            <dl className="space-y-2 text-xs">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">端口</dt>
                <dd className="font-mono text-ink-soft">{meta.heartbeat.port}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">接口</dt>
                <dd className="font-mono text-ink-soft">{meta.heartbeat.path}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">日志</dt>
                <dd className="font-mono text-ink-soft">{meta.logPath}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              判题前会先探活。探不通说明服务没起来，会直接终止并提示你先启动服务。
            </p>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-serif text-base text-ink">标签</h2>
            <div className="flex flex-wrap gap-1.5">
              {meta.tags.map((tag) => (
                <span key={tag} className="chip">
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