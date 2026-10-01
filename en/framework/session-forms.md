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

This release supports choice questions only. A choice question allows a single
or a multiple selection, can be required or optional, and can offer a
free-text "Other" answer. Other field types are planned for a later release.
A renderer that meets a field type it does not support shows a fallback form
and never drops the question silently.

This page documents the trait, the tool contracts, and how an answer reaches
the conversation. For the `wippy-form` / `wippy-form-answers` components and
the HTTP contract from the browser side, see
[Session Forms (frontend)](../frontend/micro-frontends/session-forms.md).

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

The trait requires a `wippy/session` version that ships session forms. With
an older one, an agent definition that references the trait fails to resolve
at lint time rather than silently doing nothing.

The trait contributes two tools and a block of prompt text. The prompt tells
the model the following.

- Use `ask_user` only when it needs a decision between concrete options, and
  ask at most one form per turn.
- Set `answered_message` to a short sentence in the user's voice. It becomes
  the user's chat message when they answer.
- Treat an answer with `"late": true` as context only, and confirm with the
  user before acting on the earlier request.
- Call `read_form` with a `form_id` to see an earlier form, and never write a
  `<wippy-form-answers>` element by hand.

An agent without the trait cannot call `ask_user`, but its prompt still
includes the deterministic form index described below, and it can read a
submitted answer like any other user message.

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
| `fields[].options` | 1 to 20 distinct choices. A plain string is both the value and the label. Use `{ "value", "label", "description"? }` when the stored value should differ from the shown text |
| `fields[].multiple` | Boolean, default `false`: allow selecting several options |
| `fields[].allow_other` | Boolean, default `false`: offer a free-text "Other" answer |

The normalized definition is bounded to 32 KiB. The size is measured after
normalization, where a plain string option expands to `{"value": .., "label":
..}`, so a definition with many short string options can be well over the
limit even when it looks compact. In that case the tool error reports the
actual normalized size. Labels and descriptions are rendered as plain text and
are never parsed as Markdown or HTML. Control characters other than tabs and
newlines (in multi-line fields) are rejected.

A successful call ends the agent's turn. The tool result is a factual,
past-tense sentence:

```text
Form "Delivery preference" was created as <artifact-id>. Its answer will arrive as a user message.
```

The agent should not run a further model step to say "please fill in the
form", because the form is already visible. A short continuation costs an
extra model step and does not affect correctness, because the form is already
stored.

### One form per turn

At most one form can be created per agent turn. A second `ask_user` call in
the same turn is rejected before anything is written:

```text
This turn already asked the user with a form. No second form was created; wait for the answer to the first one.
```

A session can hold up to 100 unresolved (unanswered) forms at once. Above
that, `ask_user` is rejected with `too_many_forms` and the agent is asked to
resolve or supersede older forms. Nothing is deleted automatically.

A form's definition is immutable once created. There is no edit operation, and
an attempt to update a form artifact through the general artifact-update path
is rejected with `session_form: Session forms cannot be edited. Ask a new form
instead.` To change a question, ask a new form.

## What the agent receives

The user answers on a question card (see the frontend page for the UI). The
accepted answer becomes one ordinary user message, built entirely on the
server, and the browser never supplies its text. The message has exactly one
visible line, followed by an invisible carrier element that holds the full
answer as JSON:

```text
Answered questions about the delivery of your order.

<wippy-form-answers record='{"form_id":"<artifact-id>","form_version":1,"title":"Order details","late":false,"answers":{"delivery":{"question":"How should the parcel be delivered?","answer":{"value":"courier","label":"Courier","note":"Buzzer 12, back entrance"}},"extras":{"question":"Any extras for this order?","answer":[{"value":"gift_wrap","label":"Gift wrap"},{"other":"Remove the price tag"}]},"when":{"question":"When works best for delivery?","answer":null}}}'>
</wippy-form-answers>
```

The user sees only the first line, which is the `answered_message` the agent
supplied when it called `ask_user` (or the `Answered “<title>”.` fallback).
The `wippy-form-answers` component that the Session ships renders nothing, so
the record never appears in the chat. The agent reads the raw message text,
including the record attribute, on its next turn. The answered form card shown
above the message is the summary for the user, and the record is the summary
for the agent.

### Record shape

The record is self-contained, so an agent can act on it without the original
`ask_user` call, which a checkpoint may have summarized away. For each
question id, `answers[id]` has a `question` (the field's label) and an
`answer`:

| Answer shape | When |
| --- | --- |
| `{"value": "courier", "label": "Courier"}` | A chosen option |
| `{"value": "courier", "label": "Courier", "note": "…"}` | A chosen option with the user's own note |
| `{"other": "…"}` | The user's own free-text answer |
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

| `status` | Meaning |
| --- | --- |
| `unanswered` | Returns the form's `title` and `questions` (each with its options), so an agent that lost the original `ask_user` result can restate them |
| `answer_pending` | The user answered, but the answer has not been admitted into this session's history yet (see below). No answer values are returned, and the agent must wait for the answer to arrive as a user message |
| `answered` | Returns the same self-contained record described above, plus `answered_at` |

Every agent, with or without the trait, also gets a bounded, deterministic
index of the session's forms in its prompt. The index is computed fresh on
every prompt build, so it cannot drift from the stored forms:

```text
Session forms (index; exact answers are in the answer messages and can be read with read_form when available):
- unanswered: "Delivery preference" form_id=... asked=...
- answer pending (arrives as a later user message): "Extras" form_id=... asked=...
- answered: "Order details" form_id=... answered=... late=false answer_message_id=...
(2 more unanswered and 1 more answered forms not listed)
```

The index lists up to 8 unanswered or pending forms (newest first) and up to 4
answered forms (most recently answered first), bounded to 8 KiB, and it
reports how many were omitted. A summarizing checkpoint is free text and may
drop form ids or values. The index is rebuilt from the stored artifacts on
every prompt, so it does not depend on the checkpoint having preserved
anything.

## How answers are admitted

Submitting a form's answer (see the frontend page for the HTTP contract)
commits the answer and the user message in one transaction, then publishes an
artifact-update event and wakes the owning session process. The stored row,
and not the wake-up, makes delivery durable, so a missed wake-up does not lose
the answer.

A form answer is never steered into a running turn. It stays pending until the
turn ends, no matter how the session is configured. Typed input follows the
session's own steering setting instead. It can be admitted mid-turn when the
agent has the `wippy.session.traits:steering` trait, or when the session sets
a `steer` input-policy override. Once a turn ends, pending answers and any
steered input the session held are admitted together, in the order they were
durably accepted.

Admission order follows the order in which answers were durably accepted, and
the rest depends on what the session is doing:

- If the session is idle, the answer is admitted immediately and a new turn
  starts to answer it.
- If a turn is running, the answer stays out of that turn's prompt. It is
  marked pending, and `read_form` reports `answer_pending` for it. It is
  admitted once the turn ends, in acceptance order together with any typed
  input the session held during the turn, and the next turn answers the latest
  admitted message.
- If the user pressed Stop, the answer is still admitted and becomes ordinary
  visible history, but no new turn starts for it. The form reads as delivered,
  and the user continues by sending a message. The same holds when the session
  plugin has to enforce the Stop itself. If a turn does not stop within 10
  seconds, the plugin cancels and then terminates the session process, and the
  pending answers are admitted with no turn exactly as an honored Stop's would
  be. They do not wait for the next session start to run an unattended turn.
- If the session is finishing, or the process is not running (idle timeout,
  crash, restart), the answer stays pending. The next time the session process
  starts, it scans for pending answers before anything else and queues their
  admission, so recovery needs no external retry.

The user's session plugin also drives this recovery from outside any one
session. It starts a stopped session that still holds an unadmitted answer,
once right after the plugin itself starts and again on every periodic scan
after that. An answer is therefore still delivered when its original wake-up
was lost, and the start admits the answer and runs a turn for it, like any
other session start with a pending answer.

The same plugin start also settles any of the user's sessions left stored as
"running" with no live process, for example after a runtime restart, back to
idle. The settling changes only how an already-admitted answer reads. An
answer that the turn had picked up before the process disappeared now reads as
interrupted ("send a message to continue") and no longer reads as running. A
pending answer is not affected by the settling, because it is unrelated to the
session's stored status. It is admitted with a turn the next time the session
starts, as described above.

Once admitted, the answer's message row is re-dated to the moment of
admission rather than the moment it was accepted, so its place in the visible
history follows admission order. The `submitted_at` that the artifact-state API
returns (see the frontend page) is unaffected and keeps the original
acceptance time.

The agent must never treat an `answer_pending` form as answered, and must
never guess its content before the real answer message arrives.

## Security notes

The text of the answer message, which is the sentence and the record, is built
entirely by the server from the immutable definition and the validated,
normalized answers. The browser sends only structured `answers` keyed by field
id and never sends message text. User-supplied text (an "Other" answer or a
note) is JSON-escaped data inside the record's `answer` object and is never raw
markup. The server escapes `'`, `<`, `>`, and `&` inside the record, so user
text cannot end the attribute, close the tag, or add markup.

The trait's prompt tells the agent never to write a `<wippy-form-answers>`
element itself. The tag carries meaning only in the exact wire format the
server writes, and an agent-authored one would not match a real accepted
answer.

Every state read or write checks authentication, then that the artifact
belongs to the caller and its session, then read (GET) or write (POST)
permission on that session, before doing anything with the form. A missing
artifact, another user's artifact, and an artifact whose session is gone or
not the caller's all return the same 404, so the endpoint does not reveal that
a foreign form exists.

## Disabling and rolling back

Disabling new form creation is a config-only change. Remove
`wippy.session.forms:ask_user` from an agent's `traits:` list. There is no
deploy step, no feature flag, and no separate kill switch.

- Open (unanswered) forms stay answerable. The state API's read and write
  checks are session-ownership checks and not trait checks, so a form asked
  before the trait was removed can still be submitted afterward.
- Answered forms stay readable, with or without the trait on any agent. An
  answered form is an ordinary artifact plus an ordinary user chat message,
  and `read_form` and the prompt's form index work the same for every agent.
- Do not downgrade the `wippy/session` module below the release that shipped
  Session Forms while any form artifacts exist. Rendering `wippy-form` and
  `wippy-form-answers` needs their `view.component` registry entries to be
  registered and served by the running module version. A consumer that
  registers its own forms-related entries can fail to boot on an older module,
  because one of those entries stays unresolved and the runtime refuses to
  start with `failed to load state: unresolved dependencies after retry: …`.
  The boot behavior of an older module is not defined for a consumer whose
  only reference is an agent's `wippy.session.forms:ask_user` trait, so treat
  that case as a risk too. Removing the trait is the supported way to stop new
  forms. Downgrading the module is a separate action with this failure mode.

## Compatibility

- The question card submits through the `artifactState` client, which only
  Web Host 1.0.61 or later provides (see
  [Host requirement](../frontend/micro-frontends/session-forms.md#host-requirement)).
  On an older Host the card shows the questions with disabled options and a
  notice that the form needs a newer Web Host, and nothing can be submitted.
  The user's answer message and the agent's reply stay readable in the chat.
- A form whose `form_version` is not `1` shows a notice and never a submit
  control.
- When the component bundle is missing, the Host shows its load-failure
  fallback in place of the card, and reloading the page recovers it.

## Limits at a glance

| Limit | Value |
| --- | --- |
| Form title | 160 characters |
| Description (form or field) | 1,000 characters |
| `submit_label` | 40 characters |
| `answered_message` | 200 characters |
| Fields per form | 1 to 20 |
| Field label | 240 characters |
| Options per field | 1 to 20 |
| Option text | 240 characters |
| "Other" answer text | 2,000 characters |
| Note text | 1,000 characters |
| Normalized definition size | 32 KiB |
| Submission request body | 64 KiB |
| Unresolved forms per session | 100 |
| Form index (prompt injection) | 8 unanswered/pending + 4 answered, 8 KiB total |

Form submission has no rate limit.

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
