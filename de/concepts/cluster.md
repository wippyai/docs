---
title: "Cluster"
description: "Wie Wippy-Knoten Peers erkennen, Prozessnachrichten routen und sich über Gossip und Raft koordinieren."
---

# Cluster

Ein einzelner Wippy-Knoten ist eine vollständige Runtime. Ein **Cluster** verbindet mehrere Knoten, damit Prozesse clusterweite Namen verwenden, Nachrichten zwischen Knoten routen und sich über Sperren, Gruppen und einen gemeinsamen Konsenskern koordinieren können.

Clustering ist optional (`cluster.enabled`). Diese Seite beschreibt das für Ihren Code sichtbare Modell; Topologie, Konfiguration und Betrieb behandelt der [Cluster-Leitfaden](guides/cluster.md).

## Clustermodell

Knoten erkennen einander über **Gossip** (SWIM). Ein Knoten tritt über einen Seed bei; anschließend konvergieren Mitgliedschafts- und Fehlerinformationen ohne zentralen Koordinator. Ein begrenzter **Raft**-Kern stellt linearisierbaren Konsens über eine dynamisch abgeglichene Wählermenge bereit, während weitere Knoten über Gossip teilnehmen.

Das Anwendungsmodell besteht aus drei Teilen: **Namen**, **Routing** und **Koordinationsprimitiven**.

## Benennung

Ein Prozess wird normalerweise über seine PID adressiert. In einem Cluster kann er zusätzlich unter einem **Namen** registriert und von anderen Knoten über diesen Namen erreicht werden. Der ausgewählte **Scope** bestimmt Konsistenzgarantie und Koordinationsaufwand:

| Scope | Sichtbarkeit | Garantie | Geeignet für |
|-------|------------|-----------|------------|
| **Local** | dieser Knoten | sofort, ohne Koordination | knotenlokale Hilfsprozesse |
| **Eventual** | clusterweit | konvergiert nach Gossip; Konflikte werden aufgelöst und der Verlierer benachrichtigt | Service-, Gruppen- und begrenzte Präsenznamen |
| **Consistent** | clusterweit | linearisierbares Singleton über Raft | standardmäßiger clusterweiter benannter Service |
| **Strong** | clusterweit | Consistent, zusätzlich bestätigt jeder aktive Knoten den Namen vor seiner Aktivierung | Control-Plane-Singletons und Sperren |

Die Scopes sind nach Konsistenz und Koordinationsaufwand als `Local < Eventual < Consistent < Strong` geordnet. Wählen Sie den kostengünstigsten Scope, der die benötigte Garantie erfüllt. Namen werden über [`process.registry`](lua/core/process.md) registriert. Lokale Namen werden beim Beenden des Prozesses entfernt; Consistent- und Strong-Namen außerdem beim Beenden des Prozesses oder Verlassen des Knotens. Eventual-Namen werden explizit oder beim Verlassen ihres Ursprungsknotens entfernt, nicht automatisch, wenn nur der besitzende Prozess endet.

## Routing

Routing verbindet einen registrierten Namen mit dem Prozess, dem er gehört:

- **Lesevorgänge sind lokal.** Jeder Knoten löst einen Namen aus seinem eigenen Replikat oder dem über Gossip verbreiteten Cache auf — ohne Netzwerk-Roundtrip für die Namenssuche. Das hält die Auflösung schnell und funktionsfähig während Partitionen.
- **Die Auflösung folgt einer festen Reihenfolge.** Ein Name wird über die Ebenen von der höchsten Autorität abwärts aufgelöst: Consistent und Strong (Raft), dann Eventual (Gossip), dann Local. Dadurch überschattet ein clusterweiter Name einen lokalen Namen mit derselben Zeichenfolge.
- **Schreibvorgänge werden zur Autorität geroutet.** Eine Consistent- oder Strong-Registrierung läuft über den Raft-Leader; ein anderer Knoten leitet den Schreibvorgang weiter und wartet auf das Ergebnis. Nach dem Commit wird die aktive Bindung über Gossip verbreitet, sodass jeder Knoten — auch außerhalb des Raft-Kerns — den Namen anschließend lokal auflösen kann.
- **Nachrichten werden per PID geroutet.** Wenn Sie mit `process.send` an einen Namen senden, wird er in eine PID aufgelöst und das Relay liefert die Nachricht an den besitzenden Knoten. Ihr Code adressiert einen Prozess gleich, unabhängig davon, ob er auf diesem oder einem anderen Knoten läuft — der Ort ist transparent.

Anwendungen registrieren Namen und lösen sie auf, ohne den Autoritätsknoten direkt anzusprechen. Nach der Auflösung werden Nachrichten an den Knoten geroutet, dem die Ziel-PID gehört.

## Primitive

Clustering stellt eine kleine Menge von Koordinationsbausteinen bereit:

- **Mitgliedschaft und Identität** — die Menge aktiver Knoten sowie Identität und Rolle dieses Knotens. Verwenden Sie sie, um Peers zu erkennen oder Arbeit aufzuteilen. Siehe [`system.cluster`](lua/system/system.md) und [`system.node`](lua/system/system.md).
- **Konsenszustand** — Raft-Leader, Term und Rolle dieses Knotens für Diagnose und Leader-bewusste Logik. Siehe [`system.raft`](lua/system/system.md).
- **Clusterweite Namen** — Prozesse nach Name und Scope registrieren und auflösen; das Fundament der übrigen Funktionen. Siehe [`process.registry`](lua/core/process.md).
- **Verteilte Sperren** — clusterweiter gegenseitiger Ausschluss mit höchstens einem Inhaber; wird automatisch freigegeben, wenn der Inhaber stirbt. Siehe [`system.lock`](lua/system/system.md).
- **Prozessgruppen** — benannten Gruppen beitreten und Erlang-artig an alle Mitglieder auf allen Knoten senden. Siehe [Prozessgruppen](lua/core/pg.md).

Diese Primitive verwenden dieselbe Mitgliedschafts- und Routing-Infrastruktur. Consistent- und Strong-Namen sowie verteilte Sperren nutzen den Raft-Kern. Prozessgruppen verwenden die Gossip-Mitgliedschaft, um Peers zu erkennen, Änderungen über das Relay zu senden und regelmäßig den vollständigen Zustand zur Konvergenz auszutauschen.

## Siehe auch

- [Cluster-Leitfaden](guides/cluster.md) — Topologie, Konfiguration und Betrieb
- [Prozessverwaltung](lua/core/process.md) — Starten, Nachrichten und Namensregistry
- [Prozessgruppen](lua/core/pg.md) — Benannte Gruppen und Broadcast
- [System](lua/system/system.md) — `system.cluster`, `system.node`, `system.raft`, `system.lock`
- [Prozessmodell](concepts/process-model.md) — Prozesse, PIDs und Nachrichten
