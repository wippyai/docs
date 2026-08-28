---
title: "Cluster"
description: "Konfigurieren Sie Wippy-Knoten für Gossip-Mitgliedschaft, begrenzten Raft-Konsens, Prozessnamen, verteilte Sperren und Prozessgruppen."
---

# Cluster

Wippy läuft standardmäßig als einzelner Knoten. Aktiviertes Clustering verbindet Knoten über Gossip-Mitgliedschaft und einen begrenzten Raft-Konsenskern und ermöglicht clusterweite Prozessnamen, verteilte Sperren und Prozessgruppen-Nachrichten.

Clustering ist deaktiviert, bis `cluster.enabled` auf `true` gesetzt wird.

## Was Clustering bietet

- **Mitgliedschaft** — jeder Knoten kennt die aktiven Peers durch Gossip, mit schneller Fehlererkennung.
- **Clusterweite Prozessnamen** — einen Prozess unter einem Namen registrieren, der von jedem Knoten aus auflösbar ist, mit Wahl der Konsistenzgarantien (siehe [Benennung](#benennung-und-namens-scopes)).
- **Verteilte Sperren** — `system.lock` bietet clusterweiten gegenseitigen Ausschluss mit automatischer Freigabe, wenn der Halter abstirbt (siehe [Verteilte Sperren](#verteilte-sperren)).
- **Prozessgruppen** — an jedes Mitglied einer benannten Gruppe über alle Knoten hinweg senden (siehe [Prozessgruppen](#prozessgruppen)).
- **Replizierte Key-Value-Stores** — `store.kv.raft` (stark) und `store.kv.crdt` (eventuell konsistent) replizieren KV-Daten zwischen Knoten (siehe [Store](system/store.md#cluster-kv-stores)).
- **Ein Konsenskern** — ein kleiner, begrenzter Raft-Cluster bietet das linearisierbare Fundament, auf dem die Benennungs- und Sperr-Primitive aufbauen.

## Architektur: begrenztes Raft

Jeden Knoten zu einem Raft-Peer zu machen skaliert schlecht: der Leader repliziert jeden Log-Eintrag an jeden Peer, sodass die Leerlauf-Leader-Last mit der Clustergröße wächst. Wippy begrenzt Raft auf einen fest großen Kern und lässt den Rest des Clusters über Gossip laufen. Jeder Knoten nimmt in der Raft-Konfiguration eine von drei Rollen ein:

| Rolle | Anzahl (Standard) | In Raft-Konfiguration | Empfängt Log-Replikation | Abstimmt |
|-------|-------------------|----------------------|--------------------------|----------|
| **Voter** | bis zu 5 (`max_voters`, ungerade) | ja | ja | ja |
| **Standby** | bis zu 4 (`max_standbys`) | ja | ja | nein |
| **Client** | unbegrenzt | nein | nein | nein |

- **Voter** bilden das Quorum. Schreibvorgänge werden bestätigt, sobald eine Mehrheit der Voter sie anerkennt. `max_voters` wird auf eine ungerade Obergrenze normalisiert, standardmäßig 5. Bei mindestens drei berechtigten Knoten wählt der Reconciler ebenfalls eine ungerade Voter-Anzahl. Bei zwei berechtigten Knoten und einer Obergrenze über eins werden beide Voter; `max_voters: 1` behält einen einzelnen Voter.
- **Standbys** sind nicht-abstimmende Mitglieder, die vollständig repliziert und betriebsbereit gehalten werden. Wenn ein Voter ausscheidet, befördert der Leader den am höchsten eingestuften Standby in den freien Voter-Slot, sodass das Quorum wiederhergestellt wird, ohne auf einen frischen Knoten warten zu müssen.
- **Clients** sind alle Knoten jenseits von `voters + standbys`. Sie sind überhaupt nicht in der Raft-Konfiguration, sodass der Leader ihnen niemals Log-Einträge sendet. Sie nehmen am Gossip teil und leiten Schreibvorgänge an ein Raft-Mitglied weiter. Dies hält die Leerlauf-Leader-CPU konstant (O(1)), egal wie groß der Cluster wird.

Da Standbys und Clients den Rest der Flotte aufnehmen können, hat ein Cluster mit Hunderten von Knoten weiterhin einen 5-Voter-Konsenskern. Die `max_voters`/`max_standbys`-Obergrenzen machen das Design "begrenzt".

### Voter-Auswahl

Der Leader betreibt einen Reconciler, der bei jeder Mitgliedschaftsänderung (gedrosselt durch `raft.reconcile_debounce`, Standard 2s) neu berechnet, welche Knoten Voter sein sollen, und die minimale Menge an Promote/Demote-Operationen anwendet. Die Auswahl ist deterministisch — jeder Knoten leitet dieselbe Reihenfolge aus derselben Gossip-Sicht ab — und wird durch drei gossip-beworbene Hinweise gesteuert:

- `raft.eligible` — ein Knoten mit `eligible: false` wird sowohl von der Voter- als auch von der Standby-Auswahl ausgeschlossen und bleibt außerhalb von Raft ein Client. Soll ein Knoten als Standby dienen, lassen Sie ihn berechtigt, aber unterhalb der Voter-Grenze.
- `raft.priority` — niedrigerer Wert wird beim Füllen von Voter-Slots bevorzugt; Gleichstände werden nach Knoten-ID aufgelöst.
- `failure_domain` — Voter werden zuerst über verschiedene Domains (Zonen/Racks) verteilt, damit der Ausfall einer Domain keine Voter-Mehrheit treffen kann.

Operationen werden in einer quorumserhaltenden Reihenfolge angewendet: zuerst Hinzufügungen und Beförderungen, dann Herabstufungen, dann Entfernungen.

## Mitgliedschaft und Gossip

Mitgliedschaft nutzt SWIM-Gossip (HashiCorp memberlist). Jeder Knoten bindet einen Gossip-Port (Standard **7946**) und tauscht kontinuierlich kleine Nachrichten mit Peers aus, um Ausfälle zu erkennen und Metadaten zu verbreiten.

Ein Knoten tritt bei, indem er auf einen oder mehrere bestehende Knoten zeigt:

```yaml
cluster:
  enabled: true
  name: node-2
  membership:
    join_addrs: "node-1:7946"
  internode:
    identity_key_file: /etc/wippy/node-2.identity
    trusted_peer_keys:
      node-1: "${env:NODE_1_PUBLIC_KEY}"
      node-2: "${env:NODE_2_PUBLIC_KEY}"
```

Der erste Knoten benötigt keine `join_addrs`; er startet als Seed. Beitritte werden mit Backoff wiederholt, und ein isolierter Knoten versucht regelmäßig erneut beizutreten. Das unterstützt Knoten, die wie häufig in Kubernetes mit einer neuen IP neu starten.

Gossip kann mit einem gemeinsamen Schlüssel verschlüsselt werden, der inline oder aus einer Datei angegeben wird:

```yaml
cluster:
  membership:
    secret_file: /etc/wippy/cluster.key
```

Der Gossip-Schlüssel schützt den Mitgliedschaftsverkehr. Internode-TCP-Verbindungen verwenden eine separate Ed25519-Identität. Jeder Clusterknoten muss entweder `internode.identity_key` oder `internode.identity_key_file` bereitstellen; `trusted_peer_keys` muss den passenden öffentlichen Schlüssel für den lokalen Knoten und jeden erreichbaren Peer enthalten. `identity_key` enthält einen Base64-kodierten Seed mit 32 Byte oder privaten Schlüssel mit 64 Byte; vertrauenswürdige Peer-Werte sind Base64-kodierte öffentliche Schlüssel. Verwenden Sie für jeden Knoten einen eigenen privaten Schlüssel und verteilen Sie dieselbe Karte vertrauenswürdiger öffentlicher Schlüssel an alle Knoten.

Mitgliedschaftsänderungen (`NodeJoined`, `NodeLeft`, `NodeUpdated`) sind die Ereignisse, die Raft-Bootstrap, Voter-Reconciliation, Prozessgruppen-Sync und automatische Bereinigung von Namen eines ausgeschiedenen Knotens antreiben.

## Bootstrap

Der initiale Cluster bildet sich durch Gossip, nicht durch eine statische Peer-Liste. Dies folgt dem Consul/Nomad `bootstrap_expect`-Muster: jeder startende Knoten wird informiert, wie viele Knoten erwartet werden, und wartet, bis alle sich gegenseitig sehen können, bevor gemeinsam ein Quorum gebildet wird.

| `bootstrap_expect` | Verhalten |
|--------------------|-----------|
| `0` | Kein Selbst-Bootstrap; nur einem bereits existierenden Cluster beitreten |
| `1` | Einzelknoten; sofort mit sich selbst als einzigem Voter bootstrappen |
| `N` | Warten, bis `N` berechtigte Knoten einschließlich des lokalen Knotens stabil im Gossip sichtbar sind, dann gemeinsam ein Quorum bilden |

Für einen `N`-Knoten-Bootstrap wird auf jedem anfänglichen Knoten dasselbe `bootstrap_expect: N` gesetzt. Jeder bewirbt im Gossip einen "Pre-Bootstrap"-Status; sobald genau `N` solche Peers für ein kurzes Stabilitätsfenster sichtbar sind, berechnet jeder Knoten unabhängig die identische sortierte Voter-Liste und bildet den Cluster. Das Stabilitätsfenster verhindert, dass eine kurze, partielle Sicht den Bootstrap vorzeitig auslöst.

Später startende Knoten sehen einen bereits gebildeten Cluster und überspringen den Bootstrap vollständig — der Reconciler des Leaders fügt sie als Voter oder Standbys hinzu.

## Raft-Konsenskern

Der Raft-Zustand ist **standardmäßig dateisystempersistent**: Logs und Snapshots liegen unter `cluster.raft.data_dir` (standardmäßig `~/.wippy/store`, in `_sys/raft`), und [`store.kv.raft`](system/store.md#cluster-kv-stores) repliziert über denselben Kern. Ein neu gestarteter Knoten tritt Gossip wieder bei und holt den Zustand von Peers nach. Ein Knoten läuft nur dann ohne Datenträger, wenn kein Datenverzeichnis aufgelöst werden kann — siehe [Wiederherstellung](#wiederherstellung-und-fehlermodi).

Raft öffnet keinen eigenen Listener-Port. Es nutzt das **Internode-Mesh**, also dieselben TCP-Verbindungen wie der Relay-Verkehr zwischen Knoten. Der Internode-Port wird beim Start automatisch ausgewählt, festgelegt und in Gossip angekündigt. Knoten müssen einander sowohl am Gossip-Port als auch an ihren angekündigten Internode-TCP-Ports erreichen können.

Das Raft-FSM hält die globale Namensregistrierung: aktive `name -> PID`-Bindungen plus laufende Strong-Reservierungen. Das ist es, was die nachfolgenden Benennungs-Primitive lesen und schreiben.

## Benennung und Namens-Scopes

Ein Prozess kann unter einem Namen registriert und über diesen Namen statt seiner rohen PID erreicht werden. Die wichtigste Entscheidung ist der **Scope**, der die Konsistenzgarantie auswählt. Vier Scopes sind verfügbar, von günstigsten/schwächsten bis stärksten:

| Scope | Unterstützt durch | Sichtbarkeit | Garantie |
|-------|-------------------|--------------|----------|
| **Local** | Knotenspezifische Map | nur dieser Knoten | Sofort, knotenlokal; keine Koordination |
| **Eventual** | Gossip CRDT | clusterweit | Eventual Consistent; konvergiert nach Gossip-Runden |
| **Consistent** | Raft | clusterweit | Linearisierbare Schreibvorgänge; einzigartiger Singleton im Cluster |
| **Strong** | Raft + Bestätigung aller Knoten | clusterweit | Konsistent, plus jeder lebende Knoten bestätigt, bevor der Name aktiv ist |

Auswahlhilfe:

- **Local** — Namen, die nur auf einem Knoten bedeutsam sind (ein knotenspezifischer Helfer). Wird freigegeben, sobald der Prozess beendet wird. Keine Kosten.
- **Eventual** — clusterweite Dienst-, Gruppen- und Präsenznamen, bei denen ein kurzes veraltetes Fenster akzeptabel ist. Der Bindungssatz wird auf jeden Knoten vollständig repliziert, eignet sich also für einen begrenzten Namensraum — nicht einen Namen pro Entität mit hoher Kardinalität wie einen Prozess pro Sitzung (diese direkt per PID adressieren). Wenn zwei Ursprünge denselben Namen registrieren, wählt die Konfliktauflösung einen Gewinner, und der verlierende Prozess erhält ein Cancel-Event (`process.event.CANCEL`) mit dem Grund `name revoked: <name>`; er läuft weiter und kann sich neu registrieren. Namen werden freigegeben, wenn der besitzende Knoten ausscheidet.
- **Consistent** — die Standardwahl für clusterweite benannte Singletons. First-Write-Wins: eine zweite Registrierung desselben Namens für eine andere PID schlägt mit "already exists" fehl und gibt den aktuellen Besitzer zurück. Schreibvorgänge benötigen ein Quorum, sodass sie in einer Minderheitspartition blockieren. Lesevorgänge kommen aus dem lokalen Raft-Replikat und können einem Schreibvorgang um einige Millisekunden hinterherhinken.
- **Strong** — die kleine Menge von Control-Plane-Singletons, bei denen sogar ein momentanes veraltetes Lesen gefährlich ist. Zusätzlich zur Consistent-Garantie öffnet die Registrierung eine Reservierung, die jeder lebende Knoten bestätigen muss, bevor der Name autoritativ wird; jeder Knoten, der bereits eine konflikthafte Bindung hält, lehnt sie sofort ab. Wenn die Deadline verstreicht, bevor alle Knoten bestätigen, läuft die Registrierung ab und meldet, welche Knoten fehlten. Dies ist die Grundlage für verteilte Sperren.

Namen werden automatisch freigegeben: Local beim Prozessende; Consistent und Strong beim Prozessende (über Topology-Monitoring) und beim Knotenausscheiden; Eventual beim Knotenausscheiden. Die Auflösung für Messaging (`process.send`, `process.terminate` und ähnliche) konsultiert die Ebenen der Reihe nach — Consistent, dann Eventual, dann Local — sodass ein Consistent-Name einen Eventual-Namen mit derselben Zeichenkette überschattet.

Die Lua-Oberfläche für Benennung liegt auf `process.registry` — siehe die [Prozessreferenz](lua/core/process.md).

## Prozessgruppen

Prozessgruppen sind eine cluster-aware Publish/Subscribe- und Mitgliedschaftseinrichtung, modelliert nach Erlang's `pg`. Ein Prozess tritt einer benannten Gruppe bei; ein Broadcast verteilt sich über das Internode-Mesh an die Mitglieder der Gruppe über alle Knoten hinweg, best-effort zugestellt. Gruppen sind eventual consistent und unabhängig von Raft — sie nutzen die Gossip-Mitgliedschaftssicht zur Auswahl der Empfänger — sodass sie auch funktionieren, während der Konsenskern konvergiert.

Typische Operationen: einer Gruppe beitreten/verlassen, an alle Mitglieder senden (oder nur lokale), Mitglieder auflisten und eine Gruppe auf Beitritts-/Verlassens-Ereignisse überwachen. Wenn ein neuer Knoten beitritt, reconcilen die Gruppen ihre Mitgliedschaft durch einen direkten Sync-Handshake, und eine Hintergrund-Anti-Entropy-Schleife behebt Abweichungen über die Zeit.

Siehe [Prozessgruppen](lua/core/pg.md) für die Lua-API und den [`pg.scope`-Entry-Kind](system/process-groups.md) für die Konfiguration.

## Verteilte Sperren

`system.lock` stellt clusterweiten gegenseitigen Ausschluss über einen Raft-linearisierbaren bedingten Schreibvorgang im gemeinsamen Key-Value-Store bereit. Das Erwerben führt ein Set-if-absent der Halter-PID unter `_sys:lock:<name>` aus; das Freigeben löscht den Eintrag, sofern ihn weiterhin der Aufrufer hält. Da der bedingte Schreibvorgang über Raft läuft und Schreibvorgänge abseits des Leaders weitergeleitet werden, ist er linearisierbar und erlaubt clusterweit höchstens einen Halter.

```lua
local ok, err = system.lock.acquire("orders.migration")
if not ok then
  -- err has kind errors.ALREADY_EXISTS when another process holds the lock.
  -- Apply the caller's retry and backoff policy for that case if needed.
  return nil, err
end

-- critical section: only one holder cluster-wide
local released, release_err = system.lock.release("orders.migration")
if release_err then
  return nil, release_err
end
return released
```

Erwerben ist fail-fast (nicht-blockierend): wenn die Sperre gehalten wird, kehrt es sofort zurück, sodass Aufrufer eigenes Retry/Backoff hinzufügen. Die Sperre wird automatisch freigegeben, wenn der Halterprozess endet oder sein Knoten ausscheidet, sodass Bereinigung automatisch erfolgt. Siehe die [System](lua/system/system.md)-Referenz für die genauen Signaturen.

## Konfiguration

Zugehörige Einstellungen beschreibt die [Konfiguration](guides/configuration.md#cluster). Die folgenden minimalen Formen enthalten die verpflichtenden Internode-Identitätseinstellungen.

Es handelt sich um Konfigurationsfragmente, nicht um ein vollständiges Deployment-Manifest. Ersetzen Sie Knotennamen, Adressen, Failure Domains, Pfade und jeden `${env:...}`-Identitätsplatzhalter durch für Ihren Cluster erzeugte und verteilte Werte.

Einzelknoten (Entwicklung):

```yaml
cluster:
  enabled: true
  name: dev
  internode:
    identity_key: "${env:DEV_PRIVATE_KEY}"
    trusted_peer_keys:
      dev: "${env:DEV_PUBLIC_KEY}"
  raft:
    bootstrap_expect: 1
```

Drei-Knoten-Voting-Cluster:

```yaml
cluster:
  enabled: true
  name: node-1
  failure_domain: us-east-1a
  membership:
    join_addrs: "node-2:7946,node-3:7946"
    secret_file: /etc/wippy/cluster.key
  internode:
    identity_key_file: /etc/wippy/node-1.identity
    trusted_peer_keys:
      node-1: "${env:NODE_1_PUBLIC_KEY}"
      node-2: "${env:NODE_2_PUBLIC_KEY}"
      node-3: "${env:NODE_3_PUBLIC_KEY}"
  raft:
    bootstrap_expect: 3
```

Gossip-only-Client (tritt für Benennung/Messaging bei, betreibt niemals Raft):

```yaml
cluster:
  enabled: true
  name: edge-7
  membership:
    join_addrs: "node-1:7946,node-2:7946"
  internode:
    identity_key_file: /etc/wippy/edge-7.identity
    trusted_peer_keys:
      node-1: "${env:NODE_1_PUBLIC_KEY}"
      node-2: "${env:NODE_2_PUBLIC_KEY}"
      edge-7: "${env:EDGE_7_PUBLIC_KEY}"
  raft:
    role: client
```

## Ports

| Zweck | Port | Protokoll | Konfigurationsschlüssel |
|-------|------|-----------|------------------------|
| Gossip (Mitgliedschaft) | 7946 | TCP + UDP | `cluster.membership.bind_port` |
| Internode-Mesh (Relay + Raft) | auto | TCP | `cluster.internode.bind_port` |

Raft wird über das Internode-Mesh gemultiplext und verwendet keinen separaten Port. Der Internode-Port wird automatisch zugewiesen und über Gossip angekündigt. Der Gossip-Port ist standardmäßig vorhersagbar, Peers müssen jedoch auch den angekündigten Internode-TCP-Port jedes Knotens erreichen können.

## Observability

Die Cluster-Gesundheit wird über den standardmäßigen [Prometheus-Endpoint](guides/observability.md) und Liveness-Prüfungen bereitgestellt.

Wichtige zu überwachende Metriken:

| Metrik | Bedeutung |
|--------|-----------|
| `raft_state` | 0 = Follower, 1 = Kandidat, 2 = Leader |
| `raft_term` | Aktueller Raft-Term; schnelle Anstiege signalisieren Wahlturbulenzen |
| `raft_voters` / `raft_non_voters` | Lebende Voter und Standbys in der Konfiguration |
| `raft_leader_changes_total` | Leader-Wechsel; sollte in einem gesunden Cluster nahezu konstant sein |
| `raft_voter_churn_burst_total` | Bursts von Voter-Hinzufüge-/Entferne-Operationen; anhaltende Fluktuation ist ein Warnsignal |
| `gossip_members{state}` | Zählungen nach Zustand (alive/suspect/dead/left) |
| `gossip_convergence_seconds` | Zeit zwischen Gossip-Ereignissen |

Eingebaute Liveness-Checks (am Liveness-Endpunkt verdrahtet):

- **gossip** — gesund, solange der Gossip-Health-Score des Knotens niedrig bleibt, mit einem Boot-Gnadenfenster, damit ein wieder beitretender Knoten nicht vorzeitig beendet wird.
- **raft last-contact** — ein abstimmender Follower schlägt fehl, wenn er kürzlich nicht vom Leader gehört hat; ein Standby toleriert eine viel längere Lücke; Leader bestehen immer.
- **Prozessgruppen-Broadcast** — schlägt fehl, wenn eine Gruppe für einen längeren Zeitraum keinen Broadcast-Verkehr sieht, was eine blockierte Event-Schleife oder eine anhaltende Partition anzeigt.

## Wiederherstellung und Fehlermodi

Der Raft-Zustand ist fs-dauerhaft, aber die primäre Dauerhaftigkeit des Clusters kommt weiterhin von einem lebendigen Quorum. Die praktischen Regeln:

- Eine Voter-Mehrheit am Leben erhalten. Mit 5 Votern toleriert man 2 gleichzeitige Voter-Ausfälle; Standbys werden befördert, um offene Slots zu füllen. Unter eine Mehrheit zu fallen bedeutet, dass Schreibvorgänge (neue Consistent/Strong-Registrierungen und Sperrerwerbe) blockieren, bis das Quorum zurückkehrt. Bestehende Namen und Lookups werden weiterhin aus lokalen Replikaten bedient.
- Der Leader entfernt proaktiv einen Voter, der sowohl heartbeat-still als auch gossip-tot ist, damit ein toter Voter das Quorum nicht dauerhaft blockiert, während ein Standby befördert wird.
- Um einen Cluster wiederherzustellen, der das Quorum verloren hat, werden die ausgefallenen Knoten neu gestartet. Sie treten dem Gossip wieder bei und die überlebenden Mitglieder nehmen sie wieder auf. Das Verteilen von Votern über `failure_domain`s verhindert, dass ein einzelner Zonenausfall zu Quorumverlust führt.

## Siehe auch

- [Konfiguration](guides/configuration.md#cluster) — zugehörige Cluster-Einstellungen
- [Prozess](lua/core/process.md) — Prozesse nach Namen registrieren und auflösen
- [System](lua/system/system.md) — `system.cluster`, `system.raft`, `system.node`, `system.lock`
- [Observability](guides/observability.md) — Metriken und Health-Endpoints
- [Prozessmodell](concepts/process-model.md) — Aktoren, PIDs und Nachrichten
