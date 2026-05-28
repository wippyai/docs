# Prozessgruppen
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Prozesse in benannte Gruppen aufnehmen und an jedes Mitglied im Cluster senden. Modelliert nach Erlang/OTP `pg`: Gruppen sind dynamisch, ein Prozess kann vielen Gruppen angehören, und die Mitgliedschaft wird clusterweit über Gossip verfolgt.

Für den Scope-Eintragstyp und seine Konfiguration siehe [Prozessgruppen](system/process-groups.md). Für das umfassendere Clustering-Modell siehe den [Cluster-Leitfaden](guides/cluster.md).

## Laden

```lua
local pg = require("pg")
```

## Einen Scope öffnen

Eine Prozessgruppe lebt innerhalb eines **Scopes** — einem `pg.scope`-Registry-Eintrag. Öffnen Sie ihn, um eine Instanz zu erhalten, auf der Sie operieren:

```lua
local group, err = pg.open("app:pg")
if err then
    return nil, err
end
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `id` | string | Scope-Eintrag-ID (Format: `"namespace:name"`) |

**Gibt zurück:** `pg.Instance, error`

**Berechtigung:** `pg.open` auf der Scope-`id`

Die Instanz wird automatisch freigegeben, wenn der Prozess endet; rufen Sie `release()` auf, um sie früher freizugeben. Alle anderen Operationen sind Methoden der Instanz, aufgerufen mit `:`.

## Beitreten und Verlassen

```lua
local ok, err = group:join("workers")           -- einzelne Gruppe
local ok, err = group:join({"workers", "all"})  -- Batch
local ok, err = group:leave("workers")
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `group` | string \| string[] | Gruppenname oder eine Liste von Namen für eine Batch-Operation |

**Gibt zurück:** `boolean, error`

Ein Prozess kann derselben Gruppe mehr als einmal beitreten; er muss genauso oft austreten, um vollständig auszuscheiden (Multi-Join-Semantik). `leave` ist Best-Effort über einen Batch und gibt nur dann einen Fehler zurück, wenn der Prozess in keiner der genannten Gruppen Mitglied war.

**Berechtigungen:** `pg.join` / `pg.leave` auf jedem Gruppennamen

## Mitglieder auflisten

```lua
local members, err = group:get_members("workers")        -- alle Knoten
local local_members, err = group:get_local_members("workers")  -- nur dieser Knoten
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `group` | string | Gruppenname |

**Gibt zurück:** `string[], error` — ein Array von PID-Strings (leer für eine unbekannte Gruppe)

**Berechtigungen:** `pg.get_members` / `pg.get_local_members` auf dem Gruppennamen

## Gruppen auflisten

```lua
local groups, err = group:which_groups()         -- alle Gruppen im Cluster
local local_groups, err = group:which_local_groups()  -- Gruppen mit einem lokalen Mitglied
```

**Gibt zurück:** `string[], error` — Gruppennamen, die aktuell mindestens ein Mitglied haben

**Berechtigungen:** `pg.which_groups` / `pg.which_local_groups`

## Broadcast

Eine Nachricht an jedes Mitglied einer Gruppe senden. Jedes Mitglied empfängt sie unter `topic` vom aufrufenden Prozess — mit `process.listen(topic)` verarbeiten.

```lua
local ok, err = group:broadcast("workers", "task", {id = 42})   -- alle Knoten
local ok, err = group:broadcast_local("workers", "task", {id = 42})  -- nur dieser Knoten
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `group` | string | Zielgruppe |
| `topic` | string | Nachrichten-Topic |
| `...` | any | Null oder mehr Payload-Werte |

**Gibt zurück:** `boolean, error`

**Berechtigungen:** `pg.broadcast` / `pg.broadcast_local` auf dem Gruppennamen

## Eine Gruppe überwachen

`monitor` abonniert Beitritts-/Verlassens-Ereignisse für eine Gruppe und gibt die aktuellen Mitglieder atomar zurück — keine Mitgliedschaftsänderung kann zwischen dem Snapshot und dem Abonnement verlorengehen.

```lua
local sub, members, err = group:monitor("workers")
if err then
    return nil, err
end

for _, pid in ipairs(members) do
    -- aktuelle Mitglieder zum Abonnementzeitpunkt
end

local ch = sub:channel()
local event = ch:receive()  -- {kind = "member.joined" | "member.left", path = "workers", data = {...}}

sub:close()  -- abbestellen; sub:close({flush = true}) leert zuerst wartende Ereignisse
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `group` | string | Zu überwachende Gruppe |

**Gibt zurück:** `pg.Subscription, string[], error` — das Abonnement und ein Snapshot der aktuellen Mitglieder

**Berechtigung:** `pg.monitor` auf dem Gruppennamen

## Alle Gruppen beobachten

`events` abonniert Mitgliedschaftsänderungen in jeder Gruppe im Scope und gibt einen Snapshot aller Gruppen zu ihren Mitgliedern zurück.

```lua
local sub, snapshot, err = group:events()
-- snapshot: { ["workers"] = {pid, ...}, ["all"] = {pid, ...} }

local event = sub:channel():receive()
sub:close()
```

**Gibt zurück:** `pg.Subscription, table, error`

**Berechtigung:** `pg.events`

### Ereignis-Felder

Ereignisse, die auf einem Abonnement-Channel geliefert werden, enthalten:

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `system` | string | Immer `"pg"` |
| `kind` | string | `"member.joined"` oder `"member.left"` |
| `path` | string | Der Gruppenname |
| `data` | table | `{Group = string, PIDs = string[]}` — die betroffenen Mitglieder |

Abonnement-Channels sind gepuffert (Kapazität 64); wenn ein langsamer Konsument den Puffer füllt, werden weitere Ereignisse für dieses Abonnement verworfen.

## Freigeben

```lua
group:release()
```

Gibt die Instanz sofort frei. Idempotent; nach der Freigabe gibt jede Methode einen Fehler zurück. Die Bereinigung läuft auch automatisch, wenn der Prozess endet.

**Gibt zurück:** `boolean`

## Berechtigungen

| Berechtigung | Methode | Ressource |
|--------------|---------|-----------|
| `pg.open` | `pg.open()` | Scope-ID |
| `pg.join` | `join()` | Gruppenname |
| `pg.leave` | `leave()` | Gruppenname |
| `pg.get_members` | `get_members()` | Gruppenname |
| `pg.get_local_members` | `get_local_members()` | Gruppenname |
| `pg.which_groups` | `which_groups()` | (Scope) |
| `pg.which_local_groups` | `which_local_groups()` | (Scope) |
| `pg.broadcast` | `broadcast()` | Gruppenname |
| `pg.broadcast_local` | `broadcast_local()` | Gruppenname |
| `pg.monitor` | `monitor()` | Gruppenname |
| `pg.events` | `events()` | (Scope) |

## Fehler

| Bedingung | Art |
|-----------|-----|
| Berechtigung verweigert | `errors.PERMISSION_DENIED` |
| Fehlendes oder leeres Argument | `errors.INVALID` |
| Scope nicht gefunden | `errors.NOT_FOUND` |
| Gruppe verlassen ohne Mitgliedschaft | `errors.INVALID` |
| Instanz freigegeben | `errors.INVALID` |

Siehe [Fehlerbehandlung](lua/core/errors.md) für die Arbeit mit Fehlern.

## Siehe auch

- [Prozessgruppen](system/process-groups.md) - Scope-Eintragstyp und Konfiguration
- [Cluster](guides/cluster.md) - Mitgliedschaft, Benennung und das Clustering-Modell
- [Prozessverwaltung](lua/core/process.md) - Spawnen und Messaging einzelner Prozesse
