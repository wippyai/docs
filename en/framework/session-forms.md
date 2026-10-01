---
title: "Session Forms"
description: "Ask the user structured choice questions from an agent with the ask_user tool, and read the answer back as a self-contained record."
---

# Session Forms

Session forms let an agent ask the user one or more choice questions and get
a structured answer back, without leaving a tool call waiting on human input.
The `wippy/session` module owns the feature. It provides a trait that adds the
`ask_user` and `read_form` tools, an artifact that renders as a question card
in the chat, and an HTTP endpoint that accepts the answer and delivers it to
the session as an ordinary user message.

Only choice questions are supported. A choice question takes one or several
selections, can be required or optional, and can offer a free-text "Other"
answer.

For the `wippy-form` and `wippy-form-answers` components and the browser side
of the HTTP contract, see
[Session Forms (frontend)](../frontend/micro-frontends/session-forms.md). The
Web Host version that the question card needs is listed under
[Host requirement](../frontend/micro-frontends/session-forms.md#host-requirement).

## Enabling the trait

Add `wippy.session.forms:ask_user` to an agent's `traits`:

```yaml
  - name: assistant
    kind: registry.entry
    meta:
      type: agent.gen1
      title: Assistant
    prompt: |
      When you need the user to choose between concrete options before you
      can continue, ask them with the ask_user tool instead of asking in
      plain text.
    model: gpt-4o
    max_tokens: 4096
    traits:
      - id: wippy.session.forms:ask_user
```

The trait needs a `wippy/session` release that ships Session Forms. With an
older release, an agent that references the trait fails to resolve at lint
time.

The trait contributes two tools and a block of prompt text. The prompt tells
the model the following.

- Use `ask_user` only when it needs a decision between concrete options, and
  ask at most one form per turn.
- Set `answered_message` to a short sentence in the user's voice. It becomes
  the user's chat message when they answer.
- Treat an answer with `"late": true` as context only, and confirm with the
  user before acting on the earlier request.
- Call `read_form` with a `form_id` to see an earlier form, and never write a
  `<wippy-form-answers>` element by hand, because the element carries meaning
  only in the exact format the server writes.

An agent without the trait cannot call `ask_user`, but its prompt still
includes the form index described below, and it can read a submitted answer
like any other user message.

## The `ask_user` tool

`ask_user` validates and normalizes the definition, then asks the session to
create the form. An invalid definition is a tool error. The call returns no
result and a message that describes what to fix, nothing is stored, and the
agent can retry in the same turn.

| Key | Contract |
| --- | --- |
| `title` | Required plain text, 1 to 160 characters |
| `description` | Optional plain text, at most 1,000 characters |
| `submit_label` | Optional plain text, at most 40 characters |
| `answered_message` | Optional plain text, at most 200 characters. The user's chat message once they answer, written in the user's own voice by the agent that asks (see [What the agent receives](#what-the-agent-receives)). Never shown on the form. A form asked without it falls back to `Answered “<title>”.` |
| `fields` | 1 to 20 entries |
| `fields[].id` | Unique key matching `^[a-z][a-z0-9_]{0,39}$` |
| `fields[].type` | `"choice"`, the only type in this release |
| `fields[].label` | The question, 1 to 240 characters |
| `fields[].description` | Optional help text, at most 1,000 characters |
| `fields[].required` | Boolean, default `false` |
| `fields[].options` | 1 to 20 distinct choices. A plain string is both the value and the label. Use `{ "value", "label", "description"? }` when the stored value should differ from the shown text. Value and label are at most 240 characters, and `description` is at most 1,000 |
| `fields[].multiple` | Boolean, default `false`. Allows selecting several options |
| `fields[].allow_other` | Boolean, default `false`. Offers a free-text "Other" answer |

The normalized definition is bounded to 32 KiB. The size is measured after
normalization, where a plain string option expands to `{"value": .., "label":
..}`, so a definition with many short string options can be well over the
limit even when it looks compact. In that case the tool error reports the
actual normalized size. Labels and descriptions are never parsed as Markdown or
HTML, and the card shows only text in backticks as inline code. Control
characters other than tabs and newlines (in multi-line fields) are rejected.

A successful call ends the agent's turn and returns the text below. The trait
prompt tells the agent not to add a follow-up, because the form is already
visible.

```text
Form "Delivery preference" was created as <artifact-id>. Its answer will arrive as a user message.
```

### One form per turn

At most one form can be created per agent turn. A second `ask_user` call in
the same turn is rejected before anything is written:

```text
This turn already asked the user with a form. No second form was created; wait for the answer to the first one.
```

A session can hold up to 100 unresolved (unanswered) forms at once. Above
that, `ask_user` is rejected with `too_many_forms` until the user answers
older forms. Nothing is deleted automatically.

A form's definition is immutable once created. There is no edit operation, and
an attempt to update a form artifact through the general artifact-update path
is rejected with `session_form: Session forms cannot be edited. Ask a new form
instead.` To change a question, ask a new form.

## What the agent receives

The user answers on a question card. The accepted answer becomes one ordinary
user message, built entirely on the server, and the browser never supplies its
text. The message has exactly one visible line, followed by an invisible
carrier element that holds the full answer as JSON:

```text
Answered questions about the delivery of your order.

<wippy-form-answers record='{"form_id":"<artifact-id>","form_version":1,"title":"Order details","late":false,"answers":{"delivery":{"question":"How should the parcel be delivered?","answer":{"value":"courier","label":"Courier","note":"Buzzer 12, back entrance"}},"extras":{"question":"Any extras for this order?","answer":[{"value":"gift_wrap","label":"Gift wrap"},{"other":"Remove the price tag"}]},"when":{"question":"When works best for delivery?","answer":null}}}'>
</wippy-form-answers>
```

The user sees only the first line, which is the `answered_message` the agent
supplied when it called `ask_user` (or the `Answered “<title>”.` fallback).
The `wippy-form-answers` element renders nothing, so the record never appears
in the chat. The agent reads the raw message text, including the record
attribute, on its next turn.

### Record shape

The record is self-contained, so an agent can act on it without the original
`ask_user` call, which a checkpoint may have summarized away. For each
question id, `answers[id]` has a `question` (the field's label) and an
`answer`:

| Answer shape | When |
| --- | --- |
| `{"value": "courier", "label": "Courier"}` | A chosen option |
| `{"value": "courier", "label": "Courier", "note": "…"}` | A chosen option with the user's own note, at most 1,000 characters |
| `{"other": "…"}` | The user's own free-text answer, at most 2,000 characters |
| `[ ...one of the above... ]` | A multiple-selection question, in definition order, with an "Other" entry (if any) last |
| `null` | The question was left unanswered (only possible when not required) |

The record also carries `form_id`, `form_version`, `title` and `late`. The
`late` value is `false` unless the answer was late (see below). A late answer
has `"late": true` and adds a `late_notice`.

The stored submission keeps only the normalized answer values. The record is
derived from those values and the immutable definition on every read, so the
record in the answer message and the one `read_form` returns for the same form
always agree.

## Late answers and the fresh-confirmation rule

A form's staleness and its late flag serve different purposes and are tracked
separately.

While a form is unanswered, it is stale when a different real user input (a
typed message, or a submission to another form) was durably accepted after the
form was created. Staleness is evaluated live, every time the form state is
read. Assistant text, system events, tool results, and validation failures
never make a form stale.

Once a form is answered, the acceptance transaction evaluates staleness one
final time against the same rule and freezes the result as the submission's
late flag. The flag does not change afterward, no matter what the conversation
does later. A late answer's record carries `"late": true` and:

```text
late_notice: "The conversation moved on before this answer. Use it as context and ask for fresh confirmation before acting on the earlier request."
```

A form submission is never an authorization token for the action it was
originally asked about. The agent must still get explicit confirmation before
acting on a late answer, and any action tool that needs authorization must
enforce that itself, because the forms feature only records what the user
chose.

## `read_form` and the form index

`read_form` takes a `form_id` (from the form index or an answer message) and
returns the state of one form belonging to the calling session. A form from
another session is not visible. The result depends on the form's state:

| `status` | Result |
| --- | --- |
| `unanswered` | `{ status, form_id, title, questions }`, where each question carries its options, so an agent that lost the original `ask_user` result can restate them |
| `answer_pending` | `{ status, form_id, title, note }`. The user answered, but the answer has not been admitted into the session's history yet (see below). No answer values are returned, and the `note` tells the agent to wait for the answer to arrive as a user message |
| `answered` | `{ status, answered_at, form }`, where `form` is the self-contained record described above |

Every agent, with or without the trait, also gets a bounded, deterministic
index of the session's forms in its prompt. The index is rebuilt from the
stored forms on every prompt build, so it cannot drift from them, and it does
not depend on a checkpoint having kept any form ids or values.

```text
Session forms (index; exact answers are in the answer messages and can be read with read_form when available):
- unanswered: "Delivery preference" form_id=... asked=...
- answer pending (arrives as a later user message): "Extras" form_id=... asked=...
- answered: "Order details" form_id=... answered=... late=false answer_message_id=...
(2 more unanswered and 1 more answered forms not listed)
```

The index lists up to 8 unanswered or pending forms (newest first) and up to 4
answered forms (most recently answered first), bounded to 8 KiB, and it
reports how many were omitted.

## How answers are admitted

Submitting an answer commits it together with the user message in one
transaction, so the stored row, and not the wake-up of the session process,
makes delivery durable. A form answer is never steered into a running turn,
whatever the steering setting. Typed input follows the session's steering
setting.

| When the answer is accepted | What happens |
| --- | --- |
| The session is idle | The answer is admitted at once, and a new turn starts |
| A turn is running | The answer is pending, and `read_form` reports `answer_pending`. It is admitted when the turn ends, in acceptance order together with any typed input the session held during the turn |
| The user pressed Stop | The answer is admitted into the history and no turn starts. The same happens when the session plugin has to cancel or terminate a session that does not stop in time |
| The session is finishing, or its process is not running | The answer stays pending until the process starts again. The session plugin starts stopped sessions that hold pending answers |

Once admitted, the answer's message is dated at the moment of admission, so
its place in the visible history follows admission order. The `submitted_at`
value that the artifact-state API returns keeps the original acceptance time.

## Security notes

The server builds the answer message from the immutable definition and the
validated, normalized answers. The browser sends only answers keyed by field
id, never message text. User text (an "Other" answer or a note) is
JSON-escaped data inside the record, and the server escapes `'`, `<`, `>`, and
`&` in the record, so user text cannot end the attribute, close the tag, or
add markup. The checks that the state endpoint applies to every request are
listed in [The artifact-state HTTP API](../frontend/micro-frontends/session-forms.md#the-artifact-state-http-api).

## Disabling and rolling back

To stop new forms, remove `wippy.session.forms:ask_user` from an agent's
`traits` list.

- Open (unanswered) forms stay answerable. The state API's read and write
  checks are session-ownership checks and not trait checks, so a form asked
  before the trait was removed can still be submitted afterward.
- Answered forms stay readable, with or without the trait on any agent. An
  answered form is an ordinary artifact plus an ordinary user chat message,
  and `read_form` and the form index work the same for every agent.
- Do not downgrade `wippy/session` below the release that shipped Session
  Forms while form artifacts exist. The module registers the `wippy-form` and
  `wippy-form-answers` components, and an older module can fail to start with
  `failed to load state: unresolved dependencies after retry: …`.

## Verifying

Create or use an agent with the `wippy.session.forms:ask_user` trait, start a
session, and prompt it to ask a question that needs a decision. The question
card should appear in the chat. Answering it should produce a chat message
with exactly one visible sentence, and the agent's next turn should reference
the answer correctly, for example by calling `read_form` or by acting on the
choice.

To check late-answer handling, send a plain chat message after the form is
created and before answering it, and then answer. The record should carry
`"late": true`, and the agent should ask for confirmation before acting on the
original request.

## See also

- [Session Forms (frontend)](../frontend/micro-frontends/session-forms.md): the `wippy-form` and `wippy-form-answers` components, the artifact-state HTTP API, and the `artifactState` proxy client
- [Agents](agents.md): traits, tools, and agent definitions in general
