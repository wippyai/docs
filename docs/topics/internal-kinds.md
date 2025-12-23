# Entry Handlers

Entry handlers process registry entries by kind. When entries are added, updated, or deleted, the registry dispatches events to matching handlers.

## How It Works

The registry maintains a map of kind patterns to handlers. When an entry changes:

1. Registry emits event (`entry.create`, `entry.update`, `entry.delete`)
2. Handler registry matches entry kind against registered patterns
3. Matching handlers receive the entry
4. Handlers process or reject the entry

## Kind Patterns

Handlers subscribe using patterns:

| Pattern | Matches |
|---------|---------|
| `http.service` | Exact match only |
| `http.*` | `http.service`, `http.router`, `http.endpoint` |
| `function.*` | `function.lua`, `function.lua.bc` |

## Entry Listener Interface

Handlers implement `registry.EntryListener`:

```go
type EntryListener interface {
    Add(ctx context.Context, entry Entry) error
    Update(ctx context.Context, entry Entry) error
    Delete(ctx context.Context, entry Entry) error
}
```

Returning an error from `Add` rejects the entry.

## Listener vs Observer

| Type | Purpose | Can Reject |
|------|---------|------------|
| Listener | Primary handler | Yes |
| Observer | Secondary handler (logging, metrics) | No |

```go
handlers.RegisterListener("http.*", httpManager)
handlers.RegisterObserver("function.*", metricsCollector)
```

## Registering Handlers

Register handlers during boot:

```go
func MyService() boot.Component {
    return boot.New(boot.P{
        Name:      "myservice",
        DependsOn: []boot.Name{core.RegistryName},
        Load: func(ctx context.Context) (context.Context, error) {
            handlers := bootpkg.GetHandlerRegistry(ctx)
            handlers.RegisterListener("myservice.*", manager)
            return ctx, nil
        },
    })
}
```

## Decoding Entry Data

Use `entry.DecodeEntryConfig` to unmarshal entry data:

```go
func (m *Manager) Add(ctx context.Context, ent registry.Entry) error {
    cfg, err := entry.DecodeEntryConfig[ComponentConfig](ctx, m.dtt, ent)
    if err != nil {
        return err
    }
    // Process cfg...
    return nil
}
```

The decoder:
1. Unmarshals `entry.Data` into your config struct
2. Populates `ID` and `Meta` from the entry
3. Calls `InitDefaults()` if implemented
4. Calls `Validate()` if implemented

## Config Structure

Entry configs typically include:

```go
type ComponentConfig struct {
    ID      registry.ID `json:"id"`
    Meta    attrs.Bag   `json:"meta"`
    Name    string      `json:"name"`
    Timeout int         `json:"timeout,omitempty"`
}

func (c *ComponentConfig) InitDefaults() {
    if c.Timeout == 0 {
        c.Timeout = 30
    }
}

func (c *ComponentConfig) Validate() error {
    if c.Name == "" {
        return fmt.Errorf("name is required")
    }
    return nil
}
```

## Transaction Support

For atomic operations across multiple entries, implement `TransactionListener`:

```go
type TransactionListener interface {
    Begin(ctx context.Context)
    Commit(ctx context.Context)
    Discard(ctx context.Context)
}
```

The registry calls `Begin` before processing a batch, then `Commit` on success or `Discard` on failure.

## See Also

- [Registry](internal-registry.md) - Entry storage
- [Architecture](internal-architecture.md) - Boot sequence
