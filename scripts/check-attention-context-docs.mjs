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
    'attention_find_semantic',
    'attention_context.enabled',
    'wippy.attention.model.v1',
    '8 KiB',
    'at most four attempted reads per user turn',
    "copies the complete `action_ref` object verbatim as one item of the tool's `targets` array",
    'The older `attention_inspect` tool was removed',
    'attention_context_set',
    '`ui_action_capture_visual`',
    'allow_adjustment',
    'allow_viewport_choice',
    '### Terminal statuses',
    '### Limits by attachment version',
    '### Session capability descriptor',
    'wippy.session.capabilities.v1',
    'The chat composer, its upload list and file previews are excluded from Attention reads and captures',
    'zero-target `select` request is valid only with `capture_region: true`',
    'Session plugin is the sole WebSocket inbox owner',
    '`visual_resolver`',
    '`userspace.contract:content_provider`',
    'time-of-check/time-of-use protections',
    'orphan-cleanup policy',
    'data-wippy-attention="exclude"',
    'data-wippy-attention="redact"',
  ]],
  ['en/frontend/micro-frontends/attention-context.md', [
    '# Attention Context for Micro Frontends',
    "attention.supports('message-context')",
    "attention.supports('agent-actions')",
    "attention.supports('visual-capture')",
    'Host-owned coordinator operations',
    'fromRoot: true',
    'physical Host tree',
    'fragment runtime',
    'legacy `defaultInclude` setting does not replace the Session property',
    'copied verbatim as one item of the `targets` array',
    'The older `attention_inspect` tool was removed',
    'zero-target `select` request is valid only with `capture_region: true`',
    'registered content-provider contract',
    'SHA-256',
    'orphan cleanup',
  ]],
  ['en/frontend/web-host/render-engines.md', [
    'not** an Attention Context limitation',
    'reflected physical Host shadow tree',
  ]],
  ['en/frontend/web-host/proxy-isolation.md', [
    'Attention instrumentation across boundaries',
    'fromRoot: true',
  ]],
  ['en/frontend/micro-frontends/proxy-api.md', [
    '`attention.enabled` and `attention.supports(capability)`',
    'Public methods include',
  ]],
  ['en/frontend/micro-frontends/debugging.md', [
    'Attention context is missing or wrong',
    'synthetic events are intentionally ignored',
    'GET /api/v1/sessions/capabilities',
    'wippy.agent.traits:attention',
  ]],
  ['en/framework/agents.md', [
    'Attention context and UI actions',
    'untrusted_user_observation',
    'wippy.agent.traits:attention',
    'attention_find_css',
    "copy that exact object verbatim as one item of the tool's `targets` array",
    'The older `attention_inspect` tool was removed',
    'attention_context_set',
    'ui_action_capture_visual',
    'zero-target `select` request is valid only with `capture_region: true`',
    'Session plugin is the sole WebSocket inbox owner',
    '`visual_resolver`',
  ]],
  ['en/framework/relay.md', [
    'Attention UI-action routing',
    'session_ui_action_request',
    'submitting Host tab',
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
  ['excluded focus transfer', /unless the user moves into excluded conversation controls[\s\S]*?original timestamp[\s\S]*?Send temporarily disables the composer/i],
  ['physical fragment focus', /Web Fragments use the physical Host observation rather than the hidden realm's native focus state/i],
  ['safe diagnostic grammar', /`transport:<allowlisted-code>:stage:<query-call\|query-await\|project-result>`/i],
  ['safe diagnostic fallback', /unrecognized exception becomes `internal-error`/i],
  ['action tools take a targets array', /All four tools take `targets`, an array whose items are the `action_ref` or `target_ref` objects copied verbatim/i],
  ['v1 envelope limit', /\| `wippy\.attention` version 1 \| `wippy\.attention\.v1` \| 32 KiB \|/],
  ['v2 envelope limit', /\| `wippy\.attention` version 2 \| `wippy\.attention\.v2` \| 16 KiB \(16,384 bytes\) \|/],
  ['v3 envelope limit', /\| `wippy\.attention` version 3 \| `wippy\.attention\.v3` \| 16 KiB \|/],
  ['v4 envelope limit', /\| `wippy\.attention` version 4 \| `wippy\.attention\.v4` \| 16 KiB \|/],
  ['visual envelope limit', /\| `wippy\.attention\.visual` version 1 \| `wippy\.attention\.visual\.v1` \| 32 KiB \|/],
  ['expanded Attention budget', /share a budget of 256 KiB \(262,144 bytes\)/i],
  ['path dictionary limit', /at most 4,128 shared path dictionary entries/i],
  ['capture upload type', /upload type that serves this route must allow the `image\/png` MIME type/i],
  ['capability descriptor route', /`GET \/api\/v1\/sessions\/capabilities`/],
  ['capability descriptor 404', /answers `404`/],
  ['optimistic delivery', /clears the composer before the receipt/i],
  ['single correlated receipt', /one `received` response by `request_id`/i],
  ['effective send permission', /`interaction\.can_send`/],
  ['complete UTF-8 command sizing', /complete encoded UTF-8 command/i],
  ['hidden context export', /context metadata stays out of rendered text, conversation copy and export/i],
  ['WebP encoding', /actual WebP bytes with `image\/webp` and a `\.webp` file name/i],
  ['tab binding', /carries the tab binding, `runtime_context`/i],
  ['visual image path', /The visual attachment is the only way image content reaches the model/i],
  ['uploads are listed', /listed to the model by file name, type, size and ID/i],
  ['read withdrawal', /withdraws a result after 30 seconds, on a later user turn, after a completed browser action/i],
  ['stale result mechanism', /existing `metadata\.stale` behavior/i],
  ['server receive time', /measured from the time the server received the result, not from browser clocks/i],
  ['refusal keeps arguments', /A refused call keeps the model's own call ID, tool name and arguments/i],
  ['agent sets context', /The agent can change it with the `attention_context_set` tool without asking the user/i],
]

for (const [name, pattern] of semanticRequirements) {
  if (!pattern.test(hostPage))
    errors.push(`${hostPagePath}: missing semantic requirement: ${name}`)
}

const agentTools = [
  'attention_find_semantic',
  'attention_find_css',
  'attention_get_node',
  'attention_get_tree',
  'attention_get_geometry',
  'attention_get_cursor',
  'attention_get_focus',
  'attention_get_selection',
  'attention_hit_test',
  'attention_context_set',
  'ui_action_highlight',
  'ui_action_confirm',
  'ui_action_select',
  'ui_action_capture_visual',
]
for (const file of [hostPagePath, 'en/framework/agents.md']) {
  const content = contents.get(file) ?? ''
  for (const tool of agentTools) {
    if (!content.includes(`\`${tool}\``))
      errors.push(`${file}: tool list is missing ${tool}`)
  }
}

// Mirrors AttentionUiActionStatus in @wippy-fe/shared.
const terminalStatuses = [
  'selected',
  'confirmed',
  'prepared',
  'cancelled',
  'denied',
  'rejected',
  'expired',
  'stale',
  'disconnected',
  'permission-denied',
  'unavailable',
  'error',
]
for (const status of terminalStatuses) {
  if (!hostPage.includes(`| \`${status}\` |`))
    errors.push(`${hostPagePath}: terminal status table is missing ${status}`)
}

for (const field of [
  'message_receipt',
  'steering',
  'attention.context',
  'attention.browser_operations',
  'attention.context_attachments.transport',
  'attention.context_attachments.staging',
  'attention.context_attachments.max_context_bytes',
  'attention.context_attachments.handlers',
]) {
  if (!hostPage.includes(`| \`${field}\` |`))
    errors.push(`${hostPagePath}: capability descriptor table is missing ${field}`)
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
    'attention.dispose',
  ]) {
    if (publicApi.includes(forbidden))
      throw new Error(`public example exposes private coordinator member ${forbidden}`)
  }
  for (const method of ['getFocus', 'find', 'getGeometry', 'subscribe']) {
    if (!publicApi.includes(`attention.${method}(`))
      throw new Error(`public example is missing supported inspection method ${method}`)
  }
  if (!publicApi.includes('subscription.dispose()') || !publicApi.includes('fromRoot: true'))
    throw new Error('public example must show same-Host scope and subscription disposal')
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
  if (/public[^.\n]*discovery-only/i.test(content))
    errors.push(`${file}: public Attention API is no longer discovery-only`)
  if (/disabled means no tracking|no tracking while disabled/i.test(content))
    errors.push(`${file}: Session attachment control must not disable tracking`)
  if (/\b(?:TODO|TBD)\b/.test(content))
    errors.push(`${file}: unresolved TODO/TBD placeholder`)
  for (const [name, pattern] of [
    ['action reference passed as target_ref', /verbatim as one (?:tool )?`target_ref`|as the tool's `target_ref`|`target_ref` entry/i],
    ['attention_inspect described as still present', /`attention_inspect` (?:entry )?(?:is not advertised|remains available)|compatibility `attention_inspect`/i],
    ['visual capture described as historical compatibility only', /compatibility handling for historical content|retained for compatible historical content/i],
    ['internal process text', /local candidate|release candidate|phase-gated|KB read-back|Retrieval QA|KB ingestion|final documentation work item|deferred for this|\bEE2-\d+/i],
  ]) {
    if (pattern.test(content))
      errors.push(`${file}: contains ${name}`)
  }
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log('Attention Context documentation checks passed.')
