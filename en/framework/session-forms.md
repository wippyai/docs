---
title: "Session Forms"
description: "Ask the user structured choice questions from an agent with the ask_user tool, and read the answer back as a self-contained record."
---

# Session Forms

Session forms let an agent ask the user one or more choice questions and get
a structured answer back, without leaving a tool call waiting on human input.
The `wippy/session` module owns the feature: a trait that adds the `ask_user`
and `read_form` tools, an artifact that renders as a question card in the
chat, and an HTTP endpoint that accepts the answer and delivers it to the
session as an ordinary user message.

V1 supports choice questions only: single selection, multiple selection,
optional required/optional, and an optional free-text "Other" answer. Plain
text, number, date, and other field types are a later release; a V1 renderer
detects an unsupported field type and shows a fallback rather than dropping
the question silently.

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

The trait contributes two tools and a block of prompt text that explains
them to the model (ask at most one form per turn, read `answered_message`
back through `read_form`, treat a late answer as context only, and never
write a `<wippy-form-answers>` element by hand). An agent without the trait
cannot call `ask_user`, but its prompt still includes the deterministic form
index described below, and it can read a submitted answer like any other
user message.

## The `ask_user` tool

`ask_user` validates and normalizes the definition, then asks the session to
create the form. An invalid definition is a tool error (the call returns no
result and a message describing what to fix); nothing is stored in that
case, and the agent can retry in the same turn.

| Key | Contract |
| --- | --- |
| `title` | Required plain text, 1 to 160 characters |
| `description` | Optional plain text, at most 1,000 characters |
| `submit_label` | Optional plain text, at most 40 characters |
| `answered_message` | Optional plain text, at most 200 characters. The user's chat message once they answer, written in the user's own voice by the agent that asks (see [What the agent receives](#what-the-agent-receives)). Never shown on the form. A form asked without it falls back to `Answered "<title>".` |
| `fields` | 1 to 20 entries |
| `fields[].id` | Unique key matching `^[a-z][a-z0-9_]{0,39}$` |
| `fields[].type` | `"choice"` (the only V1 type) |
| `fields[].label` | The question, 1 to 240 characters |
| `fields[].description` | Optional help text, at most 1,000 characters |
| `fields[].required` | Boolean, default `false` |
| `fields[].options` | 1 to 20 distinct choices. A plain string is both the value and the label; use `{ "value", "label", "description"? }` when the stored value should differ from the shown text |
| `fields[].multiple` | Boolean, default `false`: allow selecting several options |
| `fields[].allow_other` | Boolean, default `false`: offer a free-text "Other" answer |

The normalized definition is bounded to 32 KiB. That size is measured after
normalization, where a plain string option expands to `{"value": .., "label":
..}`, so a compact-looking definition with many short string options can be
well over the limit before it is written out this way; the tool error
reports the actual normalized size in that case. Labels and descriptions are
rendered as plain text, never parsed as Markdown or HTML, and control
characters other than tabs and newlines (in multi-line fields) are rejected.

A successful call ends the agent's turn. The tool result is a factual,
past-tense sentence:

```text
Form "Delivery preference" was created as <artifact-id>. Its answer will arrive as a user message.
```

The agent should not run a further model step to say "please fill in the
form" — the form is already visible. If it chooses to add a short
continuation anyway, that costs an extra model step and has no effect on
correctness: the form is already durably created either way.

### One form per turn

At most one form can be created per agent turn. A second `ask_user` call in
the same turn is rejected before anything is written:

```text
This turn already asked the user with a form. No second form was created; wait for the answer to the first one.
```

A session can hold up to 100 unresolved (unanswered) forms at once. Above
that, `ask_user` is rejected with `too_many_forms` and the agent is asked to
resolve or supersede older forms; nothing is deleted automatically.

A form's definition is immutable once created. There is no edit operation —
attempting to update a form artifact through the general artifact-update path
is rejected (`session_form: Session forms cannot be edited. Ask a new form
instead.`). To change a question, ask a new form.

## What the agent receives

The user answers on a question card (see the frontend page for the UI). The
accepted answer becomes one ordinary user message, built entirely on the
server — the browser never supplies its text. The message has exactly one
visible line, followed by an invisible carrier element that holds the full
answer as JSON:

```text
Answered questions about the delivery of your order.

<wippy-form-answers record='{"form_id":"<artifact-id>","form_version":1,"title":"Order details","late":false,"answers":{"delivery":{"question":"How should the parcel be delivered?","answer":{"value":"courier","label":"Courier","note":"Buzzer 12, back entrance"}},"extras":{"question":"Any extras for this order?","answer":[{"value":"gift_wrap","label":"Gift wrap"},{"other":"Remove the price tag"}]},"when":{"question":"When works best for delivery?","answer":null}}}'>
</wippy-form-answers>
```

The user sees only the first line: the `answered_message` the agent supplied
when it called `ask_user` (or the `Answered "<title>".` fallback). The
`wippy-form-answers` component the Session ships renders nothing, so the
record never appears in the chat, but the raw message text — including the
record attribute — is what the agent reads on its next turn. The answered
form card shown above the message is the user-facing summary; this record is
the machine-readable one.

### Record shape

The record is self-contained: an agent can act on it without the original
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

The record also carries `form_id`, `form_version`, and `title`. A late
answer (see below) additionally carries `"late": true` and a `late_notice`.
The stored submission keeps only the normalized answer values; the record
itself is derived from those values plus the immutable definition on every
read, so the record in the answer message and the one `read_form` returns
for the same form always agree.

## Late answers and the fresh-confirmation rule

A form's staleness and its late flag serve different purposes and are tracked
separately.

While a form is unanswered, it is **stale** when a different real user input
(a typed message, or a submission to another form) was durably accepted
after the form was created. Staleness is evaluated live, every time the form
state is read; assistant text, system events, tool results, and validation
failures never make a form stale.

Once a form is answered, the acceptance transaction evaluates staleness one
final time against the same rule and freezes the result as the submission's
**late** flag. It does not change afterward, no matter what the conversation
does later. A late answer's record carries `"late": true` and:

```text
late_notice: "The conversation moved on before this answer. Use it as context and ask for fresh confirmation before acting on the earlier request."
```

A form submission is never an authorization token for the action it was
originally asked about. The agent must still get explicit confirmation
before acting on a late answer, and any action tool that needs authorization
must enforce that itself — the forms feature only records what the user
chose.

## `read_form` and the form index

`read_form` takes a `form_id` (from the form index or an answer message) and
returns the state of one form belonging to the calling session; a form from
another session is not visible. Its result depends on the form's state:

| `status` | Meaning |
| --- | --- |
| `unanswered` | Returns the form's `title` and `questions` (each with its options), so an agent that lost the original `ask_user` result can restate them |
| `answer_pending` | The user answered, but the answer has not been admitted into this session's history yet (see below). No answer values are returned — the agent must wait for the answer to arrive as a user message |
| `answered` | Returns the same self-contained record described above, plus `answered_at` |

Every agent, with or without the trait, also gets a bounded, deterministic
index of the session's forms injected into its prompt (computed fresh on
every prompt build, not a copy that can drift):

```text
Session forms (index; exact answers are in the answer messages and can be read with read_form when available):
- unanswered: "Delivery preference" form_id=... asked=...
- answer pending (arrives as a later user message): "Extras" form_id=... asked=...
- answered: "Order details" form_id=... answered=... late=false answer_message_id=...
(2 more unanswered and 1 more answered forms not listed)
```

The index lists up to 8 unanswered/pending forms (newest first) and up to 4
answered forms (most recently answered first), bounded to 8 KiB, and reports
how many were omitted past that. A summarizing checkpoint is free text and
may drop form ids or values; this index is rebuilt from the stored artifacts
on every prompt, so it does not depend on the checkpoint having preserved
anything.

## How answers are admitted

Submitting a form's answer (see the frontend page for the HTTP contract)
commits the answer and the user message in one transaction, then publishes
an artifact-update event and wakes the owning session process. The row
itself, not the wake-up, is what makes delivery durable — a missed wake-up
does not lose the answer.

A form answer is never steered into a running turn. It stays pending until
the turn ends, no matter how the session is configured. Typed input, by
contrast, follows the session's own steering setting. It can be admitted
mid-turn when the agent has the `wippy.session.traits:steering` trait, or
the session sets a `steer` input-policy override. Once a turn ends, pending
answers and any steered input the session held are admitted together, in
the order they were durably accepted.

Admission order follows the order answers were durably accepted, and depends
on what the session is doing:

- **Idle session.** The answer is admitted immediately, and a new turn
  starts to answer it.
- **A turn is running.** The answer stays out of that turn's prompt — it is
  marked pending and `read_form` reports `answer_pending` for it — and is
  admitted once the turn ends, in acceptance order together with any typed
  input the session held during the turn. The next turn answers the latest
  admitted message.
- **The user pressed Stop.** The answer is still admitted (it becomes
  ordinary visible history), but no new turn starts for it. The form reads
  as delivered; the user continues normally by sending a message.
- **The session is finishing, or the process is not running (idle timeout,
  crash, restart).** The answer stays pending. The next time the session
  process starts, it scans for pending answers before anything else and
  queues their admission — recovery needs no external retry.

The user's session plugin also drives this recovery from outside any one
session. It starts a stopped session that still holds an unadmitted answer,
once right after the plugin itself starts and again on every periodic scan
after that, so an answer is still delivered even if its original wake-up was
lost. The same plugin start also settles any of the user's sessions left
stored as "running" with no live process, for example after a runtime
restart, back to idle, so their form answers read as interrupted rather than
perpetually running.

Once admitted, the answer's message row is re-dated to the moment of
admission rather than the moment it was accepted, so its place in the
visible history follows admission order. The `submitted_at` the
artifact-state API returns (see the frontend page) is unaffected and keeps
the original acceptance time.

The agent must never treat an `answer_pending` form as answered, and must
never guess its content before the real answer message arrives.

## Security notes

The answer message's text — the sentence and the record — is built entirely
by the server from the immutable definition and the validated, normalized
answers. The browser sends only structured `answers` keyed by field id; it
never sends message text. User-supplied text (an "Other" answer or a note)
is JSON-escaped data inside the record's `answer` object, never raw markup:
the server escapes `'`, `<`, `>`, and `&` inside the record so user text
cannot end the attribute, close the tag, or add markup.

The trait's prompt explicitly tells the agent never to write a
`<wippy-form-answers>` element itself — the tag carries meaning only in the
exact wire format the server writes, and an agent-authored one would not
match a real accepted answer.

Every state read or write checks authentication, then that the artifact
belongs to the caller and its session, then read (GET) or write (POST)
permission on that session, before doing anything with the form. A missing
artifact, another user's artifact, or an artifact whose session is gone or
not the caller's all return the same 404 — the endpoint does not reveal that
a foreign form exists.

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

There is no rate limit on form submission in V1.

## Verifying

Create or use an agent with the `wippy.session.forms:ask_user` trait, start a
session, and prompt it to ask a question that needs a decision. Confirm: the
question card appears in the chat, answering it produces a chat message with
exactly one visible sentence, and the agent's next turn correctly references
the answer (for example, by asking `read_form` or by acting on the choice).
To check late-answer handling, send a plain chat message after the form is
created but before answering it, then answer — the record should carry
`"late": true` and the agent should ask for confirmation before acting on
the original request.

## See Also

- [Session Forms (frontend)](../frontend/micro-frontends/session-forms.md) — the `wippy-form` / `wippy-form-answers` components, the artifact-state HTTP API, and the `artifactState` proxy client
- [Agents](agents.md) — traits, tools, and agent definitions in general
