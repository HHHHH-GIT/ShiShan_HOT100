/** 变量插值、JSONPath 取值、期望值子集匹配 —— 判题引擎的取值工具 */

const VAR_PATTERN = /\$\{([^}]+)\}/g;

export function interpolateString(
  input: string,
  vars: Record<string, unknown>,
): string {
  return input.replace(VAR_PATTERN, (match, name: string) => {
    const key = name.trim();
    if (!(key in vars)) return match;
    const value = vars[key];
    return value === null || value === undefined ? "" : String(value);
  });
}

/**
 * 递归插值。若字符串整体就是一个变量占位符（如 "${baseUrl}"），
 * 则直接把变量的原始值（可能是数字/数组/对象）放回去，保留类型。
 */
export function interpolate<T>(value: T, vars: Record<string, unknown>): T {
  if (typeof value === "string") {
    const whole = value.match(/^\$\{([^}]+)\}$/);
    if (whole) {
      const key = whole[1].trim();
      if (key in vars) return vars[key] as unknown as T;
    }
    return interpolateString(value, vars) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => interpolate(item, vars)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = interpolate(item, vars);
    }
    return result as unknown as T;
  }
  return value;
}

/** 支持 $.a.b / a.b / $.a[0].b / $[0] 形式的取值 */
export function resolvePath(root: unknown, expression: string): unknown {
  const raw = expression.trim().replace(/^\$\.?/, "");
  if (!raw) return root;

  const tokens: string[] = [];
  const pattern = /([^.[\]]+)|\[(\d+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw)) !== null) {
    tokens.push(match[1] ?? match[2]);
  }

  let current: unknown = root;
  for (const token of tokens) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const index = Number(token);
      if (!Number.isInteger(index)) return undefined;
      current = current[index];
      continue;
    }
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[token];
  }
  return current;
}

/** expected 是 actual 的「子集」时返回 true；对象递归，数组按下标递归 */
export function deepPartialMatch(actual: unknown, expected: unknown): boolean {
  if (expected === actual) return true;

  if (expected === null || typeof expected !== "object") {
    return actual === expected;
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) return false;
    return expected.every((item, index) => deepPartialMatch(actual[index], item));
  }

  if (actual === null || typeof actual !== "object" || Array.isArray(actual)) {
    return false;
  }

  return Object.entries(expected as Record<string, unknown>).every(([key, value]) =>
    deepPartialMatch((actual as Record<string, unknown>)[key], value),
  );
}

/** 把任意值转成适合日志展示的短字符串 */
export function preview(value: unknown, maxLength = 400): string {
  let text: string;
  try {
    text = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    text = String(value);
  }
  if (text === undefined) text = "undefined";
  return text.length > maxLength ? `${text.slice(0, maxLength)}…(已截断)` : text;
}

/** 确定性加权选择：同一序列每次运行结果一致，便于复现 */
export function pickWeighted(
  weights: number[],
  iteration: number,
): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return 0;
  const fraction = (iteration * 0.6180339887498949) % 1;
  let threshold = fraction * total;
  for (let index = 0; index < weights.length; index += 1) {
    threshold -= weights[index];
    if (threshold < 0) return index;
  }
  return weights.length - 1;
}

export function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sortedValues.length);
  const index = Math.min(sortedValues.length - 1, Math.max(0, rank - 1));
  return sortedValues[index];
}