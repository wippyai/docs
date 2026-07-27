import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import process from 'node:process'

const root = join(process.cwd(), 'en', 'frontend')
const allowedNativeControlFile = 'web-host/theme-persistence.md'
const errors = []
const nativeButtonPattern = /<button\b/
const nativeControlPattern = /<(?:button|input|select|textarea)\b/

if (!nativeButtonPattern.test('<button type="button">') || nativeButtonPattern.test('<Button label="Save" />')) {
  throw new Error('native button detector self-test failed')
}

async function markdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return markdownFiles(path)
    return entry.isFile() && entry.name.endsWith('.md') ? [path] : []
  }))
  return nested.flat()
}

function lineOf(content, index) {
  return content.slice(0, index).split('\n').length
}

function reject(file, content, pattern, message, scope = content, offset = 0) {
  const match = pattern.exec(scope)
  if (!match) return
  const sourceIndex = scope === content ? match.index : offset + match.index
  errors.push(`${file}:${lineOf(content, sourceIndex)} ${message}`)
}

function yamlCasingViolations(yaml) {
  const violations = []
  const stack = []
  const forbiddenNestedSnakeKeys = new Set([
    'theme_config',
    'custom_css',
    'custom_variables',
    'tailwind_config',
    'resize_observer',
    'prevent_link_clicks',
    'iconify_icons',
    'refresh_when_visible',
    'history_polyfill',
    'error_capture',
    'css_variables',
    'icon_sets',
    'axios_defaults',
    'route_prefix',
    'api_routes',
  ])

  for (const [index, line] of yaml.split('\n').entries()) {
    const match = line.match(/^(\s*)(?:-\s+)?([A-Za-z_][A-Za-z0-9_-]*)\s*:/)
    if (!match) continue

    const indent = match[1].length
    const key = match[2]
    while (stack.at(-1)?.indent >= indent) stack.pop()
    const parents = stack.map((entry) => entry.key)

    if (parents.at(-1) === 'meta' && key === 'configOverrides') {
      violations.push({
        index,
        message: 'registry override wrapper must be config_overrides',
      })
    }

    if (parents.at(-1) === 'meta' && key === 'mount_route') {
      violations.push({
        index,
        message: 'current backend compatibility field must be mountRoute until the mount_route fix ships',
      })
    }

    if ((parents.includes('proxy') || parents.includes('config_overrides'))
      && forbiddenNestedSnakeKeys.has(key)) {
      violations.push({
        index,
        message: 'nested backend config key must retain its defined lower-camel-case name',
      })
    }

    stack.push({ indent, key })
  }

  return violations
}

const yamlCasingCases = [
  ['meta:\n  proxy:\n    injections:\n      css:\n        themeConfig: true', 0],
  ['meta:\n  proxy:\n    injections:\n      css:\n        theme_config: true', 1],
  ['meta:\n  mountRoute: /home', 0],
  ['meta:\n  mount_route: /home', 1],
  ['meta:\n  configOverrides: {}', 1],
  ['custom_css: ""', 0],
  ['config_overrides:\n  customization:\n    customCSS: ""', 0],
  ['config_overrides:\n  customization:\n    custom_css: ""', 1],
]
for (const [yaml, expected] of yamlCasingCases) {
  if (yamlCasingViolations(yaml).length !== expected) {
    throw new Error(`YAML casing self-test failed: ${yaml}`)
  }
}

for (const path of await markdownFiles(root)) {
  const file = relative(root, path).replaceAll('\\', '/')
  const content = await readFile(path, 'utf8')
  const codeBlocks = [...content.matchAll(/```([^\n]*)\n([\s\S]*?)```/g)].map((match) => ({
    language: match[1].trim().toLowerCase(),
    content: match[2],
    offset: match.index + match[0].indexOf(match[2]),
  }))

  reject(file, content, /raw HTML buttons \+ custom CSS/i, 'raw Vue controls cannot be a compliance exception')
  reject(file, content, /MUST be scoped to `\.wippy-host-app`/, 'host-boundary scoping cannot be a universal customCSS rule')
  reject(file, content, /\b(?:bg|border)-content-(?:background|border-color)\b/, 'undefined semantic Tailwind utility; use an actual preset utility or arbitrary semantic token')
  reject(file, content, /PrimeVue is \*\*not\*\* in the host import map/, 'PrimeVue availability must be target-release and subpath specific')
  reject(file, content, /Micro Frontend Apps must use `createMemoryHistory`/, 'router rule ignores Fragment-only delivery')
  reject(file, content, /into the shadow root via an adopted stylesheet/, 'delivery claim ignores the style-element fallback')
  reject(file, content, /host(?:'s)? importmap .*overrides yours/i, 'undocumented import-map precedence claim')
  reject(file, content, /\bmerged import\s*map\b|\bmerged importmap\b/i, 'undocumented import-map merge claim')
  reject(file, content, /host(?:'s)? (?:own )?entr(?:y|ies) override/i, 'undocumented host-entry precedence claim')
  reject(file, content, /universal precedence[^\n]*host-provided|host-provided runtime first/i, 'undocumented universal import-map precedence claim')
  reject(file, content, /\bMUST\b[^\n]*\bdist\/(?:app\.html|wippy-meta\.json)\b/, 'dist is not a universal served-output path')
  reject(file, content, /CLAUDE\.md/i, 'canonical docs must not require a particular agent-instruction filename')
  reject(file, content, /only imported specifiers|only exact bare specifiers present/i, 'Rollup externals must contain every key in the fetched target-host import map')
  reject(file, content, /Importmap URLs SHOULD use `https:\/\/esm\.sh/i, 'host-less import map must copy the fetched target-host imports object')
  reject(file, content, /different framework[^\n]*PrimeVue|PrimeVue[^\n]*different framework/i, 'framework choice does not exempt standard product controls from PrimeVue')
  reject(file, content, /iframe-related layout|iframe layout\/containment/i, 'iframe CSS currently supplies themed scrollbar consistency, not a layout reset')
  reject(file, content, /facade `customCSS`/i, 'backend facade parameter is custom_css; customCSS is frontend/runtime casing')
  reject(file, content, /YAML\s+(?:uses|must use|is)\s+(?:the\s+same\s+)?camelCase/i, 'backend YAML casing is schema-specific')
  reject(file, content, /three-way sync|three lists must (?:coexist|be identical)/i, 'peer dependencies do not mirror the full import-map external set')
  reject(file, content, /`config_overrides[^`]*\.(?:css_variables|custom_css|icon_sets|axios_defaults|route_prefix|api_routes)\b[^`]*`/, 'nested config_overrides keys retain their defined lower-camel-case names')
  reject(file, content, /remove or keep your inline map|covers host-provided packages the app imports/i, 'host-less mode requires the complete fetched import map')
  reject(file, content, /must be \*\*bundled\*\*[^\n]*(?:NOT external|never external)/i, 'bundling depends on exact target-host import-map presence')
  reject(file, content, /\*\*No REJECTs\.\*\*|Gold standard passes/i, 'templates are not automatic compliance authorities')
  reject(file, content, /gold standards? win|Gold-standard validation report/i, 'templates cannot override the frontend contract')
  reject(file, content, /`npm run build`/, 'inline production build must include --outDir and --emptyOutDir')

  for (const block of codeBlocks) {
    reject(file, content, /window(?:\.parent)?\.location\b/, 'copyable child code infers host context from browser location', block.content, block.offset)
    reject(file, content, /window\.parent\.postMessage\b/, 'copyable code bypasses AppConfig/router/proxy', block.content, block.offset)
    reject(file, content, /shadowRoot\.innerHTML\s*=/, 'copyable code rewrites a mounted shadow tree', block.content, block.offset)
    reject(file, content, /appendTo\s*[:=]\s*['"]self['"]/, 'copyable overlay recipe forces inline self placement', block.content, block.offset)
    reject(file, content, /createMemoryHistory\s*\(/, 'copyable app code hand-rolls portable routing instead of using @wippy-fe/router', block.content, block.offset)
    reject(file, content, /router\.afterEach[\s\S]{0,300}host\.onRouteChanged/, 'copyable app code hand-rolls host route synchronization', block.content, block.offset)
    reject(file, content, /on\(['"]@history['"]/, 'copyable app code subscribes to package-owned history events', block.content, block.offset)
    reject(file, content, /!important\b/, 'copyable frontend code uses !important', block.content, block.offset)
    reject(file, content, /<div\b[^>]*(?:@click\b|role=['"]button['"])/, 'clickable non-interactive element appears in copyable code', block.content, block.offset)
    reject(file, content, /<a\b[\s\S]*?<Button\b|<Button\b[\s\S]*?<a\b/, 'nested interactive controls appear in one copyable markup block', block.content, block.offset)
    reject(file, content, /\bnpm run build\s*(?:&&|\\|$)/m, 'production build must pass --outDir and --emptyOutDir', block.content, block.offset)
    reject(file, content, /type="importmap"[\s\S]*?\/\*/, 'JSON comments are invalid inside an import-map script', block.content, block.offset)
    reject(file, content, /external\s*:\s*\[/, 'copyable Vite config hand-maintains an external subset instead of using all fetched import-map keys', block.content, block.offset)
    reject(file, content, /import\s*\{\s*createAppRouter\s*\}\s*from\s*['"]\.\/router['"]/, 'app bootstrap imports the package router factory from a local route module', block.content, block.offset)
    reject(file, content, /createAppRouter\(\s*(?:host|on|initialPath)\b/, 'router factory must receive route records first', block.content, block.offset)

    if (/rollupOptions\s*:/.test(block.content)
      && /external\s*:/.test(block.content)
      && !/Object\.keys\(hostImportMap\.imports\)/.test(block.content)) {
      errors.push(`${file}:${lineOf(content, block.offset)} Vite external list must derive from every fetched import-map key`)
    }

    if (/from\s*['"]@wippy-fe\/router['"]/.test(block.content)
      && /createAppRouter\(/.test(block.content)
      && !/createAppRouter\(\s*(?:routes|\[)/.test(block.content)) {
      errors.push(`${file}:${lineOf(content, block.offset)} package router example must call createAppRouter with route records first`)
    }

    if (block.language === 'json' && /"type"\s*:\s*"page"/.test(block.content)) {
      try {
        const pagePackage = JSON.parse(block.content)
        const completePackageExample = Boolean(pagePackage.name || pagePackage.specification)
        if (completePackageExample
          && pagePackage.wippy?.proxy?.injections?.css?.iframe !== true) {
          errors.push(`${file}:${lineOf(content, block.offset)} view.page package example must enable css.iframe scrollbar styling`)
        }
      }
      catch (error) {
        errors.push(`${file}:${lineOf(content, block.offset)} invalid view.page package JSON: ${error.message}`)
      }
    }

    for (const importMap of block.content.matchAll(/<script\s+type="importmap">\s*([\s\S]*?)\s*<\/script>/g)) {
      if (importMap[1].includes('...')) {
        errors.push(`${file}:${lineOf(content, block.offset + importMap.index)} import-map example contains an ellipsis placeholder`)
        continue
      }
      try {
        const parsed = JSON.parse(importMap[1])
        if (!parsed.imports || typeof parsed.imports !== 'object' || Array.isArray(parsed.imports)) {
          throw new Error('imports must be an object')
        }
        const entries = Object.entries(parsed.imports)
        if (entries.length < 20) {
          throw new Error('complete host import map cannot contain fewer than the verified 20-key baseline')
        }
        const tags = new Set(entries.map(([, url]) => (
          String(url).match(/^https:\/\/web-host\.wippy\.ai\/([^/]+)\//)?.[1]
        )))
        if (tags.has(undefined) || tags.size !== 1) {
          throw new Error('all import-map URLs must use one pinned Web Host tag')
        }
        const proxyTag = block.content.match(
          /https:\/\/web-host\.wippy\.ai\/([^/]+)\/dev-proxy\.js/,
        )?.[1]
        if (proxyTag && !tags.has(proxyTag)) {
          throw new Error('dev-proxy tag must match the import-map tag')
        }
      }
      catch (error) {
        errors.push(
          `${file}:${lineOf(content, block.offset + importMap.index)} invalid import-map example: ${error.message}`,
        )
      }
    }

    if (block.language === 'yaml' || block.language === 'yml') {
      const yamlLines = block.content.split('\n')
      for (const violation of yamlCasingViolations(block.content)) {
        errors.push(
          `${file}:${lineOf(content, block.offset) + violation.index} ${violation.message}`,
        )
      }

      for (let index = 0; index < yamlLines.length; index += 1) {
        const line = yamlLines[index]
        if (!/^\s*(?:-\s+)?[^#][^:]*:\s*(?:#.*)?$/.test(line)) continue
        const parentIndent = line.match(/^\s*/)[0].length
        const nextIndex = yamlLines.findIndex(
          (candidate, candidateIndex) => candidateIndex > index
            && candidate.trim() !== ''
            && !candidate.trimStart().startsWith('#'),
        )
        if (nextIndex === -1) continue
        const nextIndent = yamlLines[nextIndex].match(/^\s*/)[0].length
        if (nextIndent <= parentIndent) {
          errors.push(
            `${file}:${lineOf(content, block.offset) + index} YAML mapping key has no indented child`,
          )
        }
      }
    }

    const allowedStaticBlock = file === allowedNativeControlFile
      && /data-mode="auto"/.test(block.content)
      && /data-mode="light"/.test(block.content)
      && /data-mode="dark"/.test(block.content)
    if (!allowedStaticBlock) {
      reject(file, content, nativeControlPattern, 'native product control appears outside the explicit static/non-Vue example', block.content, block.offset)
    }
  }
}

const buildSystem = await readFile(join(root, 'micro-frontends/build-system.md'), 'utf8')
const buildFences = [...buildSystem.matchAll(/```([^\n]*)\n([\s\S]*?)```/g)]
const makeFence = buildFences.find((match) => match[1].trim().toLowerCase() === 'makefile')?.[2] ?? ''
const powershellFence = buildFences.find((match) => match[1].trim().toLowerCase() === 'powershell')?.[2] ?? ''
const batFence = buildFences.find((match) => match[1].trim().toLowerCase() === 'bat')?.[2] ?? ''

if (!/\tnpm run build --|^\tcd [^\n]+npm run build --/m.test(makeFence)
  || !/--outDir[\s\S]*--emptyOutDir/.test(makeFence)) {
  errors.push('micro-frontends/build-system.md: Makefile fence must run npm build with --outDir and --emptyOutDir')
}
if (!/npm\.cmd run build -- --outDir \$resolvedOutput --emptyOutDir/.test(powershellFence)) {
  errors.push('micro-frontends/build-system.md: make.ps1 fence must contain the direct canonical npm build command')
}
if (!/%~dp0make\.ps1/.test(batFence) || /\bnpm(?:\.cmd)?\s+run\s+build\b/.test(batFence)) {
  errors.push('micro-frontends/build-system.md: make.bat must only delegate to make.ps1')
}

const themePersistence = await readFile(join(root, allowedNativeControlFile), 'utf8')
if (!/intentionally static\/non-Vue example/.test(themePersistence)) {
  errors.push(`${allowedNativeControlFile}: native-control exception must remain explicit`)
}

const viewPage = await readFile(join(root, 'frontend-registry/view-page.md'), 'utf8')
if (!viewPage.includes('`meta.mountRoute` is a current backend')
  || !viewPage.includes('`meta.mount_route`')) {
  errors.push('frontend-registry/view-page.md: mountRoute must remain documented as a temporary backend casing bug')
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log('Frontend documentation checks passed.')
