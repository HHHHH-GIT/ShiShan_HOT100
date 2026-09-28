/**
 * 题目泄题检查
 *
 *   npx tsx scripts/lint-problem.ts                    # 检查 index.json 里的全部题目
 *   npx tsx scripts/lint-problem.ts --problem SHISHAN002
 *
 * 规则见 problems/README.md。error 会让退出码非零；warn 只提示。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { parseHintLevels } from "../lib/hints";
import { problemDir, problemHintsFile, problemReadmeFile } from "../lib/paths";
import { ProblemError, listProblems, readMeta, readSpec } from "../lib/problems";

/** 直接点名根因的词：出现在面向解题者的文本里就是 error */
const ROOT_CAUSE_WORDS = [
  "死锁",
  "锁顺序",
  "AB-BA",
  "加锁顺序",
  "脏缓存",
  "缓存不一致",
  "缓存失效",
  "缓存穿透",
  "单位换算",
  "重复换算",
  "回填",
  "先删缓存",
  "延迟双删",
  "Cache-Aside",
  "jstack",
  "deadlock",
  "lock order",
  "stale cache",
];

/** 可疑词：可能只是背景描述，但值得人工确认 */
const SUSPICIOUS_WORDS = [
  "缓存",
  "换算",
  "时序",
  "竞态",
  "原子性",
  "锁",
  "线程栈",
  "幂等",
];

const COLOR = {
  reset: "\u001b[0m",
  dim: "\u001b[2m",
  green: "\u001b[32m",
  red: "\u001b[31m",
  yellow: "\u001b[33m",
  bold: "\u001b[1m",
};

interface Finding {
  level: "error" | "warn";
  where: string;
  detail: string;
}

function findWords(text: string, words: string[]): string[] {
  return words.filter((word) => text.includes(word));
}

async function readIfExists(file: string): Promise<string> {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return "";
  }
}

async function lintProblem(problemId: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const meta = await readMeta(problemId);
  const spec = await readSpec(problemId);

  const readme = await readIfExists(problemReadmeFile(problemId));
  const hintsRaw = await readIfExists(problemHintsFile(problemId));
  const levels = parseHintLevels(hintsRaw);

  /* ---------- 1. 题面（README） ---------- */

  if (!readme) {
    findings.push({ level: "error", where: "starter/README.md", detail: "文件不存在" });
  }

  for (const word of findWords(readme, ROOT_CAUSE_WORDS)) {
    findings.push({
      level: "error",
      where: "starter/README.md",
      detail: `出现根因关键词「${word}」`,
    });
  }
  for (const word of findWords(readme, SUSPICIOUS_WORDS)) {
    findings.push({
      level: "warn",
      where: "starter/README.md",
      detail: `出现可疑词「${word}」，确认它只是背景描述`,
    });
  }

  // 结构树 / 文件清单
  const fences = readme.match(/```[\s\S]*?```/g) ?? [];
  for (const fence of fences) {
    if (fence.includes("├──") || fence.includes("└──")) {
      findings.push({
        level: "error",
        where: "starter/README.md",
        detail: "题面里出现代码结构树，删掉（解题者自己会看目录）",
      });
    }
  }

  // 必给信息
  if (!readme.includes(`:${meta.heartbeat.port}`)) {
    findings.push({
      level: "warn",
      where: "starter/README.md",
      detail: `没有提到服务端口 ${meta.heartbeat.port}`,
    });
  }
  if (meta.startCommand && !readme.includes(meta.startCommand.split(" ")[0])) {
    findings.push({
      level: "warn",
      where: "starter/README.md",
      detail: "没有提到启动命令",
    });
  }

  /* ---------- 2. 元数据（也会展示在页面上） ---------- */

  const metaTexts: [string, string][] = [
    ["meta.json summary", meta.summary],
    ["meta.json apiContract", meta.apiContract],
    ["meta.json tags", meta.tags.join(" ")],
  ];
  for (const [where, text] of metaTexts) {
    for (const word of findWords(text, ROOT_CAUSE_WORDS)) {
      findings.push({ level: "error", where, detail: `出现根因关键词「${word}」` });
    }
  }

  /* ---------- 3. 分级提示 ---------- */

  if (levels.length === 0) {
    findings.push({ level: "warn", where: "hints.md", detail: "没有提示（可以为空，但确认是有意的）" });
  } else if (levels.length < 3) {
    findings.push({
      level: "error",
      where: "hints.md",
      detail: `只解析出 ${levels.length} 级，规范要求恰好三级（## L1 / ## L2 / ## L3）`,
    });
  } else {
    const shallow = levels.filter((item) => item.level <= 2);
    for (const item of shallow) {
      for (const word of findWords(item.body, ROOT_CAUSE_WORDS)) {
        findings.push({
          level: "error",
          where: `hints.md L${item.level}`,
          detail: `L1/L2 里出现根因关键词「${word}」（这类词只允许放在 L3）`,
        });
      }
    }
  }

  /* ---------- 4. 用例清单 ---------- */

  for (const test of spec.tests) {
    if (!test.displayName) {
      findings.push({
        level: "error",
        where: `tests.yaml ${test.id}`,
        detail: "缺 displayName（需要保留中性的展示名称）",
      });
      continue;
    }
    for (const word of findWords(test.displayName, ROOT_CAUSE_WORDS)) {
      findings.push({
        level: "error",
        where: `tests.yaml ${test.id}`,
        detail: `displayName 出现根因关键词「${word}」`,
      });
    }
    for (const word of findWords(test.displayName, SUSPICIOUS_WORDS)) {
      findings.push({
        level: "warn",
        where: `tests.yaml ${test.id}`,
        detail: `displayName 出现可疑词「${word}」`,
      });
    }
  }

  return findings;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const index = args.indexOf("--problem");
  let ids: string[];

  if (index >= 0) {
    const id = args[index + 1];
    if (!id) {
      console.error("用法：npx tsx scripts/lint-problem.ts [--problem <ID>]");
      process.exit(2);
    }
    ids = [id];
  } else {
    ids = (await listProblems()).map((problem) => problem.id);
  }

  let errors = 0;
  let warnings = 0;

  for (const id of ids) {
    console.log(`${COLOR.bold}${id}${COLOR.reset} ${COLOR.dim}${problemDir(id)}${COLOR.reset}`);
    let findings: Finding[];
    try {
      findings = await lintProblem(id);
    } catch (error) {
      const message = error instanceof ProblemError ? error.message : String(error);
      console.log(`  ${COLOR.red}✘ 无法检查：${message}${COLOR.reset}\n`);
      errors += 1;
      continue;
    }

    if (findings.length === 0) {
      console.log(`  ${COLOR.green}✓ 通过${COLOR.reset}\n`);
      continue;
    }

    for (const finding of findings) {
      const tag =
        finding.level === "error"
          ? `${COLOR.red}✘ error${COLOR.reset}`
          : `${COLOR.yellow}· warn ${COLOR.reset}`;
      console.log(`  ${tag} ${finding.where} —— ${finding.detail}`);
      if (finding.level === "error") errors += 1;
      else warnings += 1;
    }
    console.log("");
  }

  const summary = `${ids.length} 道题：${errors} 个 error、${warnings} 个 warn`;
  console.log(errors > 0 ? `${COLOR.red}${summary}${COLOR.reset}` : `${COLOR.green}${summary}${COLOR.reset}`);
  if (errors > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(`${COLOR.red}lint 脚本异常：${error instanceof Error ? error.stack : String(error)}${console.error}`);
  process.exit(1);
});