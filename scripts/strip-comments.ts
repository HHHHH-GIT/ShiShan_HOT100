import fs from "node:fs";
import path from "node:path";

function stripJavaComments(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  let state: "NORMAL" | "IN_STRING" | "IN_CHAR" | "IN_LINE_COMMENT" | "IN_BLOCK_COMMENT" = "NORMAL";

  while (i < n) {
    const c = src[i];
    const next = i + 1 < n ? src[i + 1] : "";

    if (state === "NORMAL") {
      if (c === '"') {
        state = "IN_STRING";
        out += c;
        i++;
      } else if (c === "'") {
        state = "IN_CHAR";
        out += c;
        i++;
      } else if (c === "/" && next === "/") {
        state = "IN_LINE_COMMENT";
        i += 2;
      } else if (c === "/" && next === "*") {
        state = "IN_BLOCK_COMMENT";
        i += 2;
      } else {
        out += c;
        i++;
      }
    } else if (state === "IN_STRING") {
      out += c;
      if (c === "\\") {
        if (i + 1 < n) {
          out += src[i + 1];
          i += 2;
          continue;
        }
      } else if (c === '"') {
        state = "NORMAL";
      }
      i++;
    } else if (state === "IN_CHAR") {
      out += c;
      if (c === "\\") {
        if (i + 1 < n) {
          out += src[i + 1];
          i += 2;
          continue;
        }
      } else if (c === "'") {
        state = "NORMAL";
      }
      i++;
    } else if (state === "IN_LINE_COMMENT") {
      if (c === "\n") {
        out += "\n";
        state = "NORMAL";
      }
      i++;
    } else if (state === "IN_BLOCK_COMMENT") {
      if (c === "*" && next === "/") {
        state = "NORMAL";
        i += 2;
      } else {
        if (c === "\n") {
          out += "\n";
        }
        i++;
      }
    }
  }

  // 清理多余连续空行（最多连续 2 个换行）
  const cleaned = out
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");

  return cleaned.trim() + "\n";
}

function processDirectory(dir: string): void {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      processDirectory(fullPath);
    } else if (entry.isFile() && entry.name.endsWith(".java")) {
      const original = fs.readFileSync(fullPath, "utf8");
      const stripped = stripJavaComments(original);
      if (stripped !== original) {
        fs.writeFileSync(fullPath, stripped, "utf8");
        console.log(`Cleaned: ${path.relative(process.cwd(), fullPath)}`);
      }
    }
  }
}

const targets = [
  path.join(process.cwd(), "problems", "SHISHAN001"),
  path.join(process.cwd(), "problems", "SHISHAN002"),
  path.join(process.cwd(), "problems", "SHISHAN003"),
  path.join(process.cwd(), "problems", "SHISHAN004"),
  path.join(process.cwd(), "workspace", "SHISHAN001"),
  path.join(process.cwd(), "workspace", "SHISHAN002"),
  path.join(process.cwd(), "workspace", "SHISHAN003"),
  path.join(process.cwd(), "workspace", "SHISHAN004"),
];

for (const target of targets) {
  processDirectory(target);
}

console.log("All comments stripped successfully!");
