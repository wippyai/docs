---
title: "Attention Context for Micro Frontends"
description: "Inspect canonical UI state, register safe semantics and integrate with separate Session and agent controls."
---

# Attention Context for Micro Frontends

Wippy Attention describes the current interface through one Host-owned tree. Pages and components can query their registered subtree, or request the same application tree with `fromRoot: true`. The injected runtime owns identity, physical ancestry, observation, coordinate conversion and private transport. Packages never mint node identities or send relay messages themselves.

## Inspect the current interface

The public API is available through `@wippy-fe/proxy`, `$W.attention` and `getWippyApi().attention`. Bounded observation and inspection remain active while the Host is mounted, including without a Session or with automatic attachments off.

<!-- ATTENTION:PUBLIC-API:BEGIN -->
```typescript
import { attention } from '@wippy-fe/proxy'

const capabilities = {
  messageContext: attention.supports('message-context'),
  agentActions: attention.supports('agent-actions'),
  visualCapture: attention.supports('visual-capture'),
}

const localFocus = await attention.getFocus()
const matches = await attention.find(
  { role: 'button', name: 'Save' },
  { fromRoot: true, limit: 8 },
)

const nodes = matches.data?.nodes
if (matches.outcome === 'ok' && Array.isArray(nodes) && nodes.length === 1) {
  const node = nodes[0]
  const geometry = await attention.getGeometry(node.ref, { fromRoot: true })
  console.log({ capabilities, localFocus, node: node.ref, geometry })
}

const subscription = attention.subscribe(
  { events: ['tree', 'invalidation'], fromRoot: true },
  notification => console.log(notification),
)
// Call when the component unmounts.
subscription.dispose()
```
<!-- ATTENTION:PUBLIC-API:END -->

`supports()` reports each optional capability; discovery does not grant capture consent or agent authority. `enabled` is not the Session automatic-attachment setting. Observation, identity and private request handling remain Host-owned coordinator operations. Do not synthesize `wippy.attention.capability.v1`, `wippy.attention.relay.v2`, `wippy.ui-action.v1`, `session_ui_action_request` or `session_ui_action_result` messages.

| Method | Input and result |
|---|---|
| `getCursor(scope?)` | Current pointer event and canonical nodes. |
| `getFocus(scope?)` | Current focus and canonical node. |
| `getSelection(scope?)` | Selection text, original observation time and both canonical endpoints. |
| `atPoint(point, scope?)` | Point in Host viewport coordinates, or an explicit canonical coordinate space. Default radius is 20 CSS pixels and grid step is 5. |
| `getTree(options?)` | Bounded parent-before-child page with optional limit, depth and continuation. |
| `find(query, options?)` | Semantic matching, exact node ID or explicitly scoped CSS. |
| `getGeometry(nodeRef, scope?)` | Rectangle, clipping, visibility, coordinate space and geometry quality. |
| `subscribe(options, listener)` | Bounded change notices and a `dispose()` method. Notices require a fresh query when details are needed. |

Scope is `{ fromRoot?: boolean, node?: NodeRef }`. Tree and search options also accept their pagination fields. A `NodeRef` contains `host_instance_id`, `node_id`, `mount_id` and `generation`. Use the complete returned object. Resource IDs, labels and selectors do not identify a mounted occurrence.

Default scope includes the caller and its descendants. `fromRoot: true` never reaches another Host, application, tab or outer website. Mounted offscreen nodes remain queryable. Owner-declared placeholders identify unavailable content without inventing rendered descendants.

## Search modes and pagination

Semantic queries use one or more of `role`, `name`, `text` and `resource_id`. Names and text use Unicode case-insensitive substring matching; roles and resource IDs match exactly. An exact-ID query is `{ node_id: returnedId }`.

CSS uses `{ css: 'button', scope: returnedRootRef }`, where the reference names one live document or shadow root. It never crosses that root, an iframe or a Web Fragment. Do not mix CSS with semantic fields or create a cross-boundary selector.

Selectors see a privacy-filtered structure. Excluded and sensitive subtrees do not affect `:has`, sibling positions or `:empty`; redacted nodes expose structure without attributes or text. Editable values are unavailable. Safe non-editable value attributes and live checked/selected states remain queryable. Supported pseudo-classes are `:scope`, `:root`, `:empty`, `:is`, `:where`, `:not`, `:has`, first/last/only/nth child and type selectors, `:checked`, `:disabled`, `:enabled`, `:required`, `:optional`, `:read-only`, `:read-write`, `:indeterminate`, `:focus`, `:focus-visible` and `:focus-within`. Focus matching uses current safe focus, including owned closed roots; `:focus-visible` also requires the browser to report that focus state. Other state pseudo-classes, including `:hover`, `:active` and `:visited`, return `invalid-request`.

An element reference in `atPoint.coordinate_space` uses CSS pixels from its untransformed border-box origin. A shadow-root reference uses its host's border box; a document reference uses its viewport. The runtime accounts for ancestor scale, CSS zoom, iframe borders and padding, and scroll. The returned point uses Host viewport CSS pixels. Unsupported rotation, skew or perspective returns `unsupported-transform` rather than an estimated point.

Every result reports `outcome`, `measured_at`, revisions and omissions. Original pointer, focus and selection event times remain distinct from query time. Treat `empty`, `cleared`, `unknown`, `partial`, `unavailable`, `stale` and `cancelled` separately.

Continuation tokens are opaque, single-use and bound to the caller, scope, query, tree revision and remaining aggregate work. They expire after 30 seconds. A changed tree returns `stale` with `revision-changed`; restart explicitly. Geometry changes alone do not invalidate membership pagination. Do not reset limits by repeatedly starting broad queries.

Subscriptions support `cursor`, `focus`, `selection`, `tree`, `geometry` and `invalidation`. The Host permits 16 per caller and 128 total, coalesces updates to at most 10 per second, and reports dropped updates. A `backpressure` notice requires a fresh query. Dispose subscriptions when unmounting; terminal invalidation closes them after detachment or disconnect.

## Author semantic targets

Prefer native HTML, accessible names, keyboard focus and primitive ARIA state:

```html
<section aria-labelledby="build-status-title">
  <h2 id="build-status-title">Build status</h2>
  <output aria-live="polite" aria-label="Current build status">Ready</output>
</section>
```

For additional labels, use `attention.registerSemantic(element, { role, name, text })` and call its returned disposer on unmount. Equivalent declarative fields are `data-wippy-attention-role`, `data-wippy-attention-name` and `data-wippy-attention-text`. Labels cannot change identity, ancestry, privacy or geometry.

Open shadow roots and Wippy-instrumented closed roots retain separate component and shadow identities. Slots follow the composed tree. Existing component registries supply validated resource and package metadata. Two mounts of one package remain different occurrences.

Layout owners can call `registerLayoutProvider({ instance_id?, root, panels, breakpoint? })`. Each panel declares its local ID, element or window, role/title and active, collapsed, drawer, floating, modal and placeholder state. Use the returned handle's update/dispose methods. The Host assigns occurrence identity; arbitrary framework internals and application state do not enter the semantic tree.

## Exclude or redact content

Sensitive controls are excluded automatically. Mark application-specific secrets and irrelevant regions:

```html
<section data-wippy-attention="exclude">
  <p>Recovery codes</p>
</section>

<article data-wippy-attention="redact" aria-label="Private account card">
  <span>Account 1234 5678</span>
</article>
```

The Host already excludes its own chat composer, upload list and file previews from Attention reads and captures. Excluded content must not appear in search, geometry, selection or captures. Redaction retains only allowed structural information and safe labels. Do not put secrets in accessible names, IDs, resource metadata or custom labels. Registered semantics cannot turn input values, passwords or editable contents into safe text. CSS clipping alone is not a privacy boundary.

## Nested pages and Web Fragments

Wippy boundaries negotiate authenticated transport and retain complete physical ancestry. Navigation, detachment and remount retire identities and action references. Reparenting changes ancestry and invalidates prior action authority.

For Web Fragments, the reflected physical Host tree supplies hit identity and geometry. The fragment runtime supplies semantic, resource and occurrence metadata. Hidden-realm native hit testing is not an Attention limitation. Translation, scroll, clipping and positive axis-aligned scaling are supported; unsupported transforms produce explicit unavailable geometry, never an invented exact crop.

## Automatic message context

The persisted Session property `attention_context.enabled`, default false, controls automatic attachment. The user's client can change it, and an agent with the Attention trait can change it with `attention_context_set` without asking the user. The value belongs to the Session and stays when the user switches agents. A one-send opt-out leaves that default unchanged. Turning it off does not stop observation or explicit authorized reads. The legacy `defaultInclude` setting does not replace the Session property.

The Host prepares context immediately before submission and Session commits it atomically with the message. Failed required context preparation preserves the draft. Unknown bounded attachment kinds and versions remain inert. Do not add a `required` field or copy transport credentials, connection handles or screenshot references into semantic content.

Attachment v1 through v4 remain compatible; current compact v4 keeps complete retained ancestry through dictionaries. Automatic context remains bounded and never includes the full semantic tree. Explicit model tools use a separate compact result format. See [limits by attachment version](../web-host/attention-context.md#limits-by-attachment-version) and [model projection and durable context](../web-host/attention-context.md#model-projection-and-durable-context).

## Agent inspection and clarification

An agent needs effective `wippy.agent.traits:attention` tool authority to make fresh private requests. Receiving an attachment does not grant tools. Reads work with automatic attachment, message-context capability and overlay permission off. Requests bind to the Host tab that submitted the current turn.

The agent uses nine explicit read tools: `attention_find_semantic`, `attention_find_css`, `attention_get_node`, `attention_get_tree`, `attention_get_geometry`, `attention_get_cursor`, `attention_get_focus`, `attention_get_selection` and `attention_hit_test`. The older `attention_inspect` tool was removed. The trait also provides `attention_context_set` and the action tools `ui_action_highlight`, `ui_action_confirm`, `ui_action_select` and `ui_action_capture_visual`. The private tool projection is capped at 8 KiB and the trait bounds attempted reads. See [agent tools and limits](../web-host/attention-context.md#canonical-inspection-and-agent-tools). Packages should not imitate these tools with private WS messages.

Highlight, confirmation, selection and visual capture remain separate Host interactions. The action tools take a `targets` array. Each item is the complete candidate `action_ref` object, or the `target_ref` from a read result, copied verbatim as one item of the `targets` array. Never reconstruct it from IDs or geometry. A zero-target `select` request is valid only with `capture_region: true`. Region selection alone does not authorize a screenshot. The Host owns approval, cancellation, expiry, stale-target checks and focus restoration. See [terminal statuses](../web-host/attention-context.md#terminal-statuses) for the possible results.

## Approved visual drafts

`attention.supports('visual-capture')` reports availability, not consent. An authorized `ui_action_capture_visual` request opens Host approval, normally for a target or bounded region. Whole-viewport capture is a separate explicit choice.

After approval, the Host captures and redacts the selected area, uploads it through the ordinary file path, and prepares a removable composer file. The application's upload type must accept `image/png`, and `image/webp` when that format is requested. Capture does not send a message. Only a later user Send submits its ordinary `file_uuids`. Removing the draft removes it from the composer and invokes cleanup. Keep session isolation, authorization, expiry, SHA-256 integrity and orphan cleanup in custom integrations.

When a sent message includes an approved capture, the Host adds one `wippy.attention.visual` attachment that references the upload, and the model receives the image. Other uploads are listed to the model by name and metadata only. Screenshot bytes and upload references never enter semantic `wippy.attention` content. The registered content-provider contract controls authorized byte reads, and the framework `visual_resolver` supplies the verified image when the prompt is built.

## Test your package

1. Verify pointer, focus, selection, search and geometry share the expected canonical identity and complete nested path.
2. Check both sides of a nested boundary with the default 20 CSS-pixel radius and 5-pixel grid.
3. Exercise iframe and Web Fragment engines in managed and compatibility layouts.
4. Remount, navigate and reparent content; confirm that retired action references fail.
5. Check exclusion, redaction, offscreen content, scoped CSS, pagination and subscription disposal.
6. Turn automatic attachment off and verify bounded observation and authorized fresh reads still work.
7. Remove the agent's Attention trait; a context attachment must not restore private tools.
8. Verify approved draft removal and later ordinary Send.

For diagnosis, see [Debugging Wippy FE](./debugging.md#attention-context-is-missing-or-wrong).

## Migration

Upgrade Host, proxy, Session, Framework, facade and views as a compatible set. Replace discovery-only assumptions with the public inspection API. Use `attention_context.enabled` for automatic attachments and the reusable trait for fresh agent reads. Preserve existing per-action permissions and ordinary file consent.

Legacy `feature.attention` configuration maps to top-level `attention`; new configuration should use the top-level field. Never expose private coordinator internals as a compatibility shim.

## See Also

- [Web Host Attention Context](../web-host/attention-context.md)
- [Proxy API](./proxy-api.md#attention)
- [Proxy & Isolation](../web-host/proxy-isolation.md)
- [Surface Portability](./surface-portability.md)
