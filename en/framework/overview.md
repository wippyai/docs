---
title: "Framework"
description: "Install, declare, and import official Wippy framework modules published through the Hub."
---

# Framework

Official framework modules are published through the Wippy Hub under the `wippy` organization.

## Adding Framework Modules

```bash
wippy add wippy/test
wippy install
```

This adds the module to your lock file and downloads it to `.wippy/vendor/`.

## Declaring Dependencies in Source

Framework modules can also be declared as dependencies in your `_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dependency.test
    kind: ns.dependency
    component: wippy/test
    version: "^0.4.0"
```

Then resolve and install:

```bash
wippy update
```

## Importing Framework Libraries

Once installed, import framework libraries into your entries:

```yaml
entries:
  - name: my_test
    kind: function.lua
    meta:
      type: test
      suite: my-suite
    source: file://my_test.lua
    method: run
    imports:
      test: wippy.test:test
```

The import maps `wippy.test:test` (the `test` entry from the `wippy.test` namespace) to the local name `test`, which you then `require("test")` in Lua.

## Available Modules

| Module | Description |
|--------|-------------|
| `wippy/llm` | Unified LLM interface with generation, streaming, tool calling, structured output |
| `wippy/agent` | Agent framework with tools, delegates, traits, and memory |
| `wippy/embeddings` | Vector embeddings storage and similarity search |
| `wippy/test` | BDD-style testing framework with assertions and mocking |
| `wippy/dataflow` | Workflow orchestration with DAG-based node execution |
| `wippy/relay` | WebSocket relay with per-user hubs and plugin routing |
| `wippy/views` | Virtual page/component system with template rendering |
| `wippy/facade` | Frontend host configuration, theming, and config endpoint |
| `wippy/terminal` | Terminal UI components |
| `wippy/migration` | Database schema migrations |
| `wippy/security` | Actor scopes, policy bundles, and security helpers |
| `wippy/usage` | Token and cost usage accounting for LLM calls |

Search the Hub for the current module catalog:

```bash
wippy search wippy
```

## See Also

- [Dependency Management](../guides/dependency-management.md) — Lock files and version constraints
- [Publishing](../guides/publishing.md) — Publish a module
- [CLI Reference](../guides/cli.md) — Module-management commands
