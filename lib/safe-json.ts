import { jsonrepair } from 'jsonrepair'

/**
 * 从 AI 返回的文本中提取纯 JSON 字符串，兼容 ```json、```、或无代码块格式。
 */
export const extractJSON = (raw: string): string => {
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/i
  const match = raw.match(fenceRegex)
  return (match ? match[1] : raw).trim()
}

/**
 * 尝试安全解析 AI 返回的 JSON，自动修复常见格式错误。
 * 若三次尝试仍失败，则抛出原始错误。
 */
export function safeJSONParse(raw: string): any {
  let jsonString = extractJSON(raw)
  try {
    return JSON.parse(jsonString)
  } catch (e) {
    try {
      const repaired = jsonrepair(jsonString)
      return JSON.parse(repaired)
    } catch (e2) {
      const repairedFull = jsonrepair(raw)
      return JSON.parse(repairedFull)
    }
  }
}