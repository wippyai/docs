---
title: "Language Server"
description: "Configure Wippy's built-in Language Server Protocol server for Lua editor features over TCP or HTTP."
---

# Language Server

Wippy includes a Language Server Protocol (LSP) server for Lua editor features. It runs as part of the Wippy runtime and accepts editor connections over TCP or HTTP.

## Features

- Code completion with type-aware suggestions
- Hover information showing types and signatures
- Go to definition
- Find references
- Document and workspace symbols
- Call hierarchy (incoming and outgoing calls)
- Pull diagnostics for type errors in the current editor overlay after successful parsing
- Signature help for function parameters

## Configuration

Enable the LSP server in `.wippy.yaml`:

```yaml
lsp:
  enabled: true
  address: ":7777"
```

### Configuration Fields

| Field | Default | Description |
|-------|---------|-------------|
| `enabled` | false | Enable the LSP service and TCP server |
| `address` | :7777 | TCP listen address |
| `http_enabled` | false | Enable the HTTP transport |
| `http_address` | :7778 | HTTP listen address |
| `http_path` | /lsp | HTTP endpoint path |
| `http_allow_origin` | * | CORS allowed origin |
| `max_message_bytes` | 8388608 | Max incoming message size (bytes) |

### TCP Transport

The TCP server speaks JSON-RPC 2.0 with standard LSP message framing (Content-Length headers). This is the primary transport for editor integrations.

### HTTP Transport

The HTTP transport accepts POST requests with JSON-RPC payloads. It supports browser-based editors and web tools, answers CORS preflight `OPTIONS` requests, and includes CORS headers for cross-origin access.

```yaml
lsp:
  enabled: true
  http_enabled: true
  http_address: ":7778"
  http_path: "/lsp"
  http_allow_origin: "*"
```

## Document URI Scheme

The LSP server uses the `wippy://` URI scheme to identify registry entries:

```
wippy://namespace:entry_name
```

Editors map these URIs to entry IDs in the registry. Both `wippy://` scheme and raw `namespace:entry_name` formats are accepted.

## Indexing

The LSP server maintains an index of code entries. Multiple workers update the index in the background.

Key behaviors:

- Entries are indexed in dependency order (dependencies first)
- Changes trigger re-indexing of affected entries
- Unsaved editor changes are stored in an overlay
- Indexing is incremental; only changed entries are reprocessed

## Supported LSP Methods

| Method | Description |
|--------|-------------|
| `initialize` | Capability negotiation |
| `initialized` | Initialization-complete notification |
| `shutdown` | Shut down the protocol session |
| `exit` | Exit notification |
| `textDocument/didOpen` | Track opened documents |
| `textDocument/didChange` | Full document sync |
| `textDocument/didClose` | Release documents |
| `textDocument/hover` | Type info at cursor |
| `textDocument/definition` | Jump to definition |
| `textDocument/references` | Find all references |
| `textDocument/completion` | Code completion |
| `textDocument/signatureHelp` | Function signatures |
| `textDocument/diagnostic` | File diagnostics |
| `textDocument/documentSymbol` | File symbols |
| `workspace/symbol` | Global symbol search |
| `textDocument/prepareCallHierarchy` | Call hierarchy |
| `callHierarchy/incomingCalls` | Find callers |
| `callHierarchy/outgoingCalls` | Find callees |

## Completion

The completion engine resolves types through the code graph. It provides:

- Member completion after `.` and `:` (fields, methods)
- Local variable completion
- Module-level symbol completion
- Trigger characters: `.`, `:`

## Diagnostics

After a document parses successfully, indexing stores type-checking diagnostics such as mismatches and undefined symbols. Diagnostics use the standard error, warning, information, and hint severities.

Full-document change notifications update the overlay used for diagnostics. Clients retrieve the current stored result with `textDocument/diagnostic`; this server does not push `textDocument/publishDiagnostics` notifications. A parse failure aborts re-indexing before new diagnostics are stored, so the pull result does not report that syntax error and can retain the previous successful result.

## See Also

- [Linter](./linter.md) — CLI-based code checking
- [Types](../lua/types.md) — Type-system documentation
- [Configuration](./configuration.md) — Runtime configuration
