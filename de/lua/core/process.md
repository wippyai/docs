# Prozessverwaltung
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="permissions"/>

Kindprozesse spawnen, überwachen und mit ihnen kommunizieren. Implementiert Actor-Modell-Muster mit Nachrichtenübergabe, Supervision und Lebenszyklusverwaltung.

Die globale Variable `process` ist immer verfügbar — sie erfordert kein `require()` und muss nicht in `modules:` aufgeführt werden.

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
|-----------|-----|--------------|
| `destination` | string | PID oder registrierter Name |
| `topic` | string | Topic-Name (darf nicht mit `@` beginnen) |
| `...` | any | Payload-Werte |

**Berechtigung:** `process.send` auf Ziel-PID

## Prozesse spawnen

```lua
-- Einfaches Spawnen
local pid, err = process.spawn(id, host, ...)

-- Mit Überwachung (EXIT-Events empfangen)
local pid, err = process.spawn_monitored(id, host, ...)

-- Mit Linking (LINK_DOWN bei abnormalem Exit empfangen)
local pid, err = process.spawn_linked(id, host, ...)

-- Sowohl gelinkt als auch überwacht
local pid, err = process.spawn_linked_monitored(id, host, ...)
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `id` | string | Prozessquellen-ID (z.B. `"app.workers:handler"`) |
| `host` | string | Host-ID (z.B. `"app:processes"`) |
| `...` | any | Argumente, die an den gespawnten Prozess übergeben werden |

**Berechtigungen:**
- `process.spawn` auf Prozess-ID
- `process.host` auf Host-ID
- `process.spawn.monitored` auf Prozess-ID (für überwachte Varianten)
- `process.spawn.linked` auf Prozess-ID (für gelinkte Varianten)

## Prozesssteuerung

```lua
-- Prozess zwangsweise beenden
local ok, err = process.terminate(destination)

-- Ordnungsgemäße Kanzellierung mit optionalem Grund anfordern
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
-- Überwachung: EXIT-Events empfangen, wenn Ziel beendet wird
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
|------|-----|--------------|
| `trap_links` | boolean | Ob LINK_DOWN-Events an den Events-Channel geliefert werden |

## Inbox und Events

Channels zum Empfangen von Nachrichten und Lebenszyklusereignissen holen:

```lua
local inbox = process.inbox()    -- Message-Objekte vom @inbox-Topic
local events = process.events()  -- Lebenszyklusereignisse vom @events-Topic
```

### Event-Typen

| Konstante | Beschreibung |
|-----------|--------------|
| `process.event.CANCEL` | Kanzellierung angefordert |
| `process.event.EXIT` | Überwachter Prozess beendet |
| `process.event.LINK_DOWN` | Gelinkter Prozess abnormal beendet |

### Event-Felder

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `kind` | string | Event-Typ-Konstante |
| `from` | string | Quell-PID |
| `result` | any | Für EXIT: der zurückgegebene Wert (bei normalem Exit vorhanden) |
| `error` | any | Für EXIT: der Fehler (bei abnormalem Exit vorhanden) |
| `reason` | string | Für CANCEL: Grund der Kanzellierung |

## Topic-Subscription

Benutzerdefinierte Topics abonnieren:

```lua
local ch = process.listen(topic, options)
process.unlisten(ch)
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `topic` | string | Topic-Name (darf nicht mit `@` beginnen) |
| `options.message` | boolean | Wenn true, Message-Objekte empfangen; wenn false, rohe Payloads |

## Message-Objekte

Beim Empfangen von inbox oder mit `{message = true}`:

```lua
local msg = inbox:receive()

msg:topic()            -- string: Topic-Name
msg:from()             -- string|nil: Absender-PID
msg:payload()          -- Payload: Wrapper (`:data()` aufrufen zum Extrahieren)
msg:payload():data()   -- any: tatsächlicher Payload-Wert
```

## Synchroner Aufruf

Einen Prozess spawnen, auf sein Ergebnis warten und zurückgeben:

```lua
local result, err = process.exec(id, host, ...)
```

**Berechtigungen:** `process.exec` auf Prozess-ID, `process.host` auf Host-ID

## Prozess-Upgrade

Den aktuellen Prozess auf eine neue Definition upgraden und dabei die PID beibehalten:

```lua
-- Auf neue Version upgraden, Zustand übergeben
process.upgrade(id, ...)

-- Gleiche Definition behalten, mit neuem Zustand erneut ausführen
process.upgrade(nil, preserved_state)
```

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
spawner:with_context(values)      -- Kontextwerte hinzufügen
spawner:with_actor(actor)         -- Sicherheits-Actor setzen
spawner:with_scope(scope)         -- Sicherheits-Scope setzen
spawner:with_name(name)           -- Prozessname setzen
spawner:with_message(topic, ...)  -- Nachricht zum Senden nach Spawn einreihen
spawner:with_options(options)     -- Spawn-Optionen zusammenführen (z. B. network)
```

**Berechtigung:** `process.security` auf "security" für `:with_actor()` und `:with_scope()`

### Spawner-Spawn-Methoden

```lua
spawner:spawn(id, host, ...)
spawner:spawn_monitored(id, host, ...)
spawner:spawn_linked(id, host, ...)
spawner:spawn_linked_monitored(id, host, ...)
```

Gleiche Berechtigungen wie Modul-Level-Spawn-Funktionen.

## Namensregistrierung

Einen Prozess unter einem Namen registrieren und über diesen Namen statt seiner PID erreichen. Jede Funktion, die ein `destination` akzeptiert (`send`, `terminate`, `cancel`, `monitor`, `link`, ...), nimmt statt einer PID auch einen registrierten Namen.

```lua
local ok, err = process.registry.register(name)               -- self, lokaler Scope
local pid, err = process.registry.lookup(name)
local ok, err = process.registry.unregister(name)
```

### Scope

Das optionale `scope`-Argument wählt die Konsistenzgarantie des Namens. Standard ist `LOCAL`. Die vier Scopes und ihre Garantien sind im [Cluster-Leitfaden](guides/cluster.md#benennung-und-namens-scopes) beschrieben; kurz gefasst:

| Konstante | Sichtbarkeit | Garantie |
|-----------|--------------|----------|
| `process.registry.LOCAL` | nur dieser Knoten | Sofort, knotenlokal |
| `process.registry.EVENTUAL` | clusterweit | Eventual Consistent (Gossip) |
| `process.registry.CONSISTENT` | clusterweit | Linearisierbarer Singleton (Raft) |
| `process.registry.STRONG` | clusterweit | Konsistent + jeder lebende Knoten bestätigt |

Auf einem Einzelknoten ist nur `LOCAL` bedeutsam; die Cluster-Scopes erfordern [Clustering](guides/cluster.md).

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
| `process.host` | `spawn*()`, `exec()` | Host-ID |
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
| `spawn_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.host` |
| `spawn_linked()` | `process.spawn` + `process.spawn.linked` + `process.host` |
| `spawn_linked_monitored()` | `process.spawn` + `process.spawn.monitored` + `process.spawn.linked` + `process.host` |
| `exec()` | `process.exec` + `process.host` |
| Spawn mit benutzerdefiniertem Actor/Scope | Spawn-Berechtigungen + `process.security` |

## Fehler

| Bedingung | Art |
|-----------|-----|
| Kein Kontext gefunden | `errors.INVALID` |
| Frame-Kontext nicht gefunden | `errors.INVALID` |
| Fehlende erforderliche Argumente | `errors.INVALID` |
| Reserviertes Topic-Präfix (`@`) | `errors.INVALID` |
| Ungültiges Dauerformat | `errors.INVALID` |
| Name nicht registriert | `errors.NOT_FOUND` |
| Berechtigung verweigert | `errors.PERMISSION_DENIED` |
| Name bereits registriert | `errors.ALREADY_EXISTS` |

Siehe [Fehlerbehandlung](lua/core/errors.md) für die Arbeit mit Fehlern.

## Siehe auch

- [Channels](lua/core/channel.md) - Inter-Prozess-Kommunikation
- [Nachrichten-Queue](lua/storage/queue.md) - Queue-basiertes Messaging
- [Funktionen](lua/core/funcs.md) - Funktionsaufruf
- [Supervision](guides/supervision.md) - Prozess-Lebenszyklusverwaltung
- [Cluster](guides/cluster.md) - Namens-Scopes und clusterweite Benennung
