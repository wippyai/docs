/**
 * Ensure every Markdown page has a `description` in its frontmatter (Starlight
 * renders it as <meta name="description">, which Lighthouse SEO requires).
 * The description is derived from the first paragraph of body content; pages
 * that already declare a description are left untouched.
 *
 * Run via `pnpm descriptions`. Idempotent.
 */
import fs from 'node:fs'
import path from 'node:path'

const DOCS = path.join('src', 'content', 'docs')

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else if (entry.name.endsWith('.md')) yield full
  }
}

function parseFrontmatter(src) {
  if (!src.startsWith('---\n')) return { fm: null, body: src, end: -1 }
  const end = src.indexOf('\n---\n', 4)
  if (end < 0) return { fm: null, body: src, end: -1 }
  return { fm: src.slice(4, end), body: src.slice(end + 5), end }
}

function firstParagraph(body) {
  const lines = body.split('\n')
  let seenH1 = false
  let para = []
  let inFence = false
  for (const line of lines) {
    if (line.startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    if (/^#\s+/.test(line)) {
      seenH1 = true
      para = []
      continue
    }
    if (!seenH1) continue
    if (line.trim() === '') {
      if (para.length) break
      continue
    }
    if (/^\s*[-*+]\s/.test(line) || /^\s*\d+\.\s/.test(line) || line.startsWith('|') || line.startsWith('>')) {
      if (para.length) break
      continue
    }
    para.push(line.trim())
  }
  let text = para
    .join(' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#_>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length > 155) text = text.slice(0, 152).replace(/\s+\S*$/, '') + '…'
  return text
}

let touched = 0
let skipped = 0
for (const file of walk(DOCS)) {
  const src = fs.readFileSync(file, 'utf8')
  const { fm, body, end } = parseFrontmatter(src)
  if (fm !== null && /^description:\s*\S/m.test(fm)) {
    skipped++
    continue
  }
  const desc = firstParagraph(body)
  if (!desc) {
    skipped++
    continue
  }
  const safe = desc.replace(/"/g, "'")
  const newSrc =
    fm === null
      ? `---\ndescription: "${safe}"\n---\n\n${body}`
      : `${src.slice(0, end + 1)}description: "${safe}"\n${src.slice(end + 1)}`
  fs.writeFileSync(file, newSrc)
  touched++
}

console.log(`Descriptions: wrote ${touched}, skipped ${skipped}.`)
