import { readdir, readFile } from 'node:fs/promises'
import { dirname, posix, relative, resolve } from 'node:path'
import process from 'node:process'

const root = process.cwd()
const languages = JSON.parse(await readFile(resolve(root, 'languages.json'), 'utf8'))
const localeRoots = new Set(Object.values(languages))
const failures = []

async function markdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(entries.map((entry) => {
    const entryPath = resolve(dir, entry.name)
    if (entry.isDirectory()) return markdownFiles(entryPath)
    return entry.isFile() && entry.name.endsWith('.md') ? [entryPath] : []
  }))
  return nested.flat()
}

function repositoryPath(file) {
  return relative(root, file).replaceAll('\\', '/')
}

function splitTarget(url) {
  const hashAt = url.indexOf('#')
  return hashAt < 0 ? url : url.slice(0, hashAt)
}

function isLocalMarkdownUrl(url) {
  if (!url || url.startsWith('#') || url.startsWith('/')) return false
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return false
  return splitTarget(url).toLowerCase().endsWith('.md')
}

function targetCandidates(sourceFile, url) {
  const sourcePath = repositoryPath(sourceFile)
  const locale = sourcePath.split('/')[0]
  const pathname = splitTarget(url)
  const sourceRelative = posix.normalize(posix.join(dirname(sourcePath).replaceAll('\\', '/'), pathname))
  const localeRelative = posix.normalize(posix.join(locale, pathname))

  // Production accepts explicit source-relative links and established bare
  // locale-root links. Bare filenames are also accepted relative to the page.
  if (pathname.startsWith('./') || pathname.startsWith('../')) return [sourceRelative]
  return [...new Set([localeRelative, sourceRelative])]
}

function linksOutsideFences(markdown) {
  const links = []
  let fence = null
  for (const [index, line] of markdown.split(/\r?\n/).entries()) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/)
    if (fenceMatch) {
      const marker = fenceMatch[1][0]
      if (fence === null) fence = marker
      else if (fence === marker) fence = null
      continue
    }
    if (fence !== null) continue

    const linkPattern = /!?\[[^\]]*\]\(([^\s)]+)(?:\s+["'][^"']*["'])?\)/g
    for (const match of line.matchAll(linkPattern)) {
      if (isLocalMarkdownUrl(match[1])) links.push({ line: index + 1, url: match[1] })
    }
  }
  return links
}

const files = (await Promise.all(
  [...localeRoots].map((locale) => markdownFiles(resolve(root, locale))),
)).flat()
const existingPaths = new Set(files.map(repositoryPath))
let checkedLinks = 0

for (const file of files) {
  const markdown = await readFile(file, 'utf8')
  for (const link of linksOutsideFences(markdown)) {
    checkedLinks += 1
    const candidates = targetCandidates(file, link.url)
    if (!candidates.some((candidate) => existingPaths.has(candidate))) {
      failures.push(`${repositoryPath(file)}:${link.line} ${link.url}`)
    }
  }
}

if (failures.length > 0) {
  console.error(`Markdown link check failed (${failures.length}/${checkedLinks} unresolved):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(`Markdown link checks passed (${checkedLinks} local Markdown links across ${files.length} pages).`)
}
