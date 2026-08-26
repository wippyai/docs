---
title: "Security Model: Process Isolation, Capability Control, and Data Boundaries"
description: How Wippy isolates processes and controls access to registry capabilities, data, tools, and tenant resources.
---

# Security Model

Wippy applies security at two layers. Process isolation limits the capabilities present in an execution environment, while attribute-based policies govern access to registry capabilities. Application security depends on both layers.

## Trust Model

Wippy's isolation layer gives a process no ambient authority. A new Lua or WASM process cannot access the file system, network, host OS, or another process's memory unless the corresponding capability is present in its environment. Capabilities are granted through registry entries such as functions, tools, connections, and configuration.

Registry capabilities are governed by attribute-based access control (ABAC). Guarded operations are checked against the current actor's security scope: policies that allow or deny actions on resources, optionally based on actor and resource metadata. These policies are defined in configuration rather than application code.

When a process runs with both an actor and a scope, access is deny-by-default: a request is allowed only if a policy explicitly permits it and none denies it. **Strict mode** (off by default, enabled via `security.strict_mode`) governs the incomplete case, when no actor or scope is established: strict mode denies it, the permissive default allows it. Production deployments turn strict mode on so that an unauthenticated context fails closed. Combined with least-privilege policies, strict mode gives you fail-closed authorization on top of deny-by-absence isolation. See the [Security reference](system/security.md) for policy syntax and evaluation rules.

## Process Isolation

Every unit of execution in Wippy runs in an isolated process with its own embedded interpreter (Lua or WASM).

**What a process has:** its own memory space (a baseline overhead of ~13 KB for Lua). A scoped view of the registry. An actor identity and a security scope. A supervised lifecycle with crash recovery and restart limits.

**What a process does not have:** access to the file system (except through registry-controlled filesystem entries). Access to the network (except through granted HTTP client or tool modules). Access to other processes' memory. Access to the Go runtime hosting it. Access to environment variables (except through granted environment entries).

**How isolation is enforced:** each Lua process starts from a minimal standard library. File I/O, OS process access, dynamic code loading, and networking are never loaded, so they are not present in the environment, and the process cannot restore what does not exist. Module loading is restricted: `require` resolves only the modules and registry entries the process is explicitly granted, with no file system search path. WASM processes achieve equivalent isolation through WASI: only the host functions and mounted filesystem entries configured for that entry are reachable.

This isolation is based on capability absence rather than operating-system permission filters such as seccomp or AppArmor. Capabilities that are not loaded are unavailable to the process.

## Capability Control

The registry is Wippy's capability store, and security policies are its authorization layer.

**Every capability is a registry entry.** Functions, tools, agent definitions, database connections, environment references, configuration values, and scheduled tasks have a declared kind, schema, and metadata. Their kind handlers validate them during registration.

**Entry IDs are namespaced.** An ID has the form `namespace:name` with a single colon, and namespaces are hierarchical via dot-separated segments, for example `tenant_acme.tools:read` (namespace `tenant_acme.tools`, name `read`). Policies match actions and resources, and resource patterns can target a namespace prefix, so a single rule can cover an entire namespace.

**Policies decide access.** Each capability access (a registry lookup, a function call, a database handle, a file open) is checked against the actor's scope. A policy declares the actions and resources it covers, an allow or deny effect, and optional conditions on actor and resource metadata. Evaluation happens per access, not once at startup: if any policy denies, access is denied; if at least one allows and none denies, it is allowed; if no policy matches, access is denied. (When the context has no actor or scope at all, that incomplete case is resolved by strict mode rather than by policy evaluation.)

**Tool arguments follow a schema.** A tool declares a JSON Schema for its inputs. The model receives that schema when generating arguments, and policy checks run before the tool call.

## Data Boundaries

**Database connections are registry entries.** A process does not assemble its own connection string. It requests a connection by registry ID, and that request is policy-checked before a handle is returned. A process whose policies do not grant Tenant B's database entry cannot obtain a handle to it.

**LLM API keys live in the environment system.** Keys for Claude, GPT, and other providers are read from the environment system (for example OS environment variables exposed through an `env.storage.os` entry, referenced by `env.variable` entries whose reads are policy-checked via the `env.get` action). The provider reads them internally; they are not passed in process arguments or returned to calling code.

**File and blob storage follow the same model.** A process reads or writes through filesystem or cloud-storage registry entries, each access policy-checked. WASM processes access files only through filesystem entries explicitly mounted for that entry.

## Agent Security

Agents are LLM-powered processes that can use tools. Wippy applies the same registry and policy mechanisms to agents as it does to other processes.

**Tool access.** An agent can only invoke tools listed in its definition, and each tool execution runs through `funcs.call`, which is policy-checked. A denied call fails before the tool function runs. An agent designed to read customer data but not delete it either has no delete tool in its definition or is denied that action by policy.

**External and MCP tools.** Wippy can consume external tools and expose its own over the Model Context Protocol. Consumed tools run through the same function-call path and policy checks as native tools. Tools Wippy exposes to external MCP clients are gated by scoped, revocable access tokens that limit which actions a client may perform.

**Structured output.** The LLM module can request schema-constrained (structured) output using the provider's native structured-output support, so an agent's output can be held to a declared shape.

**Observability.** With OpenTelemetry enabled, LLM provider calls and tool invocations are traced, and the usage-tracker contract records token usage. See [Observability](guides/observability.md).

**Self-modification boundaries.** An agent permitted to create tools in one namespace can be denied write access to its own definition in another. Registry writes are policy-checked actions, so a deny policy on the agent's own namespace prevents it from editing itself or granting itself new access.

## Multi-Tenant Enforcement

When multiple customers share a Wippy instance, policies can enforce tenant boundaries before guarded operations run instead of relying only on application-level tenant checks.

**Tenant isolation is policy-enforced.** Give each tenant an actor and a scope whose policies cover only that tenant's namespaces. With strict mode enabled, access outside that scope is denied. Effective isolation depends on defining correct per-tenant policies; the runtime enforces them but does not infer tenancy.

**Cross-tenant access is explicit.** A capability shared across tenants lives in a shared namespace that each tenant's policies allow. Sharing is opt-in per namespace.

**Concurrency is bounded at the host.** Process hosts limit concurrency through worker pools. Process groups (`pg.scope`) provide isolated, cluster-wide membership and broadcast namespaces and can cap group and member counts. Per-tenant CPU and memory ceilings remain an infrastructure responsibility.

A dedicated Multi-Tenant Architecture guide is planned.

## Scope and Limitations

Wippy's security model covers process isolation, capability control, and data boundaries. The following concerns remain the responsibility of deployment infrastructure.

**Data encryption at rest.** Database, disk, and blob-storage encryption are handled by the underlying infrastructure (PostgreSQL TDE, disk encryption, and similar). Wippy assumes the storage layer handles encryption.

**Network-level isolation.** Process isolation happens at the application layer. Network segmentation between Wippy and its dependencies (database, LLM APIs, external services) is handled by infrastructure: VPCs, security groups, firewalls.

**Identity management.** Authentication (verifying who a user is) is handled by your auth layer. Wippy's security model starts after authentication: it controls what an authenticated user's processes can do, not who the user is. Tokens that carry an actor and scope can be issued and validated through a token store.

**Infrastructure audit logs.** Wippy's tracing covers process-level operations: function calls, tool calls, process activity. Infrastructure-level access (SSH to the server, database admin operations) should be audited by infrastructure tools.

## Common Questions

**Can one tenant's agent access another tenant's data?**
Per-tenant policies and strict mode deny guarded access outside the tenant's configured scope. Isolation therefore depends on defining the tenant resources and policies correctly.

**Can an agent escalate its own permissions?**
Only if its policies allow writing to its own definition. Registry writes are policy-checked, so a deny policy on the agent's own namespace prevents self-modification. An agent that can create tools in one namespace cannot grant itself access to namespaces its scope does not already cover.

**How do I see what an agent did?**
With OpenTelemetry enabled, LLM and tool calls are traced, and token usage is recorded through the usage-tracker contract. See [Observability](guides/observability.md).

**What happens if an agent behaves unexpectedly?**
The agent remains limited to the capabilities loaded into its process and the tools allowed by its definition and policy. Tool-call visibility depends on the configured tracing and logging.

**Is tenant isolation enforced by my code or by the runtime?**
The runtime evaluates policies for guarded operations. The application and deployment must define the actors, scopes, resources, and per-tenant policies that the runtime enforces.

**How are external MCP tools secured?**
Tools consumed over MCP run through the same function-call path and policy checks as native tools. Tools Wippy exposes to external MCP clients are gated by scoped, revocable access tokens. Connecting an MCP service does not bypass the security model.

## Security Reference

| Concern | Wippy's approach |
|---------|------------------|
| Process isolation | Separate interpreter per process (Lua or WASM), no shared memory |
| Default access | Unmatched policies deny when both an actor and a scope are set; strict mode additionally denies when no actor or scope is established. Use least-privilege policies plus strict mode for fail-closed authorization. |
| Capability control | Registry entries governed by attribute-based security policies (actor, scope, action, resource) |
| Data boundaries | Connections and storage are registry entries; each access is policy-checked by entry ID |
| API key management | Stored in the environment system, read internally by providers, not exposed to process code |
| Agent tool control | Tools limited to the agent's definition; each call checked via `funcs.call` policy |
| External tools (MCP) | Same function-call path and policy checks; exposed tools gated by scoped tokens |
| Agent audit trail | OpenTelemetry tracing (when enabled) plus usage-tracker records |
| Multi-tenant isolation | Per-tenant policies and scopes evaluated by the runtime before each operation |
| Concurrency limits | Bounded by host worker pools; no per-tenant CPU/memory ceilings built in |
| Self-modification | Deny policies on registry-write actions prevent agents from editing their own definitions |

## See Also

- [Security reference](system/security.md) — Policies, scopes, actors, and token stores
- [Registry](concepts/registry.md) — The capability store
- [Process Model](concepts/process-model.md) — Process isolation and lifecycle
- [Agents](framework/agents.md) — Agent definitions and tool use
