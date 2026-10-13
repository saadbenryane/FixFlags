import {test} from 'node:test'
import assert from 'node:assert/strict'
import {fontStylesheetUrls} from './font-runtime-contract.mjs'

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
