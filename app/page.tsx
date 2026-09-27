import { ProblemList } from "@/components/ProblemList";
import { listProblems } from "@/lib/problems";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let problems: Awaited<ReturnType<typeof listProblems>> = [];
  let loadError: string | null = null;

  try {
    problems = await listProblems();
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error);
  }

  return (
    <div className="space-y-4">
      {/* 极简题库顶部 */}
      <div className="flex items-center justify-between border-b border-line/80 pb-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
            题库列表
          </h1>
          <p className="mt-0.5 text-xs text-muted">
            真实线上排障工单 · 本地回归评测
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-[11px] text-muted shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" />
            本地回环就绪
          </span>
        </div>
      </div>

      {/* 题库列表主体 */}
      <section>
        {loadError ? (
          <div className="card border-bad/30 bg-bad-soft/60 p-5">
            <p className="text-sm font-semibold text-bad">题库加载失败</p>
            <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-bad/90">
              {loadError}
            </pre>
          </div>
        ) : (
          <ProblemList problems={problems} />
        )}
      </section>
    </div>
  );
}