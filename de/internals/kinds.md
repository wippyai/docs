---
title: "Entry-Listener und -Observer"
description: "Wie Listener und Observer Registry-Mutationen für passende Entry-Kind-Muster verarbeiten."
---

# Entry-Listener und -Observer

Entry-Listener und -Observer verarbeiten Registry-Mutationen für passende Entry-Kind-Muster.

Diese Seite ist eine Go-Erweiterungsreferenz. Die Ausschnitte für Registrierung und Konfiguration setzen eine vorhandene Boot-Komponente, einen Manager, einen Transcoder und einen Anwendungskonfigurationstyp voraus.

## Funktionsweise

Boot sammelt Listener und Observer samt ihren Kind-Mustern. Wenn sich ein Eintrag ändert:

1. Registry emittiert Event (`entry.create`, `entry.update`, `entry.delete`)
2. Jeder Listener-Wrapper gleicht den Entry-Kind mit seinem registrierten Muster ab
3. Passende Handler erhalten den Eintrag
4. Handler verarbeiten oder lehnen den Eintrag ab

## Kind-Patterns

Handler subscriben mit Patterns:

| Muster | Treffer |
|---------|---------|
| `http.service` | Nur exakter Match |
| `http.*` | `http.service`, `http.router`, `http.endpoint` |
| `function.**` | `function.lua`, `function.lua.bc` |

## EntryListener-Interface

Handler implementieren `registry.EntryListener`:

```go
type EntryListener interface {
    Add(ctx context.Context, entry Entry) error
    Update(ctx context.Context, entry Entry) error
    Delete(ctx context.Context, entry Entry) error
}
```

Gibt `Add`, `Update` oder `Delete` einen Fehler zurück, wird die jeweilige Operation abgelehnt.

## Listener vs Observer

| Typ | Zweck | Kann ablehnen |
|-----|-------|---------------|
| Listener | Primärer Handler | Ja |
| Observer | Sekundärer Handler (Logging, Metriken) | Nein |

```go
handlers.RegisterListener("http.*", httpManager)
handlers.RegisterObserver("function.*", metricsCollector)
```

Fehler eines Observers aus `Add`, `Update` und `Delete` werden ignoriert und erzeugen weder ein Accept- noch ein Reject-Event. Implementiert ein Listener oder Observer zusätzlich `TransactionListener`, nimmt er an Transaktionsbarrieren teil. Ein Fehler aus `Begin`, `Commit` oder `Discard` lehnt die jeweilige Transaktionsphase ab.

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

Verwenden Sie `entry.DecodeEntryConfig` aus `github.com/wippyai/runtime/system/entry`, um Entry-Daten zu dekodieren. Das Paket kann auch von Erweiterungen außerhalb des Runtime-Baums importiert werden:

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

Der Decoder:

1. Löst moderne `${env:...}`-Platzhalter in den Entry-Daten auf.
2. Dekodiert die aufgelösten Daten in Ihre Konfigurationsstruktur.
3. Übernimmt `ID` und `Meta` aus dem Eintrag, wenn die dekodierten Felder null beziehungsweise `nil` sind.
4. Ruft, sofern implementiert, `InitDefaults()` auf.
5. Löst ältere `*_env`-Felder über die Environment-Registry auf.
6. Ruft, sofern implementiert, `Validate()` auf.

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
    Begin(ctx context.Context) error
    Commit(ctx context.Context) error
    Discard(ctx context.Context) error
}
```

Die Registry ruft `Begin` vor Verarbeitung eines Batches auf, dann `Commit` bei Erfolg oder `Discard` bei Fehler.

## Siehe auch

- [Registry](internals/registry.md) – Speicherung von Einträgen
- [Architektur](internals/architecture.md) – Boot-Sequenz
