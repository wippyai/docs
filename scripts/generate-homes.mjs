/**
 * Generate a Starlight home page (`src/content/docs/<locale>/index.md`) for
 * every language, derived from that language's `manifest.json`.
 *
 * Run via `pnpm homes`. Output is committed (it is real content).
 */
import fs from 'node:fs'
import path from 'node:path'

const DOCS = path.join('src', 'content', 'docs')
const languages = JSON.parse(fs.readFileSync('languages.json', 'utf8'))

/** Every leaf title beneath a manifest node. */
function leafTitles(node) {
  const out = []
  for (const child of node.children ?? []) {
    if (child.path) out.push(child.title)
    if (child.children?.length) out.push(...leafTitles(child))
  }
  return out
}

/** First leaf path beneath a node. */
function firstLeafPath(node) {
  if (node.path) return node.path
  for (const child of node.children ?? []) {
    const found = firstLeafPath(child)
    if (found) return found
  }
  return undefined
}

function buildHome(manifest) {
  const start = firstLeafPath(manifest[0] ?? {}) ?? ''
  const cards = manifest
    .map((section) => {
      const link = firstLeafPath(section) ?? ''
      const titles = leafTitles(section)
      const details =
        titles.length > 0
          ? titles.slice(0, 4).join(' · ') + (titles.length > 4 ? ' …' : '')
          : ''
      return `- **[${section.title}](${link})**${details ? ` — ${details}` : ''}`
    })
    .join('\n')

  return `---
title: Wippy
---

# Wippy Documentation

Comprehensive documentation for the Wippy AI platform — durable AI agents,
services, and the runtime that runs them.

## Explore

${cards}

Start with **[Getting Started](${start})** if you are new here.
`
}

let generated = 0
for (const code of Object.keys(languages)) {
  const manifestPath = path.join(DOCS, code, 'manifest.json')
  if (!fs.existsSync(manifestPath)) continue
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  fs.writeFileSync(path.join(DOCS, code, 'index.md'), buildHome(manifest))
  generated += 1
}

console.log(`Generated ${generated} locale home page(s).`)
