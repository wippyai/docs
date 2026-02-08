# Language Server

Wippy includes a built-in LSP (Language Server Protocol) server that provides IDE features for Lua code. The server runs as part of the Wippy runtime and connects to editors via TCP or HTTP.

## Features

- Code completion with type-aware suggestions
- Hover information showing types and signatures
- Go to definition
- Find references
- Document and workspace symbols
- Call hierarchy (incoming and outgoing calls)
- Real-time diagnostics (parse errors, type errors)
- Signature help for function parameters

## Configuration

Enable the LSP server in `.wippy.yaml`:

```yaml
version: "1.0"

lua:
  type_system:
    enabled: true

lsp:
  enabled: true
  address: ":7777"
```

### Configuration Fields

| Field | Default | Description |
|-------|---------|-------------|
| `enabled` | false | Enable the TCP server |
| `address` | :7777 | TCP listen address |
| `http_enabled` | false | Enable the HTTP transport |
| `http_address` | :7778 | HTTP listen address |
| `http_path` | /lsp | HTTP endpoint path |
| `http_allow_origin` | * | CORS allowed origin |
| `max_message_bytes` | 8388608 | Max incoming message size (bytes) |

### TCP Transport

The TCP server speaks JSON-RPC 2.0 with standard LSP message framing (Content-Length headers). This is the primary transport for editor integrations.

### HTTP Transport

The HTTP transport accepts POST requests with JSON-RPC payloads. Useful for browser-based editors and web tools. CORS headers are included for cross-origin access.

```yaml
lsp:
  enabled: true
  http_enabled: true
  http_address: ":7778"
  http_path: "/lsp"
  http_allow_origin: "*"
```

## VS Code Setup

### Using the Wippy Lua Extension

1. Install the `wippy-lua` extension from the VS Code marketplace (or build from source)
2. Start the Wippy runtime with LSP enabled:

```bash
wippy run
```

3. The extension connects to `127.0.0.1:7777` by default.

### Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `wippyLua.lsp.enabled` | true | Enable LSP client |
| `wippyLua.lsp.host` | 127.0.0.1 | LSP server host |
| `wippyLua.lsp.port` | 7777 | TCP port |
| `wippyLua.lsp.httpPort` | 7778 | HTTP transport port |
| `wippyLua.lsp.mode` | tcp | Connection mode (tcp, http) |

## Document URI Scheme

The LSP server uses the `wippy://` URI scheme to identify registry entries:

```
wippy://namespace:entry_name
```

Editors map these URIs to entry IDs in the registry. Both `wippy://` scheme and raw `namespace:entry_name` formats are accepted.

## Indexing

The LSP server maintains an index of all code entries for fast lookups. Indexing happens in the background using multiple workers.

Key behaviors:

- Entries are indexed in dependency order (dependencies first)
- Changes trigger re-indexing of affected entries
- Unsaved editor changes are stored in an overlay
- Index is incremental - only changed entries are re-processed

## Supported LSP Methods

| Method | Description |
|--------|-------------|
| `initialize` | Capability negotiation |
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

Diagnostics are computed during indexing and include:

- Parse errors (syntax problems)
- Type checking errors (mismatches, undefined symbols)
- Severity levels: error, warning, information, hint

Diagnostics update as you type through the document overlay system.

## See Also

- [Linter](guides/linter.md) - CLI-based code checking
- [Types](lua/types.md) - Type system documentation
- [Configuration](guides/configuration.md) - Runtime configuration
