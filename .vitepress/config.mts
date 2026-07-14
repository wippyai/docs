import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

type ManifestNode = { title: string; path?: string; children?: ManifestNode[] }

const root = process.cwd()

/** Map of language code -> directory, sourced from languages.json. */
const languages = JSON.parse(
  fs.readFileSync(path.join(root, 'languages.json'), 'utf8'),
) as Record<string, string>

const langCodes = Object.keys(languages)

/** Human-readable labels shown in the language switcher. */
const LOCALE_LABELS: Record<string, string> = {
  en: 'English',
  ru: 'Русский',
  zh: '简体中文',
  ja: '日本語',
  de: 'Deutsch',
  es: 'Español',
  ko: '한국어',
  pt: 'Português',
}

/** Read a language's navigation manifest, or an empty tree when absent. */
function loadManifest(code: string): ManifestNode[] {
  const file = path.join(root, code, 'manifest.json')
  if (!fs.existsSync(file)) return []
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

/** First leaf path within a manifest subtree (used for the "read more" links). */
function firstLeafPath(node: ManifestNode): string | undefined {
  if (node.path) return node.path
  for (const child of node.children ?? []) {
    const found = firstLeafPath(child)
    if (found) return found
  }
  return undefined
}

/**
 * Convert a manifest tree into a VitePress sidebar definition.
 * A node with children becomes a collapsible group; a node with a path is also
 * a clickable link (VitePress renders the group label as a link in that case).
 */
function toSidebar(nodes: ManifestNode[], prefix: string) {
  return nodes.map((node) => {
    const item: Record<string, unknown> = { text: node.title }
    if (node.path) item.link = prefix + node.path
    if (node.children?.length) {
      item.collapsed = false
      item.items = toSidebar(node.children, prefix)
    }
    return item
  })
}

const GITHUB_REPO = 'https://github.com/wippyai/docs'

/** Shared nav for every locale (VitePress appends the language switcher). */
const nav = [{ text: 'GitHub', link: GITHUB_REPO }]

export default withMermaid(
  defineConfig({
    title: 'Wippy',
    description: 'Comprehensive documentation for the Wippy AI platform.',

    // A custom domain (docs.wippy.ai) is configured for this repo and is
    // served at the domain root, so assets resolve from "/". Override with
    // BASE_PATH=/docs/ only if the custom domain is removed.
    base: process.env.BASE_PATH ?? '/',

    srcDir: '.',
    outDir: '.vitepress/dist',
    cacheDir: '.vitepress/cache',

    cleanUrls: true,
    lastUpdated: true,

    // README.md is the GitHub repository landing page, not a site page.
    srcExclude: ['README.md'],
    // Example localhost URLs appear in tutorial content.
    ignoreDeadLinks: 'localhostLinks',

    markdown: {
      // WIT (WebAssembly Interface Type) has no Shiki grammar; alias it to a
      // bundled C-family language so it highlights cleanly instead of warning.
      languageAlias: { wit: 'rust' },
      config(md) {
        // VitePress protects fenced code blocks from Vue interpolation with
        // v-pre, but inline code (`{{ x }}`) is not covered. Add v-pre to
        // inline <code> so template syntax in inline code renders literally.
        md.renderer.rules.code_inline = (tokens, idx) =>
          `<code v-pre>${md.utils.escapeHtml(tokens[idx].content)}</code>`

        // Escape any stray mustaches in prose text (outside any code) by
        // emitting the braces as HTML entities, which Vue does not interpolate.
        md.core.ruler.after('inline', 'escape-mustaches', (state) => {
          for (const token of state.tokens) {
            if (token.type !== 'inline' || !token.children) continue
            const next = []
            for (const child of token.children) {
              if (
                child.type === 'text' &&
                (child.content.includes('{{') || child.content.includes('}}'))
              ) {
                for (const seg of child.content.split(/(\{\{|\}\})/)) {
                  if (!seg) continue
                  if (seg === '{{' || seg === '}}') {
                    const entity = new state.Token('html_inline', '', 0)
                    entity.content = seg === '{{' ? '&#123;&#123;' : '&#125;&#125;'
                    next.push(entity)
                  } else {
                    const text = new state.Token('text', '', 0)
                    text.content = seg
                    next.push(text)
                  }
                }
              } else {
                next.push(child)
              }
            }
            token.children = next
          }
        })
        // Rewrite cross-document links that were authored root-relative
        // (e.g. `](guides/cli.md)` from `guides/configuration.md`) into correct
        // file-relative paths. The docs were written for a renderer that
        // resolved such links from the doc root; VitePress resolves them from
        // the current file's directory, so they would all 404 without this.
        md.core.ruler.after('inline', 'resolve-root-relative-links', (state) => {
          const env = state.env as { path?: string } | undefined
          if (!env?.path) return
          const rel = path.relative(root, env.path)
          const firstSeg = rel.split(path.sep)[0]
          if (!langCodes.includes(firstSeg)) return
          const fileDir = path.dirname(env.path)
          const localeRootAbs = path.join(root, firstSeg)
          for (const token of state.tokens) {
            if (token.type !== 'inline' || !token.children) continue
            for (const child of token.children) {
              if (child.type !== 'link_open') continue
              const href = child.attrGet('href')
              if (!href || /^(https?:|mailto:|tel:|[\/#])/.test(href)) continue
              const hashIdx = href.indexOf('#')
              const hrefPath = hashIdx >= 0 ? href.slice(0, hashIdx) : href
              const hash = hashIdx >= 0 ? href.slice(hashIdx) : ''
              if (!hrefPath) continue
              const clean = hrefPath.replace(/^\.\//, '').replace(/\.md$/, '')
              if (fs.existsSync(path.join(fileDir, clean + '.md'))) continue
              if (fs.existsSync(path.join(localeRootAbs, clean + '.md'))) {
                const resolved = path
                  .relative(fileDir, path.join(localeRootAbs, clean + '.md'))
                  .replace(/\.md$/, '')
                  .split(path.sep)
                  .join('/')
                child.attrSet('href', resolved + hash)
              }
            }
          }
        })
      },
    },

    head: [
      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { property: 'og:site_name', content: 'Wippy Documentation' }],
      ['meta', { property: 'og:title', content: 'Wippy Documentation' }],
      ['meta', { property: 'og:description', content: 'Comprehensive documentation for the Wippy AI platform.' }],
      ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ],

    locales: Object.fromEntries(
      langCodes.map((code) => {
        const sidebar = toSidebar(loadManifest(code), `/${code}/`)
        return [
          code,
          {
            label: LOCALE_LABELS[code] ?? code.toUpperCase(),
            lang: code,
            themeConfig: {
              nav,
              sidebar,
              editLink: {
                pattern: `${GITHUB_REPO}/edit/main/:path`,
                text: 'Edit this page on GitHub',
              },
            },
          },
        ]
      }),
    ),

    themeConfig: {
      socialLinks: [{ icon: 'github', link: GITHUB_REPO }],
      search: { provider: 'local' },
      outline: { level: [2, 3], label: 'On this page' },
      lastUpdatedText: 'Last updated',
      darkModeSwitchLabel: 'Appearance',
      sidebarMenuLabel: 'Menu',
      returnToTopLabel: 'Back to top',
      footer: {
        message: `Released under the <a href="${GITHUB_REPO}/blob/main/LICENSE">Apache-2.0 License</a>.`,
        copyright: 'Copyright © Wippy AI',
      },
    },

    mermaid: {
      // The plugin auto-switches light/dark with the site theme.
    },

    vite: {
      build: {
        // The per-locale local search index (~1.5 MB) is lazy-loaded only
        // when search is used; raise the limit so the build log stays clean.
        chunkSizeWarningLimit: 2000,
      },
    },
  }),
)
