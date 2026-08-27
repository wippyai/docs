---
title: "Security Model: Process Isolation and Policy Checks"
description: "How Wippy limits Lua and WASM execution environments and authorizes guarded runtime operations with actors, scopes, and policies."
---

# Security Model

Wippy combines execution isolation with attribute-based access control (ABAC). Isolation determines which modules and host resources code can reach. ABAC determines whether a guarded operation is allowed in the current actor and policy scope. Both boundaries matter; importing a module does not grant its permissions, and a policy cannot make an undeclared module available to Lua code.

## Authorization Rules

A security context can carry an **actor** and a **scope**. The actor identifies the principal and may include metadata. The scope is an immutable set of policies. A policy matches an action and resource, may inspect actor or resource metadata, and returns `allow`, `deny`, or `undefined`.

When both actor and scope are present:

1. Any matching deny wins.
2. At least one allow and no deny permits the operation.
3. No matching policy produces `undefined`, which guarded runtime operations treat as denied.

`security.strict_mode` applies only when the context is incomplete because either the actor or scope is missing. Runtime v0.3.32a boots with strict mode on. Disable it only when legacy or transitional code must retain permissive handling for an incomplete context:

```yaml
# .wippy.yaml
security:
  strict_mode: false
```

| Context | `strict_mode: false` | `strict_mode: true` |
|---------|----------------------|---------------------|
| Actor and scope present | Evaluate policies; only `allow` permits access | Same |
| Actor or scope missing | Permit the guarded operation | Deny the guarded operation |

Keep strict mode enabled in deployments that must fail closed, and ensure services start with the actor and scope their work requires. Disabling strict mode does not turn a complete scope's `undefined` result into an allow.

See the [Security reference](../system/security.md) for policy syntax, actors, scopes, and token stores.

## Lua Isolation

Each Lua actor process owns a Lua state, and function entries execute through pools of isolated states. The runtime opens a restricted base environment rather than the full Lua host environment:

- the ambient libraries are the restricted `table`, `math`, `os`, `coroutine`, `string`, and `errors` libraries plus core globals such as `channel`, `payload`, and `print`;
- `package.path` and `package.cpath` are empty, and `package.loadlib` is disabled;
- registry-backed modules and libraries are visible only to the chunks that declare them through `modules:` or `imports:`;
- `require()` resolves that scoped set and fails for an undeclared registry module.

Consequently, Lua code has no direct host filesystem, socket, native-process, or environment-variable API. It reaches those facilities only through runtime modules such as `fs`, `http_client`, `exec`, and `env`, and their guarded operations still perform policy checks.

An imported library does not leak its imports to its caller. Each library and entrypoint receives its own scoped environment, so a capability used internally by a library is not automatically available to a function that imports the library.

## WASM Isolation

WASM code runs through configured host imports and WASI settings. Environment values and filesystem mounts must be declared on the WASM entry. Before instantiation, the runtime checks `env.get` for each configured environment entry and `fs.get` for each configured mount. Filesystem mounts are re-rooted to the configured filesystem rather than exposing the host root.

WASM socket and outgoing HTTP host functions also perform operation-specific checks such as `socket.connect`, `socket.listen`, `socket.resolve`, and `http_client.request`.

## Capability Acquisition and Use

Many runtime resources are registry entries. Modules acquire those resources by entry ID and check a corresponding action. Examples in v0.3.32a include:

| Operation | Check | Resource |
|-----------|-------|----------|
| Read a registry entry | `registry.get` | Entry ID |
| Call a function | `funcs.call` | Function ID |
| Acquire a SQL database handle | `db.get` | Database entry ID |
| Acquire a filesystem | `fs.get` | Filesystem entry ID |
| Read an environment value | `env.get` | Variable name or ID |
| Spawn a process | `process.spawn` | Process entry ID |
| Select a process host | `process.host` | Host entry ID |

These checks do not all happen at the same granularity. For example, `db.get` authorizes acquisition of a database handle; individual SQL queries through that handle do not repeat `db.get`. Likewise, `fs.get` authorizes acquisition of a filesystem handle rather than applying an ABAC decision to every file operation. Do not pass an acquired handle into a less-trusted context unless that context should retain the handle's authority.

Network modules perform additional checks for each request, connection, or listener where documented. Consult the module reference for the exact action and resource used by an operation.

## Context Inheritance

Actor and scope are inheritable frame-context values. Function calls and spawned processes inherit them unless the caller constructs a replacement context. Explicitly setting an actor or scope for a spawned process requires the `process.security` permission in addition to the applicable spawn permissions.

This inheritance keeps authorization attached to a call chain, but it also means a privileged parent must deliberately narrow the context of work delegated to less-trusted code.

## Registry Mutation

Reading entries and mutating the registry are different permissions. Standard durable changesets require `registry.apply`; at v0.3.32a that check uses an empty resource and is not a per-entry or per-namespace write decision. Do not grant `registry.apply` to an untrusted agent and assume a namespace pattern will confine its writes.

Process-local overlays have a narrower permission surface. They check the overlay owner and operation-specific actions such as `registry.overlay.create.<kind>`, `registry.overlay.update.<kind>`, and `registry.overlay.delete.<kind>` against the affected entry ID. See [Entry Registry](../lua/core/registry.md#process-local-overlays).

## Data Boundaries

Use distinct registry IDs for tenant-specific databases, filesystems, functions, and environment variables, then write policies that allow only the intended IDs. This prevents a context from acquiring another tenant's guarded resource when all access paths use the checked runtime modules.

Environment references keep provider credentials out of source manifests. A provider can resolve a configured `env.variable` internally, but this does not make the value inherently unreadable to application code: code that imports `env` and is allowed `env.get` for the same variable can read it. Protect secrets with both module scoping and policy.

Strict mode is important for multi-tenant deployments because it prevents work with a missing actor or scope from bypassing policy evaluation. It does not infer tenant identity or generate tenant policies; the application must establish the correct actor, scope, resources, and policy coverage.

## Agent and Tool Boundaries

Framework agents compile the tools selected by their definitions and traits. Tool schemas constrain and validate the arguments passed to those tools. Registry-backed tool implementations execute through the `funcs` call path, so `funcs.call` is checked against the target function ID.

The tool list and the policy scope are complementary:

- omitting a tool prevents the model from selecting it through the normal agent tool interface;
- denying `funcs.call` prevents execution even if the tool is present in the compiled list;
- granting `funcs.call` does not add an undeclared tool to the model's list.

Treat tool wrappers and external integrations as additional application code. They do not replace the runtime checks, and their own network credentials and authorization rules still need review.

## Deployment Responsibilities

Wippy's execution and policy boundaries do not replace infrastructure controls:

- storage encryption and backup policy belong to the configured database, disk, or object store;
- VPCs, firewalls, and service policies control network-level reachability;
- authentication establishes the user or service identity before Wippy authorization applies;
- host administration, SSH access, and database-administrator actions require infrastructure audit logging;
- per-tenant CPU and memory quotas require deployment-level resource controls.

OpenTelemetry can trace configured runtime and framework operations, but trace coverage depends on the enabled instrumentation. See [Observability](../guides/observability.md).

## Review Checklist

- Keep `security.strict_mode` enabled where incomplete contexts must fail closed.
- Give every service an intentional actor and scope.
- Review both declared Lua modules/imports and the policies for their guarded operations.
- Keep `registry.apply` away from untrusted code unless full durable-registry mutation is intended.
- Do not share acquired database or filesystem handles across trust boundaries.
- Separate tenant resources by registry ID and test denial outside each tenant's scope.
- Protect environment secrets with both import scoping and `env.get` policies.
- Verify tracing and infrastructure controls independently of runtime authorization.

## See Also

- [Security reference](../system/security.md) — Policies, scopes, actors, strict mode, and token stores
- [Entry Registry](../lua/core/registry.md) — Registry read, mutation, and overlay permissions
- [Process Management](../lua/core/process.md) — Spawn, context, and process security permissions
- [Process Model](./process-model.md) — Process isolation and lifecycle
- [Agents](../framework/agents.md) — Agent definitions and tool selection
