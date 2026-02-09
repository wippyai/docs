# WebAssembly-Runtime

> Die WASM-Runtime ist eine experimentelle Erweiterung. Die Konfiguration ist stabil, aber die Runtime-Interna koennen sich zwischen Releases aendern.

Wippy fuehrt WebAssembly-Module als vollwertige Registry-Eintraege neben Lua-Code aus. WASM-Funktionen und -Prozesse werden innerhalb desselben Schedulers ausgefuehrt, teilen dasselbe Sicherheitsmodell und interagieren mit Lua ueber die Funktions-Registry.

## Entry Kinds

| Kind | Beschreibung |
|------|-------------|
| `function.wat` | Inline-WebAssembly-Text-Format-Funktion, definiert in YAML |
| `function.wasm` | Vorkompiliertes WASM-Binary, geladen aus einem Dateisystem-Eintrag |
| `process.wasm` | WASM-Binary, ausgefuehrt als Prozess (CLI-Befehle oder langlebig) |

## Funktionsweise

1. WASM-Module werden als Registry-Eintraege in `_index.yaml` deklariert
2. Beim Start werden Module kompiliert und in Worker-Pools platziert
3. Lua (oder anderer WASM) Code ruft sie ueber `funcs.call()` auf
4. Argumente und Rueckgabewerte werden automatisch zwischen Lua-Tabellen und WIT-Typen abgebildet
5. Asynchrone Operationen (I/O, Sleep, HTTP) yielden ueber den Dispatcher, genau wie Lua

## Component Model

Wippy unterstuetzt das WebAssembly Component Model mit WIT (WebAssembly Interface Types). Component-Module erhalten vollstaendiges Type-Mapping zwischen Host und Guest:

- Records werden auf Lua-Tabellen mit benannten Feldern abgebildet
- Lists werden auf Lua-Arrays abgebildet
- Results werden auf `(value, error)` Rueckgabe-Tupel abgebildet
- Primitive (`s32`, `f64`, `string`, etc.) werden direkt abgebildet

Raw/Core-WASM-Module werden ebenfalls mit expliziten WIT-Signaturen unterstuetzt.

## WASM aus Lua aufrufen

WASM-Funktionen werden auf dieselbe Weise wie jede andere Funktion in der Registry aufgerufen:

```lua
local funcs = require("funcs")

-- No arguments
local result, err = funcs.call("myns:answer_wat")

-- With arguments
local result, err = funcs.call("myns:compute", 6, 7)

-- With complex data
local users = {
    {id = 1, name = "Alice", tags = {"admin"}, active = true},
    {id = 2, name = "Bob", tags = {"user"}, active = false},
}
local transformed, err = funcs.call("myns:transform_users", users)
```

## Sicherheit

WASM-Ausfuehrungen erben standardmaessig den Sicherheitskontext des Aufrufers:

- Actor-Identitaet wird vererbt
- Scope wird vererbt
- Request-Kontext wird vererbt

Host-Faehigkeiten sind Opt-in ueber explizite Imports. Jeder Eintrag deklariert genau, welche WASI-Schnittstellen er benoetigt (`wasi:cli`, `wasi:filesystem`, etc.), wodurch die Zugriffsoberflaeche des Moduls begrenzt wird.

## Siehe auch

- [Funktionen](wasm/functions.md) - Konfiguration von WASM-Funktionseintraegen
- [Host-Funktionen](wasm/hosts.md) - Verfuegbare WASI- und Wippy-Host-Schnittstellen
- [Prozesse](wasm/processes.md) - WASM als langlebige Prozesse ausfuehren
