import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

const root = process.cwd()
const errors = []

const hostPagePath = 'en/frontend/web-host/attention-context.md'
const hostPage = await readFile(join(root, hostPagePath), 'utf8')

// Validate machine-readable examples; prose is reviewed against published APIs.
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

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log('Attention Context documentation checks passed.')
