# Entry-Handler

Entry-Handler verarbeiten Registry-Einträge nach Kind. Wenn Einträge hinzugefügt, aktualisiert oder gelöscht werden, dispatcht die Registry Events an passende Handler.

## Funktionsweise

Die Registry pflegt eine Map von Kind-Patterns zu Handlern. Wenn ein Eintrag sich ändert:

1. Registry emittiert Event (`entry.create`, `entry.update`, `entry.delete`)
2. Handler-Registry matched Entry-Kind gegen registrierte Patterns
3. Passende Handler erhalten den Eintrag
4. Handler verarbeiten oder lehnen den Eintrag ab

## Kind-Patterns

Handler subscriben mit Patterns:

| Pattern | Matched |
|---------|---------|
| `http.service` | Nur exakter Match |
| `http.*` | `http.service`, `http.router`, `http.endpoint` |
| `function.*` | `function.lua`, `function.lua.bc` |

## EntryListener-Interface

Handler implementieren `registry.EntryListener`:

```go
type EntryListener interface {
    Add(ctx context.Context, entry Entry) error
    Update(ctx context.Context, entry Entry) error
    Delete(ctx context.Context, entry Entry) error
}
```

Fehler-Rückgabe von `Add` lehnt den Eintrag ab.

## Listener vs Observer

| Typ | Zweck | Kann ablehnen |
|-----|-------|---------------|
| Listener | Primärer Handler | Ja |
| Observer | Sekundärer Handler (Logging, Metriken) | Nein |

```go
handlers.RegisterListener("http.*", httpManager)
handlers.RegisterObserver("function.*", metricsCollector)
```

## Handler registrieren

Handler während Boot registrieren:

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

## Entry-Daten dekodieren

Verwenden Sie `entry.DecodeEntryConfig` um Entry-Daten zu unmarshallen:

```go
func (m *Manager) Add(ctx context.Context, ent registry.Entry) error {
    cfg, err := entry.DecodeEntryConfig[ComponentConfig](ctx, m.dtt, ent)
    if err != nil {
        return err
    }
    // cfg verarbeiten...
    return nil
}
```

Der Decoder:
1. Unmarshalled `entry.Data` in Ihre Config-Struct
2. Befüllt `ID` und `Meta` aus dem Entry
3. Ruft `InitDefaults()` auf wenn implementiert
4. Ruft `Validate()` auf wenn implementiert

## Config-Struktur

Entry-Configs beinhalten typischerweise:

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

## Transaktions-Support

Für atomare Operationen über mehrere Einträge implementieren Sie `TransactionListener`:

```go
type TransactionListener interface {
    Begin(ctx context.Context)
    Commit(ctx context.Context)
    Discard(ctx context.Context)
}
```

Die Registry ruft `Begin` vor Verarbeitung eines Batches auf, dann `Commit` bei Erfolg oder `Discard` bei Fehler.

## Siehe auch

- [Registry](internal-registry.md) - Entry-Speicherung
- [Architektur](internal-architecture.md) - Boot-Sequenz
