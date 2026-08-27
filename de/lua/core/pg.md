---
title: "Prozessgruppen"
description: "Clusterweite Prozessgruppen, Mitgliedschaften, Broadcasts und Mitgliedschaftsabonnements verwalten."
---

# Prozessgruppen
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="permissions"/>

Prozessgruppen organisieren Prozesse unter dynamischen Namen und senden Nachrichten an Gruppenmitglieder im gesamten Cluster. Ein Prozess kann mehreren Gruppen beitreten; die clusterweite Mitgliedschaft ist letztlich konsistent.

Diese Seite ist eine API-Referenz. Ihre Snippets setzen einen vorhandenen `pg.scope`, einen ausführbaren Eintrag mit Prozesskontext und Richtlinien voraus, die die dokumentierten Operationen erlauben. Die Blöcke demonstrieren einzelne Aufrufe oder partielle Abonnementabläufe und keine eigenständige Anwendung.

Den Scope-Entry-Kind und seine Konfiguration beschreibt [Prozessgruppen](../../system/process-groups.md). Das umfassendere Clustering-Modell behandelt der [Cluster-Leitfaden](../../guides/cluster.md).

## Laden

```lua
local pg = require("pg")
```

Fügen Sie `pg` zur `modules:`-Liste des ausführbaren Eintrags hinzu, bevor Sie das Modul laden.

## Einen Scope öffnen

Eine Prozessgruppe gehört zu einem **Scope**, der durch einen Registry-Eintrag vom Typ `pg.scope` dargestellt wird. Öffnen Sie den Scope, um eine Instanz für Gruppenoperationen zu erhalten:

```lua
local group, err = pg.open("app:pg")
if err then
    return nil, err
end
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `id` | string | Scope-Eintrags-ID im Format `"namespace:name"` |

**Rückgabewerte:** `pg.Instance, error`

**Berechtigung:** `pg.open` auf der Scope-`id`

Die Instanz wird bei der Bereinigung des Ausführungsframes automatisch freigegeben. Mit `release()` geben Sie sie früher frei. Alle anderen Operationen sind Methoden der Instanz und verwenden die Syntax `:`.

## Beitreten und Verlassen

Die folgenden Aufrufe sind unabhängige Formen. Wählen Sie den Einzelgruppen- oder Batch-Beitritt, den die Anwendung benötigt, und kombinieren Sie ihn mit den entsprechenden Leave-Operationen.

```lua
local ok, err = group:join("workers")           -- single group
if err then return nil, err end
```

```lua
local ok, err = group:join({"workers", "all"})  -- batch
if err then return nil, err end
```

```lua
local ok, err = group:leave("workers")
if err then return nil, err end
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `group` | string \| string[] | Gruppenname oder Namensliste für eine Batch-Operation |

**Rückgabewerte:** `boolean, error`

Ein Prozess kann derselben Gruppe mehrfach beitreten und muss sie ebenso oft verlassen, um vollständig auszuscheiden. Bei einem Batch arbeitet `leave` nach Best Effort und gibt nur dann einen Fehler zurück, wenn der Prozess keiner der genannten Gruppen angehörte.

**Berechtigungen:** `pg.join` / `pg.leave` auf jedem Gruppennamen

## Mitglieder auflisten

```lua
local members, err = group:get_members("workers")        -- all nodes
if err then return nil, err end

local local_members, err = group:get_local_members("workers")  -- this node only
if err then return nil, err end
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `group` | string | Gruppenname |

**Rückgabewerte:** `string[], error` — ein Array von PID-Strings; bei einer unbekannten Gruppe leer

**Berechtigungen:** `pg.get_members` / `pg.get_local_members` auf dem Gruppennamen

## Gruppen auflisten

```lua
local groups, err = group:which_groups()         -- all groups in the cluster
if err then return nil, err end

local local_groups, err = group:which_local_groups()  -- groups with a local member
if err then return nil, err end
```

**Rückgabewerte:** `string[], error` — Gruppennamen, die aktuell mindestens ein Mitglied haben

**Berechtigungen:** `pg.which_groups` / `pg.which_local_groups`

## Broadcasts

Ein Broadcast sendet eine Nachricht vom aufrufenden Prozess unter `topic` an jedes Gruppenmitglied. Mitglieder empfangen sie mit `process.listen(topic)`.

```lua
local ok, err = group:broadcast("workers", "task", {id = 42})   -- all nodes
if err then return nil, err end

ok, err = group:broadcast_local("workers", "task", {id = 42})  -- this node only
if err then return nil, err end
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `group` | string | Zielgruppe |
| `topic` | string | Nachrichten-Topic |
| `...` | any | Null oder mehr Payload-Werte |

**Rückgabewerte:** `boolean, error`

**Berechtigungen:** `pg.broadcast` / `pg.broadcast_local` auf dem Gruppennamen

## Eine Gruppe überwachen

`monitor` abonniert Beitritts- und Austrittsereignisse einer Gruppe und gibt einen atomaren Snapshot ihrer aktuellen Mitglieder zurück. Zwischen Snapshot und Einrichtung des Abonnements kann keine Mitgliedschaftsänderung unbeobachtet bleiben.

```lua
local sub, members, err = group:monitor("workers")
if err then
    return nil, err
end

for _, pid in ipairs(members) do
    -- current members at subscription time
end

local ch = sub:channel()
local event, open = ch:receive()  -- {kind = "member.joined" | "member.left", path = "workers", data = {...}}
if not open then
    return nil, errors.new("Process-group subscription closed")
end

sub:close()  -- unsubscribe; sub:close({flush = true}) drains queued events first
```

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `group` | string | Zu überwachende Gruppe |

**Rückgabewerte:** `pg.Subscription, string[], error` — das Abonnement und ein Snapshot der aktuellen Mitglieder

**Berechtigung:** `pg.monitor` auf dem Gruppennamen

## Alle Gruppen beobachten

`events` abonniert Mitgliedschaftsänderungen jeder Gruppe im Scope und gibt einen Snapshot zurück, der Gruppen ihren Mitgliedern zuordnet.

```lua
local sub, snapshot, err = group:events()
if err then
    return nil, err
end
-- snapshot: { ["workers"] = {pid, ...}, ["all"] = {pid, ...} }

local event, open = sub:channel():receive()
if not open then
    return nil, errors.new("Process-group subscription closed")
end
sub:close()
```

**Rückgabewerte:** `pg.Subscription, table, error`

**Berechtigung:** `pg.events`

### Ereignisfelder

Über den Channel eines Abonnements gelieferte Ereignisse enthalten:

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `system` | string | Immer `"pg"` |
| `kind` | string | `"member.joined"` oder `"member.left"` |
| `path` | string | Gruppenname |
| `data` | table | `{Group = string, PIDs = string[]}` — die betroffenen Mitglieder |

Abonnement-Channels sind gepuffert (Kapazität 64). Füllt ein langsamer Consumer den Puffer, bleiben weitere Ereignisse geordnet in der Prozess-Mailbox und werden zugestellt, sobald der Consumer den Channel leert. Das Abonnement hält also an, statt Ereignisse zu verwerfen.

## Freigeben

```lua
group:release()
```

`release` gibt die Instanz sofort frei und ist idempotent. Nach der Freigabe gibt jede andere Gruppenoperation einen Fehler zurück. Die Bereinigung erfolgt außerdem automatisch am Ende des Ausführungsframes.

**Rückgabewert:** `boolean`

## Berechtigungen

| Berechtigung | Methode | Ressource |
|--------------|---------|-----------|
| `pg.open` | `pg.open()` | Scope-ID |
| `pg.join` | `join()` | Gruppenname |
| `pg.leave` | `leave()` | Gruppenname |
| `pg.get_members` | `get_members()` | Gruppenname |
| `pg.get_local_members` | `get_local_members()` | Gruppenname |
| `pg.which_groups` | `which_groups()` | - |
| `pg.which_local_groups` | `which_local_groups()` | - |
| `pg.broadcast` | `broadcast()` | Gruppenname |
| `pg.broadcast_local` | `broadcast_local()` | Gruppenname |
| `pg.monitor` | `monitor()` | Gruppenname |
| `pg.events` | `events()` | - |

## Fehler

| Bedingung | Art |
|-----------|-----|
| Berechtigung verweigert | `errors.PERMISSION_DENIED` |
| Fehlendes oder leeres Argument | `errors.INVALID` |
| Scope nicht gefunden | `errors.INTERNAL` |
| Gruppe ohne Mitgliedschaft verlassen | `errors.NOT_FOUND` |
| Instanz freigegeben | `errors.INVALID` |
| Gruppen-, Mitglieder- oder Aktions-Queue-Limit erreicht | `errors.RATE_LIMITED` (wiederholbar) |
| Service gestoppt, Backpressure oder offener Circuit | `errors.UNAVAILABLE` |
| Broadcast-Zeitlimit überschritten | `errors.TIMEOUT` (wiederholbar) |

Siehe [Fehlerbehandlung](errors.md) für den Umgang mit Fehlern.

## Siehe auch

- [Prozessgruppen](../../system/process-groups.md) - Scope-Entry-Kind und Konfiguration
- [Cluster](../../guides/cluster.md) - Mitgliedschaft, Benennung und Clustering-Modell
- [Prozessverwaltung](process.md) - Einzelne Prozesse starten und Nachrichten senden
