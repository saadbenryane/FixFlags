import { z, type ZodTypeAny } from 'zod'

/**
 * Zod 4 native JSON Schema helpers for LLM tool schemas.
 * Do not use `zod-to-json-schema` with Zod 4: it returns empty objects.
 */

export function toJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  const generated = z.toJSONSchema(schema) as Record<string, unknown>
  delete generated.$schema
  return generated
}

/** Recursively convert `anyOf: [{type:T},{type:null}]` to OpenAPI `{type:T, nullable:true}`. */
export function toOpenApiNullableSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toOpenApiNullableSchema)
  if (!node || typeof node !== 'object') return node

  const record = node as Record<string, unknown>
  if (Array.isArray(record.anyOf) && record.anyOf.length === 2) {
    const parts = record.anyOf as Array<Record<string, unknown>>
    const nullPart = parts.find((p) => p.type === 'null')
    const typePart = parts.find((p) => p.type !== 'null')
    if (nullPart && typePart) {
      const rest = { ...record }
      delete rest.anyOf
      return toOpenApiNullableSchema({
        ...rest,
        ...typePart,
        nullable: true,
      })
    }
  }

  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, toOpenApiNullableSchema(value)])
  )
}

/** Strip JSON Schema `format` keywords OpenAI strict mode rejects. */
export function stripFormatKeyword(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripFormatKeyword)
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>)
        .filter(([key]) => key !== 'format')
        .map(([key, value]) => [key, stripFormatKeyword(value)])
    )
  }
  return node
}
