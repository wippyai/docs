---
title: "Komponenten bauen"
description: "Deklarieren Sie Anforderungen wiederverwendbarer Module mit ns.requirement und stellen Sie sie aus einem Host über Dependency-Parameter bereit."
---

# Komponenten bauen

Eine **Komponente** ist ein wiederverwendbares Wippy-Modul, das im Hub veröffentlicht und in eine Host-Anwendung eingebunden wird. Eine Komponente kann von einer Datenbank, einem Process Host oder einem Router abhängen, ohne die Entry-IDs des Hosts zu kennen. Sie deklariert diese Abhängigkeiten über eine **Requirement-Schnittstelle**, und der Host stellt ihre Werte bereit.

Dieser Leitfaden behandelt die Autorenseite: die Deklaration dieser Schnittstelle und den Wertefluss in Einträge. Die Verbraucherseite mit Lock-Dateien, Versionsbeschränkungen und `wippy add`/`update` beschreibt die [Abhängigkeitsverwaltung](./dependency-management.md). Die interne Struktur einer Komponente behandelt die [Anwendungsarchitektur](../concepts/architecture.md).

## Die drei Entry-Kinds

| Kind | Seite | Rolle |
|------|-------|-------|
| `ns.definition` | Komponente | Modul-Metadaten; erforderlich zum Veröffentlichen. |
| `ns.requirement` | Komponente | Ein Loch, das der Host füllen muss, und wohin der Wert injiziert wird. |
| `ns.dependency` | Host | Montiert eine Komponente und liefert Werte für ihre Requirements. |

## ns.definition

Jedes veröffentlichte Modul muss genau eine Definition besitzen. Sie kann Modulmetadaten sowie Referenzen auf README- und Wiki-Seiten enthalten.

```yaml
- name: definition
  kind: ns.definition
  module: jobs                # optional module metadata
  readme: file://README.md    # path to the module's documentation
  meta:
    title: Durable Jobs
    description: Leased job queue with retry and dead-lettering.
```

`module`, `readme` und `wiki` sind Definitionsdaten; alle drei sind optional. `meta` enthält gewöhnliche Entry-Metadaten für Verwaltungsoberflächen. Release Notes werden beim Veröffentlichen angegeben, nicht hier.

## ns.requirement

Ein Requirement ist ein **benannter Wert mit einer Liste von Injektionszielen**. Der Host stellt den Wert bereit, und die Runtime schreibt ihn am angegebenen Pfad in jeden Zieleintrag.

```yaml
- name: target_db
  kind: ns.requirement
  meta:
    description: SQL database backing every table in this module.
  default: app:db
  targets:
    - entry: app.jobs.migrations:schema
      path: .meta.target_db
    - entry: app.jobs.persist:lifecycle
      path: .db
```

### default — verpflichtend vs. optional

Das Feld `default` entscheidet, ob der Host einen Wert liefern *muss*:

- **`default` mit einem Wert ungleich null vorhanden** (auch ein leerer String) → das Requirement ist **optional**. Liefert der Host nichts, wird der Default verwendet.
- **`default` fehlt** → das Requirement ist **verpflichtend**. Ohne gelieferten Wert schlägt das Linken im Strict-Modus fehl (und warnt andernfalls).

<note>
Ein explizit leerer Default (<code>default: ""</code>) unterscheidet sich von einem fehlenden oder null gesetzten Default. Ein leerer String bedeutet „optional, fällt auf nichts zurück“; fehlend und <code>default: null</code> bedeuten beide „der Host muss dies bereitstellen“. Verwenden Sie einen nicht-null Default für Infrastruktur mit einer sinnvollen Anwendungskonvention wie <code>app:db</code> oder <code>app:processes</code>; lassen Sie ihn bei Werten weg, die nur der Host kennen kann.
</note>

### targets — wo der Wert landet

Jedes Target ist ein `{entry, path}`-Paar:

- **`entry`** — der Eintrag, in den der Wert injiziert wird. Ein bloßer Name (`schema`) löst innerhalb des eigenen Namespace des Requirements auf; eine vollqualifizierte ID (`app.jobs.migrations:schema`) trifft genau diesen Eintrag, über Namespaces hinweg.
- **`path`** — ein Punktpfad in den Ziel-Eintrag, z.B. `.meta.target_db`, `.host`, `.database.url`. Der führende Punkt ist Konvention.

Ein Requirement muss mindestens ein Ziel deklarieren.

Anhängen statt Setzen mit dem `+=`-Suffix am Pfad — nützlich, wenn mehrere Requirements zu einer Liste beitragen (z.B. Middleware):

```yaml
targets:
  - entry: app.api:router
    path: .middleware+=     # appends the value to the list at .middleware
```

### Ein Requirement, viele Targets

Gruppieren Sie Ziele, die denselben Wert benötigen, unter einem Requirement. Beispielsweise kann `target_db` `.meta.target_db` jeder Migration und `.db` jeder Persistenzbibliothek versorgen, `process_host` die `.host`-Felder überwachter Services und `api_router` die `.meta.router`-Felder der Endpoints:

```yaml
- name: process_host
  kind: ns.requirement
  default: app:processes
  targets:
    - { entry: app.jobs.service:worker.service, path: .host }
    - { entry: app.jobs.service:sweeper.service, path: .host }
```

Der Host stellt einen Wert bereit, und die Runtime schreibt ihn in jedes deklarierte Ziel. Der Requirement-Eintrag enthält diese Verdrahtung direkt.

## Eine Komponente konsumieren

Der Host montiert eine Komponente mit `ns.dependency` und füllt ihre Requirements über `parameters`:

```yaml
version: "1.0"
namespace: app
entries:
  - name: dep.jobs
    kind: ns.dependency
    component: acme/jobs
    version: "^1.0.0"
    parameters:
      - name: target_db
        value: app:db
      - name: process_host
        value: app:processes
      - name: api_router
        value: app:api
```

Jeder `parameter.name` entspricht einem Requirement; sein `value` ist das, was in die Targets dieses Requirements injiziert wird. Requirements mit Default dürfen weggelassen werden; verpflichtende müssen geliefert werden.

### Zuordnung von Parameternamen

Wie ein Parametername an ein Requirement bindet:

- **Bloßer Name** (`target_db`) trifft ein Requirement dieses Namens, das zu der montierten Komponente gehört. Er greift nicht auf die Requirements eines anderen Moduls über.
- **Qualifizierter Name** (`acme.jobs:target_db`) trifft genau diese Requirement-ID. Verwenden Sie ihn zur Disambiguierung beim Verdrahten transitiver Abhängigkeiten.

Liefern zwei Dependencies **unterschiedliche** Werte für dasselbe Requirement, ist das ein Konflikt und wird gemeldet (identische Werte sind in Ordnung).

## Wann Werte aufgelöst werden

Die Injektion geschieht in der **Link-Phase** der Build-Pipeline — bei der Veröffentlichung, während der Dependency-Expansion und beim Boot — nicht zur Laufzeit. Die Phase:

1. Sammelt jedes `ns.requirement` und jedes `ns.dependency` mit seinen Parametern.
2. Löst für jedes Requirement einen Wert auf: Ein passender Parameter gewinnt; andernfalls der Default; andernfalls (kein Default) bleibt es unaufgelöst.
3. Schreibt den aufgelösten Wert in jeden Ziel-Eintrag an seinem Pfad (Setzen, oder Anhängen bei `+=`).

Unter **Strict Requirements** lässt ein unaufgelöstes verpflichtendes Requirement den Build fehlschlagen; andernfalls wird eine Warnung geloggt und fortgefahren. Wenn die Einträge die Runtime erreichen, ist jedes gefüllte Requirement bereits in seine Targets eingebacken.

## Integration mit einem Mount-Test prüfen

Unit-Tests prüfen nicht die Registry-Beziehungen des zusammengesetzten Moduls. Fügen Sie einen Packaging- oder Mount-Test gegen die mit Requirements injizierte Registry hinzu und prüfen Sie:

- jeder überwachte `service` zeigt auf einen existierenden Prozess-Eintrag,
- jede gespawnte oder geplante ID löst zu einem realen Eintrag auf,
- der Speicher jeder `env.variable` ist registriert.

Damit werden unaufgelöste Beziehungen sichtbar, etwa ein Supervisor, der einen nicht registrierten Worker referenziert, oder ein Test-Fixture mit einer nur im Harness vorhandenen Storage-ID. Siehe [Supervision](./supervision.md) und das [Test-Framework](../framework/testing.md).

## Siehe auch

- [Anwendungsarchitektur](../concepts/architecture.md) — interne Struktur einer Komponente
- [Abhängigkeitsverwaltung](./dependency-management.md) — Lock-Dateien, Versionen und Verbraucher-Workflow
- [Module veröffentlichen](./publishing.md) — eine Komponente im Hub veröffentlichen
- [Leitfaden zu Entry-Kinds](./entry-kinds.md) — Referenz für `ns.definition`, `ns.requirement` und `ns.dependency`
