---
title: "Session Forms"
description: "The wippy-form question card and the wippy-form-answers carrier element: what they render, how they load, and the artifact-state HTTP API behind them."
---

# Session Forms

`wippy/session` ships two `view.component` web components that render a
Session `ask_user` form (see
[Session Forms (framework)](../../framework/session-forms.md) for the
`ask_user` tool and the answer contract). `<wippy-form>` is the interactive
question card. `<wippy-form-answers>` is an invisible carrier that keeps a
form's answer record reachable to the agent without showing it to the user
twice. Like the chat elements in
[Chat Web Components](./chat-web-components.md), both are host-provided
elements to consume. The Session module registers and serves them, and an
application that embeds a chat surface does not author or bundle either one.

## `<wippy-form>`: the question card

For a version 1 definition, every field has `type: "choice"`, and the
component renders a question card instead of a plain fields form. A form with
several questions shows one question at a time with a `‹ n/total ›` counter,
per-answer notes, an "Other" free-text row, a review step before sending, and
a read-only answered summary afterward. A mixed or non-`choice` definition
(reserved for a later release) falls back to a plain radio and checkbox fields
form.

| Prop (HTML attribute) | Type | Default | Description |
| --- | --- | --- | --- |
| `form-version` | `number` | `1` | Definition schema version. A value other than `1`, whether it comes from this prop or from the loaded state's own `form_version`, disables the interactive form and shows a compatibility notice instead of ever rendering a `Submit`. |
| `definition` | `object` | `null` | The immutable form definition: `title`, optional `description`, optional `submit_label`, optional `answered_message` (never displayed), and `fields`. |
| `state` | `string` | `"active"` | Package-tag lifecycle: `"active"` (answerable) or `"idle"` (already answered, read-only). Changing it reloads canonical state from the Host. |
| `density` | `string` | `"compact"` | `"compact"` or `"comfortable"` sizing. Read purely through a `:host([density="comfortable"])` CSS selector. |

The component owns its own data loading, submission, and offline detection. A
host only needs to mount the tag with these attributes.

- It loads the state with a `GET` on mount, and reloads it on a visibility
  change, a session-message event, an artifact-update event, the Host's
  `@reconnect` event after a WebSocket reconnect, or the browser's `online`
  event.
- It submits with a client-generated `request_id` that it reuses on a retry,
  retries once automatically after a network failure with no response, and
  handles a 422 field-error response and a 409 already-submitted response.

### Behavior

- The card shows one question at a time. Answering (a click, or a number key
  for the first nine rows) moves to the next unseen question, and Previous and
  Next navigate back to change an earlier answer. A form with several
  questions ends on a review that lists every answer, with a single "Send
  answers" action. There is no per-question submit once the review is reached.
- Every answer row has a note toggle, and the field's `allow_other` setting
  controls the "Other" row.
  - A note is the user's own text about that one chosen option. It changes the
    answer's shape to `{ "value": "…", "note": "…" }` and does not add a
    separate field.
  - "Other" is a joined free-text input with its own send button, offered only
    when the field's `allow_other` is set.
- Once submitted, the card shows a read-only summary of exactly what was
  accepted, including any notes and the submission time. The card has no close
  or decline button, and it never takes focus on its own.

The keyboard shortcuts are scoped to focus inside the card, so they never
intercept typing in the surrounding chat composer.

| Key | Action |
| --- | --- |
| 1 to 9 | Answers or ticks the corresponding row. Only the first nine rows get a number, and a question can have more options than that |
| Shift+1 to 9, or N on a focused row | Opens that row's note |
| Enter | Sends from Other or a note, or saves a note and ticks its row on a several-answer question |
| Shift+Enter | Adds a line |
| Escape | Leaves a note or Other box |
| Arrow keys | Move between rows and between questions |

### Events

| Event | Payload | When |
| --- | --- | --- |
| `answer-submitted` | `{ requestId, answerMessageId, late }` | After a submission is durably accepted, including an exact replay |
| `error` | `{ message, error }` | An unrecoverable component-level error |
| `invalid` | `{ message }` | Invalid props/config |

## `<wippy-form-answers>`: the answer carrier

The Session server writes this element into the user's chat message
immediately after they answer a form (see
[the record shape](../../framework/session-forms.md#record-shape)):

```html
Answered questions about the delivery of your order.

<wippy-form-answers record='{"form_id":"…","form_version":1,"title":"Order details","late":false,"answers":{...}}'>
</wippy-form-answers>
```

It renders nothing. It has no shadow-root content and no `<slot>`, and it sets
`:host { display: none; }` as defense in depth. Its only prop is `record` (the
single-line JSON string), and its only public member is a read-only
`answerRecord` getter that parses that attribute and returns the parsed
object, or `null` on missing or invalid JSON. It dispatches no events and
makes no host API calls of its own beyond the theme subscription every Wippy
element gets.

Agents must never emit this tag themselves. It is written exclusively by the
Session server's message-composition code as part of the fixed answer format,
and it carries no meaning outside that exact wire format.

### Why the record lives in an attribute

Two failure modes both leave the tag on the page with no children. In the
first, the chat sanitizer strips an unrecognized tag, for example right after
a fresh deploy and before the Host has re-fetched the updated components list.
In the second, an unloaded or failed component script leaves the browser
treating the tag as an anonymous `HTMLElement`, which still renders its
children by default. An element with no children renders nothing either way,
and an element with visible text content would have shown the raw JSON to the
user for that entire window. Because the record is in an attribute, every
failure mode still shows nothing.

## How the components load

Both are `view.component` registry entries with `auto_register: true`, served
by the Session module at `/wippy-session-forms` (`wippy-form`) and
`/wippy-session-form-answers` (`wippy-form-answers`). The Web Host auto-loads
every `auto_register: true` component at boot and allows its tag, plus its
declared prop attribute names, through the chat message sanitizer. The names
are `definition`, `form-version`, `state` and `density` for `wippy-form`, and
`record` for `wippy-form-answers`. `record` is declared as a `wippy.props`
entry so that the sanitizer's allowed-attribute list includes it. Without that
declaration the attribute is stripped even when the tag itself is allowed
through.

## Host requirement

`<wippy-form>` submits through `artifactState`, a typed client that the Web
Host exports from every proxy realm (`$W.artifactState()` in an iframe, or the
named `artifactState` export from `@wippy-fe/proxy` in a host-mounted web
component). Web Host 1.0.61 or later exports it, and no earlier release does.
The matching npm release is `@wippy-fe/*` 0.0.61.

The component never fabricates a success or a mock answer. It checks the
conditions in the order of the following table, and the first one that
applies decides what the card shows.

| Condition | What the card shows |
| --- | --- |
| `form-version` prop or loaded state's `form_version` is not `1` | "This form needs a newer version of the app." The card reflects `card-state="unsupported"`. |
| The Host has no `artifactState` export (every Web Host release before 1.0.61) | The questions with their options disabled, no submit control, and `card-state="unsupported"`. The notice reads "This form needs a newer Web Host. If you already answered it, your answer is in the chat." When the Host passes `state="idle"` (the form was answered), it reads "This form was answered. Your answer is in the chat." instead. |
| The Host exports `artifactState`, but no artifact id is available in the element's context | The questions rendered read-only, with "This form cannot be submitted here." |

### Behavior on a Web Host before 1.0.61

A Web Host from before 1.0.61 has neither the `artifactState` export nor the
`data-wippy-artifact-id` attribute, so the component checks for the export
first. A newly asked form shows the real questions with disabled radio
buttons, no buttons in the card, and no placeholder rows. Every option is
unselected, because the saved answer cannot be read without the artifact-state
API, so the card cannot show what was chosen. The notice therefore points to
the chat, where the user's one-line answer message and the agent's reply stay
readable. The hidden answer record never appears, and nothing is mocked. In a
chat of answered forms, each card reads "This form was answered. Your answer is
in the chat."

The older `instance.form` adapter that `artifactState` replaces is described
under [`artifactState` and the deprecated
`instance.form`](#artifactstate-and-the-deprecated-instanceform).

## The artifact-state HTTP API

`GET` and `POST /api/v1/artifact/{id}/state` read a form's canonical state and
accept its answer. The concrete path comes from the route table
(`artifacts.state`) and can be overridden per deployment through
`feature.apiRoutes`, like any other Wippy Web Host route.

### `GET /api/v1/artifact/{id}/state`

```json
{
  "form_version": 1,
  "artifact_id": "artifact-uuid",
  "session_id": "session-uuid",
  "status": "active",
  "stale": false,
  "late": false,
  "content_version": 1,
  "definition": { "title": "Delivery preference", "fields": [] },
  "data": null,
  "submitted_at": null,
  "answer_message_id": null,
  "delivery": null
}
```

`status` is `"active"` (unanswered) or `"idle"` (answered). `stale` is computed
live and is meaningful only while `status` is `"active"`. It is `true` once a
different real user input was durably accepted after the form was created.
`data` holds the exact accepted answers once answered. `delivery` reports
`"pending"`, `"running"`, `"complete"`, or `"interrupted"` for an answered
form, and it is `null` for an unanswered one. It is derived from the message
history and not from a stored flag. Responses always carry
`Cache-Control: no-store`.

### `POST /api/v1/artifact/{id}/state`

```json
{
  "form_version": 1,
  "request_id": "client-generated-uuid",
  "expected_content_version": 1,
  "answers": { "delivery": "Courier" }
}
```

`request_id` should be generated once, at the moment the user attempts
submission, and reused unchanged on any retry of that same attempt. The server
recognizes a same-id, same-answers retry as a replay (`replayed: true` in the
response) and not as a conflict. `expected_content_version` is optional. When
it is present, it is checked against the artifact's current revision, so a
stale client cannot silently overwrite a form's state.

Success:

```json
{
  "success": true,
  "artifact_id": "artifact-uuid",
  "request_id": "client-generated-uuid",
  "answer_message_id": "message-uuid",
  "content_version": 2,
  "status": "idle",
  "late": false,
  "delivery": "pending",
  "replayed": false
}
```

A `200` here means the answer and its user message are durably accepted. It
does not mean the agent has replied yet, so show something like "Submitted.
Waiting for the assistant."

| Status | Meaning |
| --- | --- |
| 200 | Accepted (or an exact replay of an already-accepted submission, `replayed: true`) |
| 400 | Malformed JSON, missing/invalid envelope fields, a missing/invalid artifact id, or `not_a_form` for an artifact that exists but is not a session form |
| 401 | No authenticated actor |
| 403 | Authenticated, but no read/write permission on the form's session |
| 404 | Artifact or session not found, or not owned by the caller |
| 409 `request_conflict` | Same `request_id`, different normalized answers than the first attempt with that id |
| 409 `already_submitted` | The form was already answered by a different request |
| 409 `version_conflict` | `expected_content_version` no longer matches the current revision |
| 413 | Request body over 64 KiB |
| 415 | `Content-Type` is not `application/json` |
| 422 | Field validation failed, with `errors` keyed by field id and a `form_errors` list |
| 500 | Internal error; no mutation was applied |

Submissions are not rate-limited server-side, so the API never returns `429`.

## The `artifactState` proxy client

```typescript
const client = (await $W.artifactState())('artifact-uuid')
// or, inside a web component: import { artifactState } from '@wippy-fe/proxy'

const state = await client.get()
const result = await client.submit({
  form_version: 1,
  request_id: crypto.randomUUID(),
  expected_content_version: state.content_version,
  answers: { color: 'blue' },
})
```

- The route is re-resolved on every call. Nothing is cached when
  `artifactState(artifactId)` is constructed, and no global config is mutated.
- `artifactId` is validated up front, and an empty or whitespace-only id
  throws synchronously.
- Every failure, whether an HTTP status or a network error, rejects with a
  typed `ArtifactStateError` (`status`, `code`, and, for a 422, `errors` keyed
  by field id plus `formErrors`). The client never fabricates a success or
  failure body.

```typescript
try {
  await client.submit(envelope)
}
catch (error) {
  if (isArtifactStateError(error) && error.status === 422) {
    // error.errors: Record<string, { code: string, message: string }[]>
  }
  throw error
}
```

Prefer `isArtifactStateError(error)` over `error instanceof
ArtifactStateError`. The class is built separately into every proxy entry
point and into the published `@wippy-fe/proxy` npm package, so an `instanceof`
check against a class imported from a different bundle's copy can silently
never match, even for an error that the same client threw.
`isArtifactStateError` checks a brand that is stable across realms. The class
also overrides `Symbol.hasInstance` to run the same check, so a plain
`instanceof` works too, but `isArtifactStateError` is the safer spelling.

### `artifactState` and the deprecated `instance.form`

`instance.form.get()` and `.submit(data)` are a thin backward-compatibility
shim over `artifactState(appConfig.context.resourceId)`. A 422 maps to the
legacy `{ success: false, errors }` shape. Every other failure (401, 404, 409,
5xx, network) rethrows the same error that `artifactState` would throw, and
the shim never returns a mock success or failure. New code should call
`instance.artifactState(artifactId)` directly and not this deprecated shim.

## Styling API

`<wippy-form>` follows the Session Forms styling contract.

- Every visual value is a `--wippy-form-*` custom property with a semantic
  theme-variable fallback, and never a raw hex as the primary fallback.
- Every restylable piece is exposed as a `::part()`. State is reflected as
  both a `<part>-<state>` part and a `w-form__<part>--<state>` class.
- State that a stylesheet needs is a host attribute (`density`, `card-state`,
  `collapsed`).

The full token, part, and host-attribute tables, plus a restyle example, are
in the package's own README (`frontend/wippy-form/README.md` in the
`wippy/session` source). `<wippy-form-answers>` has no visible surface and
exposes no styling API, because hiding the record is its entire purpose.

## Accessibility

Each question has an accessible group label. A single-selection field is a
`role="radiogroup"` with `aria-required` when required, and a
multiple-selection field is a `role="group"`. A single-selection group is one
Tab stop, with a roving `tabindex` that arrow keys move between its rows (the
WAI-ARIA radio group pattern). A multiple-selection group leaves every row its
own Tab stop, because each row is an independent checkbox.

A field-level error renders as a `role="alert"` element, linked to its group
or text box through `aria-describedby`, so a screen reader announces the error
text as soon as it appears. A single polite live region announces question and
review navigation (for example "Question 2 of 4" or "Review your answers"),
tick and untick changes, and submission-result and validation-summary text,
without moving focus.

The [keyboard behavior](#behavior) covers answering, navigation, and notes
without a pointer. Escape in a note or the Other box only closes the editor,
and the typed draft stays saved with that answer. After a full submission is
accepted, focus moves to the read-only summary's status text, so it is not
lost when the card swaps from the active view to the answered one.

## Known gaps

- The tick boxes, radio marks, and input edges use the theme's existing
  surface-300/700 border colors, which give roughly 1.3 to 1.4:1 contrast,
  with no local override. The fix belongs in the theme and not in this
  component.
- The two "Send" buttons and the two composer send buttons are unstyled
  PrimeVue defaults. They follow the theme's own primary button color and not
  `--wippy-form-accent`, so retinting `--wippy-form-accent` alone leaves them
  on the old color while rows, the counter, key badges, and the focus ring
  follow the new one.
- The Notes and Other text boxes use the theme's own `.p-textarea` colors.
  No `--wippy-form-input-bg` or `--wippy-form-input-border` tokens exist yet.
- The following defaults may change in a later release:
  - The answer shape of a note (`{value, note}` or a separate field).
  - A newly opened card does not take keyboard focus on its own.
  - Only backticks render as inline code, with no other Markdown-style
    formatting.
  - Only the first nine rows of a question get a number-key badge, and there
    is no cap on how many options a question can have.

## Diagnostics

`<wippy-form>` reflects its own state as the `card-state` host attribute. The
attribute exists for styling, and it is also the fastest way to read what the
component is doing from the DOM or an end-to-end test:

| `card-state` | Meaning |
| --- | --- |
| `loading` | Before the artifact's first `GET` resolves; `<wippy-loading>` shows instead of the card. |
| `active` | Answerable: a question, the review step, or briefly, the submitting state. |
| `review` | The review step of a several-question form, before "Send answers". |
| `answered` | The read-only summary of an accepted submission. |
| `unsupported` | An unrecognized `form-version` (from the prop or the loaded state), or a Web Host without the `artifactState` export. It takes priority over every other value, and the card is never interactive or submittable. |

A missing or failed component bundle never reaches any `card-state` above. The
`wippy-form` script never registers, or registration times out, and the Host's
own component loader shows "This part of the page could not load. Reload to
try again." in its place. The real cause goes only to the browser console, as
one of two load-failure log lines: a script error ("script failed to load") or
a registration timeout ("failed to load in time"). Each is logged once per
failed tag and not once per card that tried to mount it. The way to recover is
to reload the page. The browser keeps a failed script load for the life of the
page, so the Host cannot fetch the same bundle URL again, and a retry in the
page does not help. Once the tag is defined, every card still waiting on it
updates without further action.

The proxy's `@reconnect` event also triggers a reload. It fires with no
payload after the Host's WebSocket reconnects following a drop, so a form left
stale through a brief backend restart or network blip corrects itself once the
socket comes back, without a manual page reload.

## See also

- [Session Forms (framework)](../../framework/session-forms.md): the
  `ask_user` and `read_form` tools, the trait, and how an answer is admitted
  into the conversation
- [Chat Web Components](./chat-web-components.md): other host-provided,
  auto-registered elements delivered the same way
- [Proxy API](./proxy-api.md): the rest of `@wippy-fe/proxy` and
  `getWippyApi()`
- [Web Component Recipe](./web-component.md): building your own
  `view.component`, for contrast with these host-provided ones
