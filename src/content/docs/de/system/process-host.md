---
title: "Process Host"
---

# Process Host

Process Hosts verwalten die Ausführung von Lua-Prozessen mit einem Work-Stealing-Scheduler.

<note>
Jeder Host plant Prozesse unabhängig voneinander. Die Last wird nicht automatisch zwischen Hosts verteilt.
</note>

## Entry-Typ

| Kind | Beschreibung |
|------|--------------|
| `process.host` | Prozessausführungs-Host mit Scheduler |

## Konfiguration

```yaml
- name: main_host
  kind: process.host
  host:
    workers: 8
    queue_size: 1024
    local_queue_size: 256
  lifecycle:
    auto_start: true
```

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `workers` | int | NumCPU | Worker-Goroutinen |
| `queue_size` | int | 1024 | Globale Queue-Kapazität |
| `local_queue_size` | int | 256 | Pro-Worker lokale Deque-Größe |

## Scheduler

Der Scheduler verwendet Work-Stealing: Jeder Worker hat eine lokale Deque, und untätige Worker stehlen aus der globalen Queue oder von anderen Workern. Dies balanciert die Last automatisch aus.

- **Workers** führen Prozesse nebenläufig aus
- **Globale Queue** hält ausstehende Prozesse wenn alle Worker beschäftigt sind
- **Lokale Queues** reduzieren Konflikte indem sie Arbeit nah bei den Workern halten

## Prozesstypen

Process Hosts führen Einträge dieser Typen aus:

| Kind | Beschreibung |
|------|--------------|
| `process.lua` | Quellbasierter Lua-Prozess |
| `process.lua.bc` | Vorkompilierter Lua-Bytecode |
| `process.wasm` | WebAssembly-Prozess (experimentell) |

Prozesse laufen unabhängig mit eigenem Kontext, kommunizieren über Nachrichten und werden für Fehlertoleranz überwacht.

## Siehe auch

- [Prozess-Modul](lua/core/process.md) - Prozesse aus Lua starten und verwalten
- [WASM-Prozesse](wasm/processes.md) - Konfiguration von `process.wasm`-Einträgen
- [Prozessmodell](concepts/process-model.md) - Konzepte zu Lebenszyklus und Supervision
- [Supervision](guides/supervision.md) - Aufbau von Supervision-Bäumen
