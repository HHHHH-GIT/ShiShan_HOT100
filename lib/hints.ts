/**
 * 「卡住了再看」的分级提示解析。
 *
 * hints.md 用固定的小节约定分级：
 *
 *   ## L1 把两条投诉拆开
 *   ...
 *   ## L2 注意那个系数
 *   ...
 *   ## L3 动手手段
 *   ...
 *
 * 没有 L* 小节时，整份文件退化为单级提示。
 */
export interface HintLevel {
  level: number;
  title: string;
  body: string;
}

const LEVEL_PATTERN = /^##\s*L(\d+)\s*(.*)$/;

export function parseHintLevels(source: string): HintLevel[] {
  const text = source.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const levels: HintLevel[] = [];
  let current: HintLevel | null = null;
  const preamble: string[] = [];

  for (const line of text.split("\n")) {
    const match = line.match(LEVEL_PATTERN);
    if (match) {
      if (current) levels.push(current);
      current = { level: Number(match[1]), title: match[2].trim(), body: "" };
      continue;
    }
    if (current) {
      current.body += `${current.body ? "\n" : ""}${line}`;
    } else {
      preamble.push(line);
    }
  }
  if (current) levels.push(current);

  if (levels.length === 0) {
    return [{ level: 1, title: "", body: text }];
  }

  // 第一个 L* 之前的引子并进第一级，避免丢失内容
  const head = preamble
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n")
    .trim();
  if (head) {
    levels[0] = { ...levels[0], body: `${head}\n\n${levels[0].body}`.trim() };
  }

  return levels.map((item) => ({ ...item, body: item.body.trim() }));
}