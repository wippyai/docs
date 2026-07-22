---
title: "Anwendungsarchitektur"
description: "Wie man eine Wippy-Anwendung in Namespaces, Slices und Schichten zerlegt, damit der Registry-Graph komponierbar, testbar und bootbar bleibt, während er wächst."
---

# Anwendungsarchitektur

Eine Wippy-Anwendung ist kein Baum aus Quelldateien — sie ist ein **Graph aus Registry-Einträgen**. Code lebt in `function.lua`- und `process.lua`-Einträgen; alles, was sie verknüpft — welche Funktion eine HTTP-Route beantwortet, welchen Prozess ein Service überwacht, welche Bibliothek welche importiert — wird in `_index.yaml` deklariert. Eine App zu strukturieren heißt zu entscheiden, wie dieser Graph **in Namespaces zerlegt** wird, damit er komponierbar, testbar und bootbar bleibt, während er wächst.

Diese Seite ist die Begründung hinter dem Layout. Für die mechanischen Regeln (Dateiformat, Benennung, wo `_index.yaml` liegt) siehe [YAML & Projektstruktur](start/structure.md). Für die Entry-Typen selbst siehe die [Entry-Typen-Anleitung](guides/entry-kinds.md).

## Die Einheit ist ein Slice

Organisieren Sie nach **Feature**, nicht nach Dateityp. Ein Slice besitzt eine Fähigkeit von Ende zu Ende — seinen Datenbankzugriff, seine langlaufenden Prozesse, seine HTTP-Oberfläche und das gemeinsame Vokabular — und lebt unter einem Namespace-Präfix:

```
src/app/jobs/          namespace: app.jobs
src/app/auth/          namespace: app.auth
src/app/billing/       namespace: app.billing
```

Die Alternative — eine Aufteilung in `handlers/`, `models/`, `services/` auf oberster Ebene — verstreut jedes Feature über den Baum und koppelt sie durch Nähe. Slices halten den Wirkungsradius eines Features in einem Ordner: Sie können es lesen, testen oder löschen, ohne Referenzen durch das ganze Projekt zu jagen.

## Schichten innerhalb eines Slice

Innerhalb eines Slice teilen Sie entlang der Achse **was die Außenwelt berührt**. Das ist Ports-and-Adapters-Architektur (hexagonal), ausgedrückt als **Sub-Namespaces**:

```
src/app/jobs/                  namespace: app.jobs          ← shared vocabulary
  consts.lua  config.lua  types.lua
  persist/                     namespace: app.jobs.persist  ← database adapters (sql)
  service/                     namespace: app.jobs.service  ← processes, workers
  api/                         namespace: app.jobs.api      ← http.endpoints
```

Imports fließen **nur in eine Richtung**, von außen nach innen:

```
api  →  service  →  persist  →  { consts, config, types }
```

Die Slice-Wurzel (das gemeinsame Vokabular) importiert nichts aus den eigenen Kindern. Kinder importieren die Wurzel. Keine Schicht greift zurück nach oben, und **kein Slice importiert einen anderen Slice direkt** — Sharing über Slices hinweg läuft über einen gemeinsamen Eltern-Namespace (z.B. `app.core:types`), niemals seitwärts.

<note>
Die Namespace-Grenze ist nicht kosmetisch. Sie ist die Naht, in die die Runtime Abhängigkeiten injiziert und über die sie die Boot-Reihenfolge auflöst. Die Richtung der Imports ist es, die garantiert, dass eine gültige Boot-Reihenfolge existiert — siehe <a href="#why-this-shape">Warum diese Form</a>.
</note>

Ein kleinerer Slice reduziert die Zeremonie — ein einzelnes `_index.yaml` mit den Bibliotheken und einem Endpoint ist in Ordnung. Die Regel, die bei jeder Größe überlebt, ist die **Import-Richtung**, nicht die Ordneranzahl.

## Das gemeinsame Vokabular

Drei Dateien kehren an der Wurzel eines gut strukturierten Slice wieder. Sie halten, was jede Schicht liest, aber keine von ihnen *ist*:

| Datei | Enthält | Capabilities |
|-------|---------|--------------|
| `consts.lua` | Zustandsmaschinen, Enums, Queue-Stufen, Registry-IDs von Prozessen. Die Werte, die Ihre Datenbank-`CHECK`-Constraints spiegeln. | keine |
| `config.lua` | Env-einstellbare Regler mit Code-Default-Fallbacks (`env.get(KEY) or DEFAULT`), sodass kein `env.variable`-Eintrag nötig ist, damit ein Wert optional ist. | `env` |
| `types.lua` | Entitätsformen (`type Job = { ... }`) — die Zeilen, die die Persistenzschicht zurückgibt. | keine |

`consts` und `types` deklarieren **keine Host-Capabilities** — sie sind reine `library.lua`, die eine Tabelle zurückgeben. Das ist Absicht: Ihr Domänenvokabular kann kein I/O ausführen, kann also nicht in Geschäftslogik abdriften, und es ist ohne Datenbank und ohne Prozess-Host unit-testbar.

Halten Sie dieses Vokabular **slice-privat**. Konstanten und Typen, die über Slices hinweg geteilt werden, leben im gemeinsamen Elternteil und werden dort über einen Import referenziert — niemals in jeden Slice kopiert.

## Capabilities sortieren sich nach Schicht

Jeder Eintrag deklariert die benötigten Host-Capabilities in `modules:`. In einem geschichteten Slice sortieren sie sich sauber:

- `persist/*` deklariert `sql` — und nichts anderes bekommt Datenbankzugriff.
- `service/*` deklariert `channel`, Prozess-Host-Capabilities — und nichts anderes spawnt oder überwacht.
- `api/*` deklariert, was ein Endpoint braucht, um eine Anfrage zu marshallen.
- Das Wurzel-Vokabular deklariert nichts.

Der Gewinn: Der Wirkungsradius jeder Capability ist genau eine Schicht. Wenn Sie wissen wollen, was alles in die Datenbank schreiben kann, lesen Sie `persist/`. Dependency Inversion hört auf, ein abstraktes Prinzip zu sein, und wird zu einer Eigenschaft, nach der Sie greppen können.

## Anwendungen und Komponenten

Dieselbe Form skaliert von einer einzelnen App bis zu einer veröffentlichten Bibliothek, indem sich nur ändert, **wer die Löcher füllt**.

Eine **Anwendung** ist der oberste, deploybare Graph. Sie besitzt die konkrete Infrastruktur — den `http.service`, den `process.host`, die Datenbankverbindung — unter einem Root-Namespace (per Konvention `app`) und verdrahtet alles selbst.

Eine **Komponente** ist ein veröffentlichbares Modul, das *in* einen Host montiert wird. Sie kann die Datenbank oder den Router des Hosts nicht benennen, weil sie sie nicht kennt. Stattdessen deklariert sie eine **Schnittstelle aus Löchern** — `ns.requirement`-Einträge —, die der Host füllt, wenn er von der Komponente abhängt. Intern ist eine Komponente genauso strukturiert wie ein Anwendungs-Slice: dieselben Schichten, dasselbe Vokabular, dieselbe Import-Richtung. Die einzige Ergänzung ist die Requirement-Schnittstelle an ihrem Rand.

Das ist ein Spektrum, keine zwei Kategorien:

- **Einzelne App, interne Slices** — Slices leben unter `src/app/`, teilen die Infrastruktur der App direkt über Referenzen auf `app:db`, `app:processes`. Keine Requirement-Schnittstelle nötig; nichts Externes montiert sie. (So wird ein fokussierter Service gebaut.)
- **Multi-Komponenten-Komposition** — jede Komponente ist ihr eigenes veröffentlichbares Modul mit einer `ns.definition` und einer `ns.requirement`-Schnittstelle, komponiert von einem Host über `ns.dependency`. Der Host füllt jedes Requirement (Datenbank, Prozess-Host, Router) einmal. (So wird eine Plattform aus wiederverwendbaren Teilen gebaut.)

Wählen Sie danach, ob der Slice dazu gedacht ist, **von etwas konsumiert zu werden, das Sie nicht kontrollieren**. Wenn ja, geben Sie ihm eine Requirement-Schnittstelle und veröffentlichen Sie ihn. Wenn nein, lassen Sie ihn die Infrastruktur der App direkt referenzieren und sparen Sie sich die Zeremonie. Die Schichtung ist die Invariante an beiden Enden; die Verpackung ist das, was mit der Wiederverwendung skaliert.

Siehe [Komponenten bauen](guides/components.md) für den Requirement/Dependency-Mechanismus und [Abhängigkeitsverwaltung](guides/dependency-management.md) für die Lock-Datei-Seite.

## Warum diese Form {#why-this-shape}

Die obige Disziplin ist kein Stil. Jede Regel ist tragend dafür, wie die Runtime einen Graphen komponiert und bootet:

**Die Namespace-Grenze ist die Injektionsnaht.** Weil Schichten nur über explizite `imports:` verknüpft sind und in getrennten Namespaces leben, hat der `ns.requirement`-Mechanismus ein konkretes Ziel für die Injektion — der Host richtet seine Datenbank auf die Einträge der `persist`-Schicht, seinen Prozess-Host auf die Einträge der `service`-Schicht. Würde `persist` direkt nach `app:db` greifen, ließe sich die Komponente nie in einen anderen Host montieren: Es gäbe kein Loch zu füllen. Die Schichtung ist es, die eine Komponente **relozierbar** macht.

**Einbahn-Imports garantieren, dass eine Boot-Reihenfolge existiert.** Die Runtime löst den Eintragsgraphen beim Boot auf und muss eine topologische Ordnung finden. `api → service → persist → root`, niemals seitwärts und niemals nach oben, bedeutet, dass der Graph per Konstruktion azyklisch ist. Über einen gemeinsamen Elternteil geführte Kopplung zwischen Slices hält Slices unabhängig montierbar, statt sie in einen Zyklus zu verknoten, den der Loader nicht ordnen kann.

**Nach Schicht abgegrenzte Capabilities begrenzen den Wirkungsradius.** Host-Capabilities werden pro Eintrag gewährt. Wenn nur `persist` `sql` deklariert, ist die Menge des Codes, der die Datenbank erreichen kann, ein Verzeichnis, auf einen Blick auditierbar — keine emergente Eigenschaft der ganzen App.

**Die Schichtung erzeugt einen Testbarkeits-Gradienten.** Reines Vokabular testet ohne Welt. `persist`-Tests treffen eine Datenbank, aber keinen Worker. Ein **Mount-Test** des ganzen Moduls auditiert dann die Nähte, die die Unit-Tests bewusst nicht sehen können — dass jeder überwachte Service auf einen realen Prozess zeigt, jede gespawnte ID auflöst, jedes Requirement gefüllt ist. Diesen Gradienten bekommen Sie nur, wenn die Schichten tatsächlich trennbar sind.

Die Kurzfassung: Hexagonale Schichtung ist hier die eine Form, in der Requirement-Injektion, Capability-Abgrenzung pro Schicht und azyklische Boot-Auflösung gleichzeitig gelten. Das Kompositionsmodell der Runtime *erfordert* den Ports-and-Adapters-Schnitt, um zu funktionieren — die Disziplin ist das, was Ihnen einen bootenden Graphen und eine Komponente einbringt, die jemand anderes montieren kann.

## Siehe auch

- [YAML & Projektstruktur](start/structure.md) — Dateiformat, Benennung, Namespaces
- [Komponenten bauen](guides/components.md) — `ns.definition`, `ns.requirement`, Montage
- [Abhängigkeitsverwaltung](guides/dependency-management.md) — Lock-Dateien, Module konsumieren
- [Registry](concepts/registry.md) — wie Einträge gespeichert und aufgelöst werden
- [Entry-Typen-Anleitung](guides/entry-kinds.md) — jeder Entry-Typ
- [Prozessmodell](concepts/process-model.md) — Services, Supervision, Hosts
