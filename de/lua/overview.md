# Lua-Laufzeitumgebung

Die primäre Laufzeitumgebung von Wippy, optimiert für E/A-gebundene Workloads und Geschäftslogik. Code läuft in isolierten Prozessen, die über Nachrichtenübergabe kommunizieren - kein gemeinsamer Speicher, keine Sperren.

Wippy ist als polyglotte Laufzeitumgebung konzipiert. Während Lua die primäre Sprache ist, werden zukünftige Versionen zusätzliche Sprachen über WebAssembly und Temporal-Integration für rechenintensive oder spezialisierte Workloads unterstützen.

## Prozesse

Ihr Lua-Code läuft innerhalb von **Prozessen** - isolierten Ausführungskontexten, die vom Scheduler verwaltet werden. Jeder Prozess:

- Hat seinen eigenen Speicherbereich
- Gibt bei blockierenden Operationen ab (E/A, Channels)
- Kann überwacht und beaufsichtigt werden
- Skaliert auf Tausende pro Maschine

<note>
Ein typischer Lua-Prozess hat einen Basis-Speicher-Overhead von ca. 13 KB.
</note>

```lua
local pid = process.spawn("app.workers:handler", "app:processes")
process.send(pid, "task", {data = "work"})
```

Siehe [Prozessverwaltung](lua/core/process.md) für Spawning, Linking und Überwachung.

## Channels

Go-ähnliche Channels für Kommunikation:

```lua
local ch = channel.new()        -- ungepuffert
local buffered = channel.new(10)

ch:send(value)                  -- blockiert bis empfangen
local val, ok = ch:receive()    -- blockiert bis bereit
```

Siehe [Channels](lua/core/channel.md) für Select und Muster.

## Coroutinen

Innerhalb eines Prozesses können Sie leichtgewichtige Coroutinen starten:

```lua
coroutine.spawn(function()
    local data = fetch_data()
    ch:send(data)
end)

do_other_work()  -- setzt sofort fort
```

Gespawnte Coroutinen werden vom Scheduler verwaltet - kein manuelles Yield/Resume.

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

Diese sind immer ohne require verfügbar:

- `process` - Prozessverwaltung und Nachrichtenaustausch
- `channel` - Go-ähnliche Channels
- `os` - Zeit- und Systemfunktionen
- `coroutine` - leichtgewichtige Nebenläufigkeit

## Module

```lua
local json = require("json")
local sql = require("sql")
local http = require("http_client")
```

Verfügbare Module hängen von der Entry-Konfiguration ab. Siehe [Entry-Definitionen](lua/entries.md).

## Externe Bibliotheken

Wippy verwendet Lua 5.3-Syntax mit einem [graduellen Typsystem](lua/types.md), inspiriert von Luau. Typen sind erstklassige Laufzeitwerte - aufrufbar zur Validierung, als Argumente übergebbar und introspektierbar - was den Bedarf an Schema-Bibliotheken wie Zod oder Pydantic ersetzt.

Externe Lua-Bibliotheken (LuaRocks, etc.) werden nicht unterstützt. Die Laufzeitumgebung stellt ihr eigenes Modulsystem mit integrierten Erweiterungen für E/A, Netzwerk und Systemintegration bereit.

Für benutzerdefinierte Erweiterungen siehe [Module](internals/modules.md) in der Internals-Dokumentation.

## Fehlerbehandlung

Funktionen geben `result, error`-Paare zurück:

```lua
local data, err = json.decode(input)
if err then
    return nil, errors.wrap(err, "decode failed")
end
```

Siehe [Fehlerbehandlung](lua/core/errors.md) für Muster.

## Nächste Schritte

- [Entry-Definitionen](lua/entries.md) - Einstiegspunkte konfigurieren
- [Channels](lua/core/channel.md) - Channel-Muster
- [Prozessverwaltung](lua/core/process.md) - Spawning und Überwachung
- [Funktionen](lua/core/funcs.md) - Prozessübergreifende Aufrufe
