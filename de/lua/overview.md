---
title: "Lua-Runtime"
description: "Wie Lua-Code in Wippy-Prozessen läuft, über Channels kommuniziert, Module lädt und Fehler behandelt."
---

# Lua-Runtime

Lua ist Wippys primäre Runtime für E/A-gebundene Arbeit und Geschäftslogik. Code läuft in isolierten Prozessen, die über Nachrichten statt über gemeinsamen Speicher kommunizieren.

Diese Seite bietet einen konzeptionellen Überblick. Ihre Codeblöcke sind isolierte Referenz-Snippets; Namen wie `inbox`, `events` und `handle_message` stehen für Werte oder Callbacks aus der umgebenden Anwendung.

Die Designabwägungen hinter Lua und das Verhältnis zu WebAssembly erläutert [Warum Wippy Lua verwendet](why-lua.md).

## Prozesse

Lua-Code läuft in **Prozessen**: isolierten Ausführungskontexten, die der Scheduler verwaltet. Jeder Prozess:

- besitzt einen eigenen Speicherbereich;
- gibt die Ausführung bei blockierenden Operationen wie E/A und Channel-Zugriff frei;
- kann überwacht und beaufsichtigt werden; und
- kann neben Tausenden anderen Prozessen auf einem Rechner laufen.

```lua
local pid, err = process.spawn("app.workers:handler", "app:processes")
if err then
    return nil, err
end

local sent, send_err = process.send(pid, "task", {data = "work"})
if send_err then
    return nil, send_err
end
```

Ausführbare Lua-Einträge erhalten `process` als ambienten globalen Wert. Das Modul lässt sich auch mit `require("process")` laden, ohne es in die `modules`-Liste des Eintrags aufzunehmen. Siehe [Prozessverwaltung](lua/core/process.md) für Spawning, Linking und Überwachung.

## Channels

Channels ermöglichen die Kommunikation zwischen nebenläufigen Tasks:

```lua
local sync_ch = channel.new()   -- unbuffered
local buffered = channel.new(10)

buffered:send("work")           -- completes while buffer space is available
local val, ok = buffered:receive()  -- val is "work" and ok is true
```

Siehe [Channels](lua/core/channel.md) für Select und Muster.

## Coroutinen

Verwenden Sie innerhalb eines Prozesses leichtgewichtige Coroutinen für nebenläufige Arbeit:

```lua
coroutine.spawn(function()
    local data = fetch_data()
    ch:send(data)
end)

do_other_work()  -- continues immediately
```

Der Scheduler verwaltet gestartete Coroutinen; Aufrufer müssen sie nicht manuell pausieren oder fortsetzen.

## Select

Verwenden Sie `channel.select`, um auf mehrere Ereignisquellen zu warten:

```lua
local r = channel.select {
    inbox:case_receive(),
    events:case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    -- timed out
elseif r.channel == events then
    handle_event(r.value)
else
    handle_message(r.value)
end
```

## Globale Werte

Die folgenden globalen Werte sind ohne `require` verfügbar und müssen nicht in `modules:` aufgeführt werden:

- `channel` - Go-ähnliche Channels
- `payload` - Eingabe-Payload des Eintrags
- `process` - Prozesse starten, Nachrichten senden, überwachen und den Lebenszyklus verwalten
- `print`, `subscribe`, `unsubscribe` - Logging und Pub/Sub
- `os`, `table`, `math`, `string`, `coroutine`, `errors` - Standardbibliotheken

## Module

Nicht ambiente, integrierte Runtime-Module werden mit `require()` geladen und müssen in der `modules:`-Allowlist des Eintrags stehen. Ausführbare Einträge erhalten `process` als ambienten globalen Wert; `require("process")` ist ebenfalls ohne `modules:`-Deklaration erlaubt.

```lua
local process = require("process")
local json = require("json")
local sql = require("sql")
local http = require("http_client")
```

Verfügbare Module hängen von der Eintragskonfiguration ab. Siehe [Eintragsdefinitionen](lua/entries.md).

Registry-Bibliotheken verwenden dieselbe Syntax `require("alias")`, werden aber separat in der `imports:`-Map des Eintrags deklariert.

## Sprach- und Bibliotheksunterstützung

Wippy verwendet Lua-5.3-Syntax mit einem von Luau inspirierten [graduellen Typsystem](lua/types.md). Typen sind erstklassige Runtime-Werte, die sich zur Validierung verwenden, als Argumente übergeben und zur Laufzeit untersuchen lassen.

Externe Lua-Bibliotheken (LuaRocks usw.) werden nicht unterstützt. Die Runtime stellt ihr eigenes Modulsystem mit integrierten Erweiterungen für E/A, Netzwerk und Systemintegration bereit.

Benutzerdefinierte Erweiterungen behandelt [Module](internals/modules.md) in der Internals-Dokumentation.

## Fehlerbehandlung

Funktionen geben häufig `result, error`-Paare zurück:

```lua
local data, err = json.decode(input)
if err then
    return nil, errors.wrap(err, "decode failed")
end
```

Dieses Snippet setzt voraus, dass `json` in der `modules`-Liste des Eintrags aktiviert ist und `input` den zu dekodierenden String enthält. Siehe [Fehlerbehandlung](lua/core/errors.md) für Muster.

## Nächste Schritte

- [Eintragsdefinitionen](lua/entries.md) - Einstiegspunkte konfigurieren
- [Channels](lua/core/channel.md) - Channel-Muster
- [Prozessverwaltung](lua/core/process.md) - Spawning und Überwachung
- [Funktionen](lua/core/funcs.md) - Prozessübergreifende Aufrufe
