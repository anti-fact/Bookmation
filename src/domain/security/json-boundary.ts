import type { JsonValue } from "../types"

const FORBIDDEN_OBJECT_KEYS = new Set(["__proto__", "prototype", "constructor"])

export function jsonValueWithinBounds(
  value: unknown,
  maxDepth: number,
  depth = 0,
): value is JsonValue {
  if (depth > maxDepth) {
    return false
  }

  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
  }

  if (Array.isArray(value)) {
    return value.every((item) => jsonValueWithinBounds(item, maxDepth, depth + 1))
  }

  if (typeof value !== "object") {
    return false
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_OBJECT_KEYS.has(key)) {
      return false
    }
    if (!jsonValueWithinBounds(nested, maxDepth, depth + 1)) {
      return false
    }
  }

  return true
}
