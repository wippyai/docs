import { defineConfig } from 'astro/config'
import { unified } from '@astrojs/markdown-remark'
import starlight from '@astrojs/starlight'
import sitemap from '@astrojs/sitemap'
import fs from 'node:fs'
import path from 'node:path'

/** Map of language code -> directory (sourced from languages.json). */
const languages = JSON.parse(
  fs.readFileSync('languages.json', 'utf8'),
)

/** Locale code -> human label + html lang. The content directory matches the key. */
const LOCALES = {
  en: { label: 'English', lang: 'en' },
  de: { label: 'Deutsch', lang: 'de' },
  es: { label: 'Español', lang: 'es' },
  ja: { label: '日本語', lang: 'ja' },
  ko: { label: '한국어', lang: 'ko' },
  pt: { label: 'Português', lang: 'pt' },
  ru: { label: 'Русский', lang: 'ru' },
  zh: { label: '简体中文', lang: 'zh-CN' },
}

const GITHUB_REPO = 'https://github.com/wippyai/docs'

/** Read a language's navigation manifest, or an empty tree when absent. */
function loadManifest(code) {
  const file = path.join('src', 'content', 'docs', code, 'manifest.json')
  if (!fs.existsSync(file)) return []
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

/** First leaf path within a manifest subtree. */
function firstLeafPath(node) {
  if (node.path) return node.path
  for (const child of node.children ?? []) {
    const found = firstLeafPath(child)
    if (found) return found
  }
  return undefined
}

/** Convert a manifest tree into a Starlight sidebar definition. */
function toSidebar(nodes, prefix) {
  return nodes.map((node) => {
    const item = { label: node.title }
    if (node.path) item.link = prefix + node.path
    if (node.children?.length) {
      item.collapsed = false
      item.items = toSidebar(node.children, prefix)
    }
    return item
  })
}

const locales = Object.fromEntries(
  Object.keys(languages)
    .filter((code) => LOCALES[code])
    .map((code) => [
      code,
      {
        label: LOCALES[code].label,
        lang: LOCALES[code].lang,
        sidebar: toSidebar(loadManifest(code), `/${code}/`),
      },
    ]),
)

/**
 * Remark plugin: rewrite cross-document links that were authored
 * root-relative (e.g. `](guides/cli.md)` from `guides/configuration.md`).
 * The docs were written for a renderer that resolved such links from the
 * doc root; Astro/Starlight resolves them from the current file, so without
 * this they all 404. If a link resolves current-dir-relative, it is left
 * alone; otherwise it is re-resolved against the locale root.
 */
function rewriteRootRelativeLinks() {
  return (tree, file) => {
    const filePath = file.path || (file.history && file.history[0])
    if (!filePath) return
    const seg = 'src/content/docs/'
    const idx = filePath.indexOf(seg)
    if (idx < 0) return
    const localeRoot = path.join(
      filePath.slice(0, idx + seg.length),
      filePath.slice(idx + seg.length).split('/')[0],
    )
    const fileDir = path.dirname(filePath)
    const visit = (node) => {
      if (node.type === 'link' && typeof node.url === 'string') {
        const url = node.url
        if (!url || /^(https?:|mailto:|tel:|[/?#])/.test(url)) {
          if (node.children) node.children.forEach(visit)
          return
        }
        const hashIdx = url.indexOf('#')
        const hrefPath = hashIdx >= 0 ? url.slice(0, hashIdx) : url
        const hash = hashIdx >= 0 ? url.slice(hashIdx) : ''
        if (!hrefPath) return
        const clean = hrefPath.replace(/^\.\//, '').replace(/\.md$/, '')
        if (fs.existsSync(path.join(fileDir, clean + '.md'))) return
        if (fs.existsSync(path.join(localeRoot, clean + '.md'))) {
          node.url =
            path
              .relative(fileDir, path.join(localeRoot, clean + '.md'))
              .replace(/\.md$/, '')
              .split(path.sep)
              .join('/') + hash
        }
      }
      if (node.children) node.children.forEach(visit)
    }
    visit(tree)
  }
}

export default defineConfig({
  site: 'https://docs.wippy.ai',
  trailingSlash: 'never',
  markdown: {
    processor: unified({ remarkPlugins: [rewriteRootRelativeLinks] }),
  },
  integrations: [
    starlight({
      title: 'Wippy',
      defaultLocale: 'en',
      locales,
      social: [
        { icon: 'github', label: 'GitHub', href: GITHUB_REPO },
      ],
      customCss: ['./src/styles/custom.css'],
      components: { Head: './src/components/Head.astro' },
    }),
    sitemap(),
  ],
  vite: {
    build: {
      // Mermaid is a large bundle by nature but is dynamically imported only
      // on pages that contain diagrams; raise the limit to keep the log clean.
      chunkSizeWarningLimit: 2000,
    },
  },
})
