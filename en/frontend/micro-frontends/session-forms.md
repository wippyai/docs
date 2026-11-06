---
title: "Session Forms"
description: "The wippy-form question card and fields form and the wippy-form-answers carrier element: what they render, how they load, and the artifact-state HTTP API behind them."
---

# Session Forms

`wippy/session` ships two `view.component` web components that render a
Session form that an agent asked with the `ask_user` or `ask_user_fields` tool
(see [Session Forms (framework)](../../framework/session-forms.md) for the
tools and the answer contract). Both tools create the same kind of form, so the
components render a form the same way whichever tool asked it.
`<wippy-form>` is the interactive question card or form of fields. `<wippy-form-answers>` is an invisible
carrier that keeps a form's answer record reachable to the agent without
showing it to the user twice. Like the chat elements in
[Chat Web Components](./chat-web-components.md), both are host-provided
elements to consume, so an application that embeds a chat surface does not
author or bundle either one.

## `<wippy-form>`: the question card and the fields form

The component chooses its layout from the definition. When every field has
`type: "choice"` (a version 1 form), it renders a question card. When at least
one field is a standard field (`text`, `textarea`, `number`, `email`, `date`
or `checkbox`, which makes it a version 2 form), it renders the
[fields form](#fields-form), one form of labelled controls with a single Submit
button. A version 2 form that also holds choices shows those choices in the
fields form, as plain radio or checkbox groups. Only an agent with the
`ask_user_fields` tool can ask a version 2 form, because the `ask_user` tool
takes choice fields only.

| Prop (HTML attribute) | Type | Default | Description |
| --- | --- | --- | --- |
| `form-version` | `number` | `1` | Definition schema version. `1` is a form of choices only and `2` is a form with at least one standard field, and both render. Any other value, whether it comes from this prop or from the loaded state's own `form_version`, shows a compatibility notice and no submit control. A field of a type the component does not know gets the same notice. |
| `definition` | `object` | `null` | The immutable form definition: `title`, optional `description`, optional `submit_label`, optional `answered_message` (never displayed), and `fields`. Each field is `{ id, type, label, description?, required }` plus the keys of its type (see [Field types](../../framework/session-forms.md#field-types)). |
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

### Question card behavior

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

### Fields form

A version 2 form renders as one form. It shows the title and the optional
description, then one labelled control for each field in definition order,
then one Submit button whose text is the definition's `submit_label` (default
"Submit"). A required field shows the text "(required)" next to its label.

| Type | Control | What the user does | What is sent |
| --- | --- | --- | --- |
| `text` | A one line text box | Types the answer. A `placeholder` shows in the empty box | The text exactly as typed, with no trimming |
| `email` | A text box with an email keyboard hint and the browser's autofill turned off, because an agent can ask for someone else's address and the browser must not offer the user's own | Types an address | The address without surrounding whitespace |
| `textarea` | A text area that grows with its content and starts three rows high | Types the answer. A `placeholder` shows in the empty box. Enter adds a line and never submits | The text exactly as typed, with line breaks as `\n` |
| `number` | A text box, not a spinner, whose on-screen keyboard depends on the field (see [Number keyboard](#number-keyboard)) | Types digits with an optional minus sign and a dot for decimals. A comma, a thousands separator, a plus sign and an exponent are errors and are never guessed | A JSON number. A whole value is sent as an integer |
| `date` | A date picker | Types `YYYY-MM-DD`, or opens the calendar and picks a day. The calendar greys out days outside `min` and `max`. On a touch screen a tap on the box opens the calendar | A string `YYYY-MM-DD`, with no time zone |
| `checkbox` | A checkbox with a clickable label | Ticks or unticks the box | `true` or `false`. An optional box left unticked sends `false` |
| `choice` | A radio group for one answer, or a checkbox group for several | Picks options, with an Other row and its own text box when `allow_other` is set | The option values, as in the question card but without per-option notes |

A `placeholder` belongs to `text` and `textarea` only. The server rejects it on
every other type, and the other controls show none.

A definition `default` prefills the control. When the user clears an optional
prefilled value, nothing is sent for that field, and a checkbox always starts
unticked. The controls are the theme's own PrimeVue controls, so their surface,
border and focus styling comes from the theme.

#### Number keyboard

A phone shows the on-screen keyboard that the box asks for, and the digit
keypads cannot type everything that the number parser accepts. The `numeric`
keypad has no minus key and no separator. The `decimal` keypad has no minus key
on iOS and shows the locale's own separator, which is a comma in many locales
and which the parser rejects because it accepts a dot only. So the number field
asks for a digit keypad only where the user cannot be locked out.

| Field | On-screen keyboard |
| --- | --- |
| `integer: true` with a `min` of 0 or more | `numeric` |
| Not `integer`, a `min` of 0 or more, and a browser locale that writes decimals with a dot | `decimal` |
| Anything else (no `min`, a negative `min`, or a fraction in a comma-decimal locale) | The full keyboard |

The parser itself does not change: a dot for decimals, an optional minus sign,
no separators and no exponent. The message for anything else is "Enter a
number, using a dot for decimals (for example 12 or -3.5)."

#### Checks before sending

When the user presses Submit, the form checks every answer before it sends a
request. A failed check shows an error on the field, keeps the typed value in
place, and focuses the first invalid control. The error clears when the user
changes the answer. The browser uses the server's own rules and error codes for
these checks: required answers, text length and control characters, email
syntax, number bounds, `integer` and `step`, and date format and range. The
server checks every answer again, so the browser's checks only save a round
trip.

The browser does not check a text field's `pattern`. An agent writes the
pattern, and a browser's regular expression engine can take a very long time
on some patterns that the accepted syntax allows, which would freeze the tab.
The server checks it with a linear time engine when the form is submitted, and
a mismatch comes back as a 422 with `pattern_mismatch`. The form then shows
the error on that field like any other: the message is under the field and is
linked to the box by `aria-describedby`, the box is marked `aria-invalid`, the
first invalid control gets focus, and the text the user typed stays in the box.

#### Read-only view

After an answer is accepted, or when the form is opened already answered, the
form shows each question with the stored answer as plain text. Text and
textarea answers keep their line breaks, a number shows as digits, a date shows
as `YYYY-MM-DD`, a checkbox shows as Yes or No, and a question left unanswered
shows "Skipped". The delivery status and the answered time follow, as in the
question card.

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

The `form_version` in the record is `1` for a form of choices only and `2` for
a form with a standard field, and the answers of standard fields are plain
JSON strings, numbers and booleans.

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
component). Web Host 1.0.65 or later exports it, and no earlier release does.
Version 2 forms add no Web Host requirement, because the controls ship inside
the `wippy-form` bundle. The matching npm release for version 1 forms is
`@wippy-fe/*` 0.0.65. Only the TypeScript types for version 2 forms need a later
`@wippy-fe` types package. A version 2 form works at run time without it.
<!-- TODO: name the @wippy-fe version here when the types package for version 2 forms is published. -->
The `wippy/session` module release that ships the forms is the one that adds
Session Forms.
<!-- TODO: name the Session version here when the release PR exists. -->
<!-- Confirm the Web Host and npm version numbers when the Web Host tag is cut. This page merges after that tag. -->

The component checks these conditions in order, and the first match decides
what the card shows.

| Condition | What the card shows |
| --- | --- |
| `form-version` prop or loaded state's `form_version` is neither `1` nor `2`, or a field has a type the component does not know | "This form needs a newer version of the app." The card reflects `card-state="unsupported"`. |
| The Host has no `artifactState` export (a Web Host before 1.0.65) | The questions with their controls disabled, no submit control, and `card-state="unsupported"`. The notice reads "This form needs a newer Web Host. If you already answered it, your answer is in the chat." When the Host passes `state="idle"` (the form was answered), it reads "This form was answered. Your answer is in the chat." instead. Every control is empty, because the saved answer cannot be read without the artifact-state API. The user's one-line answer message and the agent's reply stay readable in the chat, and the hidden answer record never appears. |
| The Host exports `artifactState`, but the element has no `data-wippy-artifact-id` attribute (the Host sets it on the artifact elements it mounts) | The questions with their controls disabled and empty, with "This form cannot be submitted here." |

The older `instance.form` adapter that `artifactState` replaces always sends
`form_version: 1`, so forms use `artifactState`. It is described under [`artifactState` and the deprecated
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

`form_version` is the form's own version, `1` for a form of choices only and
`2` for a form with a standard field. `definition` is the normalized
definition with the defaults filled in, so a `text` field always carries its
`min_length` and `max_length` and a `number` field always carries `integer`.
Once the form is answered, `data` holds the accepted answers as one JSON value
for each answered question, in definition order, and leaves out the questions
the user skipped. A standard field's value is a string, a number or a boolean
(see [Answer values](../../framework/session-forms.md#answer-values)), and
a number is written as an integer when it is whole and without an exponent
otherwise. The other keys are the same as for a version 1 form, and the
following response leaves them out:

```json
{
  "form_version": 2,
  "status": "idle",
  "data": {
    "name": "Ann Lee",
    "email": "ann@example.org",
    "parcels": 3,
    "ready": "2026-05-06",
    "terms": true
  }
}
```

### `POST /api/v1/artifact/{id}/state`

```json
{
  "form_version": 1,
  "request_id": "client-generated-uuid",
  "expected_content_version": 1,
  "answers": { "delivery": "Courier" }
}
```

`form_version` must equal the `form_version` that `GET` returned for the form.
A different number, in either direction, is rejected with 400
`invalid_request` before any answer is checked.

`request_id` is a non-empty string of at most 128 characters. It should be
generated once, at the moment the user attempts submission, and reused
unchanged on any retry of that same attempt. The server recognizes a same-id,
same-answers retry as a replay (`replayed: true` in the response) and not as a
conflict. `answers` must be an object keyed by field id.
`expected_content_version` is optional. When it is present, it is checked
against the artifact's current revision, so a stale client cannot silently
overwrite a form's state.

The server compares the normalized answers when it decides whether a retry is a
replay. A retry that writes `3.0` for `3`, or an email address with
surrounding spaces, is still a replay, while a `text` or `textarea` answer is
compared exactly, so changing a trailing space under the same `request_id`
gives 409 `request_conflict`.

A version 2 form takes the same envelope. Each answer is one JSON value keyed
by field id (see [Answer values](../../framework/session-forms.md#answer-values)
for the rules of each type):

```json
{
  "form_version": 2,
  "request_id": "client-generated-uuid",
  "expected_content_version": 1,
  "answers": {
    "name": "Ann Lee",
    "email": "ann@example.org",
    "parcels": 3,
    "ready": "2026-05-06",
    "notes": "Ring twice.\nLeave it at the back door.",
    "terms": true
  }
}
```

A client that builds this body by hand follows these rules.

- Send a `number` as a JSON number, never as a string such as `"3"`, which is
  refused with `invalid_type`. A number literal that is too large to read, such
  as `1e400`, makes the whole body invalid and the response is 400
  `invalid_request`.
- Send a `checkbox` as `true` or `false`. An optional checkbox that is left out,
  or sent as `null`, is unanswered, and an explicit `false` is an answer.
- Send `text`, `textarea`, `email` and `date` answers as strings, and write a
  date as `YYYY-MM-DD`. A textarea uses `\n` for a line break, and a carriage
  return is refused.
- Leave out an unanswered optional question. A value of `null` counts as not
  sent.

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
| 400 | Malformed JSON, missing/invalid envelope fields, a `form_version` that is not the form's own, a missing/invalid artifact id, or `not_a_form` for an artifact that exists but is not a session form or is a form version the Session does not know |
| 401 | No authenticated actor |
| 403 | Authenticated, but no read/write permission on the form's session |
| 404 | Artifact or session not found, or not owned by the caller. All three cases return the same response, so the endpoint does not reveal that a foreign form exists |
| 409 `request_conflict` | Same `request_id`, different normalized answers than the first attempt with that id |
| 409 `already_submitted` | The form was already answered by a different request |
| 409 `version_conflict` | `expected_content_version` no longer matches the current revision |
| 413 | Request body over 64 KiB |
| 415 | `Content-Type` is not `application/json` |
| 422 | Field validation failed. `errors` is keyed by field id, and `form_errors` is a list (see [Validation errors](#validation-errors-422)) |
| 500 | Internal error, including a form whose stored `pattern` no longer compiles (nothing the user can fix); no mutation was applied |

There is no `429`, because submissions are not rate-limited on the server.

### Validation errors (422)

A submission that breaks any rule is rejected as a whole. Nothing is stored,
and the response names the first problem of every failing question:

```json
{
  "success": false,
  "code": "validation_failed",
  "message": "Some answers are not valid.",
  "errors": {
    "email": [{ "code": "invalid_email", "message": "Enter a valid email address." }],
    "parcels": [{ "code": "above_max", "message": "Is above the maximum." }]
  },
  "form_errors": [
    { "code": "unknown_field", "field": "ghost", "message": "\"ghost\" is not a question in this form." }
  ]
}
```

`errors` maps a field id to a list that holds one `{ code, message }`, and
`form_errors` lists problems that belong to no field of the form (an answer
keyed by an id the form does not have is `unknown_field`) and is `[]` when
there are none. A message never repeats an answer. A `form_errors` message can
name a key that the client sent, as the `unknown_field` message above does. The
codes of the standard fields are:

| Code | Fields | Meaning |
| --- | --- | --- |
| `required` | all | The question has no answer, or a required `checkbox` is `false` |
| `invalid_type` | all | The value has the wrong JSON type, such as a number sent as a string or the text `"true"` for a checkbox |
| `invalid_text` | `text`, `textarea` | The value is not valid UTF-8 or has a control character (a `text` value allows no line break) |
| `too_short` | `text`, `textarea` | Fewer than `min_length` characters |
| `too_long` | `text`, `textarea` | More than `max_length` characters |
| `pattern_mismatch` | `text` | The whole value does not match `pattern`. Only the server checks it |
| `invalid_email` | `email` | Not a valid address, or over 254 characters in all or 64 before the `@` |
| `invalid_number` | `number` | Not finite or beyond 1,000,000,000,000 in absolute value. The form also uses it for typed text that is not a number |
| `not_integer` | `number` | A fraction where `integer` is `true` |
| `below_min`, `above_max` | `number`, `date` | Outside the inclusive `min` and `max` |
| `not_on_step` | `number` | Not `min` (or 0) plus a whole multiple of `step` |
| `invalid_date` | `date` | Not a real calendar date written exactly `YYYY-MM-DD`. The form also uses it for typed text that is not a date |

When a question breaks several rules, the code of the first one is returned, in
the order the [rules by type](../../framework/session-forms.md#rules-by-type)
list them. A `choice` field keeps its version 1 codes: `invalid_option`,
`other_not_allowed`, `multiple_other`, `duplicate_selection` and `blank` (an
empty Other answer), besides `invalid_type`, `invalid_text` and `too_long`.

`<wippy-form>` shows each error on its own field, and it shows a `form_errors`
entry as a form level error. It focuses the first invalid control and announces
how many questions need attention. Changing an answer clears the error of that
field until the next submit.

## The `artifactState` proxy client

In a host-mounted web component, `artifactState` is the factory itself:

```typescript
import { artifactState } from '@wippy-fe/proxy'

const client = artifactState(artifactId)
```

In an iframe, `window.$W.artifactState()` (or `getWippyApi()`) returns a
promise for the factory:

```typescript
const factory = await window.$W.artifactState()
const client = factory(artifactId)
// or: const { artifactState } = await window.getWippyApi()
```

Both forms give the same client:

```typescript
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
deprecated shim. The shim always sends `form_version: 1`, so for a version 2
form the server answers 400 `invalid_request`. Use `artifactState` and send the
`form_version` that `get()` returned.

## Styling API

`<wippy-form>` exposes `--wippy-form-*` custom properties, `::part()`
selectors and the host attributes `card-state` and `collapsed`. The
full token, part, and host-attribute tables, plus a restyle example, are in the
package's own README (`frontend/wippy-form/README.md` in the `wippy/session`
source). `<wippy-form-answers>` exposes no styling API because it renders
nothing.

### Fields form styling

The fields form follows the same conventions. All the shared tokens of the
question card apply to its root (`--wippy-form-font`, `-font-size`,
`-small-size`, `-question-size`, `-question-weight` for the title, `-surface`,
`-border`, `-radius`, `-padding`, `-text`, `-text-muted` and `-focus`), and it
adds three tokens. Set them on `wippy-form` or on any ancestor.

| Token | Default | Used for |
| --- | --- | --- |
| `--wippy-form-field-gap` | 16px | Space between the fields, and between the header, the fields, the errors and the button |
| `--wippy-form-label-weight` | `500` | The weight of a field label |
| `--wippy-form-date-width` | `20rem` | The width of the date control, which is full width only where the form is narrower than that. The calendar opens at least as wide as the control, so it follows this width. Set a larger value for a wider box and calendar |

The controls are the theme's PrimeVue controls, so their surface, border and
focus styling comes from the theme. There are no input tokens, and the
component overrides no `.p-*` class. A state adds a part `<part>-<state>` and
a class `w-form__<part>--<state>`, for example `field-invalid` and
`w-form__field--invalid`.

| Part | States | What it is |
| --- | --- | --- |
| `card`, `fields` | `answered` and `unsupported` (on `card`) | The whole form. The same element carries both parts and the `w-form` class |
| `fields-title` | | The form title |
| `form-description` | | The form's own description |
| `notice` | | The "asked earlier" and offline lines |
| `fields-error` | | Form level errors from a 422 |
| `field` | `required`, `invalid`, `readonly`, `disabled`, `group`, `inline` | One field. `group` marks a choice (a fieldset) and `inline` marks a checkbox |
| `field-label` | | The label, or the legend of a choice |
| `field-marker` | | The "(required)" text on an editable required field |
| `field-description` | | The field's own description |
| `field-control` | | The wrapper around the control |
| `field-input` | `date` (on the date picker) | The control: the text box, the text area, the checkbox or the date picker. The `date` state is what `--wippy-form-date-width` bounds |
| `field-calendar` | | The calendar panel of the date picker (class `w-form__field-calendar`). It opens in the theme plugin's overlay layer and not inside the form, so the message around a short form never clips it, and it carries the form's `w-theme-dark` or `w-theme-light` class, so it follows a forced theme. Its width follows the date control, and no rule of the component overrides it |
| `field-error` | | The error list, linked to the control by `aria-describedby` |
| `field-value` | `empty` | The stored answer in the read-only view ("Skipped" when empty) |
| `field-note` | | The note on a chosen option in the read-only view |
| `field-options` | | A choice's group of rows |
| `field-option` | `other` | One radio or checkbox row |
| `field-option-input`, `field-option-label`, `field-option-description` | | The pieces of one row |
| `field-other`, `field-other-input` | | The label and the text box of the Other row |
| `status` | | The delivery and answered time lines in the read-only view |
| `send` | | The Submit button |

The `card-state` host attribute is reflected as for the card, with the values
`loading`, `active`, `answered` and `unsupported`. A fields form never reports
`review` and has no `collapsed` attribute. A restyle looks like this:

```css
wippy-form {
  --wippy-form-field-gap: 24px;
  --wippy-form-label-weight: 600;
}

wippy-form::part(field-description) {
  font-size: 0.875rem;
}
```

## Accessibility

### Question card

A single-selection question is a `role="radiogroup"` with `aria-required` when
required. It is one Tab stop, and arrow keys move between its rows. A
multiple-selection question is a `role="group"` where every row is its own Tab
stop, because each row is an independent checkbox. A field-level error is a
`role="alert"` element linked to its group or text box through
`aria-describedby`, and a form-level error and a failed send are each announced
by their own alert. One polite live region announces question and review
navigation, ticking and unticking, and a saved note without moving focus.
After a submission is accepted, focus moves to the read-only summary's status
text.

### Fields form

Every control has a label whose `for` points at the real input. The
description and the error list are linked to that input by `aria-describedby`.
For a checkbox and a date picker, whose wrapper element would otherwise take
the attribute, the component passes it through to the real control. A required
field is marked with the text "(required)", never with colour alone, and
`aria-invalid` and `aria-required` follow the state of the field.

A choice is a `fieldset` with a `legend` that is described as a whole. Every
radio or checkbox in it, and the Other text box, carries the same
`aria-describedby` (the field description and the error list), so a screen
reader that lands on one input reads the error, and each carries `aria-invalid`
while the group is in error. A single choice adds a `radiogroup` role with
`aria-required` around its radios. A multiple choice adds no role and no
`aria-required`, because its fieldset is already the group, and the
"(required)" text in the legend says that it is required.

The form is `novalidate`, so the browser's own validation bubble never replaces
the form's error flow. A failed submit focuses the first invalid control and
announces "N questions need attention." in one polite status region. Only
fields in error count as questions. A form level error from a 422 is spoken as
its own text after the count, or alone when no field is in error. As the user
fixes questions the text is updated once for each fixed question and not once
for each key, and it is emptied when nothing is left.

Errors in the fields form carry no `role="alert"` of their own. A submit
failure that is not a field error, such as a network error or a server error,
is shown as a message with a Retry button. The message is a plain element and
not a live region, so the status region announces its text once. After an
accepted submission, focus moves to the status text of the read-only view. A
read-only answer is plain text that the user can select.

| Key | Where | Effect |
| --- | --- | --- |
| Enter | A one line field | Submits the form |
| Enter | A textarea | Adds a line and does not submit |
| Space | A checkbox | Ticks or unticks the box |
| ArrowDown, or the calendar button | The date box | Opens the calendar |
| ArrowDown a second time | The date box with the calendar open | Moves focus into the days |
| ArrowLeft and ArrowRight, ArrowUp and ArrowDown | A day of the calendar | Move by one day, or by one week |
| Enter | A day of the calendar | Picks the day, closes the calendar and returns focus to the box |
| Escape | An open calendar | Closes the calendar and keeps what the box holds |
| A tap | The date box on a touch screen | Opens the calendar |

The date box takes typed text in the form `YYYY-MM-DD` one key at a time, and
it always shows what the user typed, including after an error appears and
after the box is left. A loose date that the picker understands, such as
`2026-6-5`, is held as the full date `2026-06-05`, which is what will be saved,
and the box shows that text once it is left. A year below 1000 keeps four
digits (`0999-05-15`), and a typed year below 100 is reported as typed
(`0050-03-04`), where PrimeVue alone would read it as 1950. Text that the
picker cannot parse is never dropped or replaced by the last good date. It
stays in the box, and the submit names it with `invalid_date`, or with
`below_min` or `above_max` when it is a well-formed date outside the range.

The calendar opens in the theme plugin's overlay layer. The layer is inside the
component's shadow root but next to the themed container and not inside it, so
the message around a short form never clips the calendar. Because the layer is
outside the themed container, the calendar carries the container's
`w-theme-dark` or `w-theme-light` class itself and follows a forced theme (see
the `field-calendar` part). A state reload leaves an open calendar on the month
the user navigated to.

On a touch screen, which means that the primary pointer is coarse, PrimeVue
gives the box no on-screen keyboard and the field does not open the calendar
on focus. A tap on the box therefore opens the calendar, as the calendar button
does. A click with a mouse and focus from a keyboard do not open it.

## Known gaps

- Some styling follows the theme and not a component token.
  - The tick boxes, radio marks, and input edges use the theme's existing
    surface-300/700 border colors, which give roughly 1.3 to 1.4:1 contrast,
    with no local override. The fix belongs in the theme and not in this
    component.
  - The two "Send" buttons and the two composer send buttons are unstyled
    PrimeVue defaults. They follow the theme's own primary button color and
    not `--wippy-form-accent`, so retinting `--wippy-form-accent` alone leaves
    them on the old color while rows, the counter, key badges, and the focus
    ring follow the new one.
  - The Notes and Other text boxes, and every control of the fields form, use
    the theme's own `.p-textarea` and PrimeVue colors, and there are no
    `--wippy-form-input-bg` or `--wippy-form-input-border` tokens.
  - The error text and the "(required)" marker of the fields form take their
    colour from the theme's severity utilities, which are tuned for contrast
    in light and dark, and not from `--wippy-form-danger`.
- Some behavior is limited.
  - A text field's `pattern` is checked on the server only, so a mismatch
    appears after the request returns and never while the user types.
  - A choice that sits in a version 2 form has no per-option notes and does
    not answer on click. The user picks options and sends the whole form with
    the Submit button. A choice-only form keeps the question card with its
    notes.
  - In the published `@wippy-fe/proxy` types, a form field is a `choice` and an
    answer is a choice answer, while `form_version` is any number. At run time
    the `artifactState` client sends and returns version 2 JSON unchanged, so a
    TypeScript caller needs a type assertion for the fields and answers of a
    version 2 form until the types are widened.
    <!-- TODO: name the @wippy-fe version here when the types package for version 2 forms is published. -->
- The calendar has two limits that come from PrimeVue.
  - The day cells have no accessible name beyond the day number. The panel
    itself is a dialog labelled "Choose Date".
  - The calendar cannot show a year below 100, because PrimeVue reads one as a
    two-digit year, so it opens on 19xx or 20xx for such a date. The box and the
    saved answer keep the year as typed.

## Diagnostics

`<wippy-form>` sets a `card-state` attribute on itself. Use it for styling, or
to wait for a state in an end-to-end test.

| `card-state` | Meaning |
| --- | --- |
| `loading` | Before the artifact's first `GET` resolves. `<wippy-loading>` shows instead of the card. |
| `active` | Answerable. A question, or briefly, the submitting state. |
| `review` | The review step of a several-question form, before "Send answers". |
| `answered` | The read-only summary of an accepted submission. |
| `unsupported` | An unrecognized `form-version` (neither `1` nor `2`, from the prop or the loaded state), a field type the component does not know, or a Web Host without the `artifactState` export. It takes priority over every other value, so the card is never interactive or submittable. |

A fields form reports only `loading`, `active`, `answered` and `unsupported`.

The component and the Session ship together in the `wippy/session` module, so a
current Session serves a current `wippy-form` bundle. An older component can
meet a current Session only through a stale cached bundle, and it then reports
`unsupported` with "This form needs a newer version of the app." for a version 2
form until the bundle is fetched again.

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
  `ask_user`, `ask_user_fields` and `read_form` tools, the two traits, and how
  an answer is admitted into the conversation
- [Chat Web Components](./chat-web-components.md): other host-provided,
  auto-registered elements delivered the same way
- [Proxy API](./proxy-api.md): the rest of `@wippy-fe/proxy` and
  `getWippyApi()`
- [Web Component Recipe](./web-component.md): building your own
  `view.component`, for contrast with these host-provided ones
