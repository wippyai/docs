---
title: "Sessions"
description: "Configure session input, stable history, checkpoints, live steering, and delivery behavior."
---

# Sessions

The `wippy/session` module owns persistent chat sessions and the policy for
accepting user input. A session blocks new messages during an active turn by
default. Steering lets an enabled session accept input during generation and
apply it before the next model step in the same turn.

## Availability

This page describes `wippy/session` 0.6.19 with Agent 0.5.11 and LLM 0.5.14.
Steering was introduced in Session 0.6.3. See [Chat Web
Components](../frontend/micro-frontends/chat-web-components.md) for client support.

A new client connected to an older Session server keeps the legacy status-based
sending behavior when `interaction` is absent. An older client connected to a
new Session server can keep using normal chat and Stop, but it does not gain
steering controls or pending-message presentation.

## Setup

Add the module to the project:

```bash
wippy add wippy/session@0.6.19
wippy install
```

## Stable history

Each normal continuation extends the preceding request. The session stores
context where it was sent and replays it unchanged, preserving the provider
prefix for prompt caching and thinking blocks. This requires Agent 0.5.10 and
LLM 0.5.13 or later.

- **Time context:** an agent with `agent_options.turn_context` gets one stored
  time note per turn. The session renders it through `wippy.agent:turn_context`
  and stores it after activation, lifecycle validation and the Stop gate,
  before the model call. The system row carries `metadata.preserve_position = true` and
  `metadata.system_action = "turn_context"`. It follows the user message and
  any activation notes; tool continuations add none. A handoff to a time-aware
  agent adds it only if that turn has none. Retries and reopened sessions replay
  the stored minute. A rendering error fails the turn.
- **Recall:** `response.context_notes` are stored in order as developer rows
  after lifecycle notes and before the step output, with `preserve_position`
  and `memory_ids`. Notes and output commit together. Kept truncated or cancelled
  text keeps its notes; discarded output discards them. Assistant rows no longer
  carry recall IDs or counts.
- **Lifecycle:** `activate` and `before_step` messages must be `developer` or
  `system`. They are positional rows with `metadata.lifecycle_phase` and
  `metadata.system_action = "lifecycle_note"`. Activation notes persist when
  activation runs; before-step notes commit with the output. A binding may
  contribute `memory_ids`, but cannot replace these host metadata fields.
- **Thinking:** assistant rows store `prefix_fingerprint`, `thinking_blocks`,
  `content_positions` when present, and the immutable `generation_checkpoint_id`.
  Each step uses `drop_stale_thinking` and `thinking_is_current` to compare both
  the fingerprint and generation checkpoint. Missing generation metadata is
  stale; changing an anchor's checkpoint does not change its generation. The
  current tool round keeps its blocks for provider handling.
- **Tool rounds:** all calls from a response follow its assistant row, then all
  results follow in the model's call order. Adjacent rows remain separate.
  Developer rows and positional system rows replay in place; other system rows,
  such as agent-change notices, stay out of the prompt.

Model text and lifecycle notes are stored only when they contain a non-space
character. A blank assistant row can hold a tool round's thinking without
creating blank text on the wire. User input with no visible text, files or
attachments is rejected with `empty_message`; attachments can stand alone.

### Deliberate prefix edits

Checkpoints replace earlier history, and agent, tool or trait changes can replace
the system prompt or tool list. Other edits include withdrawing stale tool
results or expired Attention attachments, changing an attached file's rendered
name or size, and adding, deleting or clearing session memory in the system
prompt. Client-injected system/developer rows can arrive before an in-flight
response. Stop can return applied steering to pending; a discarded step loses
its before-step and recall notes. A restored request excerpt and its time note
leave the prompt when the next user turn starts.

These edits restart the cache at the changed prefix and invalidate later
thinking. Rows from older releases may render differently once after upgrading;
missing fingerprints count as stale. Cache reuse remains provider-dependent.

## Checkpoints

With a checkpoint provider configured, the session compares the response's
`tokens.context_tokens` with the effective `token_threshold` using strict `>`.
This is the full current input, including cached input, not cumulative usage
or only uncached `prompt_tokens`. Tool continuations are checked too, before
the next round and model step. LLM context admission can also request compaction
before dispatch; an unsettled tool round cannot be cut.

Options resolve from lowest to highest precedence:

1. Session-wide `token_checkpoint_threshold` (default 50000) and `checkpoint_function_id`.
2. Agent `agent_options.checkpoint`: trait behavior defaults, then explicit agent values.
3. Persisted session `config.checkpoint`.

```yaml
config:
  checkpoint:
    token_threshold: 20000
    model: class:fast
    max_tokens: 3000
```

This is persisted host configuration; start tokens and `_control.config` do not
implicitly accept the map. `enabled: false` disables checkpointing; a nonpositive
threshold disables automatic scheduling. Maps merge recursively and lists replace,
including empty lists. Each queued checkpoint captures its effective options.
A trait checkpoint binding runs before the configured function fallback; both
receive those options. A strict binding failure prevents fallback and state writes.
See [per-agent compaction](./agents.md#behaviors-and-compaction) for trait entry shape.

The default summarizer uses its resolved model's context window, reserves the
output budget and a safety margin, and caps `max_tokens` at the model's output
limit. It reads the previous summary and new conversation, including positional
notes and arguments/results of public, private and delegation calls. Per-value
`max_tool_result_chars` clamps still apply (default 2000).

The conversation uses available input space after fixed sections and output
reservation. An explicit `max_conversation_chars` caps it; the 500000-byte default
applies only when no model window resolves. If fitting this conversation requires
dropping bytes, the checkpoint fails before generation. The duplicate KEY TOOL
RESULTS section keeps the newest `max_tool_results` (default 100), bounded by
`max_tool_results_chars` (default 100000) and remaining space. Dropping these
duplicates alone does not fail a checkpoint: the results remain in the conversation.

The default output budget is 3000 tokens; the summarizer asks for less than that
budget. A summary cut off at `max_tokens` fails. Any checkpoint failure leaves
the previous summary and history anchor unchanged. If the full prompt still fits
the agent's model window with its output reservation, the session sends it and
tries compaction again on the next step. Otherwise the turn fails visibly. Use
a summarizer with enough input capacity or checkpoint earlier.

A checkpoint within a turn retains the originating request at user authority,
followed by the resume note and later messages. The restored request is capped
at 6000 UTF-8 bytes, keeping both ends, and its time note is restored with it.
Attachments are covered by the summary rather than reloaded. A later ordinary
user message starts a new turn; steering cannot replace the active task.

## Input policy

A session may store one persistent override:

```yaml
config:
  input_policy:
    while_running: steer
```

`while_running` accepts `block` or `steer`. The effective policy is resolved
in this order:

1. Temporary override for the active turn.
2. Persistent session override in `config.input_policy`.
3. The active agent's default.
4. `block`.

The `wippy.session.traits:steering` trait sets the active agent default to
`steer`:

```yaml
traits:
  - wippy.session.traits:steering
```

Steering remains opt-in. Agents without this trait and sessions without an
override keep the blocking behavior.

## Agent management tool

The `wippy.session.traits:input_control` trait grants the
`set_session_input_policy` tool:

```yaml
traits:
  - wippy.session.traits:input_control
```

This trait grants control but does not enable steering by itself. The tool has
two arguments:

| Argument | Values | Default | Meaning |
|----------|--------|---------|---------|
| `mode` | `block`, `steer`, `inherit` | Required | Set or remove the override at the selected scope. |
| `scope` | `turn`, `session` | `turn` | Apply the change to this turn or persist it on the session. |

The tool accepts no session ID. It is bound to the calling session and checks
that the calling agent still owns that session. The session validates and
persists the change before the tool reports success. A failed write does not
change the in-memory policy.

Temporary turn overrides clear on completion, Stop, failure, recovery, and
agent handoff. A persistent session override remains until it is changed or
removed with `inherit` at session scope.

## Public interaction state

REST session responses and WebSocket session updates may include:

```ts
interaction?: {
  can_send: boolean
  revision: number
}
```

`can_send` is the committed effective sending state. `revision` increases only
when committed `can_send` changes. Clients should keep explicit `false` values
and ignore lower revisions.

A full REST response without `interaction` means the server uses the older
contract. The client should clear its cached interaction state and use the
legacy session-status behavior. A partial WebSocket update that omits
`interaction` leaves the current value unchanged. A supplied malformed object
also leaves the last valid state unchanged.

Stop is separate from `can_send`. Its availability comes from the existing
session status.

## Steering lifecycle

The server assigns the canonical message ID and persists a steering message
before acknowledging it. Steering messages alone receive input metadata:

```ts
input?: {
  state: "pending" | "applied"
  after_message_id?: string
}
```

Normal idle messages keep their existing metadata. Pending steering is ordered
by persisted `date`, then by server `message_id`. After the current response
and its running tool batch finish, the session builds the next prompt and runs
its pre-step lifecycle work while every steering row is still pending. At the
model dispatch boundary, it changes the complete batch to applied in one
transaction and places those messages after the completed response and tool
results. A failed batch update leaves every row pending and publishes no
applied event.

If the recorded prompt anchor was pruned or is missing, the session inserts the
steering message at the first valid boundary after the checkpoint context. It
does not omit the message. Malformed steering metadata leaves the durable row
in place and fails the apply operation visibly.

If prompt construction, agent loading, or lifecycle work fails before model
dispatch, steering stays pending and the session does not continue by itself.
If the provider fails after dispatch, the steering stays applied because it
already entered the prompt. Later prompt history keeps it.

An event publication failure after a database commit does not roll back the
committed state. REST reads and reconnect refreshes reconstruct that state.

## Stop, recovery, and handoff

Stop is committed before it is acknowledged. If persistence fails, the active
turn continues and the command returns an error. Repeated Stop commands are
idempotent.

If a steering message commits before Stop, it remains pending. If Stop commits
first, a later send is rejected. Stop closes the turn's cancel channel to cancel
in-flight model and tool calls. Streamed text already received is stored with
`metadata.stopped = true`; cancelled calls are stored with status `cancelled`,
and the turn ends idle. Completed tool effects are not undone. With an older
Agent that does not use the cancel channel, Stop takes effect at the next
operation boundary.

The existing Stop supervisor also bounds a stuck operation. If the session has
not stopped after 10 seconds, it requests cancellation of the session process.
After another 10 seconds, it requests termination if the process is still
running. These are process-level safeguards, not a guarantee that an external
provider request or a tool's side effects are cancelled immediately.

Unused steering remains pending after Stop or recovery, ready for the next
user-started turn. A committed tool handoff through `_control.config.agent`
continues the active turn with the new agent after the current tool results
settle, and applies pending steering at its next dispatch. Handoff clears the
temporary policy and recomputes the agent default; the persistent policy remains.
Stop suppresses continuation while preserving a committed agent switch.

Stop also commits a positional developer boundary marking the preceding turn
cancelled. Recovery stores an interruption boundary before accepting input if
the prior turn did not finish. Reopening does not duplicate it. Disconnect,
close, inactivity and capacity retirement let an accepted turn finish;
reconnection cancels pending retirement.

## Delivery confirmation

The client uses the existing WebSocket `request_id` correlation mechanism.
After persisting a message, the server publishes its existing `received` event
on `session:<session_id>:message:<message_id>` with the original `request_id`,
server message ID, text, attachments, and optional `input` metadata. Only a
valid receipt matching the send request confirms delivery and lets the sender
clear its draft and attachments. Receipts without that request ID update
history without clearing the draft.

Stop returns a session `update` with the original `request_id` after committing
its state. Rejections use the existing `error` event with the request ID and
error details. Opening or recovering a session while handling a send must not
confirm that send before the message is persisted.

When steering enters the model prompt, the server publishes `type: "update"`
on the message topic with `message_id` and the changed `input` metadata.
Clients merge this patch into the message and preserve applied state when a
delayed pending receipt arrives. A patch received before its message must not
create an empty chat row.

Older fire and forget transports may retain a random message ID. That legacy
ID has no retry or deduplication meaning.

Admission, validation, and definite database failures return a request-matched
error and write no message. If the database commit succeeds but the
acknowledgement is lost, the row remains durable and appears after refresh. The
client keeps the draft and reports that delivery was not confirmed.

There is no automatic retry, client message ID, fingerprint, or deduplication
scan. Manual resend after uncertain delivery may create a duplicate.

## Related pages

- [Agents](./agents.md) describes agent definitions and general trait behavior.
- [Chat Web Components](../frontend/micro-frontends/chat-web-components.md) describes composer behavior, acknowledgements, pending messages, and reconnects.
