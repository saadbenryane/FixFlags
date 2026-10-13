import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const root = resolve(process.cwd(), 'app/admin')
const pages = readdirSync(root, { recursive: true })
  .map(String)
  .filter((file) => file.endsWith('page.tsx') && file !== 'inbox/page.tsx')

describe('independent admin page access', () => {
  it.each(pages)('%s verifies admin access before page work', (file) => {
    const source = ts.createSourceFile(
      file,
      readFileSync(resolve(root, file), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    )
    const entry = source.statements.find(
      (node) =>
        ts.isFunctionDeclaration(node) &&
        node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword),
    ) as ts.FunctionDeclaration
    expect(entry?.body).toBeDefined()
    const first = entry.body!.statements[0]
    const expression = ts.isExpressionStatement(first)
      ? first.expression
      : ts.isVariableStatement(first)
        ? first.declarationList.declarations[0].initializer
        : undefined
    expect(
      expression &&
        ts.isAwaitExpression(expression) &&
        ts.isCallExpression(expression.expression) &&
        expression.expression.expression.getText(source),
    ).toBe('requireAdminPage')
  })
})
