import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

const root = process.cwd()
const errors = []

const requiredFiles = new Map([
  ['en/frontend/web-host/attention-context.md', [
    '# Attention Context',
    'wippy.attention.v1',
    'context_attachments',
    'attachment_id',
    'There is no `required` field',
    'physical Host shadow tree',
    'fragment runtime',
    '20-pixel radius',
    '5-pixel grid',
    'phase-gated contract',
    'never grants consent or preselects Attention',
    'complete `action_ref` object verbatim as one `target_ref`',
    'zero-target `select` request is valid only with `capture_region: true`',
    'Session plugin is the sole WebSocket inbox owner',
    '`visual_resolver`',
    '`userspace.contract:content_provider`',
    'time-of-check/time-of-use protections',
    'orphan-cleanup policy',
    'update translations as the final documentation work item',
    'data-wippy-attention="exclude"',
    'data-wippy-attention="redact"',
  ]],
  ['en/frontend/micro-frontends/attention-context.md', [
    '# Attention Context for Micro Frontends',
    "attention.supports('message-context')",
    "attention.supports('agent-actions')",
    "attention.supports('visual-capture')",
    'complete package-facing Attention surface',
    'Host-owned coordinator operations',
    'phase-gated contract',
    'physical Host tree',
    'fragment runtime',
    'legacy `defaultInclude` setting never grants per-send consent',
    'complete candidate `action_ref` object verbatim as one tool `target_ref`',
    'zero-target `select` request is valid only with `capture_region: true`',
    'registered content-provider contract',
    'SHA-256',
    'orphan cleanup',
    'Translate accepted canonical English guidance only as the final documentation work item',
  ]],
  ['en/frontend/web-host/render-engines.md', [
    'not** an Attention Context limitation',
    'reflected physical Host shadow tree',
  ]],
  ['en/frontend/web-host/proxy-isolation.md', [
    'Attention instrumentation across boundaries',
    'discovery-only',
  ]],
  ['en/frontend/micro-frontends/proxy-api.md', [
    '`attention.enabled` and `attention.supports(capability)`',
    'There are no public Attention methods',
  ]],
  ['en/frontend/micro-frontends/debugging.md', [
    'Attention context is missing or wrong',
    'synthetic events are intentionally ignored',
  ]],
  ['en/framework/agents.md', [
    'Attention context and UI actions',
    'untrusted_user_observation',
    'release availability remains phase-gated',
    'exact object verbatim as one tool `target_ref`',
    'zero-target `select` request is valid only with `capture_region: true`',
    'Session plugin is the sole WebSocket inbox owner',
    '`visual_resolver`',
  ]],
  ['en/framework/relay.md', [
    'Attention UI-action routing',
    'session_ui_action_request',
    'release availability remains phase-gated',
    'Session plugin is the sole WebSocket inbox owner',
    'private per-call mailbox',
  ]],
])

const contents = new Map()
for (const [file, anchors] of requiredFiles) {
  try {
    const content = await readFile(join(root, file), 'utf8')
    contents.set(file, content)
    const normalizedContent = content.replace(/\s+/g, ' ')
    for (const anchor of anchors) {
      if (!normalizedContent.includes(anchor.replace(/\s+/g, ' ')))
        errors.push(`${file}: missing Attention contract anchor: ${anchor}`)
    }
  }
  catch (error) {
    errors.push(`${file}: cannot read required file: ${error.message}`)
  }
}

const hostPagePath = 'en/frontend/web-host/attention-context.md'
const hostPage = contents.get(hostPagePath) ?? ''

const semanticRequirements = [
  ['attachment count', /at most 8 attachments/i],
  ['per-attachment 32 KiB limit', /each attachment[^.]*limited to 32 KiB/i],
  ['whole-array 32 KiB limit', /complete serialized `context_attachments` array[^.]*limited to 32 KiB/i],
  ['shared array budget', /all attachment kinds share that single array budget/i],
  ['transport headroom', /leave transport headroom/i],
  ['runtime origin fields', /`parent_origin` and `target_origin` bootstrap values/i],
  ['strict runtime origins', /Origins are canonical bare HTTP\(S\) origins/i],
  ['invalid origin forms', /rejects `null`, `\*`, paths, query strings, fragments, and credentials/i],
  ['origin and source binding', /match both the recorded `event\.origin` and the current live source window/i],
  ['navigation invalidation', /navigation or replacement invalidates that binding/i],
  ['query timeout', /default query timeout is 1,500 ms/i],
  ['capability retry', /retries capability discovery every 100 ms, for at most 50 attempts/i],
  ['capability renewal', /renews an accepted grant before expiry/i],
  ['grant lifetime', /default grant lifetime is 60 seconds/i],
  ['transport grant limits', /default transport grant allows 256 points, 128 candidates, and a 128 KiB response/i],
  ['default grid distinction', /49 points; callers can use a different bounded point set only within the negotiated limits/i],
  ['focus object distinction', /Current focus is a separate object, not a pointer event/i],
  ['focus fields', /`event_id`, `sequence`, `focused_at`, `realm_time_ms`, an optional `candidate_id`, the complete nested `path`, and a safe accessibility `summary`/i],
  ['focusout lifecycle', /trusted `focusout` clears current focus/i],
  ['safe diagnostic grammar', /`transport:<allowlisted-code>:stage:<query-call\|query-await\|project-result>`/i],
  ['safe diagnostic fallback', /unrecognized exception becomes `internal-error`/i],
  ['KB source hash', /exact validated source SHA-256/i],
  ['KB document identity', /KB document ID/i],
  ['KB read-back', /Read every updated document back/i],
  ['KB retrieval count', /at least 12 concrete questions/i],
  ['KB retrieval coverage', /setup, nested coordinate resolution, Web Fragments, message attachments, overlay actions, privacy, screenshots, errors, and migration/i],
  ['translations last', /Translations begin only after English acceptance, KB read-back, and retrieval QA are complete/i],
  ['publication blocked', /Public documentation publication remains blocked until it is explicitly approved and actually performed/i],
]

for (const [name, pattern] of semanticRequirements) {
  if (!pattern.test(hostPage))
    errors.push(`${hostPagePath}: missing semantic requirement: ${name}`)
}

for (const [name, pattern] of [
  ['obsolete 96 KiB attachment quota', /96 KiB per attachment/i],
  ['obsolete 128 KiB attachment-array quota', /128 KiB for the complete array/i],
  ['obsolete 300 ms query timeout', /(?:300 ms|300ms) query timeout/i],
]) {
  if (pattern.test(hostPage))
    errors.push(`${hostPagePath}: contains ${name}`)
}

function canonicalize(value) {
  if (Array.isArray(value))
    return value.map(canonicalize)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map(key => [key, canonicalize(value[key])]),
    )
  }
  return value
}

function fencedBlock(content, begin, end, language) {
  const start = content.indexOf(begin)
  const finish = content.indexOf(end)
  if (start < 0 || finish < start)
    throw new Error(`missing ${begin}/${end} markers`)
  const marked = content.slice(start + begin.length, finish)
  const escaped = language.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const fence = '```'
  const pattern = `${fence}${escaped}\\r?\\n([\\s\\S]*?)\\r?\\n${fence}`
  const match = marked.match(new RegExp(pattern))
  if (!match)
    throw new Error(`marked block does not contain one ${language} fence`)
  return match[1]
}

try {
  const attachmentText = fencedBlock(
    hostPage,
    '<!-- ATTENTION:VALID-ATTACHMENT:BEGIN -->',
    '<!-- ATTENTION:VALID-ATTACHMENT:END -->',
    'json',
  )
  const attachments = JSON.parse(attachmentText)
  if (!Array.isArray(attachments) || attachments.length !== 1)
    throw new Error('canonical fixture must contain exactly one attachment')
  const attachment = attachments[0]
  const required = [
    'attachment_id',
    'kind',
    'version',
    'created_at',
    'content_type',
    'content_bytes',
    'content_hash',
    'content',
  ]
  const actualKeys = Object.keys(attachment).sort()
  if (JSON.stringify(actualKeys) !== JSON.stringify([...required].sort()))
    throw new Error(`envelope keys differ from the v1 fixture: ${actualKeys.join(', ')}`)
  if (attachment.kind !== 'wippy.attention' || attachment.version !== 1)
    throw new Error('fixture kind/version must be wippy.attention version 1')
  if (attachment.content_type !== 'application/json')
    throw new Error('fixture content_type must be application/json')
  if (Buffer.byteLength(attachment.content, 'utf8') !== attachment.content_bytes)
    throw new Error('fixture content_bytes does not match UTF-8 content length')
  const digest = `sha256:${createHash('sha256').update(attachment.content, 'utf8').digest('hex')}`
  if (digest !== attachment.content_hash)
    throw new Error('fixture content_hash does not match canonical content')
  const payload = JSON.parse(attachment.content)
  if (JSON.stringify(canonicalize(payload)) !== attachment.content)
    throw new Error('fixture content is not canonical JSON')
  if (payload.schema !== 'wippy.attention.v1'
    || payload.capture?.radius_css_px !== 20
    || payload.capture?.grid_step_css_px !== 5
    || !Array.isArray(payload.candidates)
    || payload.candidates.length === 0) {
    throw new Error('fixture does not demonstrate the canonical Attention payload')
  }
  const forbidden = /capability_token|bearer|delivery_handle|conn_pid/i
  if (forbidden.test(attachment.content))
    throw new Error('durable fixture contains a live authority field')
}
catch (error) {
  errors.push(`en/frontend/web-host/attention-context.md: invalid canonical attachment fixture: ${error.message}`)
}

try {
  const packagePage = contents.get('en/frontend/micro-frontends/attention-context.md') ?? ''
  const publicApi = fencedBlock(
    packagePage,
    '<!-- ATTENTION:PUBLIC-API:BEGIN -->',
    '<!-- ATTENTION:PUBLIC-API:END -->',
    'typescript',
  )
  if (!/import\s+\{\s*attention\s*\}\s+from\s+'@wippy-fe\/proxy'/.test(publicApi))
    throw new Error('public example must import attention from @wippy-fe/proxy')
  for (const capability of ['message-context', 'agent-actions', 'visual-capture']) {
    if (!publicApi.includes(`attention.supports('${capability}')`))
      throw new Error(`public example is missing ${capability} discovery`)
  }
  for (const forbidden of [
    'attention.snapshot',
    'attention.queryPoints',
    'attention.registerRoot',
    'attention.getRecentEvents',
    'attention.getFocus',
    'attention.dispose',
  ]) {
    if (publicApi.includes(forbidden))
      throw new Error(`public example exposes private coordinator member ${forbidden}`)
  }
}
catch (error) {
  errors.push(`en/frontend/micro-frontends/attention-context.md: invalid public API example: ${error.message}`)
}

try {
  const manifest = JSON.parse(await readFile(join(root, 'en', 'manifest.json'), 'utf8'))
  const paths = []
  function visit(nodes) {
    for (const node of nodes ?? []) {
      if (typeof node.path === 'string')
        paths.push(node.path)
      visit(node.children)
    }
  }
  visit(manifest)
  for (const expected of [
    'frontend/web-host/attention-context',
    'frontend/micro-frontends/attention-context',
  ]) {
    const count = paths.filter(path => path === expected).length
    if (count !== 1)
      errors.push(`en/manifest.json: ${expected} must appear exactly once; found ${count}`)
  }
  for (const path of paths) {
    try {
      await readFile(join(root, 'en', `${path}.md`))
    }
    catch {
      errors.push(`en/manifest.json: referenced page does not exist: en/${path}.md`)
    }
  }
}
catch (error) {
  errors.push(`en/manifest.json: invalid manifest: ${error.message}`)
}

for (const [file, content] of contents) {
  if (/\b(?:TODO|TBD)\b/.test(content))
    errors.push(`${file}: unresolved TODO/TBD placeholder`)
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log('Attention Context documentation checks passed.')
