/**
 * 数字安全格式化工具，避免对 null/undefined/NaN 调用 toFixed()
 *
 * @param value    需要格式化的值，可以是 number、string 或其他
 * @param digits   保留的小数位数，默认 0
 * @param fallback 当 value 不是有效数字时返回的占位字符串，默认 "0"
 * @returns        字符串形式的数字或占位符
 */
export function formatNumber(
  value: unknown,
  digits: number = 0,
  fallback: string = "0"
): string {
  const num = typeof value === "number" ? value : Number(value)
  return Number.isFinite(num) ? num.toFixed(digits) : fallback
}