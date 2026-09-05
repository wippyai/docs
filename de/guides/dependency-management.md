---
title: "Abhangigkeitsverwaltung"
description: "Wippy verwendet ein Lock-Datei-basiertes Abhangigkeitssystem. Module werden im Hub veroffentlicht, als Abhangigkeiten in Ihrem Quellcode deklariert und…"
---

# Abhangigkeitsverwaltung

Wippy verwendet ein Lock-Datei-basiertes Abhangigkeitssystem. Module werden im Hub veroffentlicht, als Abhangigkeiten in Ihrem Quellcode deklariert und in einer `wippy.lock`-Datei aufgelost, die exakte Versionen verfolgt.

## Projektdateien

### wippy.lock

Die Lock-Datei verfolgt die Verzeichnisstruktur Ihres Projekts und die fixierten Abhangigkeiten:

```yaml
directories:
  modules: .wippy
  src: ./src
modules:
  - name: acme/http
    version: v1.2.0
    hash: 4ea816fe84ca58a1f0869e5ca6afa93d6ddd72fa09e1162d9e600a7fbf39f0a2
  - name: acme/sql
    version: v2.0.1
    hash: b3f9c8e12a456d7890abcdef1234567890abcdef1234567890abcdef12345678
```

| Feld | Beschreibung |
|------|--------------|
| `directories.modules` | Speicherort fur heruntergeladene Module (Standard: `.wippy`) |
| `directories.src` | Speicherort Ihres Quellcodes (Standard: `./src`) |
| `modules[].name` | Modulbezeichner im Format `org/module` |
| `modules[].version` | Fixierte semantische Version |
| `modules[].hash` | Artefakt-Digest, dem das heruntergeladene Pack entsprechen muss; ein reiner Hex-Wert wird als `sha256` gelesen |
| `modules[].root` | Markiert die ausgewählte Deployment-Wurzel; höchstens ein Modul darf sie tragen |
| `options.unpack_modules` | Packs in Verzeichnisse entpacken, statt sie als `.wapp`-Dateien zu laden (Standard: `false`) |

### wippy.yaml

Modul-Metadaten fur die Veroffentlichung. Nur erforderlich, wenn Sie ein eigenes Modul veroffentlichen:

```yaml
organization: acme
module: http
version: 1.2.0
description: HTTP utilities for Wippy
license: MIT
repository: https://github.com/acme/wippy-http
keywords:
  - http
  - web
```

| Feld | Erforderlich | Beschreibung |
|------|--------------|--------------|
| `organization` | Ja | Kleinbuchstaben, alphanumerisch mit Bindestrichen |
| `module` | Ja | Kleinbuchstaben, alphanumerisch mit Bindestrichen |
| `version` | Nein | Semantische Version (wird beim Veroffentlichen gesetzt) |
| `description` | Nein | Modulbeschreibung |
| `license` | Nein | SPDX-Lizenzbezeichner |
| `repository` | Nein | URL des Quell-Repositorys |
| `homepage` | Nein | Projekt-Homepage |
| `keywords` | Nein | Schlusselworter zur Auffindbarkeit |
| `authors` | Nein | Autorenliste |

## Abhangigkeiten deklarieren

Fugen Sie `ns.dependency`-Eintrage in Ihrer `_index.yaml` hinzu:

```yaml
version: "1.0"
namespace: app
entries:
  - name: dependency.http
    kind: ns.dependency
    component: acme/http
    version: "^1.0.0"

  - name: dependency.sql
    kind: ns.dependency
    component: acme/sql
    version: ">=2.0.0"
```

### Versionsbeschrankungen

| Beschrankung | Beispiel | Trifft zu auf |
|--------------|----------|---------------|
| Exakt | `1.2.3` | Nur 1.2.3 |
| Caret | `^1.2.0` | >=1.2.0, <2.0.0 |
| Tilde | `~1.2.0` | >=1.2.0, <1.3.0 |
| Bereich | `>=1.0.0` | 1.0.0 und hoher |
| Platzhalter | `*` | Jede Version (wahlt die hochste) |
| Kombiniert | `>=1.0.0 <2.0.0` | Zwischen 1.0.0 und 2.0.0 |

### Auflosungsregeln

- Jedes Modul wird gegen die **Schnittmenge aller deklarierten Bereiche** im Abhangigkeitsgraphen aufgelost. Inkompatible Bereiche (Diamond-Konflikte) lassen die Auflosung mit einem expliziten Fehler fehlschlagen, statt stillschweigend eine Seite zu wahlen.
- Abhangigkeiten werden aus ihren deklarierten Bereichen gelost, nicht aus zuvor aufgelosten Pins.
- **Root-Deklarationen gewinnen gegen transitive**: Wenn Ihre App und eine Abhangigkeit dasselbe Modul oder dieselbe Anforderung einziehen, hat Ihre Deklaration Vorrang.
- Dieselbe Komponente darf nur einmal als Root-Abhangigkeit deklariert werden — eine doppelte Deklaration wird mit einem Konfliktfehler abgelehnt. Aktualisieren Sie stattdessen die bestehende Abhangigkeit.

Zwei Auflösungsfehler werden unterschiedlich gemeldet. Ein Constraint-Ausdruck, den kein jemals veröffentlichtes Release erfüllen kann — die Schnittmenge der aktiven Bereiche ist leer — ist ein Konflikt, und der Fehler nennt das Modul und jeden Anforderer, der einen Bereich beigesteuert hat. Eine gültige Bereichsmenge, für die der Hub derzeit keine passende Version veröffentlicht, ist dagegen ein Verfügbarkeitsfehler: Ein späteres Release kann sie auflösbar machen, ohne dass sich an den Deklarationen etwas ändert.

Die Runtime persistiert jeden aufgelosten Graphen in ihrer Registry-Historie und spielt ihn beim Start wieder ab, statt neu aufzulosen, sodass eine deployte Anwendung mit genau den Versionen bootet, die beim Anwenden der Abhangigkeitsanderung aufgelost wurden. `wippy.lock` bleibt der portable Snapshot fur Quellprojekte.

### Herkunft von Eintragen

Die Herkunft gehört der Registry, sie ist keine Eintrags-Metadaten. Beim Laden der Eintrage stempelt die Registry jedem die Deployment-Quelle auf, die ihn geliefert hat:

| Feld | Beschreibung |
|------|--------------|
| `registry.owner` | Modulname (`org/module`), der den Eintrag geliefert hat; leer bei Anwendungsquellcode |
| `registry.root` | Wird auf `ns.dependency`-Eintragen gesetzt, die von der Deployment-Wurzel geliefert wurden, und markiert sie als Root-Deklarationen |

Autoren von Eintragen schreiben diese Felder nie; sie werden beim Laden vergeben und lassen sich aus einer `_index.yaml` nicht fälschen. Sie lassen sich mit `wippy registry list --registry-meta --json` einsehen.

## Arbeitsablauf

### Neues Projekt starten

```bash
wippy init
```

Erstellt eine `wippy.lock` mit Standardverzeichnissen.

### Abhangigkeiten hinzufugen

```bash
wippy add acme/http               # Latest version
wippy add acme/http@1.2.3         # Exact version
wippy add acme/http@latest         # Latest label
```

Dies aktualisiert die Lock-Datei. Dann installieren:

```bash
wippy install
```

### Aus dem Quellcode auflosen

Wenn Ihr Quellcode bereits `ns.dependency`-Eintrage deklariert:

```bash
wippy update
```

Dies durchsucht Ihr Quellverzeichnis, lost alle Abhangigkeitsbeschrankungen auf, aktualisiert die Lock-Datei und installiert die Module.

### Abhangigkeiten aktualisieren

```bash
wippy update                       # Re-resolve all dependencies
wippy update acme/http             # Update only acme/http
wippy update acme/http acme/sql    # Update specific modules
```

Beim Aktualisieren bestimmter Module bleiben andere Module auf ihren aktuellen Versionen fixiert. Falls die Aktualisierung Anderungen an nicht ausgewahlten Modulen erfordert, werden Sie zur Bestatigung aufgefordert.

### Aus der Lock-Datei installieren

```bash
wippy install                      # Install all from lock
wippy install --refresh            # Jedes Modul erneut herunterladen (--force und --repair sind Aliase)
```

## Modulspeicher

Heruntergeladene Module werden im Verzeichnis `.wippy/vendor/` gespeichert:

```
project/
  wippy.lock
  src/
    _index.yaml
  .wippy/
    vendor/
      acme/
        http-v1.2.0.wapp
        sql-v2.0.1.wapp
```

Standardmassig werden Module als `.wapp`-Dateien aufbewahrt. Um sie in Verzeichnisse zu entpacken:

```yaml
# wippy.lock
options:
  unpack_modules: true
```

Mit aktiviertem Entpacken:

```
.wippy/
  vendor/
    acme/
      http-v1.2.0.wapp
      http/
        wippy.yaml
        src/
          _index.yaml
          ...
```

Das Entpacken verwirft das Pack nie. Das kanonische verifizierte `.wapp` bleibt neben dem entpackten Verzeichnis liegen, weil es der einzige inhaltsadressierte Beleg fur das Modul ist und weil Artefakt-Materialisierung und Reparatur Ressourcen daraus zurücklesen. Auf das `.wapp` prüft die Installation: Ein Verzeichnis, dessen Pack fehlt, gilt als nicht installiert, und das Modul wird erneut heruntergeladen. Jede Installation entpackt das Verzeichnis frisch aus dem verifizierten Archiv, sodass manuelle Änderungen an einem vendorierten Verzeichnis nicht überleben.

Module, die aus einer [Workspace-Ersetzung](#local-development-with-replacements) aufgelöst werden, werden nie heruntergeladen oder vendoriert; sie laden aus dem lokalen Pfad.

## Lokale Entwicklung mit Ersetzungen

Uberschreiben Sie Hub-Module mit lokalen Verzeichnissen fur die Entwicklung. Ersetzungen werden im `workspace`-Abschnitt einer Runtime-Konfigurationsdatei deklariert — typischerweise einer privaten, git-ignorierten, die auf `.wippy.yaml` komponiert wird:

```yaml
# .wippy.workspace.yaml
version: "1.0"
workspace:
  replacements:
    acme/http: ../local-http
    acme/sql: ../local-sql
```

```bash
wippy run --config .wippy.yaml --config .wippy.workspace.yaml
```

Schlussel sind `org/module`, Werte sind Verzeichnisse (relative Pfade werden gegen das Verzeichnis der ersten `--config`-Datei aufgelost). Das Setzen einer Ersetzung auf `null` deaktiviert eine aus einer fruheren Konfigurationsschicht oder einem Profil geerbte Ersetzung. Ersetzungen konnen auch in einem [Profil](guides/configuration.md#profiles) liegen, sodass sie nur mit `--profile workspace` aktiv werden.

Der Pfad muss nur fur ein Modul existieren und ein Verzeichnis sein, das der Lock-Graph tatsächlich auswählt. Eine Ersetzung, die fur ein Modul deklariert ist, von dem nichts abhängt, ist eine Auflösungseingabe, keine Boot-Eingabe: Sie darf auf ein Verzeichnis zeigen, das auf dieser Maschine nicht ausgecheckt ist, ohne die Validierung scheitern zu lassen.

Eine Ersetzung ändert, woher der Quellcode eines Moduls kommt, nicht welches Release gewählt wurde. Der Ladepfad behält die Version und den Digest, die der Lock fur dieses Modul ausgewählt hat, und wird als Ersetzung markiert; daraus geladene Eintrage überschatten die vendorierten mit derselben ID. Ist eine Ersetzung fur ein Modul deklariert, fur das der Lock keine Version fixiert, fragt die Auflösung den Hub nach einer Release-Version und hält bis zu einem stärkeren Beleg eine nur lokal gültige Null-Version.

Workspace-Ersetzungen wirken auf den Ladegraphen beim Start und werden nie in `wippy.lock` geschrieben. Anderungen an der lokalen Quelle werden direkt abgeglichen, ohne den Hub zu kontaktieren. Die `exclude:`-Globs aus der `wippy.yaml` des Moduls gelten auch fur Ersetzungsverzeichnisse, sowohl beim Laden von Eintragen als auch beim Hashen des Inhalts.

Ein `replacements:`-Abschnitt in `wippy.lock` ist veraltet: Er wird noch geladen, gibt aber eine Warnung aus. Verschieben Sie diese Eintrage nach `workspace.replacements` in einer Konfigurationsdatei.

## Ladereihenfolge

Beim Start ladt Wippy Eintrage aus Verzeichnissen in dieser Reihenfolge:

1. Quellverzeichnis (`src`)
2. Ersetzungsverzeichnisse
3. Herstellergebundene Modulverzeichnisse

Module mit aktiven Ersetzungen uberspringen ihren Vendor-Pfad.

## Integritatsprufung

Jedes Modul in der Lock-Datei tragt einen Artefakt-Digest. Der Boot weigert sich, ein Modul zu laden, dessen Lock-Eintrag keinen hat; `wippy install` akzeptiert einen solchen Eintrag und zeichnet den Digest auf, den der Hub mit dem Download ausliefert.

Beim Boot werden Downloads gestaged: Das Pack wird in eine temporäre Datei neben seinem endgültigen Ort geschrieben, gegen den in `wippy.lock` fixierten Digest und gegen den Digest verifiziert, den der Hub mit der Download-URL ausgeliefert hat (samt ausgelieferter Größe), und erst dann an seinen Platz umbenannt. Eine gestagte Datei, die die Prüfung nicht besteht, wird gelöscht. `wippy install` benennt den Download in seinen Vendor-Pfad um, bevor es ihn verifiziert, prüft ihn nur gegen den ausgelieferten Digest und die ausgelieferte Größe, löscht ihn bei Fehlschlag und ersetzt einen Lock-Digest, der vom ausgelieferten abweicht, statt ihn durchzusetzen.

Ein abweichender Digest ist ein harter, nicht wiederholbarer Fehler. Beim Boot ist er `PermissionDenied`, "module integrity verification failed", ausgelöst für einen frischen Download ebenso wie für ein bereits vendoriertes Pack, das gegen den Lock-Digest erneut verifiziert wird, bevor Eintrage geladen werden. `wippy install` meldet ihn als `Internal`: "failed to store module" um "verify cached WAPP: digest mismatch" für ein Pack, das bereits im Vendor-Verzeichnis liegt, und "failed to download module" um "verify downloaded WAPP: digest mismatch" für einen frischen Download. Nichts wiederholt den Versuch, lädt über die Abweichung hinweg erneut herunter oder fällt auf den ausgelieferten Inhalt zurück.

Dieselbe Prüfung sichert die Auflösung ab. Liefert der Hub ein Manifest, dessen Digest von dem im Lock fixierten abweicht, wird der Manifest-Cache einmal aufgefrischt und erneut verglichen; stimmt er weiterhin nicht überein, scheitert die Auflösung und nennt beide Digests.

Entpackte Verzeichnisse tragen ihren eigenen aufgezeichneten Digest, ihre Größe und ihren Baum-Digest und werden gegen die aufgezeichneten Werte erneut verifiziert, sodass ein veränderter vendorierter Baum erkannt statt geladen wird.

Auch Ersetzungsquellen sind inhaltsadressiert. Die Runtime bildet den Digest des Ersetzungsbaums und lehnt ihn ab, wenn der aufgelöste Graph bereits einen anderen Digest oder eine andere Größe fur dieses Modul fixiert, sodass eine Ersetzung nicht stillschweigend fur Inhalt einstehen kann, dem sie nicht entspricht.

## Build-Zeit-Artefakte

Ein Modul kann eine mit `meta.artifact.format` markierte Dateisystem-Ressource ausliefern, die Konsumenten auf die Platte materialisieren, statt sie zur Laufzeit zu lesen. Vollständige und gezielte `wippy install`- und `wippy update`-Läufe, der Kaltstart und Laufzeit-Abhängigkeitsoperationen gleichen diese Ausgaben in derselben Transaktion ab, die den Modulgraphen ändert; `artifact.materialization_root` setzt die Ausgabe-Wurzel. Siehe [Build-Zeit-Artefakte](guides/artifacts.md).

## Siehe auch

- [Build-Zeit-Artefakte](guides/artifacts.md) - Artefakt-Ressourcen deklarieren, materialisieren und abgleichen
- [Komponenten bauen](guides/components.md) - Die Autorenseite: `ns.requirement` und Werte via `parameters` bereitstellen
- [CLI](guides/cli.md) - Befehlsreferenz
- [Veroffentlichung](guides/publishing.md) - Module im Hub veroffentlichen
- [Projektstruktur](start/structure.md) - Projektaufbau
