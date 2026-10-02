---
title: "Attention Context"
description: "Configure and operate nested pointer, focus, clarification, and optional visual context in the Wippy Web Host."
---

# Attention Context

The Wippy Attention Context API provides bounded observation and inspection of one application Host tree. Pointer, focus, selection, semantic search, geometry and actions use the same Host-owned canonical identities across panels, artifacts, pages, iframes, Web Fragments, web components and shadow roots.

The mounted Host keeps bounded observation and the public inspection API active even without a Session. Automatic message attachments, agent inspection authority and interactive permissions are separate controls.

Attention has four independent controls:

| Capability | Purpose | Configuration gate |
|---|---|---|
| Fresh agent inspection | Read current semantic UI state through private tools | Effective `wippy.agent.traits:attention` tool authority and the authenticated submitting Host |
| Message context | Attach “what I am pointing at” observations to one user message | `enabled` and `messageContext.enabled` |
| Agent actions | Highlight, confirm, or select a visible target | `enabled`, `agentActions.enabled`, and a validated action runtime |
| Visual capture | Prepare an approved, redacted ordinary composer file | `enabled`, `visualCapture.enabled`, and separate user approval |

Enabling one control does not enable the others. Missing or false optional feature flags disable attachments and interactive capabilities, while bounded observation and explicit authorized reads remain available. Receiving an attachment does not grant an agent tools.

## Enable Attention

The facade `attention` requirement accepts a JSON object. This configuration enables semantic message context while leaving interactive actions and capture off. Set it in the application's facade requirements using the project's declared startup workflow:

```json
{"enabled":true,"messageContext":{"enabled":true,"defaultInclude":false},"agentActions":{"enabled":false,"requireConfirmation":true},"visualCapture":{"enabled":false},"sampling":{"radiusCssPx":20,"stepCssPx":5},"privacy":{"text":"safe"}}
```

| Field | Meaning |
|---|---|
| `enabled` | Enables the optional attachment and interactive feature configuration. It does not turn off bounded observation or public inspection. |
| `messageContext.enabled` | Allows the Host to create `wippy.attention` message attachments. |
| `messageContext.defaultInclude` | Does not replace the persisted Session setting. Use `attention_context.enabled`, default false, to control automatic attachments. |
| `agentActions.enabled` | Allows the authenticated session broker to address the Host overlay. |
| `agentActions.requireConfirmation` | Requires a second confirmation after choosing a candidate. |
| `visualCapture.enabled` | Makes the separately consented visual-capture capability available. |
| `sampling.radiusCssPx` | Neighborhood radius in Host CSS pixels. The default is `20`; the maximum is `100`. |
| `sampling.stepCssPx` | Grid spacing in Host CSS pixels. The default is `5`; the valid range is `1`–`100`. |
| `privacy.text` | `safe` includes bounded safe text; `none` suppresses text summaries. |

Visual capture saves the approved image as an ordinary upload through the Host `uploads.create` route, which is `POST /api/v1/uploads` by default. The upload type that serves this route must allow the `image/png` MIME type, and also `image/webp` if agents request WebP captures. If the upload is refused, the capture action ends with `error` and no composer file is created.

The automatic attachment setting belongs to the Session, so each conversation has its own value and revision. A new Session can set `attention_context_enabled` when it is created. Later, the user's client can change it with `PATCH /api/v1/sessions/{session_id}/attention-context` and a body of `{"enabled": true}` or `{"enabled": false}`, with an optional `expected_revision`. The agent can change it with the `attention_context_set` tool without asking the user: no confirmation prompt is shown, and the Attention trait tells the model to use the tool only when the user asks for it. The setting stays with the Session when the user switches to another agent. A one-message opt-out does not change the stored setting.

Turning automatic attachment off does not stop observation, remove authorized inspection tools or revoke capture permission. Turning it on fails with `409 ATTENTION_CONTEXT_CAPABILITY_UNAVAILABLE` when the Session cannot render `wippy.attention` version 4, and a stale `expected_revision` fails with `409 ATTENTION_CONTEXT_REVISION_CONFLICT`. Failed context preparation keeps the draft and sends no text-only substitute.

## Canonical inspection and agent tools

Public packages can inspect their own registered subtree. `fromRoot: true` selects the same application Host tree, never another tab or the outer website. See [the public methods and examples](../micro-frontends/attention-context.md#inspect-the-current-interface). A `NodeRef` contains `host_instance_id`, `node_id`, `mount_id` and `generation`. Labels, selectors and resource IDs are not occurrence identities. Offscreen mounted nodes remain queryable; only owners can declare unmounted placeholders.

The reusable `wippy.agent.traits:attention` trait gives an agent 14 private tools in the `wippy.agent.tools` namespace. The nine read tools are:

| Tool | Arguments | Purpose |
|---|---|---|
| `attention_find_semantic` | At least one of `role`, `name`, `text`, `resource_id`; optional `scope`, `limit` (1 to 8), `continuation` | Match semantic fields across the permitted tree. |
| `attention_find_css` | `selector`, `root`; optional `limit` (1 to 8), `continuation` | Query one explicitly named canonical document or shadow root. |
| `attention_get_node` | `node_id`; optional `scope` | Resolve an exact canonical node ID. |
| `attention_get_tree` | Optional `scope`, `limit` (1 to 32, default 32), `depth` (0 to 32, default 2), `continuation` | Read a bounded subtree page. |
| `attention_get_geometry` | `node` | Measure a canonical node. |
| `attention_get_cursor` | Optional `scope`; pass `{}` for the whole Host | Read the latest pointer observation with its original timestamp. |
| `attention_get_focus` | Optional `scope`; pass `{}` for the whole Host | Read current focus with its original timestamp. |
| `attention_get_selection` | Optional `scope`; pass `{}` for the whole Host | Read selected text and both canonical endpoints. |
| `attention_hit_test` | `x`, `y`; optional `scope`, `coordinate_space`, `radius_css_px` (0 to 100), `step_css_px` (above 0, at most 100) | Inspect a point. The defaults are the Host viewport, a 20 CSS-pixel radius and a 5-pixel grid. |

Every `scope`, `root` and `node` argument is a complete returned `NodeRef`. The trait also includes `attention_context_set`, which turns automatic pointing context on or off for the current Session, and the four action tools `ui_action_highlight`, `ui_action_confirm`, `ui_action_select` and `ui_action_capture_visual`. See [agent clarification actions](#agent-clarification-actions) for the action tools. The older `attention_inspect` tool was removed; the explicit read tools above replace it.

Semantic and CSS search are separate modes. Semantic search uses structured string matching, not embeddings. CSS requires one document or shadow-root reference and never crosses it. Search tools return at most eight matches. Tree tools return at most 32 nodes and default to depth two; semantic search retains deep traversal.

CSS matching uses an inert privacy-filtered structure. Excluded and sensitive subtrees cannot affect `:has`, sibling positions or `:empty`; redacted nodes have no queryable attributes or text. Editable values are unavailable. Safe non-editable value attributes and live checked/selected state remain queryable. Supported pseudo-classes are `:scope`, `:root`, `:empty`, `:is`, `:where`, `:not`, `:has`, first/last/only/nth child and type selectors, `:checked`, `:disabled`, `:enabled`, `:required`, `:optional`, `:read-only`, `:read-write`, `:indeterminate`, `:focus`, `:focus-visible` and `:focus-within`. Focus matching uses current safe focus, including owned closed roots; `:focus-visible` also requires the browser to report that focus state. Other state pseudo-classes such as `:hover`, `:active` and `:visited` return `invalid-request`.

For node-relative `atPoint` queries, element coordinates are CSS pixels from the untransformed border-box origin. Shadow-root coordinates use the host element's border box; document coordinates use the document viewport. Conversion includes composed ancestor scale, CSS zoom, iframe borders and padding, and scroll. Returned points use Host viewport CSS pixels. Unsupported rotation, skew or perspective returns `unsupported-transform`.

The tools authenticate the complete private reply, then persist only a compact `wippy.attention.model.v1` result. Node rows and local dictionaries preserve canonical IDs, complete returned ancestry, selection and original observation times. Dictionary positions are never action identities. A unique target can include its unchanged action reference. Each successful result is limited to 8 KiB; overflow returns an explicit partial result. If rows are removed, continuation is suppressed so a later page cannot skip them. Host continuations remain bound to scope, query, revision, aggregate work and a 30-second expiry.

The Attention trait installs a guard that runs before tool execution. It admits one read per batch and at most four attempted reads per user turn. Invalid and refused attempts count, and two invalid attempts end repair. An unchanged `attention_find_semantic`, `attention_find_css`, `attention_get_node` or `attention_get_tree` call is refused unless the tree revision changed or a UI action ran after the earlier read. If the guard cannot read complete Session history for the current turn, it refuses the read. A refused call keeps the model's own call ID, tool name and arguments. The refusal reason travels to the tool in its execution context, and the tool returns a `rejected` result with that reason without contacting the Host. Unrelated tools in a mixed batch keep their normal behavior.

Session stores each compact read result in private function history, and later model generations see it again. Session withdraws an earlier read in the turn only when what it observed has changed. Reads of tree content are withdrawn when the tree revision changes, and geometry reads are withdrawn when geometry changes. Cursor, focus and selection reads are withdrawn only when a newer read of the same query exists. The model then sees a notice that the result was withdrawn, so it can call the tool again. Read lifetimes are measured from the time the server received the result, not from browser clocks. There is no full-result store and no global generation or cost limit. These limits apply only to Attention reads and do not change generic engine or provider behavior.

## What the Host observes

The Host records trusted `pointermove`, `pointerdown`, `pointerup`, `click`, `touchstart`, and `touchend` events. Each pointer or touch event has an occurrence-safe `event_id`, a monotonically increasing realm `sequence`, an absolute UTC `observed_at` timestamp, `realm_time_ms`, its point, and the candidate IDs resolved at that time. Pointer-specific fields are `pointer_id`, `pointer_type`, `buttons`, and `pointer_capture` when applicable.

Current focus is a separate object, not a pointer event. It has `event_id`, `sequence`, `focused_at`, `realm_time_ms`, an optional `candidate_id`, the complete nested `path`, and a safe accessibility `summary`. A trusted `focusout` clears current focus unless the user moves into excluded conversation controls. That transfer preserves the last meaningful focus and its original timestamp, including while Send temporarily disables the composer. Sensitive content, detachment and retired identities invalidate focus; leaving the Host document returns no current focus. Web Fragments use the physical Host observation rather than the hidden realm's native focus state. Pointer fields such as `observed_at`, `point`, and `buttons` do not belong to the focus object.

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

Queries negotiate `wippy.attention.relay.v2`, retaining v1 point/selection compatibility for older peers. New inspection operations require v2. Requests carry deadlines and remaining depth/query/query-point/candidate/byte budgets, and correlate every result. The root compositor starts with at most 128 recursive queries and 4,096 total query points. Each child receives a disjoint lease from those aggregate budgets; unused work is not duplicated across siblings. The default query timeout is 1,500 ms. An upstream runtime retries capability discovery every 100 ms, for at most 50 attempts, and renews an accepted grant before expiry. The default grant lifetime is 60 seconds; the renewal lead is the smaller of 5 seconds and half the remaining lifetime. Unsupported, timed-out, detached, navigated, or over-budget children produce explicit omissions; successful siblings are retained.

The default transport grant allows 256 points, 128 candidates, and a 128 KiB response. These are negotiated relay limits, not the size of one sample grid. The default 20-pixel/5-pixel neighborhood happens to contain 49 points; callers can use a different bounded point set only within the negotiated limits.

Live relay capability credentials are never copied into a durable message attachment. They authorize only the negotiated parent-to-child transport and expire or are revoked when the occurrence changes.

| Schema | Messages or payload | Lifetime |
|---|---|---|
| `wippy.attention.runtime.v1` | Host and parent/target mount bootstrap identity | Current mount occurrence |
| `wippy.attention.capability.v1` | `capability-request`, `capability-grant` | Short-lived parent/child negotiation |
| `wippy.attention.relay.v1` | `query-request`, `query-result`, `query-error` | One bounded recursive query |
| `wippy.attention.relay.v2` | Shared authenticated inspection, point/selection and subscription transport | One bounded query or disposable subscription |
| `wippy.attention.v1` | Composed snapshot with pointer, focus, candidates, capture settings, and omissions | Immutable message attachment |
| `wippy.attention.v2`, `wippy.attention.v3` | Earlier compact snapshot encodings with a shared path dictionary | Immutable message attachment |
| `wippy.attention.v4` | Compact immutable attachment with complete retained path dictionaries | Immutable message attachment |
| `wippy.attention.visual.v1` | Reference to an approved image upload | Immutable message attachment |
| `wippy.attention.model.v1` | Compact private inspection result | Persisted private tool result |
| `wippy.session.capabilities.v1` | Session capability descriptor | One HTTP response |
| `wippy.ui-action.v1` | Private inspection or interactive `request` and `result` | One correlated operation |

## Web Fragments

Web Fragments are first-class instrumented Attention boundaries. The Host queries the reflected physical Host shadow tree for hit identity, stacking, clipping, and rectangles. `proxy-fragment.js` in the fragment runtime contributes package identity, runtime identity, semantic roots, privacy rules, reflected-node mapping, and nested-child capabilities.

The hidden realm’s native `document.elementFromPoint()` behavior is therefore not an Attention portability constraint. A fragment candidate reports provenance such as `geometry_source: "physical-host"` and `runtime_source: "fragment-realm"` so consumers can distinguish the two contributors.

## Message attachment contract

`context_attachments` is a generic, versioned array on `session_message.data`. Current compact attachments use version 4; versions 1 through 4 remain supported. The following version 1 fixture demonstrates the compatible envelope. The `content` string is canonical JSON; `content_bytes` is its UTF-8 byte length and `content_hash` is its lowercase SHA-256 digest. The Host may stage this content and send a one-use reference through the same atomic submission path; see [message delivery](#message-delivery).

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

### Message delivery

On a Host with Attention enabled, a message without attachments uses the normal receipt-confirmed delivery. It also carries the tab binding, `runtime_context`, so agent tools in that turn reach the Host tab that sent the message. Only a message with context attachments uses the stricter context path. On that path the Host validates the attachments against the handlers that the Session reports. When the inline message would be too large for one WebSocket command, the Host stages the attachments with `POST /api/v1/sessions/context` and sends a one-use `context_attachments_ref` instead of the inline array.

The Host sends `runtime_context` only to a Session whose capability descriptor reports Attention support. For an older Session, plain messages are sent as before, and a message with pointing context is refused with an error so the user can send it without that context.

### Session capability descriptor

`GET /api/v1/sessions/capabilities` describes the protocol features of the Session module. The Host reads it before it chooses a delivery path. The endpoint requires an authenticated user, returns `401` otherwise, and sends `Cache-Control: no-store`. A Session release without this endpoint answers `404`, and the Host then treats that Session as having no Attention support.

```json
{
  "success": true,
  "capabilities": {
    "schema": "wippy.session.capabilities.v1",
    "message_receipt": 1,
    "steering": 1,
    "attention": {
      "context": 1,
      "browser_operations": 1,
      "context_attachments": {
        "transport": 1,
        "staging": true,
        "max_context_bytes": 32768,
        "handlers": [
          { "kind": "wippy.attention", "versions": [1, 2, 3, 4] },
          { "kind": "wippy.attention.visual", "versions": [1] }
        ]
      }
    }
  }
}
```

| Field | Meaning |
|---|---|
| `schema` | Always `wippy.session.capabilities.v1`. |
| `message_receipt` | Version 1 means the `received` event echoes the message `request_id`, and an identical retry returns the same message. |
| `steering` | Version 1 means input sent while a turn runs is stored as pending and applied at the next step, session updates carry `interaction`, and Stop accepts a `stop_request_id`. |
| `attention.context` | Version 1 means the Session stores the per-Session `attention_context` setting and supports `attention_context_set` and the `PATCH` route. |
| `attention.browser_operations` | Version 1 means the Session accepts the `runtime_context` tab binding and routes `session_ui_action_request` and `session_ui_action_result`. |
| `attention.context_attachments.transport` | The attachment transport version, currently 1. |
| `attention.context_attachments.staging` | `true` when the Session accepts staged attachments at `/api/v1/sessions/context`. |
| `attention.context_attachments.max_context_bytes` | The largest staged attachment payload in bytes. |
| `attention.context_attachments.handlers` | The attachment kinds and versions that the Session can render for the model. |

The Host treats a Session as supporting Attention when both `attention.context` and `attention.browser_operations` are at least 1.

### Limits by attachment version

Every envelope has these limits, whatever its kind:

- `attachment_id` and `kind` are at most 128 characters, and `kind` is lowercase words joined by single dots or hyphens.
- `content_type` is `application/json`, and `content_hash` is `sha256:` followed by 64 lowercase hexadecimal digits.
- `content_bytes` and the serialized envelope are each at most 32 KiB (32,768 bytes), and the whole `context_attachments` array is also at most 32 KiB.

The known kinds add their own limits:

| Kind and version | Payload schema | Envelope limit | Payload limits |
|---|---|---|---|
| `wippy.attention` version 1 | `wippy.attention.v1` | 32 KiB | At most 128 candidates, 32 recent events, 128 omissions and 4,096 sample points. Each path has 1 to 32 segments. |
| `wippy.attention` version 2 | `wippy.attention.v2` | 16 KiB (16,384 bytes) | The version 1 limits after expansion, plus at most 4,128 shared path dictionary entries and 16,384 links between candidates and sample points. |
| `wippy.attention` version 3 | `wippy.attention.v3` | 16 KiB | The version 2 limits. Path segments in the dictionary use a packed form. |
| `wippy.attention` version 4 | `wippy.attention.v4` | 16 KiB | The version 3 limits. Selection anchor and focus paths also use dictionary indices. |
| `wippy.attention.visual` version 1 | `wippy.attention.visual.v1` | 32 KiB | A PNG or WebP image of at most 1 MiB, at most 2,048 pixels wide and high, and at most 4,194,304 pixels in total. The attachment's `expires_at` must equal the payload's `expires_at`. |

The envelope limit for versions 2 to 4 applies to the canonical JSON of the whole envelope. After expansion, all `wippy.attention` attachments in one message share a budget of 256 KiB (262,144 bytes). Session accepts versions 2 to 4 only when its renderer can expand them; otherwise the send fails with `unsupported-attention-version`.

### Model projection and durable context

The model receives at most six recent events: the newest discrete events first, then the newest moves if slots remain. Current pointer and focus are separate from those six events. Up to eight targets are rendered, subject to the render byte budget. Current pointer and focus have priority; when sampling finds multiple terminal child realms under one shared root, the renderer reserves one representative per realm before additional hits and older-event targets. Unequal nesting depths do not make a sibling ineligible. If the target or byte limit prevents full representation, the model must treat that coverage as partial.

The model receives grid settings, sampled-point count, duration, completeness, and `capture.sample_bounds` rather than the full 49-point default lattice. Each rendered candidate includes at most three sample IDs, with `sample_point_count` and `sample_point_ids_omitted` describing the reduction. Model-only `partial` fields report omitted candidates, recent events, sample points, and omission records. `partial.sampled_realms` counts the eligible multi-realm frontier and `partial.sampled_realms_omitted` counts its unrepresented realms; zero means that no eligible multi-realm frontier was identified, not that no target was sampled.

Persisted attachments keep their exact retained paths. Current compact v4 uses ancestry dictionaries; the legacy v1 fixture above retains its sample grid directly. The attachment renderer does not rewrite persisted content or action references. Its existing model projection retains up to 32 pointer-target path segments and 12 secondary/focus segments. These attachment render limits are distinct from explicit inspection tools, whose compact results preserve complete returned ancestry within an 8 KiB ceiling. There is no private context-file retrieval store, and ordinary uploads do not expand semantic context. Files attached to a message are listed to the model by file name, type, size and ID; their content is never inlined as an image. Image content reaches the model only through an approved `wippy.attention.visual` capture, described in [optional visual capture](#optional-visual-capture).

When agent actions are enabled, an eligible rendered candidate includes an `action_ref`. To act on that candidate, the agent copies the complete `action_ref` object verbatim as one item of the tool's `targets` array. Reconstructing a target from visible IDs or geometry is invalid because it can omit the Host instance, mount generation, or path digest used for stale-target validation.

## Agent clarification actions

Agent actions require their own configuration and authority. A fresh read can supply an action reference without a prior message attachment. When a read returns exactly one node that can be acted on, its result includes a `target_ref` object with the same fields as `action_ref`.

The trait provides four Host-owned interactions:

| Tool | Mode | Targets | User experience |
|---|---|---|---|
| `ui_action_highlight` | `highlight` | 1 to 32 | Project the supplied rectangles and draw attention to them. |
| `ui_action_confirm` | `confirm` | 1 to 32 | Ask whether one of the supplied targets is the intended target. |
| `ui_action_select` | `select` | 0 to 32 | Ask the user to choose a supplied target, or open arbitrary area selection when no targets are supplied and `capture_region: true`. |
| `ui_action_capture_visual` | `capture_visual` | 1 to 32 | Ask the user to approve an image of a target, a region or the viewport. The approved image becomes a removable composer file. |

All four tools take `targets`, an array whose items are the `action_ref` or `target_ref` objects copied verbatim. They also take an optional `prompt` of at most 512 characters, and `allow_pointer` and `allow_keyboard`, which both default to `true`. The highlight, confirm and select tools also take `capture_region`, which defaults to `false`. `ui_action_capture_visual` takes an optional `capture` object instead:

| `capture` field | Values | Default | Meaning |
|---|---|---|---|
| `scope` | `target`, `region`, `viewport` | `target` | What the user is asked to approve. |
| `region` | `{ x, y, width, height }` with a positive width and height | None | The area to offer. It is required when `scope` is `region`. |
| `allow_adjustment` | `true`, `false` | `true` | Lets the user adjust the area before approving it. |
| `allow_viewport_choice` | `true`, `false` | `false` | Lets the user choose the entire app viewport instead. |
| `format` | `image/png`, `image/webp` | `image/png` | The image format of the prepared file. |

The action tools and `attention_context_set` are private and exclusive, so each one cancels concurrent tool calls. The read tools are not exclusive, and their guard keeps unrelated calls in mixed batches. The session broker binds each request to the authenticated user, Session, active agent, turn, submitting Host tab and connection generation. Interactive requests expire within 120 seconds. Immutable target references contain `snapshot_id`, `target_id`, `host_instance_id`, `mount_id`, `generation`, `path_digest`, `rect`, and an optional `label`. They contain no bearer or capability token. Put the exact object into `targets` and do not construct one from individual fields. A stored reference does not refresh expired authority.

A zero-target `select` request is valid only with `capture_region: true`. It opens Host-owned arbitrary area selection and returns the selected region through the correlated action result. In this action contract, `capture_region` authorizes region selection; it does not itself authorize a screenshot or make visual bytes available to the model.

### Terminal statuses

Each action returns exactly one terminal result. Its `status` is one of these values:

| Status | Meaning |
|---|---|
| `selected` | In `select`, the user chose a target or an area. The result includes `selected_target`. |
| `confirmed` | In `highlight` or `confirm`, the user accepted the suggested target. The result includes `selected_target`. |
| `prepared` | In `capture_visual`, the user approved the image and the Host added it to the composer. The result includes `prepared_file` with `uuid`, `name`, `mime_type`, `byte_size`, `sha256` and `scope`. |
| `cancelled` | The user cancelled, for example with Escape, or the tool stopped waiting and cancelled the request. |
| `denied` | In `capture_visual`, the user declined, the browser denied capture permission, or the area is excluded for privacy. |
| `rejected` | The user said that the suggested target is not the one they meant. |
| `expired` | The request reached its deadline before the user answered. |
| `stale` | A target, the Host instance or the visible Session changed, so the request no longer matches the page. |
| `disconnected` | The Host connection closed or the Session plugin stopped before a result arrived. |
| `permission-denied` | The Host refused the request because a required permission was not granted. |
| `unavailable` | The Host cannot run the request, for example because actions or capture are disabled, another action is active, or no input method is allowed. |
| `error` | The Host failed while running the request, for example because the capture upload failed. |

Read tools use the same result envelope. A read that the Host answered has status `inspected`, and a read that the Attention guard refused returns `rejected` with a `reason`.

Navigation, mount-generation changes, a changed Host instance, timeout, and disconnect invalidate the active interaction. Pointer and keyboard paths are independently permissioned, Escape cancels, and focus returns to the control that was active before the overlay opened.

Applications do not send these custom WebSocket messages themselves. The Session plugin is the sole WebSocket inbox owner for action results. It validates the sender and correlation, then routes the accepted result to the private per-call mailbox `session_ui_action_result:<sha256(call_id)>`; framework tools wait on that mailbox and do not subscribe to WebSocket topics. `session_ui_action_request` and `session_ui_action_result` remain private on-wire transport events between the broker and the authenticated Host connection. Relay prefix handling delivers the latter to the Session plugin as `ui_action_result`. See [Agents](../../framework/agents.md#attention-context-and-ui-actions) and [Relay](../../framework/relay.md#attention-ui-action-routing).

## Optional visual capture

An authorized `ui_action_capture_visual` request opens Host approval. Target or bounded-region capture is the default, and whole-viewport capture is offered only when the request sets `allow_viewport_choice`. Semantic inspection never starts a screenshot. The application's upload type must accept PNG, and WebP when it is requested; see [Enable Attention](#enable-attention).

Approval captures and redacts the selected area, saves it as an ordinary upload, and adds it to the composer as a removable file. It does not send a message. The user can remove the file or send it with a later message through ordinary `file_uuids`. When a sent message still includes the file, the Host also adds one `wippy.attention.visual` version 1 attachment that references that upload, and the model receives the approved image. This happens even when automatic pointing context is off. The visual attachment is the only way image content reaches the model. Semantic `wippy.attention` attachments never contain screenshot bytes or upload references.

The Host revalidates target identity, generation, ancestry, geometry and privacy before capture and before accepting a prepared result. Missing or stale authority, cancellation, denial, navigation and disconnect terminate the request without a draft. The provider applies exclusions and redaction and enforces byte and dimension limits. Composer drafts remain Session-scoped; removal invokes cleanup.

The fresh snapshot and the final frame must still match the originally approved target rectangle. Movement between approval and snapshot, or while a frame is pending, returns `stale-target` even if the same canonical node remains live. The Host does not silently move an approved crop; a new capture requires approval again.

A later ordinary file send retains normal file authorization and atomic message validation. A missing or expired file does not silently become an attachment-free send. Ordinary uploads use the registered `userspace.contract:content_provider` contract and `userspace.uploads:content_provider` implementation. Preserve authorized byte reads, declared size, media type, SHA-256 integrity, time-of-check/time-of-use protections, upload expiry and the orphan-cleanup policy.

Session checks a `wippy.attention.visual` attachment before it stores the message. The reference must name an upload, be authorized for the same Session and not be expired. The image must be PNG or WebP within the [visual limits](#limits-by-attachment-version), and the uploaded bytes must match the declared SHA-256 digest. A reference that fails these checks rejects the complete send. When a later prompt is built, the framework emits the image only when the authorized `visual_resolver` returns bytes that pass the same checks. Otherwise it omits the image with a diagnostic, and valid semantic content remains available. Neither the attachment nor the resolver grants capture consent.

## Privacy and security

- Password, hidden, file, one-time-code, payment-card, credential-like, and similarly named editable controls are excluded automatically.
- `data-wippy-attention="exclude"` removes an element and its subtree as candidates. `data-wippy-attention="redact"` retains geometry while removing that subtree’s text from summaries.
- `privacy.text: "none"` disables collected text globally while retaining geometry and non-text structural context.
- Frame metadata is `about:srcdoc` or a bare origin. Paths, query strings, fragments, usernames, and passwords are rejected.
- Only trusted browser input is recorded. Script-dispatched pointer and focus events do not enter the observation history.
- Mount generations and path digests detect stale or remounted targets. They are correlation data, not authorization credentials.
- The chat composer, its upload list and file previews are excluded from Attention reads and captures.
- The session service strips ephemeral routing context before persistence. History and replay contain only validated immutable attachments.

## Partial results and errors

`capture.complete: false` or a non-empty `omissions` array means the snapshot is partial. Consumers must not invent the missing path. Common omission reasons include `capability-unavailable`, `child-timeout`, `child-disconnected`, `navigation`, `stale-mount`, `point-budget`, `query-budget`, `candidate-budget`, `response-budget`, `redacted`, and `unsupported-boundary`.

Transport omission details use only the safe grammar `transport:<allowlisted-code>:stage:<query-call|query-await|project-result>`. The code is one of the documented relay error codes; an unrecognized exception becomes `internal-error`. Durable context must never contain raw exception messages, stack traces, URLs, tokens, or arbitrary child-supplied diagnostic text.

Relay errors distinguish invalid requests, unsupported versions, unauthorized callers, Host-instance mismatch, expired or revoked capability, generation mismatch, deadline expiry, detach, navigation, disconnect, oversized responses, and internal failure. Ordinary page rendering continues when Attention is unavailable.

## Operational verification

Before enabling Attention for users, verify all of the following against the exact deployed module revisions:

1. Automatic attachment off emits no automatic Attention attachment. Optional interactive capabilities off opens no overlay. Bounded observation and authorized fresh reads still work.
2. Pointer and focus paths include all expected panel, artifact/page, engine, component, shadow, and final-element segments.
3. A boundary sample discovers candidates from both edge-to-edge children.
4. Message text and attachment persist atomically and survive history retrieval and a runtime restart.
5. Highlight, confirmation, selection, cancel, timeout, stale target, navigation, disconnect, reconnect, and focus restoration work in compatibility and managed layouts.
6. Visual capture consent, denial, redaction, upload of PNG or WebP files, reference authorization, and image delivery to the model work when that capability is enabled.
7. `GET /api/v1/sessions/capabilities` reports `attention.context` and `attention.browser_operations`, and a plain message on an Attention Host still receives its `received` confirmation.

## See Also

- [Attention Context for micro frontends](../micro-frontends/attention-context.md) — public API and authoring guidance
- [Proxy & Isolation](./proxy-isolation.md) — proxy injection and nested boundaries
- [Render Engines](./render-engines.md) — iframe and Web Fragment delivery
- [Proxy API](../micro-frontends/proxy-api.md) — package-facing proxy exports
