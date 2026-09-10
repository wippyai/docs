---
title: "Attention Context for Micro Frontends"
description: "Make page and web-component interfaces understandable to Wippy Attention without exposing Host-owned observation internals."
---

# Attention Context for Micro Frontends

Wippy Attention uses ordinary accessible markup to describe what the user points at or focuses. Page applications and web components do not collect global pointer history, traverse other packages, mint target identities, or send recursive query messages. Those operations belong to the Web Host and its injected runtime.

## Discover capability

`@wippy-fe/proxy` exposes one read-only discovery object:

<!-- ATTENTION:PUBLIC-API:BEGIN -->
```typescript
import { attention } from '@wippy-fe/proxy'

if (attention.enabled) {
  const canAttach = attention.supports('message-context')
  const canClarify = attention.supports('agent-actions')
  const canCapture = attention.supports('visual-capture')

  console.log({ canAttach, canClarify, canCapture })
}
```
<!-- ATTENTION:PUBLIC-API:END -->

`enabled` reports the master Host opt-in. `supports()` reports the capability that is both configured and available in the current runtime. Agent actions and visual capture are phase-gated; packages must tolerate false until the selected release carries their complete integration evidence.

This is intentionally the complete package-facing Attention surface. Root registration, event observation, point queries, snapshot composition, target resolution, screenshots, and disposal are Host-owned coordinator operations. Do not reach through proxy globals or synthesize `wippy.attention.capability.v1`, `wippy.attention.relay.v1`, `wippy.ui-action.v1`, `session_ui_action_request`, or `session_ui_action_result` messages.

## Author semantic targets

Attention summaries follow the same semantics as assistive technology. Prefer native HTML first:

```html
<section aria-labelledby="build-status-title">
  <h2 id="build-status-title">Build status</h2>
  <output aria-live="polite" aria-label="Current build status">Ready</output>
</section>
```

For custom controls, provide an appropriate role, accessible name, keyboard behavior, focus state, and primitive ARIA state. Keep visible labels specific enough to distinguish adjacent controls. A target with a meaningful role and name remains understandable even when text collection is disabled.

Shadow DOM does not change these requirements. Open roots and Wippy-instrumented opted-in closed roots can contribute semantic paths, but the component still owns accessible names, roles, and focus behavior. Slots are resolved through the composed tree.

## Exclude or redact content

Sensitive form controls are excluded automatically, but package authors must mark application-specific secrets and irrelevant regions.

```html
<!-- This subtree cannot become an Attention candidate. -->
<section data-wippy-attention="exclude">
  <p>Recovery codes</p>
</section>

<!-- Geometry remains useful, but descendant text is omitted. -->
<article data-wippy-attention="redact" aria-label="Private account card">
  <span>Account 1234 5678</span>
</article>
```

Use `exclude` for secret-bearing controls, hidden implementation UI, canvas helpers, and decorative overlays that should never be described. Use `redact` when the Host may identify the region by safe ARIA metadata but must not collect its descendant text. Do not put secrets in `id`, `name`, `aria-label`, `autocomplete`, package IDs, artifact IDs, or other structural metadata.

## Nested pages, components, and Web Fragments

No special application code is needed for nesting. Each Wippy-owned boundary receives its proxy runtime, negotiates a short-lived parent/child capability, and answers point queries in its own mount-local CSS-pixel coordinate space. The parent maps requested Host points through clipping and transforms, merges successful child results, and records explicit omissions for partial boundaries.

Keep a child’s mount occurrence stable while it is visible. If a package remounts an iframe, artifact, fragment, or component, the Host increments its generation; old target references then become stale by design.

For Web Fragments, the reflected physical Host tree supplies hit identity and physical geometry. The injected fragment runtime supplies semantic, package, and runtime metadata. The hidden realm’s native hit-testing behavior is not a limitation of the Attention API.

## Message context is a send-time choice

A package can discover whether message context is available, but it cannot force the Host to attach it. The user makes a fresh explicit choice for every message. The legacy `defaultInclude` setting never grants per-send consent and must not preselect Attention. The resulting `context_attachments[]` array is created immediately before the user message is sent and committed atomically with that message.

Unknown attachment kinds and newer versions are allowed only within global count and byte limits. They remain inert until the server has a registered handler. Package code must not add a `required` flag or copy live capability, target-authority, bearer, connection, or screenshot handles into durable content.

See [Web Host Attention Context](../web-host/attention-context.md#message-attachment-contract) for the complete envelope and limits.

The Host retains at most 32 recent events within a default 60-second window. Consecutive sampled moves over the same targets compact to the latest complete move; discrete intent, focus changes, pointer-state changes, and remounts preserve boundaries. This is not dwell tracking and adds no version 1 event fields. Packages should not infer hover duration or an exhaustive movement trace from the attachment.

The stored attachment and model input have different budgets. Model input includes up to six recent events, preferring the newest discrete events before the newest moves, plus current pointer and focus. It includes at most eight targets and summarizes the sampled grid instead of copying every point. When neighboring terminal child realms share a root, their representatives are prioritized before extra hits and older events; explicit partial-coverage counts disclose any remaining omissions. Exact retained paths and grid data remain in the immutable attachment. See [model projection and durable context](../web-host/attention-context.md#model-projection-and-durable-context) for the field names and path limits. Do not assume an ancestry dictionary, private context-file retrieval, or an ordinary upload can expand these model limits: those mechanisms are not implemented Attention contracts.

## Agent clarification belongs to the Host

Agent clarification is implemented but remains a phase-gated contract at release level. Packages must not depend on it until the selected release proves the targeted broker, Host overlay, stale-target handling, and both managed and compatibility E2E flows.

An agent may highlight candidates, ask “Is that it?”, or ask the user to select the intended target. For a candidate action, the framework copies the complete candidate `action_ref` object verbatim as one tool `target_ref` in `targets`; reconstructing it from IDs or geometry is invalid. A zero-target `select` request is valid only with `capture_region: true`, which opens Host-owned arbitrary area selection. It does not authorize a screenshot. The Host overlay projects snapshot rectangles into the current viewport and owns pointer/keyboard input, cancellation, focus restoration, expiry, stale-target checks, navigation invalidation, and reconnect behavior.

Do not build a competing package-level overlay in response to agent messages. The private session broker targets the authenticated Host connection and accepts only immutable target references bound to the current Host instance and mount generation. A child package cannot authorize an action by inventing a rectangle or target ID.

## Optional visual capture

Visual capture remains phase-gated at release level.
`attention.supports('visual-capture')` is capability discovery, not consent and not a capture method; packages must treat false as normal. The default session resolver can dereference an authorized `upload` reference through the registered content-provider contract. Reference authorization, exact-byte verification, and SHA-256 integrity checks are implemented, but production capture, redaction, multimodal mapping, expiry, and orphan cleanup still require deployment evidence. A durable reference alone is not permission to read bytes.

Capture denial before composition can leave semantic Attention available without a visual attachment. Once a visual reference is attached, missing or denied authorization, unavailable verification, invalid bytes, or a hash mismatch rejects the complete send before persistence; there is no silent semantic-only fallback. When an already accepted message is rendered later, expiry or a failed authorized byte read omits the image with a render diagnostic while other valid semantic context remains renderable. See [the visual failure stages](../web-host/attention-context.md#optional-visual-capture) for the exact boundary between capture, ingestion, and model rendering.

If a region must never appear in visual context, mark it `data-wippy-attention="exclude"` and verify the deployed capture provider’s redaction behavior. Do not rely on CSS clipping alone as a privacy boundary.

## Test your package

Test with real trusted input in the complete Host, not only with synthetic DOM events:

1. Point at and focus the final control; verify its role, accessible name, safe text, and complete nested path.
2. Put two child components edge to edge; point within 20 CSS pixels of their boundary and verify both can be discovered by the 5-pixel grid.
3. Exercise iframe and Web Fragment engines. For a fragment, verify `physical-host` geometry and `fragment-realm` metadata provenance.
4. Remount or navigate the package and verify old target references become stale.
5. Mark a subtree `exclude` and another `redact`; verify neither leaks protected text.
6. Turn Attention off and verify the package still works with no observer or overlay.
7. Run the committed tests in Chromium, Firefox, and WebKit.

For runtime symptoms and inspection steps, see [Debugging Wippy FE](./debugging.md#attention-context-is-missing-or-wrong).

## Migration

Attention is opt-in. Existing packages require no code change when it is disabled. To adopt it:

1. Upgrade the Web Host, session, framework, facade, views, and proxy package family as one compatible release.
2. Improve native semantics and keyboard focus before enabling collection.
3. Add `exclude` and `redact` annotations for application-specific sensitive regions.
4. Enable semantic message context with `defaultInclude: false` and validate the production-shaped nested fixture.
5. Enable agent actions only after the private broker, overlay, and reconnect behavior are verified in both layouts.
6. Enable visual capture last, with explicit consent, redaction, and reference-authorization tests.
7. Translate accepted canonical English guidance only as the final documentation work item, after release evidence is stable.

Legacy config migration preserves `feature.attention` as top-level `attention`, but new configuration should use the current top-level AppConfig field directly. Do not expose Host coordinator methods as a compatibility shim.

## See Also

- [Web Host Attention Context](../web-host/attention-context.md) — operator configuration and full contracts
- [Proxy API](./proxy-api.md#attention) — package-facing discovery API
- [Proxy & Isolation](../web-host/proxy-isolation.md) — runtime injection and nested composition
- [Surface Portability](./surface-portability.md) — layout geometry for portable components
