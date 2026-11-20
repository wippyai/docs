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

## Tool approval

Tool approval asks the user before a tool call runs. The user approves the
call, approves all calls of a kind, or denies it. A session where approval is
on is a protected session.

Tool approval needs a Session release that supports it
<!-- version: set at release -->. An older Session ignores the trait and sends
no approval events. The messages between the Session and a chat client are in
the [tool approval protocol](https://github.com/wippyai/session/blob/master/docs/tool-approval-protocol.md).

### Turn it on

Add the `wippy.session.traits:tool_approval` trait to an agent. Every option is
optional:

```yaml
traits:
  - id: wippy.session.traits:tool_approval
    context:
      require: marked
      approve_all: "off"
      timeout_seconds: 900
      max_requests_per_turn: 10
```

| Option | Default | Values |
|--------|---------|--------|
| `require` | `marked` | `marked`, `all` |
| `approve_all` | `off` | `off`, `batch`, `tool`, `session` |
| `timeout_seconds` | 900 | 30 to 3600 |
| `max_requests_per_turn` | 10 | 1 to 50 |

- With `require: marked`, only tools that set `approval` in their registry meta
  ask. See [Tool Metadata](./agents.md#tool-metadata). Delegation calls never
  ask under `marked`.
- With `require: all`, every call needs approval, delegation calls included.
  No tool is exempt because it only reads data. An Approve all grant can still
  cover a call. A repeat of a call that the user denied earlier in the turn
  settles without a card.
- With `approve_all: "off"`, Approve all is offered only for a tool whose
  author set `approval.approve_all: true`.
- `max_requests_per_turn` caps the approval requests in one turn. When one
  model step asks for more, no call of that step runs and the turn ends with a
  notice (error code `tool_approval_limit`).
- An invalid context fails the turn with `tool_approval_config_invalid` before
  any model call. An unknown key is invalid too, so a misspelt key cannot leave
  a weaker default in force.

### Sticky activation

Each step of an agent that has the trait stores that agent's settings in the
session. After the first one, the session stays protected. The stored `require`
never goes back from `all` to `marked`. An agent without the trait does not turn
approval off: the stored settings stay in force. Grants do not apply while the
active agent lacks the trait or does not allow their scope.

### Capability flag

`GET /api/v1/sessions/capabilities` reports `tool_approval: 1` when the Session
supports tool approval. A client treats a missing key as "no tool approval" and
sends the same messages as before.

A chat client must also declare an approval surface for the session. The
declaration says that the client has a transcript that can show approval cards.
Approval needs a live surface for the session from any connection, or the
grace period after the last one went away. The Wippy
Web Host declares one while `<wippy-chat>` or `<wippy-chat-messages>` is
mounted, and so does its own chat. A `chat.js` UI can declare one too.
`<wippy-chat-input>` and `<wippy-session-selector>` declare none.

When no surface is live and none was ever declared, every call that needs
approval settles at once as not run (`approval_ui_unavailable`), and the turn
ends with a notice (error code `tool_approval_unavailable`). This is also what
happens with a client that does not support tool approval, such as an older
Host. After a declared surface goes away, the request waits for the grace
period below.

### What the user sees

The chat shows each waiting call as a card with the tool, a one-line summary of
the arguments and **Details**. The card offers only what the Session offered:

| Control | Effect |
|---------|--------|
| **Approve** | The call runs. |
| **Approve all** | Approves every pending call that the button covers. It shows its scope: `batch` (the calls of one model response), `tool` (this tool, for the rest of the session) or `session` (the eligible tools and delegation targets that **Details** lists). Scope `batch` creates no grant. Scope `tool` or `session` creates a grant, and later calls in that scope run without a card. |
| **Deny** | The call does not run, and no call of the batch runs. The turn ends. |
| **Deny with a reason** | The call does not run. The user's text (1 to 2,000 characters) goes to the model, and the turn continues. |
| **Stop** | The chat Stop button ends the waiting call as cancelled and ends the turn. |

When the session accepts messages during a turn (`while_running: steer`),
sending a message while a card waits skips the approval. The call does not run,
and the model continues with the message. Under the default `block` policy, the
Session refuses a message while the turn is running. Stop ends the turn.

A tool grant covers the tool at its deployment fingerprint. The fingerprint
covers the registry entry (kind, meta and data). A change only to code that the
entry points to does not change it. A session grant covers exactly the tools and
delegation targets that **Details** lists.

A grant lasts for the rest of the session and survives new turns and Session
restarts. It ends when the user revokes it, when the session is deleted, or when
the session gets another owner. A new, copied or forked session starts with no
grants.

A grant pauses in these cases:

- The tool changes, or its author sets `approve_all: false`. Only a new Approve
  all gives the authority back.
- An agent step does not permit the grant, for example when the model hands off
  to an agent without the trait. Only a user switch back to an agent that
  permits it restores the grant.

A revocation stops only the calls that the grant allowed in a batch that is not
yet released. It never stops calls that were already released, even ones that
have not started. Later calls ask again.

### Timeouts and grace period

A request waits for `timeout_seconds`. When the time runs out, the call does
not run and the turn ends.

The Session asks for a decision only while a client surface is live, or during
the grace period. If a
client declared a surface before and none is live now, the request stays
pending for a 120 second grace period, or until its deadline, whichever comes
first.

### What the model sees

A call that did not run gets a structured result. It holds no approval ID,
digest or grant ID.

```json
{
  "executed": false,
  "reason": "denied_by_user",
  "user_feedback": "Use the staging customer instead.",
  "instruction": "The tool did not run. Do not call it again with the same arguments. Follow the user's feedback."
}
```

| Reason | When | Turn |
|--------|------|------|
| `denied_by_user` | The user denied with a reason. | Continues |
| `stopped_by_user` | The user denied and stopped. | Ends |
| `not_run_batch_stopped` | A call of the batch was stopped, or the batch closed. | Ends |
| `expired` | The deadline passed. | Ends |
| `stopped` | The user pressed Stop. | Ends |
| `superseded_by_user_message` | The user sent a message. | Continues with the message |
| `interrupted` | The turn finished, crashed or was handed off. | Ends |
| `approval_ui_unavailable` | No live surface after the grace period, or none declared. | Ends, with a notice |
| `limit` | The per-turn cap was reached. | Ends, with a notice |
| `changed_before_run` | The tool entry or the call changed before release. | Continues |
| `revoked` | The grant that allowed the call was revoked, or the session changed owner, before release. | Continues |
| `repeated_denied_call` | Same call as one denied earlier in the turn. | Continues |
| `approval_check_failed` | The Session could not prepare a valid call for the check. | Continues |

### Restart and recovery

A pending approval does not survive a Session process restart. Recovery closes
the unfinished batch. A pending request becomes `interrupted`, and the model
sees the `interrupted` result. After a crash, an approved call of a batch that
was never released, and a call of a batch released before the crash, get the
plain text `interrupted, outcome unknown` when they were still pending at the
crash, because the Session cannot know whether the call ran. A row that already
ended keeps its result. No call runs again after a restart.

### Operator switch

The `tool_approval_enforcement` requirement of `wippy/session` (environment
variable `SESSION_TOOL_APPROVAL_ENFORCEMENT`) is `enforce` by default. The
value `off` skips the approval gate for every session and logs a warning for
each skipped check. This is a security downgrade, meant for rollback. Any other
value reads as `enforce`.

```yaml
- name: dep.wippy.session
  kind: ns.dependency
  component: wippy/session
  parameters:
    - name: tool_approval_enforcement
      value: "off"
```

The switch skips only the gate. The Session still validates the trait, so an
invalid context still fails the turn. It still stores the activation, so the
Web Host still isolates content and the `isolation_required` refusal below
still applies. Grants stay with their session and apply again when enforcement
returns.

### Artifacts in protected sessions

The Web Host cannot isolate JSON or packaged web content. In a protected
session the Session refuses a `_control.artifacts` item that holds such
content, whether new or as an update. That includes a number or a boolean, and
text that parses as a JSON number, boolean or `null`. It allows HTML, markdown, a JSON string,
a Session form tag (`wippy-form`) without `on*` props, and `view_ref` items.
One refused item refuses the whole list, and nothing is written. The tool call
fails with an error that starts with `isolation_required:`, and the model can
return HTML or markdown instead. See [Proxy & Isolation](../frontend/web-host/proxy-isolation.md#protected-sessions-and-isolated-artifacts)
for what the Host does with the content.

### Known limits

- Only tool calls of chat sessions are checked. Dataflow, Temporal, CLI loops
  and direct `funcs.call` are not.
- Tools that a delegated child agent calls are not checked.
- Approval protects against the model, tool results and other users. It does
  not protect against code that already runs as the user in the browser, such
  as an app page.
- Where the registry cannot pin a tool version, a small race remains between
  the recheck at release and the start of the call.

## Related pages

- [Agents](./agents.md) describes agent definitions and general trait behavior,
  and how a tool marks itself for approval.
- [Chat Web Components](../frontend/micro-frontends/chat-web-components.md) describes composer behavior, acknowledgements, pending messages, and reconnects.
