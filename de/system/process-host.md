---
title: "Process Host"
description: "Process Hosts verwalten die Ausführung von Lua- und WebAssembly-Prozessen mit einem Work-Stealing-Scheduler."
---

# Process Host

Ein `process.host` führt Lua- und WebAssembly-Prozesse auf einem Work-Stealing-Scheduler aus. Diese Seite ist eine Konfigurations- und Lebenszyklusreferenz; der YAML-Block ist ein Entry-Fragment.

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
| `queue_size` | int | 1024 | Anfängliche Kapazität der globalen Queue |
| `local_queue_size` | int | 256 | Anfängliche Kapazität der lokalen Deque pro Worker |

Beide Queues wachsen, wenn ihre anfängliche Kapazität erschöpft ist. Nach Anwendung der Standardwerte müssen die Werte positiv sein. Die globale Queue erzwingt eine effektive Anfangskapazität von mindestens 16; jede lokale Deque rundet ihre Kapazität auf eine Zweierpotenz auf.

## Lebenszyklus

Ein Process Host ist ein vom Supervisor verwalteter Dienst. `lifecycle.auto_start` ist standardmäßig `false`; ein nicht gestarteter Host lehnt Process-Spawns ab. Die üblichen Lebenszyklusfelder gelten ebenfalls, darunter `requires`, `startup`, `start_timeout`, `stop_timeout`, `stable_threshold`, `restart` und `security`.

Das Stoppen eines Hosts beendet diese Host-Instanz endgültig. Der Scheduler sendet jedem Prozess ein Abbruchereignis, wartet bis zum Ablauf des Stop-Kontexts auf deren Abschluss und bricht anschließend alle verbleibenden Prozesse ab und schließt sie.

Live-Updates können `host.workers` skalieren. Änderungen an Queue-Größen oder der Lebenszykluskonfiguration werden abgelehnt und erfordern einen Austausch des Hosts. Wenn CPU-Affinität den Worker-Pool verwaltet, kann auch die Worker-Anzahl nicht live geändert werden.

## Scheduler

Der Scheduler verwendet Work-Stealing: Jeder Worker hat eine lokale Deque, und untätige Worker stehlen aus der globalen Queue oder von anderen Workern. Dies balanciert die Last automatisch aus.

- **Workers** führen Prozesse nebenläufig aus.
- **Globale Queue** hält ausstehende Prozesse, wenn alle Worker beschäftigt sind.
- **Lokale Queues** reduzieren Konflikte, indem sie Arbeit in der Nähe der Worker halten.

## Prozesstypen

Process Hosts führen Einträge dieser Typen aus:

| Kind | Beschreibung |
|------|--------------|
| `process.lua` | Quellbasierter Lua-Prozess |
| `process.lua.bc` | Vorkompilierter Lua-Bytecode |
| `process.wasm` | WebAssembly-Prozess (experimentell) |

Prozesse laufen unabhängig mit ihrem eigenen Frame-Kontext und kommunizieren über Nachrichten. Die auf dem Process-Eintrag konfigurierte Sicherheit wird vor der Ausführung auf dessen Frame angewendet. Monitore, Links und Anwendungs-Supervisor können auf Fehler reagieren; der Process Host startet nicht jeden fehlgeschlagenen Prozess automatisch neu.

## Siehe auch

- [Prozess-Modul](../lua/core/process.md) - Prozesse aus Lua starten und verwalten
- [WASM-Prozesse](../wasm/processes.md) - Konfiguration von `process.wasm`-Einträgen
- [Prozessmodell](../concepts/process-model.md) - Konzepte zu Lebenszyklus und Supervision
- [Supervision](../guides/supervision.md) - Aufbau von Supervision-Bäumen
