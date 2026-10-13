import {test} from 'node:test'
import assert from 'node:assert/strict'
import {fontStylesheetUrls, stylesheetHasSelector} from './font-runtime-contract.mjs'

test('recognizes standalone and optimized grouped font selectors', () => {
  for (const css of ['.font-variables { --font-sans: "Inter Variable" }', '.font-variables,:root{--font-sans:"Inter Variable"}', '@layer base { :root, .font-variables { --font-sans: "Inter Variable" } }']) {
    assert.equal(stylesheetHasSelector(css, '.font-variables'), true)
  }
  assert.equal(stylesheetHasSelector('.font-variables,:root{color:red}', ':root'), true)
})

test('does not mistake comments, string values or different selectors for the font rule', () => {
  for (const css of ['/* .font-variables{color:red} */ body{color:red}', 'body{content:".font-variables{"}', '.font-variables-disabled{color:red}', 'body.font-variables{color:red}', '.font-variables:hover{color:red}']) {
    assert.equal(stylesheetHasSelector(css, '.font-variables'), false)
  }
})

test('discovers Webpack, Turbopack and production stylesheets in rendered order', () => {
  const html = `<link href="/_next/static/css/app/layout.css?v=1&amp;x=2" rel="stylesheet"><link rel='stylesheet' href='/_next/static/chunks/_123._.css'><link rel="preload stylesheet" href="/_next/static/css/abc.css">`
  assert.deepEqual(fontStylesheetUrls(html,'https://fixflags.test/'),[
    'https://fixflags.test/_next/static/css/app/layout.css?v=1&x=2',
    'https://fixflags.test/_next/static/chunks/_123._.css',
    'https://fixflags.test/_next/static/css/abc.css',
  ])
})
test('rejects external, non-stylesheet and unrelated assets, and deduplicates links', () => {
  const html = `<link rel="stylesheet" href="https://other.test/_next/static/a.css"><link rel="preload" href="/_next/static/b.css"><link rel="stylesheet" href="/unrelated.css"><link rel="stylesheet" href="/_next/static/x.css"><link href="/_next/static/x.css" rel="stylesheet">`
  assert.deepEqual(fontStylesheetUrls(html,'https://fixflags.test/'),['https://fixflags.test/_next/static/x.css'])
  assert.deepEqual(fontStylesheetUrls('<p>No stylesheet</p>','https://fixflags.test/'),[])
})
