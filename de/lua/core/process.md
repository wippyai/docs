---
title: "Prozessverwaltung"
description: "Wippy-Prozesse starten, überwachen, verknüpfen, benachrichtigen, benennen und aktualisieren."
---

# Prozessverwaltung
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

Der globale Wert `process` stellt Funktionen zum Starten, Benachrichtigen, Überwachen, Verknüpfen und Benennen von Prozessen sowie zur Lebenszyklussteuerung bereit.

Er ist ohne `require()` verfügbar und muss nicht unter `modules:` aufgeführt werden.

Diese Seite ist eine API-Referenz. Die Blöcke mit Aufrufformen verwenden Platzhalter wie `id`, `host`, `destination`, `topic` und `name` für Werte aus dem Anwendungscode; sie sind keine eigenständigen Programme. Aufrufe mit einem `err`-Ergebnis geben bei Erfolg den dokumentierten Wert und bei Fehler einen Fehlersentinel plus `error` zurück. Der Sentinel ist normalerweise `nil`; `process.set_options` gibt dagegen `false` zurück. Der Kontrollfluss der Anwendung muss den Fehler behandeln.

## Prozessinformationen

Die aktuelle Frame-ID oder Prozess-ID abrufen:

```lua
local frame_id, err = process.id()  -- Registry ID of the current function, process, or workflow definition
if err then return nil, err end

local pid, err = process.pid()      -- Process ID
if err then return nil, err end
```

## Nachrichten senden

Nachricht(en) an einen Prozess per PID oder registriertem Namen senden:

```lua
local ok, err = process.send(destination, topic, ...)
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `destination` | string | PID oder registrierter Name |
| `topic` | string | Topic-Name (darf nicht mit `@` beginnen) |
| `...` | any | Payload-Werte |

**Berechtigung:** `process.send` auf Ziel-PID

## Prozesse spawnen

```lua
-- Basic spawn
local pid, err = process.spawn(id, host, ...)

-- With monitoring (receive EXIT events)
local pid, err = process.spawn_monitored(id, host, ...)

-- With linking (receive LINK_DOWN on abnormal exit)
local pid, err = process.spawn_linked(id, host, ...)

-- Both linked and monitored
local pid, err = process.spawn_linked_monitored(id, host, ...)
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `id` | string | Prozessquellen-ID (z.B. `"app.workers:handler"`) |
| `host` | string | Host-ID (z.B. `"app:processes"`) |
| `...` | any | Argumente, die an den gespawnten Prozess übergeben werden |

Alle Varianten erfordern `process.spawn` auf der Prozess-ID. Überwachte Varianten erfordern zusätzlich `process.spawn.monitored`, verknüpfte Varianten `process.spawn.linked`. In Runtime v0.3.32a prüft nur die Funktion `spawn()` auf Modulebene `process.host` auf der Host-ID; die spezialisierten Varianten auf Modulebene führen diese Host-Berechtigungsprüfung nicht aus.

## Prozesssteuerung

```lua
-- Forcefully terminate a process
local ok, err = process.terminate(destination)

-- Request graceful cancellation with an optional reason
local ok, err = process.cancel(destination, "shutting down")
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `destination` | string | PID oder registrierter Name |
| `reason` | string | Optionaler Grund, der dem Ziel übermittelt wird |

**Berechtigungen:** `process.terminate`, `process.cancel` auf Ziel-PID

## Überwachung und Linking

Einen existierenden Prozess überwachen oder linken:

```lua
-- Monitoring: receive EXIT events when target exits
local ok, err = process.monitor(destination)
local ok, err = process.unmonitor(destination)

-- Linking: bidirectional, receive LINK_DOWN on abnormal exit
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
|------|-----|--------------|
| `trap_links` | boolean | Ob LINK_DOWN-Events an den Events-Channel geliefert werden |
| `upgradable` | boolean | Opt-in für OUTDATED-Events, wenn der Code des Prozesses invalidiert wird |

## Inbox und Events

Channels zum Empfangen von Nachrichten und Lebenszyklusereignissen holen:

```lua
local inbox = process.inbox()    -- Message objects from @inbox topic
local events = process.events()  -- Lifecycle events from @events topic
```

### Event-Typen

| Konstante | Beschreibung |
|-----------|--------------|
| `process.event.CANCEL` | Abbruch angefordert |
| `process.event.EXIT` | Überwachter Prozess beendet |
| `process.event.LINK_DOWN` | Gelinkter Prozess abnormal beendet |
| `process.event.OUTDATED` | Der Code des Prozesses oder eine importierte Abhängigkeit hat sich in der Registry geändert |

### Event-Felder

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `kind` | string | Event-Typ-Konstante |
| `from` | string | Quell-PID |
| `result` | table | Für EXIT/LINK_DOWN: ein Record `{value, error}`; der Rückgabewert des Prozesses steht unter `result.value`, ein Fehler unter `result.error` |
| `reason` | string | Für CANCEL: Grund des Abbruchs |
| `sources` | string[] | Für OUTDATED: Registry-IDs, die sich geändert haben oder transitiv betroffen sind |

`OUTDATED` wird nur an Prozesse geliefert, die sich mit `process.set_options({upgradable = true})` dafür angemeldet haben. Mehrere Invalidierungen verschmelzen zu einem ausstehenden Event mit der Vereinigung ihrer `sources`. Behandeln Sie das Event mit [`process.upgrade`](#prozess-upgrade).

## Topic-Subscription

Benutzerdefinierte Topics abonnieren:

```lua
local ch, err = process.listen(topic, options)
if err then return nil, err end

local ok, err = process.unlisten(ch)
if err then return nil, err end
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `topic` | string | Topic-Name (darf nicht mit `@` beginnen) |
| `options.message` | boolean | Wenn true, Message-Objekte empfangen; wenn false, rohe Payloads |

## Message-Objekte

Beim Empfangen von inbox oder mit `{message = true}`:

```lua
local msg = inbox:receive()

msg:topic()            -- string: topic name
msg:from()             -- string|nil: sender PID
msg:payload()          -- Payload: wrapper (call :data() to extract)
msg:payload():data()   -- any: actual payload value
```

## Synchroner Aufruf

Einen Prozess spawnen, auf sein Ergebnis warten und zurückgeben:

```lua
local result, err = process.exec(id, host, ...)
```

**Berechtigungen:** `process.exec` auf Prozess-ID, `process.host` auf Host-ID

## Prozess-Upgrade

Aktualisieren Sie den aktuellen Prozess und behalten Sie seine PID bei.

Die beiden folgenden Snippets sind alternative Aufrufformen und keine aufeinanderfolgenden Operationen.

```lua
-- Upgrade to new version, passing state
process.upgrade(id, ...)
```

```lua
-- Keep same definition, re-run with new state
process.upgrade(nil, preserved_state)
```

`process.upgrade` ist ein terminaler Kontrolltransfer: Die Funktion verwirft die aktuelle Ausführung und startet die angeforderte Definition mit derselben PID. Code nach dem Aufruf läuft in der alten Ausführung nicht mehr.

## Kontext-Spawner

Einen Spawner mit benutzerdefiniertem Kontext für Kindprozesse erstellen:

```lua
local spawner = process.with_context({request_id = "123"})
```

**Berechtigung:** `process.context` auf "context"

### Spawner mit Optionen

`process.with_options(options)` erstellt einen Spawner, der spawn-zeitliche Optionen (z.B. einen Netzwerk-Selektor) anstelle von Kontextwerten trägt:

```lua
local spawner = process.with_options({network = "app:tor_proxy"})
```

| Option | Typ | Beschreibung |
|--------|-----|--------------|
| `network` | string | Registry-ID eines `network.*`-Eintrags für die ausgehenden Verbindungen des Kindprozesses |

**Berechtigung:** `process.context` auf "context"; die Auswahl eines Netzwerks erfordert zusätzlich `network.select` auf dieser Netzwerk-ID.

### SpawnBuilder-Methoden

SpawnBuilder ist unveränderlich - jede Methode gibt eine neue Instanz zurück:

```lua
spawner:with_context(values)      -- Add context values
spawner:with_actor(actor)         -- Set security actor
spawner:with_scope(scope)         -- Set security scope
spawner:with_name(name)           -- Set process name
spawner:with_message(topic, ...)  -- Queue message to send after spawn
spawner:with_options(options)     -- Merge spawn-time options (e.g. network)
```

**Berechtigung:** `process.security` auf "security" für `:with_actor()` und `:with_scope()`

### Spawner-Spawn-Methoden

```lua
spawner:spawn(id, host, ...)
spawner:spawn_monitored(id, host, ...)
spawner:spawn_linked(id, host, ...)
spawner:spawn_linked_monitored(id, host, ...)
```

Alle Spawn-Methoden des `SpawnBuilder` erfordern `process.host` auf der Host-ID sowie die jeweils anwendbaren Berechtigungen `process.spawn`, `process.spawn.monitored` und `process.spawn.linked`.

### Spawner-Exec

```lua
local result, err = spawner:exec(id, host, ...)
```

Führt den Zielprozess synchron unter Kontext, Actor und Scope des Builders aus und gibt dessen Ergebniswert zurück — das gebundene Gegenstück zum Modul-Level-`process.exec`. Ein deferred Worker kann mit `with_actor`/`with_scope` eine Owner-Identität rekonstruieren und in deren Namen ausführen.

**Berechtigungen:** `process.exec` auf der Prozess-ID, `process.host` auf der Host-ID

## Namensregistrierung

Einen Prozess unter einem Namen registrieren und über diesen Namen statt seiner PID erreichen. Jede Funktion, die ein `destination` akzeptiert (`send`, `terminate`, `cancel`, `monitor`, `link`, ...), nimmt statt einer PID auch einen registrierten Namen.

```lua
local ok, err = process.registry.register(name)               -- self, local scope
local pid, err = process.registry.lookup(name)
local ok, err = process.registry.unregister(name)
```

### Scope

Das optionale Argument `scope` wählt die Konsistenzgarantie des Namens und verwendet standardmäßig `LOCAL`. Das vollständige Modell beschreibt der [Cluster-Leitfaden](guides/cluster.md#benennung-und-namens-scopes).

| Konstante | Sichtbarkeit | Garantie |
|-----------|--------------|----------|
| `process.registry.LOCAL` | nur dieser Knoten | Sofort, knotenlokal |
| `process.registry.EVENTUAL` | clusterweit | Eventual Consistent (Gossip) |
| `process.registry.CONSISTENT` | clusterweit | Linearisierbarer Singleton (Raft) |
| `process.registry.STRONG` | clusterweit | Konsistent + jeder lebende Knoten bestätigt |

Auf einem Einzelknoten ist nur `LOCAL` verfügbar; Cluster-Scopes erfordern [Clustering](guides/cluster.md).

### register

```lua
local ok, err = process.registry.register(name, pid, scope)
```

| Parameter | Typ | Erforderlich | Standard | Beschreibung |
|-----------|-----|--------------|----------|--------------|
| `name` | string | ja | | Zu registrierender Name |
| `pid` | string | nein | self | Zu registrierende PID; Standard ist der aufrufende Prozess |
| `scope` | number | nein | `LOCAL` | Eine der obigen Scope-Konstanten |

Gibt `true` bei Erfolg zurück, oder `nil, error` bei Fehler. Konflikte (Name bereits für eine andere PID unter einem Cluster-Scope registriert) geben `errors.ALREADY_EXISTS` zurück. Das Registrieren desselben Namens für dieselbe PID ist idempotent. Eine `STRONG`-Registrierung blockiert, bis jeder lebende Knoten bestätigt oder die Reservierungsdeadline abläuft; bei Timeout wird ein Fehler zurückgegeben.

Das Registrieren im Namen einer anderen PID erfordert zusätzlich die Berechtigung `process.registry.foreign` auf der Ziel-PID.

### lookup

```lua
local pid, err = process.registry.lookup(name)
```

Gibt den registrierten PID-String zurück, oder `nil, error` mit der Art `errors.NOT_FOUND`, wenn der Name nicht registriert ist.

### unregister

```lua
local ok, err = process.registry.unregister(name, scope)
```

`scope` ist standardmäßig `LOCAL` und muss mit dem Scope übereinstimmen, unter dem der Name registriert wurde. Für `CONSISTENT` und `STRONG` ist der besitzende Prozess derjenige, dem die Deregistrierung erlaubt ist; das Deregistrieren eines von einer anderen PID gehaltenen Namens gibt `false` zurück. Namen werden auch automatisch freigegeben, wenn der besitzende Prozess endet (und für Cluster-Scopes, wenn sein Knoten ausscheidet), sodass explizites Deregistrieren für vorzeitige Freigabe ist.

## Berechtigungen

Berechtigungen steuern, was ein aufrufender Prozess tun kann. Alle Prüfungen verwenden den Sicherheitskontext des Aufrufers (Actor) gegen die Zielressource.

### Richtlinienauswertung

Richtlinien können basierend auf Folgendem erlauben/ablehnen:
- **Actor**: Der Sicherheitsprinzipal, der die Anfrage stellt
- **Aktion**: Die durchgeführte Operation (z.B. `process.send`)
- **Ressource**: Das Ziel (PID, Prozess-ID, Host-ID oder Name)
- **Attribute**: Zusätzlicher Kontext einschließlich `pid` (Prozess-ID des Aufrufers)

### Berechtigungsreferenz

| Berechtigung | Funktionen | Ressource |
|--------------|-----------|-----------|
| `process.spawn` | `spawn*()` | Prozess-ID |
| `process.spawn.monitored` | `spawn_monitored()`, `spawn_linked_monitored()` | Prozess-ID |
| `process.spawn.linked` | `spawn_linked()`, `spawn_linked_monitored()` | Prozess-ID |
| `process.host` | `spawn()` auf Modulebene, alle Spawn-Methoden des `SpawnBuilder`, `exec()` | Host-ID |
| `process.send` | `send()` | Ziel-PID |
| `process.exec` | `exec()` | Prozess-ID |
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
| `process.registry.foreign` | `registry.register()` | Ziel-PID |

Cluster-Namens-Scopes werden durch scope-suffixierte Varianten dieser Aktionen autorisiert (`process.registry.register.eventual`, `.consistent`, `.strong` und die entsprechenden `unregister`-Aktionen), sodass eine Richtlinie lokale Benennung separat von clusterweiter Benennung gewähren kann.

### Mehrfache Berechtigungen

Einige Operationen erfordern mehrere Berechtigungen:

| Operation | Erforderliche Berechtigungen |
|-----------|------------------------------|
| `spawn()` | `process.spawn` + `process.host` |
| `spawn_monitored()` auf Modulebene | `process.spawn` + `process.spawn.monitored` |
| `spawn_linked()` auf Modulebene | `process.spawn` + `process.spawn.linked` |
| `spawn_linked_monitored()` auf Modulebene | `process.spawn` + `process.spawn.monitored` + `process.spawn.linked` |
| `SpawnBuilder:spawn()` | `process.spawn` + `process.host` |
| `SpawnBuilder:spawn_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.host` |
| `SpawnBuilder:spawn_linked()` | `process.spawn` + `process.spawn.linked` + `process.host` |
| `SpawnBuilder:spawn_linked_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.spawn.linked` + `process.host` |
| `exec()` | `process.exec` + `process.host` |
| Spawn mit benutzerdefiniertem Actor/Scope | Spawn-Berechtigungen + `process.security` |

## Fehler

| Bedingung | Art |
|-----------|-----|
| Kein Kontext gefunden | `errors.INTERNAL` |
| Frame-Kontext nicht gefunden | `errors.INTERNAL` |
| Fehlende erforderliche Argumente | `errors.INVALID` |
| Reserviertes Topic-Präfix (`@`) | `errors.INVALID` |
| Name nicht registriert | `errors.NOT_FOUND` |
| Berechtigung verweigert | `errors.PERMISSION_DENIED` |
| Name bereits registriert | `errors.ALREADY_EXISTS` |

Siehe [Fehlerbehandlung](lua/core/errors.md) für die Arbeit mit Fehlern.

## Siehe auch

- [Channels](lua/core/channel.md) - Koordination von Coroutinen innerhalb eines Prozesses
- [Nachrichten-Queue](lua/storage/queue.md) - Queue-basierte Nachrichtenübermittlung
- [Funktionen](lua/core/funcs.md) - Funktionen aufrufen
- [Supervision](guides/supervision.md) - Prozesslebenszyklen verwalten
- [Cluster](guides/cluster.md) - Namens-Scopes und clusterweite Benennung
