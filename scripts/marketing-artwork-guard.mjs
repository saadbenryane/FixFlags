#!/usr/bin/env node

import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const manifestPath = path.join(ROOT, 'lib/marketing/artwork-manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const allowedClassifications = new Set(['approved', 'refined', 'replaced'])
const forbiddenTerms = [
  /run audit/i,
  /lighthouse/i,
  /performance score/i,
  /best practices/i,
  /automatic pr/i,
  /coming soon/i,
]
const violations = []

if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.assets)) {
  violations.push('artwork manifest must use schemaVersion 1 with an assets array')
}

const ids = new Set()
const sources = new Set()

for (const asset of manifest.assets ?? []) {
  if (ids.has(asset.id)) violations.push(`duplicate artwork id: ${asset.id}`)
  if (sources.has(asset.src)) violations.push(`duplicate artwork src: ${asset.src}`)
  ids.add(asset.id)
  sources.add(asset.src)

  if (!allowedClassifications.has(asset.classification)) {
    violations.push(`${asset.id}: invalid classification ${asset.classification}`)
  }

  const relativePath = asset.src.replace(/^\//, '')
  const filePath = path.join(ROOT, 'public', relativePath)
  let metadata
  try {
    statSync(filePath)
    metadata = await sharp(filePath).metadata()
  } catch {
    violations.push(`${asset.id}: missing or unreadable asset ${asset.src}`)
    continue
  }

  if ((metadata.width ?? 0) < asset.width || (metadata.height ?? 0) < asset.height) {
    violations.push(
      `${asset.id}: expected at least ${asset.width}x${asset.height}, got ${metadata.width}x${metadata.height}`
    )
  }
  if (asset.requiresAlpha && metadata.hasAlpha !== true) {
    violations.push(`${asset.id}: expected an alpha channel`)
  }
  if (asset.contentBearing && asset.requiredTerms.length === 0) {
    violations.push(`${asset.id}: content-bearing artwork must declare requiredTerms`)
  }

  const declaredText = asset.requiredTerms.join(' ')
  for (const term of forbiddenTerms) {
    if (term.test(declaredText)) {
      violations.push(`${asset.id}: forbidden artwork term ${term}`)
    }
  }

  for (const consumer of asset.consumers) {
    const consumerPath = path.join(ROOT, consumer)
    let source
    try {
      source = readFileSync(consumerPath, 'utf8')
    } catch {
      violations.push(`${asset.id}: missing consumer ${consumer}`)
      continue
    }
    if (!source.includes(asset.src)) {
      violations.push(`${asset.id}: ${consumer} does not reference ${asset.src}`)
    }
  }

  for (const replacedSrc of asset.replaces ?? []) {
    for (const consumer of asset.consumers) {
      const source = readFileSync(path.join(ROOT, consumer), 'utf8')
      if (source.includes(replacedSrc)) {
        violations.push(`${asset.id}: ${consumer} still references replaced asset ${replacedSrc}`)
      }
    }
  }
}

if (violations.length > 0) {
  console.error('marketing-artwork-guard failed:\n' + violations.map((v) => `  - ${v}`).join('\n'))
  process.exit(1)
}

console.log(`marketing-artwork-guard: ok (${manifest.assets.length} generated assets)`)
