# Prozessverwaltung
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

Spawnen, uberwachen und kommunizieren Sie mit Kindprozessen. Implementiert Actor-Modell-Muster mit Nachrichtenubergabe, Supervision und Lebenszyklusverwaltung.

Die globale `process`-Variable ist immer verfugbar.

## Prozessinformationen

Die aktuelle Frame-ID oder Prozess-ID abrufen:

```lua
local frame_id = process.id()  -- Aufrufkettenidentifikator
local pid = process.pid()       -- Prozess-ID
```

## Nachrichten senden

Nachricht(en) an einen Prozess per PID oder registriertem Namen senden:

```lua
local ok, err = process.send(destination, topic, ...)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `destination` | string | PID oder registrierter Name |
| `topic` | string | Topic-Name (darf nicht mit `@` beginnen) |
| `...` | any | Payload-Werte |

**Berechtigung:** `process.send` auf Ziel-PID

## Prozesse spawnen

```lua
-- Einfaches Spawnen
local pid, err = process.spawn(id, host, ...)

-- Mit Uberwachung (EXIT-Events empfangen)
local pid, err = process.spawn_monitored(id, host, ...)

-- Mit Linking (LINK_DOWN bei abnormalem Exit empfangen)
local pid, err = process.spawn_linked(id, host, ...)

-- Sowohl gelinkt als auch uberwacht
local pid, err = process.spawn_linked_monitored(id, host, ...)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `id` | string | Prozessquellen-ID (z.B. `"app.workers:handler"`) |
| `host` | string | Host-ID (z.B. `"app:processes"`) |
| `...` | any | Argumente, die an gespawnten Prozess ubergeben werden |

**Berechtigungen:**
- `process.spawn` auf Prozess-ID
- `process.host` auf Host-ID
- `process.spawn.monitored` auf Prozess-ID (fur uberwachte Varianten)
- `process.spawn.linked` auf Prozess-ID (fur gelinkte Varianten)

## Prozesssteuerung

```lua
-- Prozess zwangsweise beenden
local ok, err = process.terminate(destination)

-- Ordnungsgemasse Kanzellierung mit optionaler Deadline anfordern
local ok, err = process.cancel(destination, "5s")
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `destination` | string | PID oder registrierter Name |
| `deadline` | string\|integer | Dauer-String oder Millisekunden |

**Berechtigungen:** `process.terminate`, `process.cancel` auf Ziel-PID

## Uberwachung und Linking

Einen existierenden Prozess uberwachen oder linken:

```lua
-- Uberwachung: EXIT-Events empfangen, wenn Ziel beendet wird
local ok, err = process.monitor(destination)
local ok, err = process.unmonitor(destination)

-- Linking: bidirektional, LINK_DOWN bei abnormalem Exit empfangen
local ok, err = process.link(destination)
local ok, err = process.unlink(destination)
```

**Berechtigungen:** `process.monitor`, `process.unmonitor`, `process.link`, `process.unlink` auf Ziel-PID

## Prozessoptionen

```lua
local options = process.get_options()
local ok, err = process.set_options({trap_links = true})
```

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `trap_links` | boolean | Ob LINK_DOWN-Events an den Events-Channel geliefert werden |

## Inbox und Events

Channels zum Empfangen von Nachrichten und Lebenszyklusereignissen holen:

```lua
local inbox = process.inbox()    -- Message-Objekte vom @inbox-Topic
local events = process.events()  -- Lebenszyklusereignisse vom @events-Topic
```

### Event-Typen

| Konstante | Beschreibung |
|----------|-------------|
| `process.event.CANCEL` | Kanzellierung angefordert |
| `process.event.EXIT` | Uberwachter Prozess beendet |
| `process.event.LINK_DOWN` | Gelinkter Prozess abnormal beendet |

### Event-Felder

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `kind` | string | Event-Typ-Konstante |
| `from` | string | Quell-PID |
| `result` | table | Fur EXIT: `{value: any}` oder `{error: string}` |
| `deadline` | string | Fur CANCEL: Deadline-Zeitstempel |

## Topic-Subscription

Benutzerdefinierte Topics abonnieren:

```lua
local ch = process.listen(topic, options)
process.unlisten(ch)
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `topic` | string | Topic-Name (darf nicht mit `@` beginnen) |
| `options.message` | boolean | Wenn true, Message-Objekte empfangen; wenn false, rohe Payloads |

## Message-Objekte

Beim Empfangen von inbox oder mit `{message = true}`:

```lua
local msg = inbox:receive()

msg:topic()    -- string: Topic-Name
msg:from()     -- string|nil: Absender-PID
msg:payload()  -- any: Payload-Daten
```

## Synchroner Aufruf

Einen Prozess spawnen, auf sein Ergebnis warten und zuruckgeben:

```lua
local result, err = process.call(id, host, ...)
```

**Berechtigungen:** `process.call` auf Prozess-ID, `process.host` auf Host-ID

## Prozess-Upgrade

Den aktuellen Prozess auf eine neue Definition upgraden und dabei PID beibehalten:

```lua
-- Auf neue Version upgraden, Zustand ubergeben
process.upgrade(source, ...)

-- Gleiche Definition behalten, mit neuem Zustand erneut ausfuhren
process.upgrade(nil, preserved_state)
```

## Kontext-Spawner

Einen Spawner mit benutzerdefiniertem Kontext fur Kindprozesse erstellen:

```lua
local spawner = process.with_context({request_id = "123"})
```

**Berechtigung:** `process.context` auf "context"

### SpawnBuilder-Methoden

SpawnBuilder ist unveranderlich - jede Methode gibt eine neue Instanz zuruck:

```lua
spawner:with_context(values)      -- Kontextwerte hinzufugen
spawner:with_actor(actor)         -- Sicherheits-Actor setzen
spawner:with_scope(scope)         -- Sicherheits-Scope setzen
spawner:with_name(name)           -- Prozessname setzen
spawner:with_message(topic, ...)  -- Nachricht zum Senden nach Spawn einreihen
```

**Berechtigung:** `process.security` auf "security" fur `:with_actor()` und `:with_scope()`

### Spawner-Spawn-Methoden

```lua
spawner:spawn(id, host, ...)
spawner:spawn_monitored(id, host, ...)
spawner:spawn_linked(id, host, ...)
spawner:spawn_linked_monitored(id, host, ...)
```

Gleiche Berechtigungen wie Modul-Level-Spawn-Funktionen.

## Namensregistrierung

Prozesse nach Namen registrieren und nachschlagen:

```lua
local ok, err = process.registry.register(name, pid)  -- pid standardmassig self
local pid, err = process.registry.lookup(name)
local ok = process.registry.unregister(name)
```

**Berechtigungen:** `process.registry.register`, `process.registry.unregister` auf Name

## Berechtigungen

Berechtigungen steuern, was ein aufrufender Prozess tun kann. Alle Prufungen verwenden den Sicherheitskontext des Aufrufers (Actor) gegen die Zielressource.

### Richtlinienauswertung

Richtlinien konnen basierend auf Folgendem erlauben/ablehnen:
- **Actor**: Der Sicherheitsprinzipal, der die Anfrage stellt
- **Aktion**: Die durchgefuhrte Operation (z.B. `process.send`)
- **Ressource**: Das Ziel (PID, Prozess-ID, Host-ID oder Name)
- **Attribute**: Zusatzlicher Kontext einschliesslich `pid` (Prozess-ID des Aufrufers)

### Berechtigungsreferenz

| Berechtigung | Funktionen | Ressource |
|------------|-----------|----------|
| `process.spawn` | `spawn*()` | Prozess-ID |
| `process.spawn.monitored` | `spawn_monitored()`, `spawn_linked_monitored()` | Prozess-ID |
| `process.spawn.linked` | `spawn_linked()`, `spawn_linked_monitored()` | Prozess-ID |
| `process.host` | `spawn*()`, `call()` | Host-ID |
| `process.send` | `send()` | Ziel-PID |
| `process.call` | `call()` | Prozess-ID |
| `process.terminate` | `terminate()` | Ziel-PID |
| `process.cancel` | `cancel()` | Ziel-PID |
| `process.monitor` | `monitor()` | Ziel-PID |
| `process.unmonitor` | `unmonitor()` | Ziel-PID |
| `process.link` | `link()` | Ziel-PID |
| `process.unlink` | `unlink()` | Ziel-PID |
| `process.context` | `with_context()` | "context" |
| `process.security` | `:with_actor()`, `:with_scope()` | "security" |
| `process.registry.register` | `registry.register()` | Name |
| `process.registry.unregister` | `registry.unregister()` | Name |

### Mehrfache Berechtigungen

Einige Operationen erfordern mehrere Berechtigungen:

| Operation | Erforderliche Berechtigungen |
|-----------|---------------------|
| `spawn()` | `process.spawn` + `process.host` |
| `spawn_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.host` |
| `spawn_linked()` | `process.spawn` + `process.spawn.linked` + `process.host` |
| `spawn_linked_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.spawn.linked` + `process.host` |
| `call()` | `process.call` + `process.host` |
| Spawn mit benutzerdefiniertem Actor/Scope | Spawn-Berechtigungen + `process.security` |

## Fehler

| Bedingung | Art |
|-----------|------|
| Kein Kontext gefunden | `errors.INVALID` |
| Frame-Kontext nicht gefunden | `errors.INVALID` |
| Fehlende erforderliche Argumente | `errors.INVALID` |
| Reserviertes Topic-Prafix (`@`) | `errors.INVALID` |
| Ungultiges Dauerformat | `errors.INVALID` |
| Name nicht registriert | `errors.NOT_FOUND` |
| Berechtigung verweigert | `errors.PERMISSION_DENIED` |
| Name bereits registriert | `errors.ALREADY_EXISTS` |

Siehe [Fehlerbehandlung](lua/core/errors.md) fur die Arbeit mit Fehlern.

## Siehe auch

- [Channels](lua/core/channel.md) - Inter-Prozess-Kommunikation
- [Nachrichtenwarteschlange](lua/storage/queue.md) - Queue-basiertes Messaging
- [Funktionen](lua/core/funcs.md) - Funktionsaufruf
- [Supervision](guides/supervision.md) - Prozess-Lebenszyklusverwaltung
