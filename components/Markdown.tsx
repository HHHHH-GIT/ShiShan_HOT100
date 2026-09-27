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
          className="rounded border border-line bg-paper-2 px-1 py-0.5 font-mono text-[0.82em] text-ink-soft"
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
        <pre
          key={key++}
          className="log-scroll overflow-x-auto rounded-xl border border-line bg-[#26241f] px-4 py-3 text-[12.5px] leading-relaxed text-[#e8e3d8]"
        >
          <code className="font-mono" data-lang={lang || undefined}>
            {body.join("\n")}
          </code>
        </pre>,
      );
      continue;
    }

    // 分隔线
    if (/^\s*---+\s*$/.test(line)) {
      blocks.push(<div key={key++} className="rule my-5" />);
      continue;
    }

    // 标题
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      const cls =
        level <= 2
          ? "font-serif text-xl text-ink mt-1"
          : "font-serif text-base text-ink-soft mt-1";
      blocks.push(
        <p key={key++} className={cls}>
          {renderInline(text, `h${key}`)}
        </p>,
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
        <div key={key++} className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-paper-2">
                {header.map((cell, cellIndex) => (
                  <th
                    key={cellIndex}
                    className="border-b border-line px-3 py-2 text-left font-medium text-ink-soft"
                  >
                    {renderInline(cell, `th${cellIndex}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="odd:bg-white even:bg-paper/60">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="border-b border-line/70 px-3 py-2 align-top text-ink-soft"
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

    // 引用
    if (line.trim().startsWith(">")) {
      const body: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        body.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(
        <blockquote
          key={key++}
          className="border-l-2 border-accent/60 bg-accent-soft/40 px-4 py-2 text-sm text-ink-soft"
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
          className={`space-y-1 pl-5 text-sm leading-relaxed text-ink-soft ${
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
      <p key={key++} className="text-sm leading-relaxed text-ink-soft">
        {renderInline(paragraph.join(" "), `p${key}`)}
      </p>,
    );
  }

  return <div className="space-y-3">{blocks}</div>;
}