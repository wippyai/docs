---
title: "Cluster"
---

# Cluster

Ein einzelner Wippy-Knoten ist eine vollständige Laufzeitumgebung. Ein **Cluster** verbindet mehrere Knoten zu einem koordinierten System: Prozesse können benannt und von jedem Knoten aus erreicht werden, sich über Sperren und Gruppen koordinieren und auf einen gemeinsamen Konsenskern vertrauen — ohne dass sich ändert, wie Ihr Code Prozesse startet, Nachrichten sendet oder überwacht.

Clustering ist optional (`cluster.enabled`). Diese Seite beschreibt das Modell, das Ihr Code sieht; für Topologie, Konfiguration und Betrieb siehe den [Cluster-Leitfaden](guides/cluster.md).

## Das Modell

Knoten entdecken sich gegenseitig über **Gossip** (SWIM) — ein Knoten tritt bei, indem er auf einen Seed zeigt, und Mitgliedschaft sowie Ausfallerkennung konvergieren ohne einen Koordinator. Über Gossip sitzt ein kleiner, begrenzter **Raft**-Kern: eine feste Menge von Wählern stellt linearisierbaren Konsens bereit, während der Rest der Flotte auf Gossip aufsetzt. Die meisten Knoten tragen nie Konsenslast, sodass der Cluster horizontal skaliert und gleichzeitig eine einzige Quelle der Wahrheit für Dinge behält, die eine benötigen.

Was der Cluster Ihrem Code bietet, lässt sich auf drei Ideen reduzieren: **Namen**, **Routing** und **Koordinationsprimitive**.

## Benennung

Ein Prozess wird normalerweise über seine PID adressiert. In einem Cluster kann er auch unter einem **Namen** registriert werden und von überall unter diesem Namen erreichbar sein. Die entscheidende Wahl ist der **Gültigkeitsbereich** — die Konsistenzgarantie, die Sie wollen, abgewogen gegen die Kosten:

| Gültigkeitsbereich | Sichtbarkeit | Garantie | Verwendung |
|--------------------|--------------|----------|------------|
| **Local** | dieser Knoten | sofort, keine Koordination | knotenlokal Hilfsprozesse |
| **Eventual** | clusterweit | konvergiert nach Gossip; Konflikte werden aufgelöst und der Verlierer benachrichtigt | Dienst-, Gruppen- und begrenzte Präsenznamen |
| **Consistent** | clusterweit | linearisierbares Singleton über Raft | der Standard für clusterweite benannte Dienste |
| **Strong** | clusterweit | Consistent, plus jeder lebende Knoten bestätigt, bevor der Name aktiv wird | Steuerungsebenen-Singletons und Sperren |

Die Gültigkeitsbereiche bilden eine strikte Ordnung — `Local < Eventual < Consistent < Strong` — auf der Achse Konsistenz versus Kosten. Sie wählen den schwächsten Bereich, der die benötigte Garantie noch erfüllt. Namen werden über [`process.registry`](lua/core/process.md) registriert und automatisch freigegeben, wenn der besitzende Prozess endet (oder sein Knoten verlässt).

## Routing

Benennung ist nur nützlich, wenn ein Name zuverlässig den richtigen Prozess erreicht. Routing verbindet beides und folgt einigen konsistenten Regeln:

- **Lesevorgänge sind lokal.** Jeder Knoten löst einen Namen aus seinem eigenen Replikat oder dem über Gossip verteilten Cache auf — kein Netzwerk-Roundtrip zum Nachschlagen eines Namens. Dies hält die Auflösung schnell und lässt sie bei Netzwerkpartitionen funktionieren.
- **Auflösung hat eine feste Reihenfolge.** Ein Name wird der Reihe nach über die Ebenen aufgelöst — Consistent (Raft), dann Eventual (Gossip), dann Local — sodass ein clusterweiter Name einen lokalen Namen mit gleichem Text überschattet.
- **Schreibvorgänge routen zur Autorität.** Eine Consistent- oder Strong-Registrierung läuft über den Raft-Leader; ein Knoten, der nicht der Leader ist, leitet den Schreibvorgang weiter und wartet auf das Ergebnis. Nach dem Commit wird die aktive Bindung über Gossip verteilt, sodass jeder Knoten — auch jene außerhalb des Raft-Kerns — den Namen danach lokal auflösen kann.
- **Nachrichten routen über PID.** Wenn Sie mit `process.send` an einen Namen senden, wird dieser zu einer PID aufgelöst und die Nachricht an den besitzenden Knoten zugestellt. Ihr Code adressiert einen Prozess auf dieselbe Weise, unabhängig davon, ob er auf diesem oder einem anderen Knoten liegt — der Ort ist transparent.

Das Ergebnis: Sie registrieren und schlagen Namen auf, ohne darüber nachzudenken, welcher Knoten die Autorität hält, und Nachrichten finden ihr Ziel im Cluster genauso wie lokal.

## Primitive

Clustering stellt eine kleine Menge von Bausteinen bereit. Jeder ist vollständig auf seiner eigenen Seite dokumentiert; das Konzept ist, was sie ermöglichen:

- **Mitgliedschaft und Identität** — die lebende Menge von Knoten sowie Identität und Rolle dieses Knotens. Verwenden Sie es, um Peers zu entdecken oder Arbeit aufzuteilen. Siehe [`system.cluster`](lua/system/system.md) und [`system.node`](lua/system/system.md).
- **Konsenszustand** — der Raft-Leader, Term und die Rolle dieses Knotens, für Diagnose und leader-bewusste Logik. Siehe [`system.raft`](lua/system/system.md).
- **Clusterweite Namen** — Prozesse nach Name und Gültigkeitsbereich registrieren und auflösen, das Fundament, auf dem alles andere aufbaut. Siehe [`process.registry`](lua/core/process.md).
- **Verteilte Sperren** — clusterweiter gegenseitiger Ausschluss mit höchstens einem Inhaber, automatisch freigegeben, wenn der Inhaber ausfällt. Siehe [`system.lock`](lua/system/system.md).
- **Prozessgruppen** — benannten Gruppen beitreten und an jedes Mitglied über alle Knoten hinweg senden, im Erlang-Stil. Siehe [Prozessgruppen](lua/core/pg.md).

Diese sind bewusst primitiv gehalten: Sperren und benannte Singletons bauen auf dem Strong-Gültigkeitsbereich auf, Prozessgruppen auf Gossip, und alle auf derselben oben beschriebenen Mitgliedschaft und demselben Routing — sodass sie vorhersagbar zusammenspielen, anstatt jede ihre eigene Verteilung zu erfinden.

## Siehe auch

- [Cluster-Leitfaden](guides/cluster.md) - Topologie, Konfiguration und Betrieb
- [Prozessverwaltung](lua/core/process.md) - Starten, Nachrichtenübermittlung und die Namensvergabe
- [Prozessgruppen](lua/core/pg.md) - Benannte Gruppen und Broadcast
- [System](lua/system/system.md) - `system.cluster`, `system.node`, `system.raft`, `system.lock`
- [Prozessmodell](concepts/process-model.md) - Prozesse, PIDs und Nachrichtenübermittlung
