import Link from "next/link";
import { notFound } from "next/navigation";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { JudgeClient } from "@/components/JudgeClient";
import { ProblemError, getProblem } from "@/lib/problems";

export const dynamic = "force-dynamic";

export default async function JudgePage({
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

  return (
    <div className="space-y-4">
      {/* 极简面包屑 */}
      <nav className="flex items-center gap-1.5 text-xs text-muted">
        <Link href="/" className="transition-colors hover:text-ink">
          题库
        </Link>
        <span className="text-line-strong">/</span>
        <Link href={`/problems/${problem.id}`} className="transition-colors hover:text-ink">
          {problem.meta.title}
        </Link>
        <span className="text-line-strong">/</span>
        <span className="font-medium text-ink">本地回归评测</span>
        <div className="ml-1">
          <DifficultyBadge difficulty={problem.meta.difficulty} />
        </div>
      </nav>

      <JudgeClient
        problemId={problem.id}
        problemTitle={problem.meta.title}
        problemSummary={problem.meta.summary}
        difficulty={problem.meta.difficulty}
        heartbeatPort={problem.meta.heartbeat.port}
        heartbeatPath={problem.meta.heartbeat.path}
        workspacePath={problem.workspacePath}
        startCommand={problem.meta.startCommand}
      />
    </div>
  );
}