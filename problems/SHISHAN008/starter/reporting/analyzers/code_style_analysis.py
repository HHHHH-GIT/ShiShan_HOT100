"""代码风格分析器：纯函数，输入 CodeSample 列表，输出 CodeStyleMetrics。

启发式分析，不追求精确（指标用于趋势对比而非绝对度量）：
- 行数：去掉纯空白行的代码行数
- 注释率：注释行 / 总行数
- 语言分布：按 language 字段聚合
- 命名风格：在标识符中统计 camelCase vs snake_case
- 嵌套深度：按缩进 / 大括号估算平均最大嵌套
- 圈复杂度代理：控制流关键字数 +1
"""
from __future__ import annotations

import re

from ..models import CodeSample, CodeStyleMetrics

# 注释正则（按语言家族）
_LINE_COMMENT = {
    "python": r"^\s*#",
    "ruby": r"^\s*#",
    "bash": r"^\s*#",
    "sql": r"^\s*--",
    "mysql": r"^\s*--",
    "golang": r"^\s*//",
    "go": r"^\s*//",
    "rust": r"^\s*//",
    "javascript": r"^\s*//",
    "typescript": r"^\s*//",
    "java": r"^\s*//",
    "c": r"^\s*//",
    "c++": r"^\s*//",
    "cpp": r"^\s*//",
    "c#": r"^\s*//",
    "csharp": r"^\s*//",
    "kotlin": r"^\s*//",
    "swift": r"^\s*//",
    "php": r"^\s*(//|#)",
    "scala": r"^\s*//",
    "dart": r"^\s*//",
}

# 块注释 /* */（C 系）
_BLOCK_COMMENT_RE = re.compile(r"/\*.*?\*/", re.DOTALL)
_BLOCK_COMMENT_LINE_RE = re.compile(r"^\s*\*")

# 控制流关键字（圈复杂度代理）
_COMPLEXITY_RE = re.compile(
    r"\b(if|else if|elif|for|while|switch|case|catch|except|and|or|&&|\|\|)\b"
)

# 标识符
_IDENT_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")
_CAMEL_RE = re.compile(r"[a-z][A-Z]")
_SNAKE_RE = re.compile(r"[a-z]_[a-z]")


def analyze_code_style(samples: list[CodeSample]) -> CodeStyleMetrics:
    metrics = CodeStyleMetrics(sample_count=len(samples))
    if not samples:
        return metrics

    lang_dist: dict[str, int] = {}
    line_counts: list[int] = []
    comment_rates: list[float] = []
    camel_total = 0
    snake_total = 0
    nesting_depths: list[float] = []
    complexities: list[float] = []

    for s in samples:
        lang = (s.language or "unknown").lower()
        lang_dist[lang] = lang_dist.get(lang, 0) + 1

        code = s.code or ""
        lines, comment_lines = _count_lines(code, lang)
        line_counts.append(lines)
        comment_rates.append((comment_lines / lines) if lines else 0.0)

        # 命名风格（在去注释代码上统计）
        clean = _strip_comments(code, lang)
        idents = _IDENT_RE.findall(clean)
        camel = sum(1 for i in idents if _CAMEL_RE.search(i))
        snake = sum(1 for i in idents if _SNAKE_RE.search(i))
        camel_total += camel
        snake_total += snake

        nesting_depths.append(_max_nesting_depth(code, lang))
        complexities.append(float(len(_COMPLEXITY_RE.findall(clean)) + 1))

    metrics.language_distribution = lang_dist
    metrics.line_counts = line_counts
    metrics.comment_rates = comment_rates
    metrics.naming_camel = camel_total
    metrics.naming_snake = snake_total
    metrics.avg_nesting_depth = round(sum(nesting_depths) / len(nesting_depths), 2) if nesting_depths else 0.0
    metrics.avg_complexity = round(sum(complexities) / len(complexities), 2) if complexities else 0.0
    return metrics


# ----------------------------------------------------------
def _count_lines(code: str, lang: str) -> tuple[int, int]:
    """返回 (非空行数, 注释行数)。"""
    line_comment_re = _LINE_COMMENT.get(lang)
    cleaned = _strip_block_comments(code)
    non_blank = 0
    comment_lines = 0
    for line in cleaned.splitlines():
        if not line.strip():
            continue
        non_blank += 1
        is_comment = False
        if line_comment_re and re.match(line_comment_re, line):
            is_comment = True
        elif _BLOCK_COMMENT_LINE_RE.match(line):
            is_comment = True
        if is_comment:
            comment_lines += 1
    return non_blank, comment_lines


def _strip_comments(code: str, lang: str) -> str:
    """去掉注释，保留代码（用于命名/复杂度统计）。"""
    cleaned = _strip_block_comments(code)
    line_comment_re = _LINE_COMMENT.get(lang)
    out_lines = []
    for line in cleaned.splitlines():
        if line_comment_re and re.match(line_comment_re, line):
            continue
        if _BLOCK_COMMENT_LINE_RE.match(line):
            continue
        out_lines.append(line)
    return "\n".join(out_lines)


def _strip_block_comments(code: str) -> str:
    """去掉 /* ... */ 块注释。"""
    return _BLOCK_COMMENT_RE.sub("", code)


def _max_nesting_depth(code: str, lang: str) -> float:
    """估算最大嵌套深度。

    - 缩进式语言（python 等）：按前导空格 / 4 估算
    - 大括号语言：按 { } 配对栈估算
    """
    if lang in ("python", "ruby", "bash"):
        max_depth = 0
        for line in code.splitlines():
            if not line.strip():
                continue
            indent = len(line) - len(line.lstrip(" "))
            depth = indent // 4
            max_depth = max(max_depth, depth)
        return float(max_depth)
    else:
        depth = 0
        max_depth = 0
        for ch in code:
            if ch == "{":
                depth += 1
                max_depth = max(max_depth, depth)
            elif ch == "}":
                depth = max(0, depth - 1)
        return float(max_depth)
