import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import process from 'node:process'
import { inflateSync } from 'node:zlib'

const sha256Pattern = /^sha256:[a-f0-9]{64}$/
const placeholderPattern = /^sha256:generated-[a-z0-9-]+$/

function validateHash(value, allowPlaceholders) {
  return sha256Pattern.test(value) ||
    (allowPlaceholders && placeholderPattern.test(value))
}

function decodePng(filePath) {
  const input = readFileSync(filePath)
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  if (!input.subarray(0, 8).equals(signature))
    throw new Error(`${filePath} is not a PNG`)
  let offset = 8
  let width
  let height
  let bitDepth
  let colorType
  const idat = []
  while (offset < input.length) {
    const length = input.readUInt32BE(offset)
    const type = input.toString('ascii', offset + 4, offset + 8)
    const data = input.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
    }
    else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    offset += length + 12
  }
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType]
  if (!width || !height || bitDepth !== 8 || !channels)
    throw new Error(`${filePath} uses an unsupported PNG encoding`)
  const packed = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const decoded = Buffer.alloc(stride * height)
  let sourceOffset = 0
  const paeth = (a, b, c) => {
    const p = a + b - c
    const pa = Math.abs(p - a)
    const pb = Math.abs(p - b)
    const pc = Math.abs(p - c)
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
  }
  for (let y = 0; y < height; y += 1) {
    const filter = packed[sourceOffset]
    sourceOffset += 1
    for (let x = 0; x < stride; x += 1) {
      const raw = packed[sourceOffset + x]
      const left = x >= channels ? decoded[y * stride + x - channels] : 0
      const up = y > 0 ? decoded[(y - 1) * stride + x] : 0
      const upLeft =
        y > 0 && x >= channels
          ? decoded[(y - 1) * stride + x - channels]
          : 0
      const predictor =
        filter === 0 ? 0
          : filter === 1 ? left
            : filter === 2 ? up
              : filter === 3 ? Math.floor((left + up) / 2)
                : filter === 4 ? paeth(left, up, upLeft)
                  : null
      if (predictor == null)
        throw new Error(`${filePath} uses unknown PNG filter ${filter}`)
      decoded[y * stride + x] = (raw + predictor) & 255
    }
    sourceOffset += stride
  }
  return { width, height, channels, pixels: decoded }
}

function countChangedPixels(beforePath, afterPath, pixelDeltaThreshold) {
  const before = decodePng(beforePath)
  const after = decodePng(afterPath)
  if (before.width !== after.width || before.height !== after.height)
    throw new Error('before and after image dimensions differ')
  let changedPixels = 0
  const pixelCount = before.width * before.height
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    let changed = false
    for (let channel = 0; channel < Math.max(before.channels, after.channels); channel += 1) {
      const beforeValue =
        channel < before.channels
          ? before.pixels[pixel * before.channels + channel]
          : 255
      const afterValue =
        channel < after.channels
          ? after.pixels[pixel * after.channels + channel]
          : 255
      if (Math.abs(beforeValue - afterValue) > pixelDeltaThreshold) {
        changed = true
        break
      }
    }
    if (changed) changedPixels += 1
  }
  return { changedPixels, totalPixels: pixelCount }
}

export function validateVisualEvidence(
  manifest,
  { allowPlaceholders = false, manifestPath = null, verifyFiles = true } = {},
) {
  const errors = []
  const requireString = (value, field) => {
    if (typeof value !== 'string' || value.length === 0)
      errors.push(`${field} must be a nonempty string`)
  }

  requireString(manifest.schemaVersion, 'schemaVersion')
  requireString(manifest.scenarioId, 'scenarioId')
  requireString(manifest.componentId, 'componentId')
  requireString(manifest.state?.theme, 'state.theme')
  requireString(manifest.state?.interaction, 'state.interaction')
  if (!Number.isInteger(manifest.state?.viewport?.width) ||
    !Number.isInteger(manifest.state?.viewport?.height)) {
    errors.push('state.viewport must contain integer width and height')
  }
  requireString(manifest.runtime?.browserVersion, 'runtime.browserVersion')
  if (typeof manifest.runtime?.devicePixelRatio !== 'number')
    errors.push('runtime.devicePixelRatio must be a number')

  for (const field of ['fontsHash', 'fixtureHash']) {
    const value = manifest.runtime?.[field]
    if (typeof value !== 'string' || !validateHash(value, allowPlaceholders))
      errors.push(`runtime.${field} must be a sha256 value`)
  }
  for (const side of ['baseline', 'candidate']) {
    requireString(manifest[side]?.commit, `${side}.commit`)
    const hash = manifest[side]?.buildHash
    if (typeof hash !== 'string' || !validateHash(hash, allowPlaceholders))
      errors.push(`${side}.buildHash must be a sha256 value`)
  }
  if (manifest.candidate?.recapturedAfterBuild !== true)
    errors.push('candidate.recapturedAfterBuild must be true')

  if (!Array.isArray(manifest.requiredScopes) ||
    !manifest.requiredScopes.includes('component') ||
    !manifest.requiredScopes.includes('context')) {
    errors.push('requiredScopes must include component and context')
  }
  if (!Array.isArray(manifest.captures) || manifest.captures.length === 0) {
    errors.push('captures must be a nonempty array')
  }
  else {
    const scopes = new Set()
    const artifactIds = new Set()
    let recomputedChangedPixels = 0
    let recomputedTotalPixels = 0
    for (const [captureIndex, capture] of manifest.captures.entries()) {
      requireString(capture.scope, `captures[${captureIndex}].scope`)
      if (scopes.has(capture.scope))
        errors.push(`captures has duplicate scope ${capture.scope}`)
      scopes.add(capture.scope)
      for (const imageKind of ['before', 'after', 'diff']) {
        const image = capture[imageKind]
        requireString(
          image?.artifactId,
          `captures[${captureIndex}].${imageKind}.artifactId`,
        )
        if (artifactIds.has(image?.artifactId))
          errors.push(`duplicate visual artifact ${image.artifactId}`)
        artifactIds.add(image?.artifactId)
        requireString(image?.path, `captures[${captureIndex}].${imageKind}.path`)
        if (typeof image?.sha256 !== 'string' ||
          !validateHash(image.sha256, allowPlaceholders)) {
          errors.push(`captures[${captureIndex}].${imageKind}.sha256 must be a sha256 value`)
        }
        if (!allowPlaceholders && verifyFiles && manifestPath && image?.path) {
          const imagePath = resolve(dirname(manifestPath), image.path)
          if (!existsSync(imagePath)) {
            errors.push(`${image.path} does not exist`)
          }
          else {
            const actual = `sha256:${createHash('sha256').update(readFileSync(imagePath)).digest('hex')}`
            if (actual !== image.sha256)
              errors.push(`${image.path} hash does not match`)
          }
        }
      }
      if (!allowPlaceholders && verifyFiles && manifestPath &&
        capture.before?.path && capture.after?.path) {
        try {
          const recomputed = countChangedPixels(
            resolve(dirname(manifestPath), capture.before.path),
            resolve(dirname(manifestPath), capture.after.path),
            manifest.diff?.pixelDeltaThreshold,
          )
          recomputedChangedPixels += recomputed.changedPixels
          recomputedTotalPixels += recomputed.totalPixels
        }
        catch (error) {
          errors.push(`captures[${captureIndex}] cannot be compared: ${error.message}`)
        }
      }
    }
    for (const scope of manifest.requiredScopes ?? []) {
      if (!scopes.has(scope))
        errors.push(`required capture scope ${scope} is missing`)
    }
    if (!allowPlaceholders && verifyFiles &&
      (manifest.diff?.changedPixels !== recomputedChangedPixels ||
        manifest.diff?.totalPixels !== recomputedTotalPixels)) {
      errors.push('diff metrics do not match recomputed before/after pixels')
    }
  }

  if (!['passed', 'waived'].includes(manifest.diff?.result))
    errors.push('diff.result must be passed or waived')
  const changedPixels = manifest.diff?.changedPixels
  const totalPixels = manifest.diff?.totalPixels
  const changedRatio = manifest.diff?.changedRatio
  const pixelDeltaThreshold = manifest.diff?.pixelDeltaThreshold
  const changedRatioThreshold = manifest.diff?.changedRatioThreshold
  if (!Number.isInteger(changedPixels) || changedPixels < 0 ||
    !Number.isInteger(totalPixels) || totalPixels <= 0 ||
    changedPixels > totalPixels ||
    typeof changedRatio !== 'number' || changedRatio < 0 || changedRatio > 1 ||
    !Number.isInteger(pixelDeltaThreshold) ||
    pixelDeltaThreshold < 0 || pixelDeltaThreshold > 255 ||
    typeof changedRatioThreshold !== 'number' ||
    changedRatioThreshold < 0 || changedRatioThreshold > 1) {
    errors.push('diff metrics and thresholds are outside valid bounds')
  }
  else if (Math.abs(changedRatio - changedPixels / totalPixels) > 1e-12) {
    errors.push('diff.changedRatio must equal changedPixels / totalPixels')
  }
  if (manifest.diff?.result === 'waived') {
    const waiver = manifest.diff.waiver
    if (!waiver || typeof waiver.reason !== 'string' ||
      typeof waiver.reviewer !== 'string' ||
      waiver.changedPixels !== changedPixels ||
      manifest.diff.disposition !== 'intentional-change' ||
      changedRatio <= changedRatioThreshold) {
      errors.push('a waived diff requires reason, reviewer, and changedPixels')
    }
  }
  else if (manifest.diff?.waiver != null ||
    manifest.diff?.disposition !== 'within-threshold' ||
    changedRatio > changedRatioThreshold) {
    errors.push('a passed diff must be within threshold with no waiver')
  }
  if (!Array.isArray(manifest.console?.unexpectedErrors) ||
    manifest.console.unexpectedErrors.length !== 0) {
    errors.push('console.unexpectedErrors must be an empty array')
  }
  if (manifest.fixtureCleanup?.verified !== true ||
    !Array.isArray(manifest.fixtureCleanup?.temporaryArtifactsRemaining) ||
    manifest.fixtureCleanup.temporaryArtifactsRemaining.length !== 0) {
    errors.push('fixtureCleanup must prove that no temporary artifacts remain')
  }

  return errors
}

export function validateVisualEvidenceIndex(
  index,
  { allowPlaceholders = false, indexPath = null, verifyFiles = true } = {},
) {
  const errors = []
  const themes = index.applicability?.themes
  const viewports = index.applicability?.viewports
  const states = index.applicability?.states
  if (!index.schemaVersion || !index.componentId)
    errors.push('index requires schemaVersion and componentId')
  if (!Array.isArray(themes) || !themes.length ||
    !Array.isArray(viewports) || !viewports.length ||
    !Array.isArray(states) || !states.length) {
    errors.push('index applicability requires nonempty themes, viewports, and states')
  }
  if (index.finalBuild?.recapturedAfterBuild !== true)
    errors.push('index finalBuild.recapturedAfterBuild must be true')
  if (!validateHash(index.finalBuild?.candidateBuildHash ?? '', allowPlaceholders))
    errors.push('index finalBuild.candidateBuildHash must be a sha256 value')

  const scenarios = Array.isArray(index.scenarios) ? index.scenarios : []
  const seen = new Set()
  for (const scenario of scenarios) {
    const key = `${scenario.theme}\0${scenario.viewport}\0${scenario.state}`
    if (seen.has(key))
      errors.push(`duplicate scenario coverage ${scenario.scenarioId}`)
    seen.add(key)
    if (!scenario.scenarioId || !scenario.manifest)
      errors.push('every index scenario requires scenarioId and manifest')
    if (!allowPlaceholders && verifyFiles && indexPath && scenario.manifest) {
      const scenarioPath = resolve(dirname(indexPath), scenario.manifest)
      if (!existsSync(scenarioPath)) {
        errors.push(`${scenario.manifest} does not exist`)
        continue
      }
      const evidence = JSON.parse(readFileSync(scenarioPath, 'utf8'))
      errors.push(...validateVisualEvidence(evidence, {
        manifestPath: scenarioPath,
        verifyFiles,
      }).map((error) => `${scenario.scenarioId}: ${error}`))
      if (evidence.scenarioId !== scenario.scenarioId ||
        evidence.componentId !== index.componentId ||
        evidence.state?.theme !== scenario.theme ||
        evidence.state?.interaction !== scenario.state) {
        errors.push(`${scenario.scenarioId}: index and scenario identity do not match`)
      }
      if (evidence.candidate?.commit !== index.finalBuild?.candidateCommit ||
        evidence.candidate?.buildHash !== index.finalBuild?.candidateBuildHash) {
        errors.push(`${scenario.scenarioId}: scenario was not recaptured from the final build`)
      }
      if (index.applicability?.overlay === true &&
        !evidence.requiredScopes?.includes('full-page')) {
        errors.push(`${scenario.scenarioId}: overlay scenario requires full-page capture`)
      }
    }
  }
  for (const theme of themes ?? []) {
    for (const viewport of viewports ?? []) {
      for (const state of states ?? []) {
        if (!seen.has(`${theme}\0${viewport.id}\0${state}`))
          errors.push(`missing scenario for ${theme}/${viewport.id}/${state}`)
      }
    }
  }
  return errors
}

if (process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const manifestPath = process.argv[2]
  if (!manifestPath) {
    console.error('Usage: node scripts/check-frontend-visual-evidence.mjs <manifest.json>')
    process.exit(2)
  }
  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  }
  catch (error) {
    console.error(`Cannot read visual evidence ${manifestPath}: ${error.message}`)
    process.exit(1)
  }
  const errors = Array.isArray(manifest.scenarios)
    ? validateVisualEvidenceIndex(manifest, { indexPath: manifestPath })
    : validateVisualEvidence(manifest, { manifestPath })
  if (errors.length) {
    console.error(errors.join('\n'))
    process.exit(1)
  }
  console.log('Frontend visual evidence checks passed.')
}
