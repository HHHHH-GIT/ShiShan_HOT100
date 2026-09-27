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
      <div className="flex items-baseline justify-between border-b border-line pb-3">
        <h1 className="font-serif text-2xl font-bold tracking-tight text-ink">
          题库
        </h1>
        <span className="text-xs text-muted font-mono">
          本地回归评测
        </span>
      </div>

      {/* 题库列表主体 */}
      <section>
        {loadError ? (
          <div className="card border-bad/40 bg-bad-soft p-5">
            <p className="text-sm font-medium text-bad">题库加载失败</p>
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