---
title: "Sessions"
description: "Configure session input, live steering, agent control, and delivery behavior."
---

# Sessions

The `wippy/session` module owns persistent chat sessions and the policy for
accepting user input. A session blocks new messages during an active turn by
default. Steering lets an enabled session accept input during generation and
apply it before the next model step in the same turn.

## Setup

Add the module to the project:

```bash
wippy add wippy/session
wippy install
```

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
first, a later send is rejected. The current provider operation or a tool batch
that is already running may finish. The session suppresses new tools and any
further continuation at the next operation boundary.

Unused steering remains pending after Stop, recovery, or handoff. Recovery and
handoff clear the temporary policy, retain the persistent policy and pending
input, and recompute the active agent default. They do not start a turn. The
pending messages are included when the user starts the next turn.

## Delivery confirmation

On the session command path, the client correlates a send command with
`request_id`. The server generates the message ID. Only a successful, matching
command response confirms the send and allows the sender to clear its draft
and attachments. WebSocket receipts update history but do not confirm the
sender's request. Older fire and forget transports may retain a random message
ID. That legacy ID has no retry or deduplication meaning.

Admission, validation, and definite database failures return a request-matched
error and write no message. If the database commit succeeds but the
acknowledgement is lost, the row remains durable and appears after refresh. The
client keeps the draft and reports that delivery was not confirmed.

There is no automatic retry, client message ID, fingerprint, or deduplication
scan. Manual resend after uncertain delivery may create a duplicate. Immediate
cancellation of an in-flight provider request is also outside this contract.

## Related pages

- [Agents](./agents.md) describes agent definitions and general trait behavior.
- [Chat Web Components](../frontend/micro-frontends/chat-web-components.md) describes composer behavior, acknowledgements, pending messages, and reconnects.
