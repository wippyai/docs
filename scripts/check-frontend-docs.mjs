import { readdir, readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import {
  validateVisualEvidence,
  validateVisualEvidenceIndex,
} from './check-frontend-visual-evidence.mjs'

const root = join(process.cwd(), 'en', 'frontend')
const allowedNativeControlFile = 'web-host/theme-persistence.md'
const errors = []
const nativeButtonPattern = /<button\b/
const nativeControlPattern = /<(?:button|input|select|textarea)\b/
const publicationMode = process.env.FRONTEND_DOCS_PUBLICATION === '1'

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
  reject(file, content, /\bpredict(?:able|ed|ing)?\b[^\n]{0,80}\btoken name\b/i, 'token names must come from the generated catalogue, not inference')
  reject(file, content, /\bpositions\s*=\s*["']?3\b/i, 'invented three-position component API; use the reviewed custom-sibling contract')
  reject(file, content, /\bproject-bound\b[^\n]{0,80}\b(?:discouraged|non-compliant|reject)\b/i, 'project-bound status must be exactly UNSUPPORTED with standard CI failure')

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

    if (file === 'micro-frontends/custom-composites.md' && block.language === 'json') {
      try {
        const example = JSON.parse(block.content)
        const exception = example.exceptions?.[0]
        if (!exception || typeof exception.visualSibling !== 'object' || Array.isArray(exception.visualSibling)) {
          throw new Error('exception.visualSibling must be a structured object')
        }
        for (const field of ['component', 'contractId', 'contractHash']) {
          if (typeof exception.visualSibling[field] !== 'string' || !exception.visualSibling[field]) {
            throw new Error(`exception.visualSibling.${field} must be a nonempty string`)
          }
        }
        if (!Array.isArray(exception.sharedAppearanceMappings) || !exception.sharedAppearanceMappings.length) {
          throw new Error('exception.sharedAppearanceMappings must contain structured mappings')
        }
        if (!exception.sharedAppearanceMappings.every((mapping) => {
          const basicShape =
            typeof mapping?.contractProperty === 'string' &&
            typeof mapping.part === 'string' && mapping.part &&
            typeof mapping.selector === 'string' &&
            /^\.[a-z][a-z0-9_-]*$/.test(mapping.selector) &&
            mapping.source && typeof mapping.source === 'object' &&
            typeof mapping.source.kind === 'string' &&
            (typeof mapping.source.name === 'string' || Array.isArray(mapping.source.names))
          if (!basicShape) return false
          if (!mapping.source.kind.startsWith('tailwind-')) return true
          const expected = mapping.source.names ?? [mapping.source.name]
          const actual = mapping.utilityClasses
          return Array.isArray(actual) &&
            new Set(actual).size === actual.length &&
            [...actual].sort().join('\0') === [...expected].sort().join('\0')
        })) {
          throw new Error('every shared appearance mapping requires contractProperty, part, stable class selector, and source')
        }
        if (!Array.isArray(exception.rejectedPrimeVueCompositions) ||
          !exception.rejectedPrimeVueCompositions.length ||
          !exception.rejectedPrimeVueCompositions.every((rejection) =>
            Array.isArray(rejection?.components) && rejection.components.length &&
            typeof rejection.reason === 'string' && rejection.reason)) {
          throw new Error('rejectedPrimeVueCompositions requires components and a reason')
        }
        if (!Array.isArray(exception.platformInvariantUtilities) ||
          !Array.isArray(exception.moduleLocalProperties)) {
          throw new Error('invariant and module-local fields must be arrays, including when empty')
        }
        for (const evidenceField of ['accessibilityEvidence', 'visualEvidence']) {
          const evidence = exception[evidenceField]
          const resultField = evidenceField === 'accessibilityEvidence'
            ? 'resultId'
            : 'captureId'
          if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence) ||
            typeof evidence.manifest !== 'string' || !evidence.manifest ||
            typeof evidence.scenarioId !== 'string' || !evidence.scenarioId ||
            typeof evidence[resultField] !== 'string' || !evidence[resultField] ||
            typeof evidence.build?.head !== 'string' || !evidence.build.head ||
            typeof evidence.build?.trackedFrontendDiffSha256 !== 'string' ||
            !evidence.build.trackedFrontendDiffSha256) {
            throw new Error(`${evidenceField} requires a manifest, scenario, result/capture, and candidate build binding`)
          }
        }
        if (Object.hasOwn(exception, 'runtimeTokenGroups')) {
          throw new Error('runtimeTokenGroups is obsolete; use exact sharedAppearanceMappings')
        }
      } catch (error) {
        errors.push(`${file}:${lineOf(content, block.offset)} invalid custom-composite contract example: ${error.message}`)
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

const requiredPages = new Map([
  ['overview.md', [
    'Frontend Contract: Start Here',
    'module source',
    'PrimeVue-like control',
  ]],
  ['platform-topology.md', [
    'about:srcdoc',
    '@wippy-fe/router',
    '`iframe` CSS injection currently provides default themed scrollbar styling',
    "host.setThemeMode('auto' | 'light' | 'dark')",
    'Never force `w-theme-dark` or `w-theme-light` classes directly',
  ]],
  ['portable-ui-contract.md', [
    'FE-PORT-001',
    'FE-UI-001',
    'FE-UI-002',
    'FE-UI-003',
    'FE-UI-004',
    'FE-UI-005',
    'FE-TW-001',
    'FE-TW-002',
    'FE-TW-003',
    'FE-TOKEN-001',
    'FE-TOKEN-002',
    'FE-STYLE-001',
    'FE-A11Y-001',
  ]],
  ['micro-frontends/theming.md', [
    'The facade authors a PrimeVue theme',
    'global `.p-drawer-content`',
    'theme-variable',
    'platform-invariant',
    'host.setThemeMode',
    'Directly editing',
  ]],
  ['micro-frontends/proxy-api.md', [
    'host.setThemeMode(mode)',
    'host.getThemeMode()',
    'There is no `host.applyTheme()` method',
    'Runtime tests must exercise `host.setThemeMode()`',
    'AppConfig is the host-to-child transport',
  ]],
  ['micro-frontends/tailwind-contract.md', [
    'Compile-time Tailwind value',
    'Runtime-backed utility',
    'Public portable contract',
    'GENERATED:TAILWIND-CONTRACT:BEGIN',
  ]],
  ['micro-frontends/token-catalogue.md', [
    'Never construct a token name by analogy',
    'schemaVersion',
    'packageVersion',
    'implementationRelease',
    'GENERATED:TOKEN-CATALOGUE:BEGIN',
  ]],
  ['micro-frontends/configuration-casing.md', [
    'top-level `lower_case_with_underscore`',
    'Nested frontend configuration carried by backend YAML',
    '`meta.mountRoute` is a current backend compatibility bug',
    '`meta.mount_route`',
  ]],
  ['micro-frontends/custom-composites.md', [
    'Data-shape equivalence is not affordance equivalence',
    'do not invent a `positions` prop',
    'wippy-fe.contract.json',
    'sharedAppearanceMappings',
    'platform-invariant',
    'implementation-private',
    '`gap-2`',
    '`w-10`',
    '`rounded-md`',
    'merely to make a',
    'it is not a JSON Schema',
    'one mapping for every `shared-runtime` property',
  ]],
  ['micro-frontends/compliance-checklist.md', [
    'Deterministic visual verification',
    'before/after/diff evidence',
    'fixtureCleanup',
    'unexpected console errors',
  ]],
  ['micro-frontends/quickstart.md', [
    'Node.js 22.12 or newer',
    'Vite 7 for these examples',
  ]],
  ['micro-frontends/overview.md', [
    'Node.js 22.12 or newer',
    'Vite 7 for this documentation baseline',
  ]],
  ['micro-frontends/unsupported-project-bound.md', [
    'Standard compliance returns exactly `UNSUPPORTED`',
    'Standard CI fails',
  ]],
])

for (const [file, requiredText] of requiredPages) {
  const content = await readFile(join(root, file), 'utf8')
  for (const text of requiredText) {
    if (!content.includes(text)) {
      errors.push(`${file}: missing canonical contract anchor: ${text}`)
    }
  }
}

const ruleOwners = new Map()
for (const path of await markdownFiles(root)) {
  const file = relative(root, path).replaceAll('\\', '/')
  const content = await readFile(path, 'utf8')
  for (const match of content.matchAll(/^###\s+(FE-[A-Z0-9]+-\d{3}):/gm)) {
    const owners = ruleOwners.get(match[1]) ?? []
    owners.push(file)
    ruleOwners.set(match[1], owners)
  }
}
for (const [rule, owners] of ruleOwners) {
  if (owners.length !== 1) {
    errors.push(`${rule}: normative rule heading must have one owner; found ${owners.join(', ')}`)
  }
}

const requiredRuleOwners = new Map([
  ['FE-PORT-001', 'portable-ui-contract.md'],
  ['FE-UI-001', 'portable-ui-contract.md'],
  ['FE-UI-002', 'portable-ui-contract.md'],
  ['FE-UI-003', 'portable-ui-contract.md'],
  ['FE-UI-004', 'portable-ui-contract.md'],
  ['FE-UI-005', 'portable-ui-contract.md'],
  ['FE-TW-001', 'portable-ui-contract.md'],
  ['FE-TW-002', 'portable-ui-contract.md'],
  ['FE-TW-003', 'portable-ui-contract.md'],
  ['FE-TW-004', 'portable-ui-contract.md'],
  ['FE-TOKEN-001', 'portable-ui-contract.md'],
  ['FE-TOKEN-002', 'portable-ui-contract.md'],
  ['FE-STYLE-001', 'portable-ui-contract.md'],
  ['FE-A11Y-001', 'portable-ui-contract.md'],
])
for (const [rule, owner] of requiredRuleOwners) {
  const owners = ruleOwners.get(rule) ?? []
  if (owners.length !== 1 || owners[0] !== owner) {
    errors.push(`${rule}: canonical owner must be ${owner}`)
  }
}

const manifest = JSON.parse(await readFile(join(process.cwd(), 'en', 'manifest.json'), 'utf8'))
const manifestText = JSON.stringify(manifest)
for (const file of requiredPages.keys()) {
  const path = `frontend/${file.replace(/\.md$/, '')}`
  if (!manifestText.includes(`"${path}"`)) {
    errors.push(`en/manifest.json: missing canonical page ${path}`)
  }
}

if (publicationMode) {
  const themeRoot = process.env.WIPPY_THEME_ROOT
  const evidenceRoot = process.env.WIPPY_FE_EVIDENCE_ROOT
  const evidenceHash = process.env.WIPPY_FE_RUNTIME_EVIDENCE_SHA256
  if (!themeRoot) {
    errors.push('publication: WIPPY_THEME_ROOT must point to the selected @wippy-fe/theme package')
  }
  if (!evidenceRoot) {
    errors.push('publication: WIPPY_FE_EVIDENCE_ROOT must point to the external release evidence directory')
  }
  if (!/^[a-f0-9]{64}$/i.test(evidenceHash ?? '')) {
    errors.push('publication: WIPPY_FE_RUNTIME_EVIDENCE_SHA256 must be the external runtime evidence content hash')
  }
  if (themeRoot) {
    const generated = spawnSync(process.execPath, [
      join(process.cwd(), 'scripts', 'generate-frontend-contract.mjs'),
      '--theme-root',
      themeRoot,
      '--check',
    ], { cwd: process.cwd(), encoding: 'utf8', windowsHide: true })
    if (generated.status !== 0) {
      errors.push(`publication: generated frontend contract or acceptance evidence failed: ${generated.stderr || generated.stdout}`)
    }
    const themeRepositoryRoot = join(themeRoot, '..', '..')
    if (evidenceRoot && /^[a-f0-9]{64}$/i.test(evidenceHash ?? '')) {
      const acceptanceEvidence = join(evidenceRoot, 'runtime-acceptance-evidence.json')
      const visualEvidence = join(evidenceRoot, 'visual-evidence-index.json')
      const acceptance = spawnSync(process.execPath, [
        join(themeRepositoryRoot, 'scripts', 'build-theme-contract.mjs'),
        '--check',
        '--acceptance',
        '--evidence',
        acceptanceEvidence,
        '--evidence-sha256',
        evidenceHash,
      ], { cwd: themeRepositoryRoot, encoding: 'utf8', windowsHide: true })
      if (acceptance.status !== 0) {
        errors.push(`publication: selected theme acceptance gate failed: ${acceptance.stderr || acceptance.stdout}`)
      }
      const visual = spawnSync(process.execPath, [
        join(process.cwd(), 'scripts', 'check-frontend-visual-evidence.mjs'),
        visualEvidence,
      ], { cwd: process.cwd(), encoding: 'utf8', windowsHide: true })
      if (visual.status !== 0) {
        errors.push(`publication: external visual evidence failed: ${visual.stderr || visual.stdout}`)
      }
      if (acceptance.status === 0 && visual.status === 0) {
        try {
          const runtimeManifest = JSON.parse(await readFile(acceptanceEvidence, 'utf8'))
          const visualIndex = JSON.parse(await readFile(visualEvidence, 'utf8'))
          const visualArtifacts = new Map()
          for (const scenarioRef of visualIndex.scenarios ?? []) {
            const scenarioPath = resolve(dirname(visualEvidence), scenarioRef.manifest)
            const scenario = JSON.parse(await readFile(scenarioPath, 'utf8'))
            for (const capture of scenario.captures ?? []) {
              for (const kind of ['before', 'after', 'diff']) {
                const image = capture[kind]
                if (!image?.artifactId) continue
                const previous = visualArtifacts.get(image.artifactId)
                const current = {
                  path: resolve(dirname(scenarioPath), image.path),
                  sha256: image.sha256?.replace(/^sha256:/, '').toLowerCase(),
                }
                if (previous &&
                  (previous.path !== current.path || previous.sha256 !== current.sha256)) {
                  throw new Error(`visual artifact ${image.artifactId} has conflicting definitions`)
                }
                visualArtifacts.set(image.artifactId, current)
              }
            }
          }
          for (const artifact of runtimeManifest.artifacts ?? []) {
            const visualArtifact = visualArtifacts.get(artifact.id)
            const runtimeArtifactPath = resolve(dirname(acceptanceEvidence), artifact.path)
            if (!visualArtifact ||
              visualArtifact.path !== runtimeArtifactPath ||
              visualArtifact.sha256 !== artifact.sha256?.toLowerCase()) {
              throw new Error(`runtime artifact ${artifact.id} is not bound to matching visual evidence`)
            }
          }
        }
        catch (error) {
          errors.push(`publication: runtime/visual evidence binding failed: ${error.message}`)
        }
      }
    }
  }
  for (const file of ['micro-frontends/token-catalogue.md', 'micro-frontends/tailwind-contract.md']) {
    const content = await readFile(join(root, file), 'utf8')
    if (/Generated snapshot pending/.test(content)) {
      errors.push(`${file}: generated package snapshot is still pending`)
    }
    if (!/source hashes/i.test(content)) {
      errors.push(`${file}: generated catalogue provenance must include source hashes`)
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
if (!buildSystem.includes('https://web-host.wippy.ai/<release-tag>/import-map.json')
  || !buildSystem.includes('https://web-host.wippy.ai/webcomponents-1.0.56/import-map.json')) {
  errors.push('micro-frontends/build-system.md: canonical CDN import-map URL must be explicit')
}

const webComponent = await readFile(join(root, 'micro-frontends/web-component.md'), 'utf8')
const webComponentFences = [...webComponent.matchAll(/```([^\n]*)\n([\s\S]*?)```/g)]
const componentEntry = webComponentFences.find((match) =>
  match[1].trim().toLowerCase() === 'ts' &&
  /class ExampleControlsElement/.test(match[2]))?.[2] ?? ''
const componentPackage = webComponentFences.find((match) =>
  match[1].trim().toLowerCase() === 'json' &&
  /"tagName"\s*:\s*"example-controls"/.test(match[2]))?.[2] ?? ''
const componentVite = webComponentFences.find((match) =>
  match[1].trim().toLowerCase() === 'ts' &&
  /wippyComponentPlugin/.test(match[2]))?.[2] ?? ''

for (const [pattern, message] of [
  [/WippyVueElement/, 'must extend the supported Vue web-component base'],
  [/plugins:\s*\[\s*PrimeVuePlugin\s*\]/, 'must install the named Wippy PrimeVue plugin'],
  [/hostCssKeys:\s*\[\s*'themeConfigUrl',\s*'primeVueCssUrl',\s*'iframeCssUrl'\s*\]/, 'must request the required host CSS keys'],
  [/h\(Button,\s*\{\s*label:\s*'Save'\s*\}\)/, 'must render a public PrimeVue control'],
  [/define\(import\.meta\.url,\s*ExampleControlsElement\)/, 'must register through the supported define helper'],
]) {
  if (!pattern.test(componentEntry)) {
    errors.push(`micro-frontends/web-component.md: control-bearing entry ${message}`)
  }
}
try {
  const parsed = JSON.parse(componentPackage)
  if (parsed.specification !== 'wippy-component-1.0' ||
    parsed.wippy?.type !== 'component' ||
    parsed.wippy?.tagName !== 'example-controls' ||
    parsed.wippy?.props?.type !== 'object') {
    throw new Error('package metadata does not match the component entry')
  }
}
catch (error) {
  errors.push(`micro-frontends/web-component.md: invalid control-bearing package example: ${error.message}`)
}
if (!/wippyComponentPlugin\(\{\s*required:\s*true\s*\}\)/.test(componentVite) ||
  !/external:\s*Object\.keys\(hostImportMap\.imports\)/.test(componentVite)) {
  errors.push('micro-frontends/web-component.md: Vite example must use strict component metadata and all import-map externals')
}

const complianceChecklist = await readFile(join(root, 'micro-frontends/compliance-checklist.md'), 'utf8')
const visualJsonBlocks = [...complianceChecklist.matchAll(/```json\n([\s\S]*?)```/g)]
  .map((match) => match[1])
for (const [label, block, validator] of [
  ['index', visualJsonBlocks.find((value) => /"applicability"/.test(value)), validateVisualEvidenceIndex],
  ['scenario', visualJsonBlocks.find((value) => /"state"\s*:\s*\{/.test(value)), validateVisualEvidence],
]) {
  try {
    const visual = JSON.parse(block ?? '')
    const visualErrors = validator(visual, { allowPlaceholders: true, verifyFiles: false })
    if (visualErrors.length)
      throw new Error(visualErrors.join('; '))
  }
  catch (error) {
    errors.push(`micro-frontends/compliance-checklist.md: invalid visual evidence ${label} example: ${error.message}`)
  }
}

const themePersistence = await readFile(join(root, allowedNativeControlFile), 'utf8')
if (!/outside the Wippy portable-module contract/.test(themePersistence)) {
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
