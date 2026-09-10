---
title: "Attention Context"
description: "Configure and operate nested pointer, focus, clarification, and optional visual context in the Wippy Web Host."
---

# Attention Context

The Wippy Attention Context API lets the Host attach a bounded description of the interface near the user’s pointer to a chat message. It also lets an agent ask the current user to confirm or select a visible target. Both features are opt-in and work across supported panels, artifacts, pages, iframes, Web Fragments, web components, and shadow roots.

This page defines the version 1 contract. Runtime availability is reported by
capability discovery and release evidence; the presence of a documented schema
does not mean every capability is ready in every release.

Attention has three independent capabilities:

| Capability | Purpose | Configuration gate |
|---|---|---|
| Message context | Attach “what I am pointing at” observations to one user message | `enabled` and `messageContext.enabled` |
| Agent actions | Highlight, confirm, or select a visible target | `enabled`, `agentActions.enabled`, and a validated action runtime |
| Visual capture | Attach a consented, redacted image or region reference | `enabled`, `visualCapture.enabled`, and a validated capture provider |

Enabling one capability does not enable either of the others. When `enabled` is absent or false, the Host installs no active Attention observer or overlay.

## Enable Attention

The facade `attention` requirement accepts a JSON object. This PowerShell example enables only semantic message context. Agent actions and visual capture remain off until their release-specific integration evidence is accepted:

```powershell
$attentionConfig = '{"enabled":true,"messageContext":{"enabled":true,"defaultInclude":false},"agentActions":{"enabled":false,"requireConfirmation":true},"visualCapture":{"enabled":false},"sampling":{"radiusCssPx":20,"stepCssPx":5},"privacy":{"text":"safe"}}'
./wippy.exe run -c -o "wippy.facade:attention:default=$attentionConfig"
```

| Field | Meaning |
|---|---|
| `enabled` | Master opt-in. All other Attention settings are inert unless this is true. |
| `messageContext.enabled` | Allows the Host to create `wippy.attention` message attachments. |
| `messageContext.defaultInclude` | Legacy compatibility input only. It never grants consent or preselects Attention; the user makes a fresh choice for every message. |
| `agentActions.enabled` | Allows the authenticated session broker to address the Host overlay. |
| `agentActions.requireConfirmation` | Requires a second confirmation after choosing a candidate. |
| `visualCapture.enabled` | Makes the separately consented visual-capture capability available. |
| `sampling.radiusCssPx` | Neighborhood radius in Host CSS pixels. The default is `20`; the maximum is `100`. |
| `sampling.stepCssPx` | Grid spacing in Host CSS pixels. The default is `5`; the valid range is `1`–`100`. |
| `privacy.text` | `safe` includes bounded safe text; `none` suppresses text summaries. |

## What the Host observes

The Host records trusted `pointermove`, `pointerdown`, `pointerup`, `click`, `touchstart`, and `touchend` events. Each pointer or touch event has an occurrence-safe `event_id`, a monotonically increasing realm `sequence`, an absolute UTC `observed_at` timestamp, `realm_time_ms`, its point, and the candidate IDs resolved at that time. Pointer-specific fields are `pointer_id`, `pointer_type`, `buttons`, and `pointer_capture` when applicable.

Current focus is a separate object, not a pointer event. It has `event_id`, `sequence`, `focused_at`, `realm_time_ms`, an optional `candidate_id`, the complete nested `path`, and a safe accessibility `summary`. A trusted `focusout` clears current focus. Pointer fields such as `observed_at`, `point`, and `buttons` do not belong to the focus object.

The default event window is 60 seconds and retains at most 32 recent events. The same limits apply when merging child observations. Discrete events are preferred when the event budget is full; remaining slots retain the newest moves. The latest pointer and current focus are tracked separately from the recent-event list. Text is whitespace-normalized and limited to 160 Unicode scalar values at collection time.

Consecutive sampled moves over the same ordered set of targets compact to the newest complete move, including its coordinates, timestamp, sequence, and sample identity. Compaction stops when a target or its mount generation changes, pointer identity/type/buttons/capture changes, a target is unresolved, or a discrete event or focus change intervenes. Pending trusted movement is recorded before a subsequent trusted discrete or focus event. This is bounded movement sampling, not dwell tracking: version 1 adds no dwell episodes, durations, or new event fields.

At snapshot time, the Host samples a circular neighborhood around the latest pointer. A 20-pixel radius on a 5-pixel grid produces 49 point queries. Candidates are deduplicated by target identity while retaining every `sample_point_id` that found them.

This is deliberately a neighborhood, not a single hit test. When two nested components meet edge to edge, points on both sides of the boundary are routed to their owning children, so relevant targets from both components can appear in one snapshot.

## Recursive resolution

The Host composes a semantic path from the visible surface to the final element. A path can contain:

```text
host → panel → artifact → iframe or web-fragment → web-component → shadow-root → artifact → element
```

Each segment includes `kind`, `mount_id`, and `generation`. Applicable segments can also include `panel_id`, `artifact_id`, `page_id`, `package_id`, `tag_name`, an origin-only `frame_origin`, geometry, clipping, and a local-to-parent transform. The final candidate adds a Host-viewport rectangle and a bounded accessibility summary such as role, accessible name, safe text, value, and primitive state.

Parents query children at explicit points. Before a boundary accepts a query, parent and child negotiate `wippy.attention.capability.v1` for an exact Host instance, exact parent/child mount generations, and strict `parent_origin` and `target_origin` bootstrap values. Origins are canonical bare HTTP(S) origins. The API rejects `null`, `*`, paths, query strings, fragments, and credentials. Every inbound message must match both the recorded `event.origin` and the current live source window; navigation or replacement invalidates that binding.

Queries use `wippy.attention.relay.v1`, carry a deadline and remaining depth/query/query-point/candidate/byte budgets, and correlate every point result. The root compositor starts with at most 128 recursive queries and 4,096 total query points. Each child receives a disjoint lease from those aggregate budgets; unused work is not duplicated across siblings. The default query timeout is 1,500 ms. An upstream runtime retries capability discovery every 100 ms, for at most 50 attempts, and renews an accepted grant before expiry. The default grant lifetime is 60 seconds; the renewal lead is the smaller of 5 seconds and half the remaining lifetime. Unsupported, timed-out, detached, navigated, or over-budget children produce explicit omissions; successful siblings are retained.

The default transport grant allows 256 points, 128 candidates, and a 128 KiB response. These are negotiated relay limits, not the size of one sample grid. The default 20-pixel/5-pixel neighborhood happens to contain 49 points; callers can use a different bounded point set only within the negotiated limits.

Live relay capability credentials are never copied into a durable message attachment. They authorize only the negotiated parent-to-child transport and expire or are revoked when the occurrence changes.

| Schema | Messages or payload | Lifetime |
|---|---|---|
| `wippy.attention.runtime.v1` | Host and parent/target mount bootstrap identity | Current mount occurrence |
| `wippy.attention.capability.v1` | `capability-request`, `capability-grant` | Short-lived parent/child negotiation |
| `wippy.attention.relay.v1` | `query-request`, `query-result`, `query-error` | One bounded recursive query |
| `wippy.attention.v1` | Composed snapshot with pointer, focus, candidates, capture settings, and omissions | Immutable message attachment |
| `wippy.ui-action.v1` | `request`, `result` | One phase-gated clarification action |

## Web Fragments

Web Fragments are first-class instrumented Attention boundaries. The Host queries the reflected physical Host shadow tree for hit identity, stacking, clipping, and rectangles. `proxy-fragment.js` in the fragment runtime contributes package identity, runtime identity, semantic roots, privacy rules, reflected-node mapping, and nested-child capabilities.

The hidden realm’s native `document.elementFromPoint()` behavior is therefore not an Attention portability constraint. A fragment candidate reports provenance such as `geometry_source: "physical-host"` and `runtime_source: "fragment-realm"` so consumers can distinguish the two contributors.

## Message attachment contract

`context_attachments` is a generic, versioned array on `session_message.data`. The following is the canonical `wippy.attention` version 1 fixture. The `content` string is canonical JSON; `content_bytes` is its UTF-8 byte length and `content_hash` is its lowercase SHA-256 digest.

<!-- ATTENTION:VALID-ATTACHMENT:BEGIN -->
```json
[
  {
    "attachment_id": "attachment-1",
    "kind": "wippy.attention",
    "version": 1,
    "created_at": "2026-09-04T12:00:00.000Z",
    "content_type": "application/json",
    "content_bytes": 752,
    "content_hash": "sha256:5f3351c84704bdd064d1da1cd4c2dc16ce5be1b521c0c86051cd7824177d895c",
    "content": "{\"candidates\":[{\"occluded\":false,\"path\":[{\"generation\":3,\"kind\":\"host\",\"mount_id\":\"host-1\"},{\"generation\":1,\"kind\":\"element\",\"mount_id\":\"leaf-1\",\"tag_name\":\"span\"}],\"rect\":{\"height\":24,\"width\":80,\"x\":100,\"y\":100},\"sample_point_ids\":[\"p0\"],\"summary\":{\"name\":\"Nested status\",\"role\":\"status\",\"text\":\"Ready\"},\"target_id\":\"target-1\"}],\"capture\":{\"complete\":true,\"duration_ms\":12,\"grid_step_css_px\":5,\"points\":[{\"point_id\":\"p0\",\"x\":120,\"y\":112}],\"radius_css_px\":20,\"sampled_points\":1},\"coordinate_space\":{\"device_pixel_ratio\":1,\"height\":720,\"kind\":\"host-viewport\",\"width\":1280},\"created_at\":\"2026-09-04T12:00:00.000Z\",\"host_instance_id\":\"host-1\",\"mount_generation\":3,\"omissions\":[],\"recent_events\":[],\"schema\":\"wippy.attention.v1\",\"snapshot_id\":\"snapshot-1\"}"
  }
]
```
<!-- ATTENTION:VALID-ATTACHMENT:END -->

Every envelope requires `attachment_id`, `kind`, `version`, `created_at`, `content_type`, `content_bytes`, `content_hash`, and `content`. `expires_at` is optional. There is no `required` field.

The service accepts at most 8 attachments. Each attachment and the complete serialized `context_attachments` array are limited to 32 KiB. All attachment kinds share that single array budget; eight attachments do not receive eight independent 32 KiB allowances. `content_bytes` is also limited to 32 KiB, but envelope JSON, escaping, and sibling attachments consume the same whole-array limit. Producers should leave transport headroom instead of filling `content` to its theoretical maximum. Attachment IDs must be unique. A known `wippy.attention` version 1 payload must use schema `wippy.attention.v1` and satisfy its strict object boundaries. Unknown bounded kinds and newer versions may be stored for forward compatibility, but are inert and excluded from model prompts until a handler is registered.

Validation and persistence are atomic with the user message. Invalid JSON, duplicate IDs, noncanonical content, byte or hash mismatches, expiry, forbidden live fields, or an invalid known payload reject the complete send; the service must not create a text-only message after required context validation fails.

The model renderer inserts recognized Attention data into the same user-role turn under an explicit `untrusted_user_observation` label. Text and accessibility fields are data, never instructions. Prompt rendering has a separate byte budget and can retain fewer candidates than the durable attachment.

### Model projection and durable context

The model receives at most six recent events: the newest discrete events first, then the newest moves if slots remain. Current pointer and focus are separate from those six events. Up to eight targets are rendered, subject to the render byte budget. Current pointer and focus have priority; when sampling finds multiple terminal child realms under one shared root, the renderer reserves one representative per realm before additional hits and older-event targets. Unequal nesting depths do not make a sibling ineligible. If the target or byte limit prevents full representation, the model must treat that coverage as partial.

The model receives grid settings, sampled-point count, duration, completeness, and `capture.sample_bounds` rather than the full 49-point default lattice. Each rendered candidate includes at most three sample IDs, with `sample_point_count` and `sample_point_ids_omitted` describing the reduction. Model-only `partial` fields report omitted candidates, recent events, sample points, and omission records. `partial.sampled_realms` counts the eligible multi-realm frontier and `partial.sampled_realms_omitted` counts its unrepresented realms; zero means that no eligible multi-realm frontier was identified, not that no target was sampled.

The persisted version 1 attachment keeps its exact retained paths and sample grid. Model projection does not rewrite it or the candidate action references. Pointer-target paths can retain up to 32 segments in model input; secondary target and focus paths are capped at 12 segments there. These render limits do not shorten the stored paths. An ancestry dictionary and private context-file retrieval are not implemented contracts; ordinary uploads do not provide either mechanism.

When agent actions are enabled, an eligible rendered candidate includes an `action_ref`. An agent tool must copy that complete `action_ref` object verbatim as one `target_ref` entry in its `targets` array. Reconstructing a target from visible IDs or geometry is invalid because it can omit the Host instance, mount generation, or path digest used for stale-target validation.

## Agent clarification actions

**Availability:** agent actions remain a phase-gated contract at release level.
Target projection, Host snapshot-registry validation, targeted broker routing,
and the framework tools are implemented. Do not enable them for users until the
selected release also passes managed and compatibility E2E behavior.

The agent-action contract allows three Host-owned interactions:

| Mode | User experience |
|---|---|
| `highlight` | Project one or more supplied rectangles and draw attention to them. |
| `confirm` | Ask whether one of the supplied targets is the intended target. |
| `select` | Ask the user to choose a supplied target, or open arbitrary area selection when no targets are supplied and `capture_region: true`. |

The contract requires framework tools to be private and exclusive. The session broker must bind a request to the authenticated user, session, current connection process, current Host instance, request/action IDs, and an expiry of at most 120 seconds. Only immutable target references from the current snapshot may cross this boundary: `snapshot_id`, `target_id`, `host_instance_id`, `mount_id`, `generation`, `path_digest`, `rect`, and an optional label. Target references contain no bearer or capability token. Pass the candidate's exact `action_ref` as the tool's `target_ref`; do not construct one from individual fields.

A zero-target `select` request is valid only with `capture_region: true`. It opens Host-owned arbitrary area selection and returns the selected region through the correlated action result. In this action contract, `capture_region` authorizes region selection; it does not itself authorize a screenshot or make visual bytes available to the model.

The completed Host path must return exactly one terminal result: `selected`, `confirmed`, `cancelled`, `rejected`, `expired`, `stale`, `disconnected`, `permission-denied`, `unavailable`, or `error`. Navigation, mount-generation changes, a changed Host instance, timeout, and disconnect invalidate the active interaction. Pointer and keyboard paths are independently permissioned, Escape cancels, and focus returns to the control that was active before the overlay opened.

Applications do not send these custom WebSocket messages themselves. The Session plugin is the sole WebSocket inbox owner for action results. It validates the sender and correlation, then routes the accepted result to the private per-call mailbox `session_ui_action_result:<sha256(call_id)>`; framework tools wait on that mailbox and do not subscribe to WebSocket topics. `session_ui_action_request` and `session_ui_action_result` remain private on-wire transport events between the broker and the authenticated Host connection. Relay prefix handling delivers the latter to the Session plugin as `ui_action_result`. See [Agents](../../framework/agents.md#attention-context-and-ui-actions) and [Relay](../../framework/relay.md#attention-ui-action-routing).

## Optional visual capture

**Availability:** visual capture remains phase-gated at release level. The session
upload authorizer and byte resolver, pre-persistence verification, and framework
`visual_resolver` integration are implemented. These interfaces do not establish
production capture, redaction, multimodal, expiry, or orphan-cleanup acceptance;
keep visual capture disabled until the selected deployment proves those paths.

Visual capture is a separate capability and consent decision. Enabling semantic Attention does not authorize a screenshot. The provider must make capture visible to the user, restrict it to the requested composited region, apply the same exclusion and redaction policy, enforce byte and dimension limits, and authorize any resulting reference for the current session.

Visual failure behavior depends on when the failure occurs:

1. Before attachment composition, capture denial or failure can leave an otherwise valid semantic Attention attachment available. No failed visual reference is added to the send.
2. Once a visual reference is attached, the session layer validates its structure, session binding, expiry, media type, declared size, and digest, authorizes the reference, and resolves and verifies its exact bytes before persistence. Missing authorization or verification, denied access, invalid bytes, or a digest mismatch rejects the entire message and attachment array atomically. The service does not silently downgrade that send to semantic-only or text-only content.
3. When rendering an already accepted message, the framework calls `visual_resolver` again for an eligible reference and verifies media type, size, and SHA-256 before emitting image input. Later expiry, denied access, an unavailable resolver, or invalid bytes omits that image and returns a render diagnostic. Other valid semantic context remains renderable; this does not rewrite the persisted message or bypass send-time validation.

The default session resolver supports an `upload` reference through the registered `userspace.contract:content_provider` contract and the exact `userspace.uploads:content_provider` implementation. It opens the provider with the attachment’s opaque upload ID only after session binding, expiry, media type, declared size, and digest validation. It then verifies provider metadata, storage identity, the size before and after reading, the exact byte count, media type, and SHA-256 digest before the framework emits an image part. Deployments that replace this provider must preserve the same authorization and time-of-check/time-of-use protections. Capture failure and abandoned uploads must also follow the deployment’s bounded upload-expiry and orphan-cleanup policy; a durable reference alone is never permission to read bytes.

A capture provider reports whether its result is exact, composited, partial, denied, or unavailable. These capture outcomes precede attachment composition and are distinct from rejection of an attached unauthorized visual reference. Capture correlation handles remain private live transport state and do not appear in `wippy.attention.v1`.

## Privacy and security

- Password, hidden, file, one-time-code, payment-card, credential-like, and similarly named editable controls are excluded automatically.
- `data-wippy-attention="exclude"` removes an element and its subtree as candidates. `data-wippy-attention="redact"` retains geometry while removing that subtree’s text from summaries.
- `privacy.text: "none"` disables collected text globally while retaining geometry and non-text structural context.
- Frame metadata is `about:srcdoc` or a bare origin. Paths, query strings, fragments, usernames, and passwords are rejected.
- Only trusted browser input is recorded. Script-dispatched pointer and focus events do not enter the observation history.
- Mount generations and path digests detect stale or remounted targets. They are correlation data, not authorization credentials.
- The session service strips ephemeral routing context before persistence. History and replay contain only validated immutable attachments.

## Partial results and errors

`capture.complete: false` or a non-empty `omissions` array means the snapshot is partial. Consumers must not invent the missing path. Common omission reasons include `capability-unavailable`, `child-timeout`, `child-disconnected`, `navigation`, `stale-mount`, `point-budget`, `query-budget`, `candidate-budget`, `response-budget`, `redacted`, and `unsupported-boundary`.

Transport omission details use only the safe grammar `transport:<allowlisted-code>:stage:<query-call|query-await|project-result>`. The code is one of the documented relay error codes; an unrecognized exception becomes `internal-error`. Durable context must never contain raw exception messages, stack traces, URLs, tokens, or arbitrary child-supplied diagnostic text.

Relay errors distinguish invalid requests, unsupported versions, unauthorized callers, Host-instance mismatch, expired or revoked capability, generation mismatch, deadline expiry, detach, navigation, disconnect, oversized responses, and internal failure. Ordinary page rendering continues when Attention is unavailable.

## Operational verification

Before enabling Attention for users, verify all of the following against the exact deployed module revisions:

1. Disabled mode emits no Attention attachment and opens no overlay.
2. Pointer and focus paths include all expected panel, artifact/page, engine, component, shadow, and final-element segments.
3. A boundary sample discovers candidates from both edge-to-edge children.
4. Message text and attachment persist atomically and survive history retrieval and a runtime restart.
5. Highlight, confirmation, selection, cancel, timeout, stale target, navigation, disconnect, reconnect, and focus restoration work in compatibility and managed layouts.
6. Visual capture consent, denial, redaction, reference authorization, and multimodal mapping work when that capability is enabled.
7. The committed browser suite passes in Chromium, Firefox, and WebKit.
8. After canonical English documentation and release evidence are accepted, update translations as the final documentation work item. Do not translate a moving contract.

## Documentation and KB release gate

Canonical English documents must pass repository validators before Wippy KB ingestion. For every ingested or updated document, record the exact validated source SHA-256, the KB document ID, and the repository revision. Read every updated document back and verify that its content matches the recorded source.

Retrieval QA must contain at least 12 concrete questions covering setup, nested coordinate resolution, Web Fragments, message attachments, overlay actions, privacy, screenshots, errors, and migration. Compare answers with both the validated source and raw KB search results. Fix the canonical source or KB entry and repeat ingestion, read-back, and failed questions until every answer returns the correct guidance.

Translations begin only after English acceptance, KB read-back, and retrieval QA are complete. Public documentation publication remains blocked until it is explicitly approved and actually performed; validated local documents and successful KB ingestion are not proof of publication.

## See Also

- [Attention Context for micro frontends](../micro-frontends/attention-context.md) — public API and authoring guidance
- [Proxy & Isolation](./proxy-isolation.md) — proxy injection and nested boundaries
- [Render Engines](./render-engines.md) — iframe and Web Fragment delivery
- [Proxy API](../micro-frontends/proxy-api.md) — package-facing proxy exports
