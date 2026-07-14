---
title: "System"
---

# System
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Abfragen von Laufzeit-Systeminformationen einschließlich Speicherverbrauch, Garbage-Collection-Statistiken, CPU-Details und Prozess-Metadaten.

## Laden

```lua
local system = require("system")
```

## Shutdown

Systemshutdown mit Exit-Code auslösen. Nützlich für Terminal-Apps; Aufruf aus laufenden Actors beendet das gesamte System:

```lua
local ok, err = system.exit(0)
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `code` | integer | Exit-Code (0 = Erfolg), Standard ist 0 |

**Gibt zurück:** `boolean, error`

## Module auflisten

Alle geladenen Lua-Module mit Metadaten abrufen:

```lua
local mods, err = system.modules()
```

**Gibt zurück:** `table[], error`

Jede Modul-Tabelle enthält:

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `name` | string | Modulname |
| `description` | string | Modulbeschreibung |
| `class` | string[] | Modul-Klassifizierungs-Tags |

## Speicherstatistiken

Detaillierte Speicherstatistiken abrufen:

```lua
local stats, err = system.memory.stats()
```

**Gibt zurück:** `table, error`

Stats-Tabelle enthält:

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `alloc` | number | Zugewiesene und verwendete Bytes |
| `total_alloc` | number | Kumulativ zugewiesene Bytes |
| `sys` | number | Vom System erhaltene Bytes |
| `heap_alloc` | number | Auf Heap zugewiesene Bytes |
| `heap_sys` | number | Für Heap vom System erhaltene Bytes |
| `heap_idle` | number | Bytes in ungenutzten Spans |
| `heap_in_use` | number | Bytes in genutzten Spans |
| `heap_released` | number | An OS freigegebene Bytes |
| `heap_objects` | number | Anzahl zugewiesener Heap-Objekte |
| `stack_in_use` | number | Vom Stack-Allocator verwendete Bytes |
| `stack_sys` | number | Für Stack vom System erhaltene Bytes |
| `mspan_in_use` | number | Bytes von mspan-Strukturen in Verwendung |
| `mspan_sys` | number | Für mspan vom System erhaltene Bytes |
| `num_gc` | number | Anzahl abgeschlossener GC-Zyklen |
| `next_gc` | number | Ziel-Heap-Größe für nächsten GC |

## Aktuelle Zuweisung

Aktuell zugewiesene Bytes abrufen:

```lua
local bytes, err = system.memory.allocated()
```

**Gibt zurück:** `number, error`

## Heap-Objekte

Anzahl zugewiesener Heap-Objekte abrufen:

```lua
local count, err = system.memory.heap_objects()
```

**Gibt zurück:** `number, error`

## Speicherlimit

Speicherlimit setzen (gibt vorherigen Wert zurück):

```lua
local prev, err = system.memory.set_limit(1024 * 1024 * 100)
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `limit` | integer | Speicherlimit in Bytes, -1 für unbegrenzt |

**Gibt zurück:** `number, error`

Aktuelles Speicherlimit abrufen:

```lua
local limit, err = system.memory.get_limit()
```

**Gibt zurück:** `number, error`

## GC erzwingen

Garbage Collection erzwingen:

```lua
local ok, err = system.gc.collect()
```

**Gibt zurück:** `boolean, error`

## GC-Zielprozentsatz

GC-Zielprozentsatz setzen (gibt vorherigen Wert zurück). Ein Wert von 100 bedeutet, dass GC ausgelöst wird, wenn sich der Heap verdoppelt:

```lua
local prev, err = system.gc.set_percent(200)
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `percent` | integer | GC-Zielprozentsatz |

**Gibt zurück:** `number, error`

Aktuellen GC-Zielprozentsatz abrufen:

```lua
local percent, err = system.gc.get_percent()
```

**Gibt zurück:** `number, error`

## Goroutine-Anzahl

Anzahl aktiver Goroutines abrufen:

```lua
local count, err = system.runtime.goroutines()
```

**Gibt zurück:** `number, error`

## GOMAXPROCS

GOMAXPROCS-Wert abrufen oder setzen:

```lua
-- Aktuellen Wert abrufen
local current, err = system.runtime.max_procs()

-- Neuen Wert setzen
local prev, err = system.runtime.max_procs(4)
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `n` | integer | Falls angegeben, setzt GOMAXPROCS (muss > 0 sein) |

**Gibt zurück:** `number, error`

## CPU-Anzahl

Anzahl logischer CPUs abrufen:

```lua
local cpus, err = system.runtime.cpu_count()
```

**Gibt zurück:** `number, error`

## Prozess-ID

Aktuelle Prozess-ID abrufen:

```lua
local pid, err = system.process.pid()
```

**Gibt zurück:** `number, error`

## Hostname

System-Hostname abrufen:

```lua
local hostname, err = system.process.hostname()
```

**Gibt zurück:** `string, error`

## Arbeitsverzeichnis

Aktuelles Arbeitsverzeichnis der Laufzeit abrufen:

```lua
local dir, err = system.process.cwd()
```

**Gibt zurück:** `string, error`

## Prozess-Hosts

Alle Prozess-Hosts mit Worker- und Queue-Statistiken auflisten:

```lua
local hosts, err = system.hosts.list()
```

**Gibt zurück:** `table[], error`

Jede Host-Tabelle enthält:

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | string | Host-Registry-ID |
| `workers` | number | Größe des Worker-Pools |
| `processes` | number | Aktive Prozesse auf diesem Host |
| `executed` | number | Insgesamt ausgeführte Schritte |
| `stolen` | number | Von anderen Hosts gestohlene Schritte |
| `queue_depth` | number | Ausstehende Einträge in der Host-Queue |

Auf einem bestimmten Host laufende Prozesse auflisten:

```lua
local procs, err = system.hosts.processes("app:host")
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `host_id` | string | Host-Registry-ID |

**Gibt zurück:** `table[], error`

Jede Prozess-Tabelle enthält:

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `pid` | string | Prozess-ID |
| `host` | string | Host-ID |
| `source` | string | Quell-Eintrag-ID |
| `state` | string | Prozessstatus |
| `steps` | number | Ausgeführte Schritte |
| `started_at` | number | Start-Zeitstempel (Nanosekunden) |
| `parent` | string | Parent-PID (entfällt, falls keine) |
| `actor_id` | string | Actor-ID (entfällt, falls keine) |
| `stats` | table | Prozessspezifische Stats (optional) |

## Service-Status

Status für einen spezifischen überwachten Service abrufen:

```lua
local state, err = system.supervisor.state("namespace:service")
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `service_id` | string | Service-ID (z.B. "namespace:service") |

**Gibt zurück:** `table, error`

Status-Tabelle enthält:

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | string | Service-ID |
| `status` | string | Aktueller Status |
| `desired` | string | Gewünschter Status |
| `retry_count` | number | Anzahl der Wiederholungen |
| `last_update` | number | Letzter Aktualisierungszeitstempel (Nanosekunden) |
| `started_at` | number | Start-Zeitstempel (Nanosekunden) |
| `details` | string | Optionale Details (formatiert) |

## Alle Service-Status

Status für alle überwachten Services abrufen:

```lua
local states, err = system.supervisor.states()
```

**Gibt zurück:** `table[], error`

Jede Status-Tabelle hat das gleiche Format wie `system.supervisor.state()`.

## Cluster-Primitive

Die Subtabellen `system.node`, `system.cluster`, `system.raft` und `system.lock` legen die Clustering-Schicht frei. Sie sind am nützlichsten, wenn [Clustering aktiviert ist](guides/cluster.md); auf einem Einzelknoten degradieren sie vorhersagbar — `system.raft.*` meldet "raft not available", `system.cluster` meldet nur den lokalen Knoten, und `system.lock` erfordert die globale Registry, die Clustering bereitstellt.

Alle Leseaufrufe sind lokal und günstig: sie melden die Sicht dieses Knotens auf den committierten Zustand, ohne je das Netzwerk zu blockieren.

### Knotenidentität

`system.node` meldet die eigene Identität dieses Knotens im Cluster.

```lua
local id, err = system.node.id()      -- ID dieses Knotens
local addr, err = system.node.addr()  -- beworbene Netzwerkadresse
local role, err = system.node.role()  -- "leader" | "voter" | "standby" | "non-member"
```

| Funktion | Gibt zurück | Hinweise |
|----------|-------------|----------|
| `system.node.id()` | `string, error` | Knoten-ID aus dem Relay-Kontext |
| `system.node.addr()` | `string, error` | Beworbene Adresse (z.B. `10.0.0.1:7946`); Fehler wenn Mitgliedschaft nicht verfügbar |
| `system.node.role()` | `string, error` | Raft-Rolle dieses Knotens; gibt `"non-member"` (kein Fehler) zurück wenn Raft nicht läuft |

**Berechtigung:** `system.read` auf `node`.

### Cluster-Mitgliedschaft

`system.cluster` meldet die clusterweite Sicht: wer die Mitglieder sind und wer führt.

```lua
local members, err = system.cluster.members()  -- Array von Knoten-Tabellen
local leader, err = system.cluster.leader()    -- Leader-Knoten-ID oder "" wenn unbekannt
local n, err = system.cluster.size()           -- Anzahl sichtbarer Mitglieder
```

`system.cluster.members()` gibt ein Array von Knoten-Tabellen zurück. Der lokale Knoten ist einmal enthalten und sortiert zuerst.

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | string | Knoten-ID |
| `is_local` | boolean | True für den aufrufenden Knoten |
| `addr` | string | Beworbene Adresse (entfällt wenn unbekannt) |
| `meta` | table | String-zu-String-Gossip-Metadaten (entfällt wenn keine) |

| Funktion | Gibt zurück | Hinweise |
|----------|-------------|----------|
| `system.cluster.members()` | `table[], error` | Fehler wenn keine Mitgliedschaftsinformationen erreichbar |
| `system.cluster.leader()` | `string, error` | Aktuelle Raft-Leader-ID; `""` (kein Fehler) wenn Leader unbekannt oder Raft fehlt |
| `system.cluster.size()` | `number, error` | Anzahl sichtbarer Mitglieder; `0` wenn keine Mitgliedschaftsinfo verfügbar |

**Berechtigung:** `system.read` auf `cluster`.

### Raft-Zustand

`system.raft` liest die lokale Sicht dieses Knotens auf den Raft-Konsenskern. Jede Funktion gibt `nil, error` ("raft not available") zurück, wenn Raft auf diesem Knoten nicht läuft.

```lua
local leader, err = system.raft.is_leader()      -- boolean
local member, err = system.raft.is_member()      -- boolean: Voter oder Standby
local role, err = system.raft.role()             -- gleiche Werte wie system.node.role()
local term, err = system.raft.term()             -- aktueller Raft-Term
local idx, err = system.raft.commit_index()      -- höchster committierter Log-Index
local stats, err = system.raft.stats()           -- rohe Stats-Map (string -> string)
```

| Funktion | Gibt zurück | Hinweise |
|----------|-------------|----------|
| `system.raft.is_leader()` | `boolean, error` | True genau dann, wenn dieser Knoten der aktuelle Leader ist |
| `system.raft.is_member()` | `boolean, error` | True genau dann, wenn dieser Knoten Voter oder Standby in der committieren Konfiguration ist |
| `system.raft.role()` | `string, error` | `"leader"` / `"voter"` / `"standby"` / `"non-member"` |
| `system.raft.term()` | `number, error` | Aktueller Term; `0` wenn aus Stats nicht verfügbar |
| `system.raft.commit_index()` | `number, error` | Höchster committierter Log-Index auf diesem Knoten |
| `system.raft.stats()` | `table, error` | Vollständige rohe Stats-Map; Schlüssel und Werte sind Strings |

**Berechtigung:** `system.read` auf `raft`, außer `system.raft.stats()`, das `system.read` auf `raft_stats` erfordert.

### Verteilte Sperren

`system.lock` bietet clusterweiten gegenseitigen Ausschluss. Eine Sperre ist ein global eindeutiger Name, der dem aufrufenden Prozess gehört. Sie baut auf dem Strong-Namens-Scope auf, sodass höchstens ein Halter clusterweit existieren kann, und die Sperre wird automatisch freigegeben, wenn der Halterprozess endet oder sein Knoten ausscheidet — es gibt keine steckengebliebene Sperre zu bereinigen.

```lua
local ok, err = system.lock.acquire("orders.migration")
if ok then
  -- kritischer Abschnitt: nur ein Halter clusterweit
  system.lock.release("orders.migration")
end
```

Erwerben ist fail-fast: wenn die Sperre bereits gehalten wird, gibt es sofort `false` zurück statt zu blockieren, sodass Aufrufer eigenes Retry und Backoff implementieren. Nur der aktuelle Halter kann freigeben; eine Sperre freizugeben, die man nicht hält, ist ein sicheres No-Op.

| Funktion | Gibt zurück | Ergebnisse |
|----------|-------------|------------|
| `system.lock.acquire(name)` | `boolean, error` | `true, nil` erworben; `false, error` bereits gehalten (Art `errors.ALREADY_EXISTS`); `nil, error` bei Fehler |
| `system.lock.release(name)` | `boolean, error` | `true, nil` freigegeben; `false, nil` nicht gehalten oder von anderem Prozess gehalten; `nil, error` bei Fehler |

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `name` | string | Clusterweiter Sperrenname |

**Berechtigung:** `system.lock` auf dem Sperren-`name` (sodass eine Richtlinie einschränken kann, welche Namen ein Aufrufer sperren darf).

## Berechtigungen

Systemoperationen unterliegen der Sicherheitsrichtlinienauswertung.

| Aktion | Ressource | Beschreibung |
|--------|-----------|--------------|
| `system.read` | `memory` | Speicherstatistiken lesen |
| `system.read` | `memory_limit` | Speicherlimit lesen |
| `system.control` | `memory_limit` | Speicherlimit setzen |
| `system.read` | `gc_percent` | GC-Prozentsatz lesen |
| `system.gc` | `gc` | Garbage Collection erzwingen |
| `system.gc` | `gc_percent` | GC-Prozentsatz setzen |
| `system.read` | `goroutines` | Goroutine-Anzahl lesen |
| `system.read` | `gomaxprocs` | GOMAXPROCS lesen |
| `system.control` | `gomaxprocs` | GOMAXPROCS setzen |
| `system.read` | `cpu` | CPU-Anzahl lesen |
| `system.read` | `pid` | Prozess-ID lesen |
| `system.read` | `hostname` | Hostname lesen |
| `system.read` | `cwd` | Arbeitsverzeichnis lesen |
| `system.read` | `hosts` | Hosts / Host-Prozesse auflisten |
| `system.read` | `modules` | Geladene Module auflisten |
| `system.read` | `supervisor` | Supervisor-Status lesen |
| `system.read` | `node` | Identität dieses Knotens lesen |
| `system.read` | `cluster` | Cluster-Mitgliedschaft und Leader lesen |
| `system.read` | `raft` | Raft-Zustand lesen |
| `system.read` | `raft_stats` | Rohe Raft-Stats-Map lesen |
| `system.lock` | `<Sperrenname>` | Eine verteilte Sperre erwerben oder freigeben |
| `system.exit` | - | System-Shutdown auslösen |

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|-----|--------------|
| Berechtigung verweigert | `errors.INVALID` | nein |
| Ungültiges Argument | `errors.INVALID` | nein |
| Fehlendes erforderliches Argument | `errors.INVALID` | nein |
| Code-Manager nicht verfügbar | `errors.INTERNAL` | nein |
| Service-Info nicht verfügbar | `errors.INTERNAL` | nein |
| OS-Fehler (hostname, cwd) | `errors.INTERNAL` | nein |
| Raft läuft nicht auf diesem Knoten | `errors.INTERNAL` | nein |
| Mitgliedschaft nicht verfügbar | `errors.INTERNAL` | nein |
| Sperre bereits gehalten | `errors.ALREADY_EXISTS` | nein |

Siehe [Fehlerbehandlung](lua/core/errors.md) für die Arbeit mit Fehlern.
