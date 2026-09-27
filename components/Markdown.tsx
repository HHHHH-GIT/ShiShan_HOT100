import type { ReactNode } from "react";

/**
 * 轻量 Markdown 渲染：只覆盖题面用到的最小语法集合
 * （标题 / 段落 / 列表 / 表格 / 代码块 / 行内代码 / 加粗 / 引用 / 分隔线）。
 * 不引入额外依赖，也不做 HTML 透传（避免注入）。
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith("`")) {
      nodes.push(
        <code
          key={`${keyPrefix}-c${index}`}
          className="rounded border border-line bg-paper px-1.5 py-0.5 font-mono text-[0.8em] text-ink font-medium"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(
        <strong key={`${keyPrefix}-b${index}`} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>,
      );
    }
    lastIndex = match.index + token.length;
    index += 1;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function isTableRow(line: string): boolean {
  return line.trim().startsWith("|") && line.trim().endsWith("|");
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function Markdown({ source }: { source: string }) {
  if (!source.trim()) return null;

  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  let key = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    // 代码块
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3);
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        body.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push(
        <div key={key++} className="overflow-hidden rounded-xl border border-neutral-800 bg-[#18181b] shadow-xs my-2">
          {lang && (
            <div className="flex items-center justify-between border-b border-neutral-800/80 px-3.5 py-1.5 bg-[#1f1f23]">
              <span className="font-mono text-[10px] uppercase text-neutral-400 font-medium tracking-wider">
                {lang}
              </span>
            </div>
          )}
          <pre className="log-scroll overflow-x-auto p-3.5 text-[12px] leading-relaxed text-neutral-200">
            <code className="font-mono" data-lang={lang || undefined}>
              {body.join("\n")}
            </code>
          </pre>
        </div>,
      );
      continue;
    }

    // 分隔线
    if (/^\s*---+\s*$/.test(line)) {
      blocks.push(<div key={key++} className="rule my-4" />);
      continue;
    }

    // 标题
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      const cls =
        level <= 2
          ? "text-base font-semibold text-ink mt-3 tracking-tight"
          : "text-sm font-semibold text-ink-soft mt-2";
      blocks.push(
        <h3 key={key++} className={cls}>
          {renderInline(text, `h${key}`)}
        </h3>,
      );
      index += 1;
      continue;
    }

    // 表格
    if (isTableRow(line) && index + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[index + 1])) {
      const header = splitRow(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && isTableRow(lines[index])) {
        rows.push(splitRow(lines[index]));
        index += 1;
      }
      blocks.push(
        <div key={key++} className="overflow-x-auto rounded-xl border border-line bg-surface my-2">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-line bg-paper text-muted">
                {header.map((cell, cellIndex) => (
                  <th
                    key={cellIndex}
                    className="px-3.5 py-2.5 text-left font-semibold text-ink-soft"
                  >
                    {renderInline(cell, `th${cellIndex}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="transition-colors hover:bg-paper/50">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="px-3.5 py-2.5 align-top text-ink-soft"
                    >
                      {renderInline(cell, `td${rowIndex}-${cellIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // 引用（工单体，LeetCode / Apple 极简卡片式 Callout）
    if (line.trim().startsWith(">")) {
      const body: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        body.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(
        <blockquote
          key={key++}
          className="rounded-r-lg border-l-3 border-ink/40 bg-paper px-4 py-2.5 text-xs leading-relaxed text-ink-soft my-2"
        >
          {body.map((item, itemIndex) => (
            <p key={itemIndex}>{renderInline(item, `bq${key}-${itemIndex}`)}</p>
          ))}
        </blockquote>,
      );
      continue;
    }

    // 列表
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (index < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*([-*]|\d+\.)\s+/, ""));
        index += 1;
      }
      const Tag = ordered ? "ol" : "ul";
      blocks.push(
        <Tag
          key={key++}
          className={`space-y-1 pl-5 text-xs leading-relaxed text-ink-soft my-1.5 ${
            ordered ? "list-decimal" : "list-disc"
          }`}
        >
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, `li${key}-${itemIndex}`)}</li>
          ))}
        </Tag>,
      );
      continue;
    }

    // 段落
    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trim().startsWith("```") &&
      !/^(#{1,4})\s+/.test(lines[index]) &&
      !/^\s*([-*]|\d+\.)\s+/.test(lines[index]) &&
      !lines[index].trim().startsWith(">") &&
      !isTableRow(lines[index]) &&
      !/^\s*---+\s*$/.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(
      <p key={key++} className="text-xs leading-relaxed text-ink-soft">
        {renderInline(paragraph.join(" "), `p${key}`)}
      </p>,
    );
  }

  return <div className="space-y-2.5">{blocks}</div>;
}