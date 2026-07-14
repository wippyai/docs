/**
 * Generate a VitePress home page (`<locale>/index.md`) for every language,
 * derived from that language's `manifest.json`.
 *
 * Run automatically by the `dev`/`build` npm scripts. Output is gitignored.
 */
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const languages = JSON.parse(
  fs.readFileSync(path.join(root, 'languages.json'), 'utf8'),
)

/** Collect every leaf title beneath a manifest node. */
function leafTitles(node) {
  const out = []
  for (const child of node.children ?? []) {
    if (child.path) out.push(child.title)
    if (child.children?.length) out.push(...leafTitles(child))
  }
  return out
}

/** First leaf path beneath a node, for the "read more" link. */
function firstLeafPath(node) {
  if (node.path) return node.path
  for (const child of node.children ?? []) {
    const found = firstLeafPath(child)
    if (found) return found
  }
  return undefined
}

function buildHome(code, manifest) {
  const prefix = `/${code}/`
  const startLink = prefix + (firstLeafPath(manifest[0] ?? {}) ?? '')
  const features = manifest
    .map((section) => {
      const link = prefix + (firstLeafPath(section) ?? '')
      const titles = leafTitles(section).slice(0, 4)
      const details =
        titles.length > 0
          ? titles.join(' · ') + (leafTitles(section).length > 4 ? ' …' : '')
          : section.title
      return `  - title: ${JSON.stringify(section.title)}\n    details: ${JSON.stringify(details)}\n    link: ${JSON.stringify(link)}`
    })
    .join('\n')

  return `---
layout: home

hero:
  name: Wippy
  text: Durable AI agents and services
  tagline: Comprehensive documentation for the Wippy AI platform.
  image:
    src: https://github.com/wippyai/.github/raw/main/logo/wippy-text-light.svg
    alt: Wippy
  actions:
    - theme: brand
      text: Get Started
      link: ${JSON.stringify(startLink)}
    - theme: alt
      text: GitHub
      link: https://github.com/wippyai/docs

features:
${features}
---
`
}

let generated = 0
for (const code of Object.keys(languages)) {
  const manifestPath = path.join(root, code, 'manifest.json')
  if (!fs.existsSync(manifestPath)) continue
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  fs.writeFileSync(path.join(root, code, 'index.md'), buildHome(code, manifest))
  generated += 1
}

console.log(`Generated ${generated} locale home page(s).`)
