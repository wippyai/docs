---
title: "Anwendungsarchitektur"
description: "Wie eine Wippy-Anwendung in Namespaces, Slices und Schichten gegliedert wird, damit der Registry-Graph beim Wachsen komponierbar, testbar und bootfähig bleibt."
---

# Anwendungsarchitektur

Eine Wippy-Anwendung ist ein durch Quelldateien dargestellter **Graph aus Registry-Einträgen**. Code liegt in Einträgen wie `function.lua` und `process.lua`; `_index.yaml`-Dateien deklarieren, wie Funktionen, Routen, Services und Bibliotheken verbunden sind. Die Anwendungsstruktur bestimmt, wie dieser Graph in Namespaces aufgeteilt wird, damit er beim Wachsen komponierbar, testbar und bootfähig bleibt.

Diese Seite beschreibt eine mögliche Organisation dieses Graphen. Dateiformat, Benennung und Platzierung von `_index.yaml` behandelt [YAML und Projektstruktur](start/structure.md). Definitionen der Einträge finden Sie im [Leitfaden zu Entry-Kinds](guides/entry-kinds.md).

## Feature-Slices

Ein sinnvoller Standard ist die Organisation nach **Feature** statt nach Dateityp. Ein Slice besitzt eine Fähigkeit vollständig — Datenbankzugriff, lang laufende Prozesse, HTTP-Oberfläche und gemeinsames Vokabular — und liegt unter einem Namespace-Präfix:

```
src/app/jobs/          namespace: app.jobs
src/app/auth/          namespace: app.auth
src/app/billing/       namespace: app.billing
```

Feature-Slices halten zusammengehöriges Verhalten in einem Ordner. Dadurch lässt sich eine Fähigkeit leichter lesen, testen, ändern oder entfernen, ohne sie über Verzeichnisse wie `handlers/`, `models/` und `services/` auf oberster Ebene verfolgen zu müssen.

## Schichten innerhalb eines Slice

Trennen Sie Code bei größeren Slices danach, **was die Außenwelt berührt**. Damit wird eine Ports-and-Adapters- beziehungsweise hexagonale Architektur durch **Sub-Namespaces** umgesetzt:

```
src/app/jobs/                  namespace: app.jobs          ← shared vocabulary
  consts.lua  config.lua  types.lua
  persist/                     namespace: app.jobs.persist  ← database adapters (sql)
  service/                     namespace: app.jobs.service  ← processes, workers
  api/                         namespace: app.jobs.api      ← http.endpoints
```

Imports sollten von äußeren zu inneren Schichten fließen:

```
api  →  service  →  persist  →  { consts, config, types }
```

Die Slice-Wurzel enthält das gemeinsame Vokabular und importiert keine eigenen Kinder. Kinder dürfen die Wurzel importieren. Vermeiden Sie direkte Imports zwischen Slices; legen Sie gemeinsame Definitionen in einem übergeordneten Namespace wie `app.core:types` ab.

<note>
Namespaces organisieren Entry-IDs, erzeugen aber nicht selbst Abhängigkeiten oder Injektionsnähte. Explizite <code>imports</code>, Kind-spezifische Referenzen und Ziele von <code>ns.requirement</code> erzeugen diese Beziehungen. Eine konsistente Richtung hält den resultierenden Graphen explizit. Siehe <a href="#why-this-shape">Warum diese Form</a>.
</note>

Ein kleiner Slice kann ein einziges `_index.yaml` für seine Bibliotheken und seinen Endpoint verwenden. Entscheidend ist die **Import-Richtung**, nicht die Anzahl der Ordner.

## Gemeinsames Vokabular

Drei Dateien stehen häufig an der Wurzel eines Slice. Sie enthalten Definitionen, die von dessen Schichten gemeinsam verwendet werden:

| Datei | Inhalt | Capabilities |
|------|-------|--------------|
| `consts.lua` | Zustandsautomaten, Enums, Queue-Stufen und Registry-IDs von Prozessen. Werte, die `CHECK`-Constraints der Datenbank spiegeln. | keine |
| `config.lua` | Über die Umgebung einstellbare Werte mit einem Helper, der nur dann einen Code-Standardwert verwendet, wenn `env.get(KEY)` `errors.NOT_FOUND` liefert, und Berechtigungs- oder Backendfehler weitergibt. Für einen optionalen Wert ist kein `env.variable`-Eintrag erforderlich. | `env` |
| `types.lua` | Entitätsformen (`type Job = { ... }`) — die von der Persistenzschicht gelieferten Zeilen. | keine |

`consts` und `types` deklarieren **keine Host-Capabilities**; sie sind reine `library.lua`-Einträge, die eine Tabelle zurückgeben. Dadurch bleibt Domänenvokabular frei von E/A und kann ohne Datenbank oder Process Host getestet werden.

Halten Sie dieses Vokabular **Slice-intern**. Legen Sie Konstanten und Typen, die mehrere Slices gemeinsam nutzen, in einem übergeordneten Namespace ab und importieren Sie sie, statt sie zu kopieren.

## Capabilities nach Schicht

Lua-Einträge deklarieren nicht-ambient verfügbare Module unter `modules:` und Registry-gestützte Abhängigkeiten unter `imports:`. In einem geschichteten Slice lassen sich diese Abhängigkeiten an der Verantwortung ausrichten:

- `persist/*` deklariert `sql` und hält Datenbankzugriff in der Persistenzschicht.
- `service/*` enthält Prozessorchestrierung und Service-Abhängigkeiten. Die globalen Werte `process` und `channel` sind ambient verfügbar und benötigen keine `modules:`-Deklaration.
- `api/*` deklariert Module wie `http` und importiert die aufgerufenen Funktionen oder Bibliotheken.
- Das Vokabular an der Wurzel benötigt keine nicht-ambient verfügbaren Module oder Infrastruktur-Imports.

Damit bleibt die Modulsichtbarkeit auf eine bekannte Schicht begrenzt. Sie ist keine Autorisierungsfreigabe: ABAC-Richtlinien entscheiden unabhängig davon, ob geschützte Operationen wie `db.get` zur Laufzeit zulässig sind. Um Code zu prüfen, der ein Datenbank-Handle anfordern kann, untersuchen Sie `persist/`, dessen deklarierte Module und die Richtlinien seines Ausführungskontexts.

## Anwendungen und Komponenten

Dieselbe Form kann eine einzelne Anwendung oder eine veröffentlichte Bibliothek tragen; der Unterschied liegt darin, **wer ihre Abhängigkeiten bereitstellt**.

Eine **Anwendung** ist der oberste deploybare Graph. Sie besitzt konkrete Infrastruktur — `http.service`, `process.host`, Datenbankverbindung — unter einem Root-Namespace, üblicherweise `app`, und verdrahtet alles selbst.

Eine **Komponente** ist ein veröffentlichbares Modul, das in einen Host eingebunden wird. Da sie die Datenbank- oder Router-IDs des Hosts nicht kennt, deklariert sie eine Schnittstelle aus `ns.requirement`-Einträgen, die der Host bereitstellt. Intern kann eine Komponente dieselben Schichten, dasselbe Vokabular und dieselbe Import-Richtung wie ein Anwendungsslice verwenden.

Dies sind zwei Punkte auf einem Spektrum:

- **Einzelne Anwendung mit internen Slices** — Slices liegen unter `src/app/` und referenzieren Infrastruktur der Anwendung wie `app:db` und `app:processes` direkt. Eine Requirement-Schnittstelle ist nicht erforderlich, weil nichts Externes sie einbindet.
- **Komposition mehrerer Komponenten** — jede Komponente ist ein eigenes veröffentlichbares Modul mit `ns.definition` und einer `ns.requirement`-Schnittstelle. Ein Host komponiert sie über `ns.dependency` und füllt jede Anforderung für Datenbank, Process Host oder Router einmal.

Entscheiden Sie danach, ob der Slice **von einem Host verwendet wird, den Sie nicht kontrollieren**. Wiederverwendbare Komponenten benötigen eine Requirement-Schnittstelle; interne Slices dürfen Infrastruktur der Anwendung direkt referenzieren. Die Verpackung ändert sich mit der Wiederverwendung, die interne Schichtung kann gleich bleiben.

Siehe [Komponenten erstellen](guides/components.md) für den Requirement-/Dependency-Mechanismus und [Abhängigkeitsverwaltung](guides/dependency-management.md) für die Lock-Datei.

## Warum diese Form :id=why-this-shape

Diese Struktur unterstützt Komposition, Capability-Prüfung und Analyse der Bootreihenfolge:

**Requirement-Ziele bilden die Injektionsnaht.** Unterschiedliche Namespaces machen Ziel-IDs lesbar, die eigentliche Injektion erfolgt jedoch durch `ns.requirement.targets`. Ein Host kann Persistenzeinträgen eine Datenbank-ID und Service-Einträgen eine Process-Host-ID bereitstellen. Eine direkte Referenz auf `app:db` koppelt die Komponente stattdessen an diese Host-Konvention.

**Einseitige Referenzen halten Registry-Übergänge auflösbar.** Die Registry extrahiert deklarierte Abhängigkeitspfade und ordnet Änderungen topologisch, sodass Abhängigkeiten vor ihren Verwendern erstellt und nach ihnen gelöscht werden. Die Richtung `api → service → persist → root` hilft, den Graphen azyklisch zu halten. Ein übergeordneter Namespace ist nur eine Organisationskonvention; gemeinsam verwendete Einträge benötigen weiterhin explizite Referenzen.

**Nach Schicht begrenzte Module schaffen eine klare Grenze.** Jeder Lua-Chunk kann seine deklarierten Imports und nicht-ambient verfügbaren Module auflösen; nicht deklarierte Registry-Module scheitern geschlossen bei der Modulauflösung. Laufzeitprüfungen durch Richtlinien bleiben eine eigene Grenze. Wenn nur Persistenzeinträge `sql` deklarieren, lässt sich der Code, der ein Datenbank-Handle anfordern kann, leichter erkennen und prüfen.

**Die Schichtung unterstützt unterschiedliche Testumfänge.** Vokabular kann ohne Infrastruktur getestet werden. Persistenztests können eine Datenbank verwenden, ohne Worker zu starten. Ein **Mount-Test** für das gesamte Modul prüft anschließend die Integrationsnähte: Jeder überwachte Service zeigt auf einen Prozess, jede gestartete ID lässt sich auflösen und jede Anforderung ist erfüllt.

## Siehe auch

- [YAML und Projektstruktur](start/structure.md) — Dateiformat, Benennung und Namespaces
- [Komponenten erstellen](guides/components.md) — `ns.definition`, `ns.requirement` und Einbindung
- [Abhängigkeitsverwaltung](guides/dependency-management.md) — Lock-Dateien und Modulkonsum
- [Registry](concepts/registry.md) — Speicherung und Auflösung von Einträgen
- [Leitfaden zu Entry-Kinds](guides/entry-kinds.md) — alle Entry-Kinds
- [Prozessmodell](concepts/process-model.md) — Services, Supervision und Hosts
