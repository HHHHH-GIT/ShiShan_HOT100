/**
 * 题目打包脚本
 *
 *   npm run pack:problem                    # 打包 problems/index.json 中的全部题目
 *   npm run pack:problem -- --problem SHISHAN001
 *
 * 把 problems/<id>/starter/ 打包为 problems/<id>/dist/<id>.zip，
 * 解压后即为一个完整的、可直接构建运行的屎山项目。
 */
import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";

const ROOT = process.cwd();
const PROBLEMS_DIR = path.join(ROOT, "problems");

const SKIP_DIRS = new Set(["target", "logs", ".git", ".idea", "node_modules", "__pycache__"]);
const SKIP_EXTS = [".log", ".class", ".iml", ".zip"];

function readProblemIds(): string[] {
  const indexPath = path.join(PROBLEMS_DIR, "index.json");
  const parsed = JSON.parse(fs.readFileSync(indexPath, "utf8")) as { problems?: unknown };
  if (!Array.isArray(parsed.problems)) {
    throw new Error(`${indexPath} 的 problems 字段应为字符串数组`);
  }
  return parsed.problems as string[];
}

function makeFilter(starterDir: string) {
  return (filename: string): boolean => {
    const rel = path.relative(starterDir, filename);
    if (!rel) return true;
    if (rel.split(path.sep).some((seg) => SKIP_DIRS.has(seg))) return false;
    return !SKIP_EXTS.some((ext) => filename.endsWith(ext));
  };
}

function packProblem(id: string): { files: number; sizeKb: number; zipPath: string } {
  const starterDir = path.join(PROBLEMS_DIR, id, "starter");
  if (!fs.existsSync(starterDir)) {
    throw new Error(`跳过 ${id}：找不到 starter 目录 ${starterDir}`);
  }

  const distDir = path.join(PROBLEMS_DIR, id, "dist");
  fs.mkdirSync(distDir, { recursive: true });
  const zipPath = path.join(distDir, `${id}.zip`);
  if (fs.existsSync(zipPath)) fs.rmSync(zipPath);

  const zip = new AdmZip();
  zip.addLocalFolder(starterDir, "", makeFilter(starterDir));
  zip.writeZip(zipPath);

  const files = zip.getEntries().filter((entry) => !entry.isDirectory).length;
  return { files, sizeKb: Math.round(fs.statSync(zipPath).size / 1024), zipPath };
}

function main(): void {
  const argIndex = process.argv.indexOf("--problem");
  const ids = argIndex >= 0 ? [process.argv[argIndex + 1]] : readProblemIds();
  if (ids.length === 0 || ids.some((id) => !id)) {
    throw new Error("未指定要打包的题目");
  }

  let failed = 0;
  for (const id of ids) {
    try {
      const { files, sizeKb, zipPath } = packProblem(id);
      console.log(`✓ ${id}  打包完成：${files} 个文件，${sizeKb} KB`);
      console.log(`  → ${path.relative(ROOT, zipPath).split(path.sep).join("/")}`);
    } catch (error) {
      failed += 1;
      console.error(`✗ ${id}  ${(error as Error).message}`);
    }
  }
  if (failed > 0) process.exitCode = 1;
}

main();