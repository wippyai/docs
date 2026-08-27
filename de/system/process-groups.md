---
title: "Prozessgruppen"
description: "Konfigurieren Sie clusterfähige benannte Prozessgruppen mit dezentraler Mitgliedschaft, Broadcasts, Monitoring und Abgleich."
---

# Prozessgruppen

Ein `pg.scope` ermöglicht Prozessen, benannten Gruppen beizutreten und an eine Gruppe adressierte Broadcasts zu empfangen. Das Modell folgt Erlang/OTP `pg`: Gruppen entstehen beim ersten Beitritt, ein Prozess kann mehreren Gruppen angehören und derselben Gruppe mehrfach beitreten, und jeder Cluster-Knoten verwaltet seinen eigenen Mitgliedschaftszustand und gleicht ihn über das Internode-Mesh mit Peers ab. Diese Seite ist eine Konfigurations- und Verhaltensreferenz; die YAML-Blöcke sind Entry-Fragmente.

Die Lua-API ist unter [Prozessgruppen](../lua/core/pg.md) dokumentiert; diese Seite behandelt den Scope-Entry-Typ und seine Konfiguration. Siehe den [Cluster-Leitfaden](../guides/cluster.md) für das umgebende Mitgliedschaftsmodell.

## Eintragstyp

| Typ | Beschreibung |
|-----|--------------|
| `pg.scope` | Ein unabhängiger Prozessgruppen-Namespace mit eigenem Mitgliedschaftszustand und Cluster-Mesh |

Jeder Scope ist isoliert: Gruppen und Mitglieder in einem Scope sind für einen anderen unsichtbar. Ein Prozess öffnet einen Scope über seine Eintrag-ID (`pg.open("app:pg")`) und operiert darin.

```yaml
- name: pg
  kind: pg.scope
  lifecycle:
    auto_start: true
```

## Konfiguration

Alle Felder sind optional. Die Tabelle führt ihre Standardwerte auf.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `protocol_timeout` | duration | 5s | Timeout für Inter-Knoten-Sync-/Discover-Operationen |
| `broadcast_timeout` | duration | 5s | Timeout für die Zustellung eines Broadcasts an ein einzelnes Mitglied |
| `anti_entropy_interval` | duration | 30s | Takt der Reconcile-Schleife; pro Tick wird ein Peer synchronisiert |
| `circuit_breaker_failures` | int | 3 | Aufeinanderfolgende Sendefehler zu einem Knoten, bevor sein Circuit öffnet |
| `circuit_breaker_reset_time` | duration | 10s | Wartezeit, bevor ein offener Circuit in den Half-Open-Zustand für einen Test-Send wechselt |
| `max_retries` | int | 3 | Wiederholungsversuche für einen fehlgeschlagenen Broadcast |
| `retry_base_delay` | duration | 100ms | Initiale Backoff-Verzögerung zwischen Wiederholungen |
| `retry_max_delay` | duration | 1s | Maximale Backoff-Verzögerung |
| `action_queue_size` | int | 256 | Tiefe, bei der eine "nähert sich der Kapazität"-Warnung protokolliert wird |
| `action_queue_max_size` | int | 1024 | Harte Kapazität der internen Event-Loop-Queue; Operationen werden bei Überfüllung verworfen |
| `monitor_buffer` | int | 64 | Event-Channel-Kapazität pro Abonnement; Ereignisse werden für einen Abonnenten verworfen, dessen Puffer voll ist |
| `max_groups` | int | 0 | Maximale Anzahl unterschiedlicher Gruppen (0 = unbegrenzt) |
| `max_members_per_group` | int | 0 | Maximale Mitglieder pro Gruppe, inkl. Multi-Joins (0 = unbegrenzt) |

```yaml
- name: pg
  kind: pg.scope
  anti_entropy_interval: 30s
  circuit_breaker_failures: 3
  max_members_per_group: 10000
  lifecycle:
    auto_start: true
```

## Funktionsweise

**Single-Writer-Zustand.** Jeder Scope betreibt eine Single-Goroutine-Event-Loop (das gen_server-Muster). Alle Mutationen werden über sie serialisiert; Lesevorgänge von Mitgliedern und Gruppen werden aus atomar veröffentlichten Snapshots bedient, sodass sie die Loop niemals blockieren.

**Beitritts-/Verlassens-Propagierung.** Ein lokaler Beitritt oder Austritt wird auf die Loop angewendet und dann an die Vereinigung der lebenden Mitglieds-Peers und aller zuvor entdeckten Remote-Knoten ausgefächert. Das Senden an diese Vereinigung stellt sicher, dass ein frisch beigetretener oder noch nicht konvergierter Knoten die Änderung trotzdem erhält.

**Broadcast.** `broadcast` snapshottiert die vollständige cluster-übergreifende Mitgliederliste innerhalb der Loop und liefert dann außerhalb der Loop an jedes Mitglied, sodass ein langsamer Empfänger den Scope nicht blockieren kann. `broadcast_local` macht dasselbe, aber nur für Mitglieder auf dem lokalen Knoten.

**Monitor und Events.** Das Abonnieren und Snapshotting der aktuellen Mitglieder geschieht in einem Event-Loop-Tick, sodass ein Abonnent niemals eine Änderung verpasst oder doppelt zählt, die das Abonnement überholt. Abonnenten erhalten `member.joined` / `member.left`-Ereignisse; ein Austritt für einen Prozess, der N-mal beigetreten ist, meldet die PID N-mal und bewahrt so die Multiplizität.

**Anti-Entropy und Discovery.** Beim Start sendet ein Scope Discover-Nachrichten an eine kleine zufällige Teilmenge von Peers (begrenzt, um einen N²-Sturm zu vermeiden, wenn viele Knoten gleichzeitig neu starten). Wenn ein Knoten beitritt, erhält er einen vollständigen Zustandssync. Die Anti-Entropy-Schleife drückt dann periodisch einen vollständigen Sync zu einem Peer gleichzeitig, sodass jeder Broadcast, den ein Peer verpasst hat, schließlich konvergiert. Der Empfänger wendet einen differenziellen Sync an — nur tatsächlich hinzugefügte oder entfernte Mitglieder lösen Ereignisse aus.

**Circuit Breaker.** Ein knotenspezifischer Circuit Breaker verfolgt aufeinanderfolgende Sendefehler. Nach `circuit_breaker_failures` Fehlern öffnet er und Sends an diesen Knoten werden übersprungen, bis `circuit_breaker_reset_time` verstreicht, wonach ein Test-Send zugelassen wird. Beitritts-/Verlassens-Broadcasts, die auf einen offenen Breaker treffen, werden mit exponentiellem Backoff bis zu `max_retries` wiederholt.

## Observability

Ein Liveness-Health-Check (`pg.broadcast_recent.<scope>`) meldet einen ungesunden Zustand, wenn ein Scope über längere Zeit keinen Broadcast-Verkehr erkennt, und macht dadurch eine blockierte Event-Loop oder anhaltende Partition sichtbar. Siehe den [Observability-Leitfaden](../guides/observability.md).

## Siehe auch

- [Prozessgruppen](../lua/core/pg.md) - Die Lua-API
- [Cluster](../guides/cluster.md) - Mitgliedschaft und das Clustering-Modell
- [Prozessmodell](../concepts/process-model.md) - Prozesse, PIDs und Messaging
