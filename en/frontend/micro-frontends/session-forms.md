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
elements to consume, so an application that embeds a chat surface does not
author or bundle either one.

## `<wippy-form>`: the question card

For a version 1 definition the component renders a question card.

| Prop (HTML attribute) | Type | Default | Description |
| --- | --- | --- | --- |
| `form-version` | `number` | `1` | Definition schema version. A value other than `1`, whether it comes from this prop or from the loaded state's own `form_version`, shows a compatibility notice and no submit control. |
| `definition` | `object` | `null` | The immutable form definition: `title`, optional `description`, optional `submit_label`, optional `answered_message` (never displayed), and `fields`. |
| `state` | `string` | `"active"` | Package-tag lifecycle: `"active"` (answerable) or `"idle"` (already answered, read-only). Changing it reloads canonical state from the Host. |

The component owns its own data loading, submission, and offline detection. A
host only needs to mount the tag with these attributes.

- It loads the state with a `GET` on mount, and reloads it on a visibility
  change, a session-message event, an artifact-update event, the Host's
  `@reconnect` event after a WebSocket reconnect, or the browser's `online`
  event. The `@reconnect` reload corrects a form that a brief backend restart
  or network drop left stale.
- It submits with a client-generated `request_id` that it reuses on a retry,
  retries once automatically after a network failure with no response, and
  handles a 422 field-error response and a 409 already-submitted response.

### Behavior

- The card shows one question at a time, with a `‹ n/total ›` counter on a
  form that has several questions. Answering (a click or a number key) moves to
  the next unseen question, and Previous and Next navigate back to change an
  earlier answer. A form with several questions ends on a review that lists
  every answer, with a single "Send answers" action. There is no per-question
  submit once the review is reached.
- Every answer row has a note toggle, and the field's `allow_other` setting
  controls the "Other" row.
  - A note is the user's own text about that one chosen option. It changes the
    answer's shape to `{ "value": "…", "note": "…" }` and does not add a
    separate field.
  - "Other" is a free-text input with its own send button, offered only when
    the field's `allow_other` is set.
- Text in backticks in a question, an option or a description shows as inline
  code, and no other formatting is applied.
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
| Escape | Leaves a note or Other box and keeps the typed draft with that answer |
| Arrow keys | Move between rows and between questions |

### Events

The component adds no events of its own. These come from the shared web
component base, bubble, and cross the shadow boundary.

| Event | Payload | When |
| --- | --- | --- |
| `load` | none | The component finished mounting |
| `unload` | none | The element was removed from the page |
| `error` | `{ message, error }` | Mounting failed |
| `invalid` | `{ message }` | A prop failed validation |

To react to a submission, watch the `card-state` attribute for `answered` (see
[Diagnostics](#diagnostics)).

## `<wippy-form-answers>`: the answer carrier

The Session server writes this element into the user's chat message
immediately after they answer a form (see
[the record shape](../../framework/session-forms.md#record-shape)):

```html
Answered questions about the delivery of your order.

<wippy-form-answers record='{"form_id":"…","form_version":1,"title":"Order details","late":false,"answers":{...}}'>
</wippy-form-answers>
```

It renders nothing. It has no shadow-root content and no slot, and it sets
`display: none` on the host. Its only prop is `record`, and a read-only
`answerRecord` getter returns the parsed record, or `null` for a missing or
invalid attribute. It dispatches no events.

### Why the record lives in an attribute

The record is in an attribute and not in the element's text because an element
with no children renders nothing in every failure case. If the chat sanitizer
strips the unknown tag, or the component script has not loaded, text content
would show the raw JSON.

## How the components load

Both are `view.component` registry entries with `auto_register: true`, served
by the Session module at `/wippy-session-forms` (`wippy-form`) and
`/wippy-session-form-answers` (`wippy-form-answers`). The Web Host auto-loads
every `auto_register: true` component at boot and allows its tag, plus its
declared prop attribute names, through the chat message sanitizer. The names
are `definition`, `form-version` and `state` for `wippy-form`, and
`record` for `wippy-form-answers`. `record` is declared as a `wippy.props`
entry so that the sanitizer's allowed-attribute list includes it. Without that
declaration the attribute is stripped even when the tag itself is allowed
through.

## Host requirement

`<wippy-form>` submits through `artifactState`, a typed client that the Web
Host exports from every proxy realm (`$W.artifactState()` in an iframe, or the
named `artifactState` export from `@wippy-fe/proxy` in a host-mounted web
component). Web Host 1.0.64 or later exports it, and no earlier release does.
The matching npm release is `@wippy-fe/*` 0.0.64.

The component checks these conditions in order, and the first match decides
what the card shows.

| Condition | What the card shows |
| --- | --- |
| `form-version` prop or loaded state's `form_version` is not `1` | "This form needs a newer version of the app." The card reflects `card-state="unsupported"`. |
| The Host has no `artifactState` export (a Web Host before 1.0.64) | The questions with their options disabled, no submit control, and `card-state="unsupported"`. The notice reads "This form needs a newer Web Host. If you already answered it, your answer is in the chat." When the Host passes `state="idle"` (the form was answered), it reads "This form was answered. Your answer is in the chat." instead. Every option is unselected, because the saved answer cannot be read without the artifact-state API. The user's one-line answer message and the agent's reply stay readable in the chat, and the hidden answer record never appears. |
| The Host exports `artifactState`, but the element has no `data-wippy-artifact-id` attribute (the Host sets it on the artifact elements it mounts) | The questions rendered read-only, with "This form cannot be submitted here." |

The older `instance.form` adapter that `artifactState` replaces is described
under [`artifactState` and the deprecated
`instance.form`](#artifactstate-and-the-deprecated-instanceform).

## The artifact-state HTTP API

`GET` and `POST /api/v1/artifact/{id}/state` read a form's canonical state and
accept its answer. The concrete path comes from the route table
(`artifacts.state`) and can be overridden per deployment through
`feature.apiRoutes`, like any other Wippy Web Host route. Every request checks
authentication, then that the artifact and its session belong to the caller,
then read (`GET`) or write (`POST`) permission on that session.

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
  "definition": {
    "title": "Delivery preference",
    "fields": [
      {
        "id": "delivery",
        "type": "choice",
        "label": "How should the parcel be delivered?",
        "required": true,
        "options": [
          { "value": "Courier", "label": "Courier" },
          { "value": "Pickup point", "label": "Pickup point" }
        ],
        "multiple": false,
        "allow_other": false
      }
    ]
  },
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

`request_id` is a non-empty string of at most 128 characters. It should be
generated once, at the moment the user attempts submission, and reused
unchanged on any retry of that same attempt. The server recognizes a same-id,
same-answers retry as a replay (`replayed: true` in the response) and not as a
conflict. `answers` must be an object keyed by field id.
`expected_content_version` is optional. When it is present, it is checked
against the artifact's current revision, so a stale client cannot silently
overwrite a form's state.

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
| 404 | Artifact or session not found, or not owned by the caller. All three cases return the same response, so the endpoint does not reveal that a foreign form exists |
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
  form_version: state.form_version,
  request_id: crypto.randomUUID(),
  expected_content_version: state.content_version,
  answers: { color: 'blue' },
})
```

- The route is re-resolved on every call. Nothing is cached when
  `artifactState(artifactId)` is constructed, and no global config is mutated.
- `artifactId` is validated up front. An empty or whitespace-only id, or an id
  with characters other than letters, digits, `_` and `-`, throws
  synchronously.
- Every failure, whether an HTTP status or a network error, rejects with a
  typed `ArtifactStateError` (`status`, `code`, and, for a 422, `errors` keyed
  by field id plus `formErrors`). An entry in a 422 body that lacks a string
  `code` or `message` is left out of `errors` and `formErrors`.

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

Use `isArtifactStateError(error)` and not `error instanceof
ArtifactStateError`. It is `$W.isArtifactStateError` in an iframe page, and a
named export of `@wippy-fe/proxy` in a web component. Each proxy bundle carries
its own copy of the class, so `instanceof` can fail for an error that another
bundle threw, while `isArtifactStateError` checks a brand that is the same in
every copy.

### `artifactState` and the deprecated `instance.form`

`instance.form.get()` and `.submit(data)` are a thin backward-compatibility
shim over `artifactState(appConfig.context.resourceId)`. A 422 maps to the
legacy `{ success: false, errors }` shape. Every other failure (401, 404, 409,
5xx, network) rethrows the same error that `artifactState` would throw. New
code should call `instance.artifactState(artifactId)` directly and not this
deprecated shim.

## Styling API

`<wippy-form>` exposes `--wippy-form-*` custom properties, `::part()`
selectors and the host attributes `card-state` and `collapsed`. The
full token, part, and host-attribute tables, plus a restyle example, are in the
package's own README (`frontend/wippy-form/README.md` in the `wippy/session`
source). `<wippy-form-answers>` exposes no styling API because it renders
nothing.

## Accessibility

A single-selection question is a `role="radiogroup"` with `aria-required` when
required. It is one Tab stop, and arrow keys move between its rows. A
multiple-selection question is a `role="group"` where every row is its own Tab
stop, because each row is an independent checkbox. A field-level error is a
`role="alert"` element linked to its group or text box through
`aria-describedby`. One polite live region announces question and review
navigation, tick changes, and submission and validation results without moving
focus, and after a submission is accepted, focus moves to the read-only
summary's status text.

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
- The Notes and Other text boxes use the theme's own `.p-textarea` colors, and
  there are no `--wippy-form-input-bg` or `--wippy-form-input-border` tokens.

## Diagnostics

`<wippy-form>` sets a `card-state` attribute on itself. Use it for styling, or
to wait for a state in an end-to-end test.

| `card-state` | Meaning |
| --- | --- |
| `loading` | Before the artifact's first `GET` resolves. `<wippy-loading>` shows instead of the card. |
| `active` | Answerable. A question, the review step, or briefly, the submitting state. |
| `review` | The review step of a several-question form, before "Send answers". |
| `answered` | The read-only summary of an accepted submission. |
| `unsupported` | An unrecognized `form-version` (from the prop or the loaded state), or a Web Host without the `artifactState` export. It takes priority over every other value, and the card is never interactive or submittable. |

A missing or failed component bundle never reaches any `card-state` above. The
`wippy-form` script never registers, or registration times out, and the Host's
own component loader shows "This part of the page could not load. Reload to
try again." in its place. The cause goes only to the browser console, as
"Component tag script failed to load" for a script error or "Component tag
failed to load in time" for a registration timeout. A script error is logged
once per failed tag, and a registration timeout is logged once for each card
that tried to mount the tag. Reload the page to recover.

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
