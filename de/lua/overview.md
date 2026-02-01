# Lua-Laufzeitumgebung

Die primare Berechnungslaufzeitumgebung von Wippy, optimiert fur I/O-gebundene und Geschaftslogik-Workloads. Code lauft in isolierten Prozessen, die uber Nachrichtenubergabe kommunizieren - kein gemeinsamer Speicher, keine Locks.

Wippy ist als polyglotte Laufzeitumgebung konzipiert. Wahrend Lua die primare Sprache ist, werden zukunftige Versionen zusatzliche Sprachen uber WebAssembly und Temporal-Integration fur rechenintensive oder spezialisierte Workloads unterstutzen.

## Prozesse

Ihr Lua-Code lauft innerhalb von **Prozessen** - isolierten Ausfuhrungskontexten, die vom Scheduler verwaltet werden. Jeder Prozess:

- Hat seinen eigenen Speicherbereich
- Gibt bei blockierenden Operationen ab (I/O, Channels)
- Kann uberwacht und beaufsichtigt werden
- Skaliert auf Tausende pro Maschine

<note>
Ein typischer Lua-Prozess hat einen Basis-Speicheroverhead von ca. 13 KB.
</note>

```lua
local pid = process.spawn("app.workers:handler", "app:processes")
process.send(pid, "task", {data = "work"})
```

Siehe [Prozessverwaltung](lua-process.md) fur Spawning, Linking und Supervision.

## Channels

Go-ahnliche Channels fur Kommunikation:

```lua
local ch = channel.new()        -- ungepuffert
local buffered = channel.new(10)

ch:send(value)                  -- blockiert bis empfangen
local val, ok = ch:receive()    -- blockiert bis bereit
```

Siehe [Channels](lua-channel.md) fur Select und Muster.

## Coroutinen

Innerhalb eines Prozesses konnen Sie leichtgewichtige Coroutinen starten:

```lua
coroutine.spawn(function()
    local data = fetch_data()
    ch:send(data)
end)

do_other_work()  -- setzt sofort fort
```

Gespawnte Coroutinen werden vom Scheduler verwaltet - kein manuelles yield/resume.

## Select

Behandeln Sie mehrere Ereignisquellen:

```lua
local r = channel.select {
    inbox:case_receive(),
    events:case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    -- Timeout aufgetreten
elseif r.channel == events then
    handle_event(r.value)
else
    handle_message(r.value)
end
```

## Globale Variablen

Diese sind immer ohne require verfugbar:

- `process` - Prozessverwaltung und Nachrichtenaustausch
- `channel` - Go-ahnliche Channels
- `os` - Zeit- und Systemfunktionen
- `coroutine` - leichtgewichtige Nebenlaufigkeit

## Module

```lua
local json = require("json")
local sql = require("sql")
local http = require("http_client")
```

Verfugbare Module hangen von der Entry-Konfiguration ab. Siehe [Entry-Definitionen](lua-entries.md).

## Externe Bibliotheken

Wippy verwendet Lua 5.3-Syntax mit einem [graduellen Typsystem](lua-types.md), inspiriert von Luau. Typen sind erstklassige Laufzeitwerte - aufrufbar zur Validierung, als Argumente ubergebbar und introspektierbar - was den Bedarf an Schema-Bibliotheken wie Zod oder Pydantic ersetzt.

Externe Lua-Bibliotheken (LuaRocks, etc.) werden nicht unterstutzt. Die Laufzeitumgebung stellt ihr eigenes Modulsystem mit integrierten Erweiterungen fur I/O, Netzwerk und Systemintegration bereit.

Fur benutzerdefinierte Erweiterungen siehe [Module](internal-modules.md) in der Internals-Dokumentation.

## Fehlerbehandlung

Funktionen geben `result, error`-Paare zuruck:

```lua
local data, err = json.decode(input)
if err then
    return nil, errors.wrap(err, "decode failed")
end
```

Siehe [Fehlerbehandlung](lua-errors.md) fur Muster.

## Nachste Schritte

- [Entry-Definitionen](lua-entries.md) - Einstiegspunkte konfigurieren
- [Channels](lua-channel.md) - Channel-Muster
- [Prozessverwaltung](lua-process.md) - Spawning und Supervision
- [Funktionen](lua-funcs.md) - Prozessubergreifende Aufrufe
