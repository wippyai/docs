/**
 * Ensure every Markdown page has a `title` in its frontmatter (Starlight
 * requires it). The title is derived from the first "# Heading" in the file;
 * pages that already declare a title are left untouched.
 *
 * Run once via `pnpm titles`. Idempotent.
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
  if (!src.startsWith('---\n')) return { fm: null, body: src }
  const end = src.indexOf('\n---\n', 4)
  if (end < 0) return { fm: null, body: src }
  return { fm: src.slice(4, end), body: src.slice(end + 5), end }
}

let touched = 0
let skipped = 0
for (const file of walk(DOCS)) {
  const src = fs.readFileSync(file, 'utf8')
  const { fm, body, end } = parseFrontmatter(src)
  if (fm !== null && /^title:\s*\S/m.test(fm)) {
    skipped++
    continue
  }
  const match = body.match(/^#\s+(.+?)\s*$/m)
  const title = (match ? match[1] : path.basename(file, '.md')).replace(/"/g, "'")
  const newSrc =
    fm === null
      ? `---\ntitle: "${title}"\n---\n\n${body}`
      : `${src.slice(0, end + 1)}title: "${title}"\n${src.slice(end + 1)}`
  fs.writeFileSync(file, newSrc)
  touched++
}

console.log(`Titles: wrote ${touched}, skipped ${skipped} (already had one).`)
