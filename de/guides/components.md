---
title: "Komponenten bauen"
description: "Wiederverwendbare Module verfassen: Requirement-Schnittstellen mit ns.requirement deklarieren und wie Hosts Werte über Dependency-Parameter liefern."
---

# Komponenten bauen

Eine **Komponente** ist ein wiederverwendbares Wippy-Modul — ein Funktionalitäts-Slice, im Hub veröffentlicht und in eine Host-Anwendung montiert. Die Herausforderung einer Komponente ist, dass sie die Dinge, von denen sie abhängt, nicht benennen kann: Sie braucht *eine* Datenbank, *einen* Prozess-Host, *einen* Router, weiß aber nicht, welche der Host ihr geben wird. Wippy löst das mit einer **Requirement-Schnittstelle** — die Komponente deklariert Löcher, der Host füllt sie.

Diese Anleitung behandelt die Autorenseite: das Deklarieren dieser Schnittstelle und das Verständnis, wie Werte in Ihre Einträge fließen. Für die Konsumentenseite (Lock-Dateien, Versions-Constraints, `wippy add`/`update`) siehe [Abhängigkeitsverwaltung](guides/dependency-management.md). Für die interne Struktur einer Komponente siehe [Anwendungsarchitektur](concepts/architecture.md).

## Die drei Kinds

| Kind | Seite | Rolle |
|------|-------|-------|
| `ns.definition` | Komponente | Modul-Metadaten; erforderlich zum Veröffentlichen. |
| `ns.requirement` | Komponente | Ein Loch, das der Host füllen muss, und wohin der Wert injiziert wird. |
| `ns.dependency` | Host | Montiert eine Komponente und liefert Werte für ihre Requirements. |

## ns.definition

Eines pro Modul, erforderlich für die Veröffentlichung. Es trägt den Anzeigenamen des Moduls und den README-Pfad — nicht mehr.

```yaml
- name: definition
  kind: ns.definition
  module: jobs                # optional; defaults to the entry name
  readme: file://README.md    # path to the module's documentation
  meta:
    title: Durable Jobs
    description: Leased job queue with retry and dead-lettering.
```

Nur `module` und `readme` sind Komponentendaten; `meta` sind gewöhnliche Entry-Metadaten für Management-UIs. Release Notes werden zur Veröffentlichungszeit geliefert, nicht hier.

## ns.requirement

Ein Requirement ist ein **benanntes Loch mit einer Liste von Injektionszielen**. Der Host liefert einen Wert; die Runtime schreibt diesen Wert in jeden Ziel-Eintrag am angegebenen Pfad.

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

- **`default` vorhanden** (beliebiger Wert, auch ein leerer String) → das Requirement ist **optional**. Liefert der Host nichts, wird der Default verwendet.
- **`default` fehlt** → das Requirement ist **verpflichtend**. Ohne gelieferten Wert schlägt das Linken im Strict-Modus fehl (und warnt andernfalls).

<note>
Ein explizit leerer Default (<code>default: ""</code>) ist etwas anderes als gar kein Default. Leerer String bedeutet "optional, fällt auf nichts zurück"; fehlend bedeutet "der Host muss dies liefern." Verwenden Sie einen Default für Infrastruktur mit einer vernünftigen In-App-Konvention (<code>app:db</code>, <code>app:processes</code>); lassen Sie ihn weg für Werte, die nur der Host kennen kann.
</note>

### targets — wo der Wert landet

Jedes Target ist ein `{entry, path}`-Paar:

- **`entry`** — der Eintrag, in den der Wert injiziert wird. Ein bloßer Name (`schema`) löst innerhalb des eigenen Namespace des Requirements auf; eine vollqualifizierte ID (`app.jobs.migrations:schema`) trifft genau diesen Eintrag, über Namespaces hinweg.
- **`path`** — ein Punktpfad in den Ziel-Eintrag, z.B. `.meta.target_db`, `.host`, `.database.url`. Der führende Punkt ist Konvention.

Ein Requirement ohne Targets ist ein Fehler — ein Loch, das nirgendwohin injiziert, ist sinnlos.

Anhängen statt Setzen mit dem `+=`-Suffix am Pfad — nützlich, wenn mehrere Requirements zu einer Liste beitragen (z.B. Middleware):

```yaml
targets:
  - entry: app.api:router
    path: .middleware+=     # appends the value to the list at .middleware
```

### Ein Requirement, viele Targets

Gruppieren Sie alles, was denselben Wert braucht, unter einem einzigen Requirement. Das ist das idiomatische Muster: ein `target_db`-Requirement, das in `.meta.target_db` jeder Migration und `.db` jeder Persistenzbibliothek injiziert, ein `process_host`, das in `.host` jedes überwachten `service` injiziert, ein `api_router`, das in `.meta.router` jedes Endpoints injiziert:

```yaml
- name: process_host
  kind: ns.requirement
  default: app:processes
  targets:
    - { entry: app.jobs.service:worker.service, path: .host }
    - { entry: app.jobs.service:sweeper.service, path: .host }
```

Der Host füllt ein Loch; die Runtime fächert den Wert auf jedes Target auf. Nichts wird in einen parallelen Config-Eintrag gespiegelt — der Requirement-Eintrag *ist* die Verdrahtung.

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

## Die Nähte prüfen: ein Mount-Test

Unit-Tests üben einen Slice in Isolation aus; sie können nicht sehen, ob das *zusammengesetzte* Modul kohärent ist. Fügen Sie einen Packaging-/Mount-Test hinzu, der das Modul als Ganzes gegen die live, requirement-injizierte Registry auditiert:

- jeder überwachte `service` zeigt auf einen existierenden Prozess-Eintrag,
- jede gespawnte oder geplante ID löst zu einem realen Eintrag auf,
- der Speicher jeder `env.variable` ist registriert.

Das sind die Integrationsnähte, die die isolierten Unit-Suites verdecken — die Lücken, die einen Supervisor einen nie registrierten Worker referenzieren lassen oder eine Test-Fixture eine Harness-only-Storage-ID in einen montierten Boot durchsickern lassen. Siehe [Supervision](guides/supervision.md) und das [Test-Framework](framework/testing.md).

## Siehe auch

- [Anwendungsarchitektur](concepts/architecture.md) — wie eine Komponente intern strukturiert ist
- [Abhängigkeitsverwaltung](guides/dependency-management.md) — Lock-Dateien, Versionen, der Konsumenten-Workflow
- [Module veröffentlichen](guides/publishing.md) — eine Komponente in den Hub bringen
- [Entry-Typen-Anleitung](guides/entry-kinds.md) — Referenz zu `ns.definition`, `ns.requirement`, `ns.dependency`
