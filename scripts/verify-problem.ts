/**
 * 端到端自检脚本：用同一份 tests.yaml 校验指定实现。
 *
 *   npx tsx scripts/verify-problem.ts --problem SHISHAN001                       # 校验工作区里的实现
 *   npx tsx scripts/verify-problem.ts --problem SHISHAN001 --dir problems/SHISHAN001/reference
 *
 * 脚本不负责启动服务：请先把被测服务跑起来（心跳必须通），脚本会按 tests.yaml
 * 顺序执行全部测试点并打印 verdict 与失败点。
 */
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { checkHeartbeat } from "../lib/heartbeat";
import { readMeta, readSpec } from "../lib/problems";
import { runTestCase } from "../lib/runner/executors";
import type { LogLevel, RunnerContext } from "../lib/runner/types";

const ROOT = process.cwd();

const COLOR = {
  reset: "\u001b[0m",
  dim: "\u001b[2m",
  green: "\u001b[32m",
  red: "\u001b[31m",
  yellow: "\u001b[33m",
  cyan: "\u001b[36m",
  bold: "\u001b[1m",
};

const LEVEL_COLOR: Record<LogLevel, string> = {
  info: COLOR.dim,
  debug: "\u001b[90m",
  success: COLOR.green,
  warn: COLOR.yellow,
  error: COLOR.red,
};

interface Options {
  problemId: string;
  dir: string | null;
  verbose: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const get = (flag: string): string | null => {
    const index = args.indexOf(flag);
    return index >= 0 ? (args[index + 1] ?? null) : null;
  };

  const problemId = get("--problem");
  if (!problemId) {
    console.error("用法：npx tsx scripts/verify-problem.ts --problem <ID> [--dir <实现目录>] [--verbose]");
    process.exit(2);
  }

  return { problemId, dir: get("--dir"), verbose: args.includes("--verbose") };
}

async function fileSize(file: string): Promise<number> {
  try {
    return (await fs.stat(file)).size;
  } catch {
    return 0;
  }
}

async function main(): Promise<void> {
  const options = parseArgs();
  const meta = await readMeta(options.problemId);
  const spec = await readSpec(options.problemId);

  const baseDir = options.dir
    ? path.resolve(ROOT, options.dir)
    : path.resolve(ROOT, "workspace", options.problemId);

  if (!existsSync(baseDir)) {
    console.error(`${COLOR.red}实现目录不存在：${baseDir}${COLOR.reset}`);
    process.exit(2);
  }

  const logFile = path.resolve(baseDir, meta.logPath);

  console.log(`${COLOR.bold}${meta.id} · ${meta.title}${COLOR.reset}`);
  console.log(`${COLOR.dim}实现目录：${path.relative(ROOT, baseDir) || "."}${COLOR.reset}`);
  console.log(`${COLOR.dim}日志文件：${logFile}${COLOR.reset}`);
  console.log(`${COLOR.dim}测试规格：${spec.tests.length} 个测试点${COLOR.reset}\n`);

  const logOffsets = new Map<string, number>();
  logOffsets.set(logFile, await fileSize(logFile));
  for (const test of spec.tests) {
    if (test.type === "log" && test.path) {
      logOffsets.set(path.resolve(baseDir, test.path), await fileSize(path.resolve(baseDir, test.path)));
    }
  }

  // ---------- 心跳预检 ----------
  const heartbeat = await checkHeartbeat(meta.heartbeat);
  if (!heartbeat.ok) {
    console.log(
      `${COLOR.red}${COLOR.bold}心跳未通过${COLOR.reset} ${heartbeat.detail}`,
    );
    console.log(`${COLOR.dim}请先在 ${path.relative(ROOT, baseDir)} 目录执行：${meta.startCommand}${COLOR.reset}`);
    console.log(`\n${COLOR.bold}verdict: heartbeat_failed${COLOR.reset}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `${COLOR.green}心跳通过${COLOR.reset} ${COLOR.dim}(${heartbeat.elapsedMs}ms)${COLOR.reset}\n`,
  );

  const ctx: RunnerContext = {
    problemId: meta.id,
    vars: { baseUrl: spec.baseUrl, ...(spec.vars ?? {}) },
    logFile,
    logBaseDir: baseDir,
    logOffsets,
    log: (level, message, testId) => {
      if (!options.verbose && level === "debug") return;
      const prefix = testId ? `${COLOR.dim}[${testId}]${COLOR.reset} ` : "";
      console.log(`${prefix}${LEVEL_COLOR[level]}${message}${COLOR.reset}`);
    },
  };

  const failures: { name: string; reason: string }[] = [];

  for (const [index, test] of spec.tests.entries()) {
    console.log(
      `\n${COLOR.cyan}${COLOR.bold}▶ ${index + 1}/${spec.tests.length} ${test.name}${COLOR.reset} ${COLOR.dim}(${test.type})${COLOR.reset}`,
    );
    const startedAt = Date.now();

    try {
      const outcome = await runTestCase(test, ctx);
      const durationMs = Date.now() - startedAt;
      if (outcome.passed) {
        console.log(`${COLOR.green}✔ 通过${COLOR.reset} ${COLOR.dim}(${durationMs}ms)${COLOR.reset}`);
        if (outcome.metrics) {
          console.log(`${COLOR.dim}  ${JSON.stringify(outcome.metrics)}${COLOR.reset}`);
        }
      } else {
        console.log(`${COLOR.red}✘ 未通过${COLOR.reset} ${COLOR.dim}(${durationMs}ms)${COLOR.reset}`);
        failures.push({ name: test.name, reason: outcome.reason ?? "未给出原因" });
      }
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const reason = `执行异常：${error instanceof Error ? error.message : String(error)}`;
      console.log(`${COLOR.red}✘ 执行异常${COLOR.reset} ${COLOR.dim}(${durationMs}ms)${COLOR.reset}`);
      failures.push({ name: test.name, reason });
    }
  }

  console.log(`\n${COLOR.dim}${"─".repeat(60)}${COLOR.reset}`);
  if (failures.length === 0) {
    console.log(`${COLOR.green}${COLOR.bold}verdict: AC${COLOR.reset}  全部 ${spec.tests.length} 个测试点通过`);
    return;
  }

  console.log(`${COLOR.red}${COLOR.bold}verdict: FAIL${COLOR.reset}  ${failures.length} 个测试点未通过：`);
  for (const failure of failures) {
    console.log(`\n${COLOR.red}✘ ${failure.name}${COLOR.reset}`);
    console.log(`${COLOR.dim}${failure.reason}${COLOR.reset}`);
  }
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(`${COLOR.red}自检脚本异常：${error instanceof Error ? error.stack : String(error)}${COLOR.reset}`);
  process.exit(1);
});