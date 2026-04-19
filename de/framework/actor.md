# Actor

Das Modul `wippy/actor` bietet eine Bibliothek fuer Nebenlaeufigkeit per Nachrichtenuebermittlung, die einen Lua-Prozess in einen topic-basierten Actor verwandelt. Handler werden ueber das Nachrichten-Topic nachgeschlagen, und die Bibliothek multiplext die Prozess-Inbox, Systemereignisse, interne asynchrone Ergebnisse und beliebige zusaetzliche Kanaele durch eine einzige `channel.select`-Schleife.

## Einrichtung

```bash
wippy add wippy/actor
wippy install
```

Deklariere die Bibliothek als Abhaengigkeit und importiere sie dort, wo sie benoetigt wird:

```yaml
- name: dep.actor
  kind: ns.dependency
  component: wippy/actor
  version: "*"

- name: counter_process
  kind: process.lua
  source: file://counter.lua
  method: main
  modules:
    - time
  imports:
    actor: wippy.actor:actor
```

## Grundlegende Verwendung

```lua
local actor = require("actor")

local initial_state = { counter = 0 }

local handlers = {
    increment = function(state, payload, topic, from)
        state.counter = state.counter + (payload.amount or 1)
    end,

    get_count = function(state, payload, topic, from)
        process.send(from, "count_result", { count = state.counter })
    end,

    stop = function(state)
        return actor.exit({ final_count = state.counter })
    end,
}

local function main()
    return actor.new(initial_state, handlers):run()
end

return { main = main }
```

`actor.new(state, handlers)` liefert eine Actor-Instanz zurueck. `run()` treibt die Select-Schleife an, bis ein Handler `actor.exit(...)` zurueckgibt oder der Prozess abgebrochen wird.

## Handler

Jeder Schluessel in der `handlers`-Tabelle, dessen Name nicht mit `__` beginnt, ist ein Topic-Handler. Handler erhalten `(state, payload, topic, from)`.

### Spezielle Handler

| Name | Wann er laeuft |
|------|--------------|
| `__init` | Einmal, bevor die Select-Schleife startet |
| `__default` | Topic ohne passenden Handler |
| `__on_event` | Jedes Prozessereignis (einschliesslich Cancel) |
| `__on_cancel` | Prozess-Cancel-Ereignis (wird nach `__on_event` aufgerufen) |
| `__on_internal_message` | Von `state.async` geliefertes Ergebnis |

## Kontrollfluss

### Exit

```lua
return actor.exit({ reason = "done", data = state.data })
```

Stoppt die Schleife und loest `run()` mit dem Wert auf.

### Chain

```lua
return actor.next("process", payload)
```

Verteilt die aktuelle Nachricht erneut unter einem neuen Topic. Ist `payload` gleich `nil`, wird das vorherige Payload uebernommen. Nuetzlich fuer Validierungs-zu-Verarbeitungs-Pipelines ohne verschachtelte `if`.

## State-Methoden

`actor.new` haengt Hilfsfunktionen an die State-Tabelle. Sie sind innerhalb jedes Handlers verfuegbar.

| Methode | Beschreibung |
|--------|-------------|
| `state.add_handler(topic, fn)` | Registriert einen Handler zur Laufzeit |
| `state.remove_handler(topic)` | Entfernt einen zuvor hinzugefuegten Handler |
| `state.register_channel(ch, fn)` | Multiplext einen zusaetzlichen Kanal in die Schleife; `fn(state, value, ok, channel_id)` laeuft bei jedem Empfang |
| `state.unregister_channel(ch)` | Stoppt das Lauschen auf dem Kanal |
| `state.async(fn)` | Fuehrt `fn` in einer neuen Coroutine aus; gibt sie `actor.next(...)` zurueck, wird das Ergebnis an den Actor zurueckgeliefert |
| `state.wait(topic, timeout_ms)` | Blockierendes Warten auf einen Topic-Listener mit Timeout; liefert `(value, err)` |
| `state.next(topic, payload)` | Alias fuer `actor.next` |

## Ereignisse und Abbruch

Die Schleife empfaengt automatisch Prozessereignisse. Ueberschreibe `__on_event` (oder das spezifischere `__on_cancel`), um darauf zu reagieren:

```lua
__on_cancel = function(state, event, kind, from)
    return actor.exit({ reason = "cancelled", items = state.items })
end,
```

Ohne benutzerdefinierten Handler beendet ein Cancel-Ereignis den Actor trotzdem -- ueber die Standard-Ereignisverdrahtung -- aber es laeuft keine benutzerdefinierte Bereinigung.

## Vollstaendiges Beispiel

```lua
local actor = require("actor")

local handlers = {
    __init = function(state)
        state.items = {}
        state.async(function() return actor.next("ready", {}) end)
    end,

    ready = function(state)
        process.send(state.parent, "actor_ready", { pid = process.pid() })
    end,

    subscribe = function(state, _, _, from)
        state.subscriber = from
    end,

    add_item = function(state, payload)
        table.insert(state.items, payload.item)
        return actor.next("notify_change", {})
    end,

    notify_change = function(state)
        if state.subscriber then
            process.send(state.subscriber, "items_changed", { count = #state.items })
        end
    end,

    get_items = function(state, _, _, from)
        process.send(from, "items_list", { items = state.items })
    end,

    __on_cancel = function(state)
        return actor.exit({ items = state.items })
    end,
}

local function main()
    return actor.new({ parent = process.parent() }, handlers):run()
end

return { main = main }
```

## Siehe Auch

- [Process](../lua/core/process.md) - Inbox, Ereignisse, Send/Spawn-Primitive
- [Channels](../lua/core/channel.md) - Intern verwendete Channel- und Select-Primitive
- [Framework-Uebersicht](overview.md) - Verwendung von Framework-Modulen
