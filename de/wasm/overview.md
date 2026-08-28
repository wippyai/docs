---
title: "WebAssembly-Runtime"
description: "WAT- und WASM-Funktionen oder WASM-Prozesse neben Lua über Registry-Einträge ausführen."
---

# WebAssembly-Runtime

> Die WASM-Runtime ist eine experimentelle Erweiterung. Die Konfiguration ist stabil, aber die Interna der Runtime können sich zwischen Releases ändern.

Wippy registriert WebAssembly-Module neben Lua-Code. Funktionseinträge werden in die Funktions-Registry aufgenommen und über Funktions-Pools ausgeführt; Prozesseinträge registrieren Prozess-Factories und laufen unter Process Hosts. Beide verwenden den Scheduler und das Sicherheitsmodell der Runtime.

**Klassifizierung: konzeptionelle Übersicht.** Der Lua-Block enthält unabhängige
Aufrufmuster und setzt voraus, dass die genannten WASM-Einträge und ihre WIT-Verträge
bereits registriert sind. Das Rust/WASM-Tutorial zeigt ein Projekt mit einer kompilierten Komponente.

## Eintragsarten

| Art | Beschreibung |
|-----|--------------|
| `function.wat` | In YAML definierte Inline-Funktion im WebAssembly-Textformat |
| `function.wasm` | Vorkompiliertes WASM-Binary, das aus einem Dateisystemeintrag geladen wird |
| `process.wasm` | Als Prozess ausgeführtes WASM-Binary (CLI-Befehl oder langlebiger Prozess) |

## Funktionsweise

1. WASM-Module werden in `_index.yaml` als Registry-Einträge deklariert
2. Beim Start werden `function.wat`- und `function.wasm`-Einträge kompiliert, als Funktionen registriert und in ihre konfigurierten Funktions-Pools aufgenommen
3. Lua ruft diese Funktionseinträge über `funcs.call()` auf
4. `process.wasm`-Einträge registrieren stattdessen Prozess-Factories und werden unter einem Process Host gestartet
5. Funktionsargumente und Rückgabewerte werden zwischen Lua-Tabellen und WIT-Typen abgebildet
6. Unterstützte, über den Dispatcher vermittelte Operationen wie Clock-Polling und ausgehende HTTP-Anfragen yielden, damit der Scheduler andere Arbeit ausführen kann

## Component Model

Wippy unterstützt das WebAssembly Component Model mit WIT (WebAssembly Interface Types). Komponentenmodule bilden diese Typen zwischen Host und Gast ab:

- Records werden zu Lua-Tabellen mit benannten Feldern
- Lists werden zu Lua-Arrays
- Results werden zu `(value, error)`-Rückgabetupeln
- Primitive (`s32`, `f64`, `string` usw.) werden direkt abgebildet

Raw/Core-WASM-Module werden ebenfalls mit expliziten WIT-Signaturen unterstützt.

## WASM aus Lua aufrufen

Rufen Sie eine WASM-Funktion über ihre Registry-ID mit `funcs.call()` auf:

```lua
local funcs = require("funcs")

-- No arguments
local result, err = funcs.call("myns:answer_wat")
if err then return nil, err end

-- With arguments
local computed, compute_err = funcs.call("myns:compute", 6, 7)
if compute_err then return nil, compute_err end

-- With complex data
local users = {
    {id = 1, name = "Alice", tags = {"admin"}, active = true},
    {id = 2, name = "Bob", tags = {"user"}, active = false},
}
local transformed, err = funcs.call("myns:transform_users", users)
if err then return nil, err end
```

## Sicherheit

WASM-Ausführungen erben standardmäßig den Sicherheitskontext des Aufrufers:

- Die Actor-Identität wird übernommen
- Der Scope wird übernommen
- Der Request-Kontext wird übernommen

Host-Fähigkeiten werden durch explizite Imports einzeln aktiviert. Jeder Eintrag deklariert die benötigten Host-Profile, etwa `funcs`, `wasi1`, `wasi:cli` oder `wasi:filesystem`, und begrenzt damit die Zugriffsfläche des Moduls. Das Aktivieren eines Profils umgeht keine Sicherheitsprüfungen der Runtime für Operationen wie Funktionsaufrufe, Sockets oder ausgehende HTTP-Anfragen.

## Siehe auch

- [Funktionen](wasm/functions.md) - Konfiguration von WASM-Funktionseinträgen
- [Host-Funktionen](wasm/hosts.md) - Verfügbare WASI- und Wippy-Host-Schnittstellen
- [Prozesse](wasm/processes.md) - WASM als langlebige Prozesse ausführen
- [Rust/WASM-Tutorial](../tutorials/rust-wasm.md) - Eine Komponente bauen und registrieren
