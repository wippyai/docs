---
title: "Abhängigkeitsverwaltung"
description: "Deklarieren, lösen, installieren, aktualisieren, ersetzen und prüfen Sie Wippy-Modulabhängigkeiten mit einer Lock-Datei."
---

# Abhängigkeitsverwaltung

Wippy löst Modulabhängigkeiten aus Quelldeklarationen auf und zeichnet exakte Versionen in `wippy.lock` auf. Veröffentlichte Module werden vom Hub in das Modulverzeichnis des Projekts heruntergeladen.

Die folgenden Modulnamen, Versionen, Hashes und lokalen Pfade unter `acme/*` dienen nur als Beispiele. Verwenden Sie Module und geprüfte Digests aus Ihrem eigenen Projekt oder dem Hub.

## Projektdateien

### wippy.lock

Die Lock-Datei verfolgt die Verzeichnisstruktur Ihres Projekts und die fixierten Abhängigkeiten:

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
| `directories.modules` | Speicherort für heruntergeladene Module (Standard: `.wippy`) |
| `directories.src` | Speicherort Ihres Quellcodes (Standard: `./src`) |
| `modules[].name` | Modulbezeichner im Format `org/module` |
| `modules[].version` | Fixierte semantische Version |
| `modules[].hash` | Inhalts-Hash zur Integritatsprufung |

### wippy.yaml

Modul-Metadaten für die Veröffentlichung. Nur erforderlich, wenn Sie ein eigenes Modul veröffentlichen:

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
| `version` | Nein | Semantische Version (wird beim Veröffentlichen gesetzt) |
| `description` | Nein | Modulbeschreibung |
| `license` | Nein | SPDX-Lizenzbezeichner |
| `repository` | Nein | URL des Quell-Repositorys |
| `homepage` | Nein | Projekt-Homepage |
| `keywords` | Nein | Schlüsselwörter zur Auffindbarkeit |
| `authors` | Nein | Autorenliste |

## Abhängigkeiten deklarieren

Fügen Sie `ns.dependency`-Einträge in Ihrer `_index.yaml` hinzu:

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

### Auflösungsregeln

- Jedes Modul wird gegen die **Schnittmenge aller deklarierten Bereiche** im Abhängigkeitsgraphen aufgelöst. Inkompatible Bereiche (Diamond-Konflikte) lassen die Auflösung mit einem expliziten Fehler fehlschlagen, statt stillschweigend eine Seite zu wählen.
- Abhängigkeiten werden aus ihren deklarierten Bereichen gelöst, nicht aus zuvor aufgelösten Pins.
- **Root-Deklarationen gewinnen gegen transitive**: Wenn Ihre App und eine Abhängigkeit dasselbe Modul oder dieselbe Anforderung einziehen, hat Ihre Deklaration Vorrang. Ein Abhängigkeits-Eintrag mit `meta.module` ist transitiv, sofern er nicht explizit als Root markiert ist — veröffentlichte Anwendungen behalten ihre im Quellcode deklarierten Abhängigkeiten als Roots.
- Dieselbe Komponente darf nur einmal als Root-Abhangigkeit deklariert werden — eine doppelte Deklaration wird mit einem Konfliktfehler abgelehnt. Aktualisieren Sie stattdessen die bestehende Abhangigkeit.

Die Runtime persistiert jeden aufgelösten Graphen in ihrer Registry-Historie und spielt ihn beim Start wieder ab, statt neu aufzulösen, sodass eine deployte Anwendung mit genau den Versionen bootet, die beim Anwenden der Abhängigkeitsänderung aufgelöst wurden. `wippy.lock` bleibt der portable Snapshot für Quellprojekte.

## Abhängigkeits-Workflow

### Neues Projekt starten

```bash
wippy init
```

Erstellt eine `wippy.lock` mit Standardverzeichnissen.

### Abhängigkeiten hinzufügen

```bash
wippy add acme/http               # Latest version
wippy add acme/http@1.2.3         # Exact version
wippy add acme/http@latest         # Latest label
```

Dies aktualisiert die Lock-Datei. Dann installieren:

```bash
wippy install
```

### Aus dem Quellcode auflösen

Wenn Ihr Quellcode bereits `ns.dependency`-Einträge deklariert:

```bash
wippy update
```

Dies durchsucht Ihr Quellverzeichnis, lost alle Abhangigkeitsbeschrankungen auf, aktualisiert die Lock-Datei und installiert die Module.

### Abhängigkeiten aktualisieren

```bash
wippy update                       # Re-resolve all dependencies
wippy update acme/http             # Update only acme/http
wippy update acme/http acme/sql    # Update specific modules
```

Beim Aktualisieren bestimmter Module bleiben andere Module auf ihren aktuellen Versionen fixiert. Falls die Aktualisierung Änderungen an nicht ausgewählten Modulen erfordert, werden Sie zur Bestätigung aufgefordert.

### Aus der Lock-Datei installieren

```bash
wippy install                      # Install all from lock
wippy install --refresh            # Re-fetch every module (--force and --repair are aliases)
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
      http/
        wippy.yaml
        src/
          _index.yaml
          ...
```

## Lokale Entwicklung mit Ersetzungen

Ordnen Sie Hub-Module für die lokale Entwicklung lokalen Verzeichnissen im Abschnitt `workspace` einer Runtime-Konfigurationsdatei zu. Üblicherweise ist dies eine private, ignorierte Datei, die über `.wippy.yaml` gelegt wird:

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

Schlüssel sind `org/module`, Werte sind Verzeichnisse. Relative Pfade werden gegen das Verzeichnis der ersten `--config`-Datei aufgelöst; der Pfad muss existieren und ein Verzeichnis sein. `null` deaktiviert eine aus einer früheren Konfigurationsschicht oder einem Profil geerbte Ersetzung. Ersetzungen können auch in einem [Profil](./configuration.md#profiles) liegen und dadurch nur mit `--profile workspace` aktiv werden.

Workspace-Ersetzungen wirken auf den Ladegraphen beim Start und werden nie in `wippy.lock` geschrieben. Änderungen an der lokalen Quelle werden direkt abgeglichen, ohne den Hub zu kontaktieren. Die `exclude:`-Globs aus der `wippy.yaml` des Moduls gelten auch für Ersetzungsverzeichnisse, sowohl beim Laden von Einträgen als auch beim Hashen des Inhalts.

Der Abschnitt `replacements:` in `wippy.lock` ist veraltet. Er wird weiterhin mit einer Warnung geladen; verschieben Sie diese Einträge nach `workspace.replacements` in einer Konfigurationsdatei.

## Ladereihenfolge

Beim Start lädt Wippy Einträge aus Verzeichnissen in dieser Reihenfolge:

1. Quellverzeichnis (`src`)
2. Ersetzungsverzeichnisse
3. Herstellergebundene Modulverzeichnisse

Module mit aktiven Ersetzungen überspringen ihren Vendor-Pfad.

## Integritatsprufung

Der Inhalts-Hash eines Lock-Eintrags ist optional, bis die Installation ihn ergänzt. Ist ein erwarteter Digest vorhanden, prüft die Installation zwischengespeicherte und heruntergeladene Module dagegen. Ein abweichendes Cache-Modul beendet die Installation; führen Sie `wippy install --refresh` aus, um eine frische Kopie herunterzuladen und zu prüfen. Ein neu heruntergeladenes Modul mit fehlgeschlagener Prüfung wird entfernt und die Installation schlägt fehl.

## Siehe auch

- [Komponenten erstellen](./components.md) — Requirements definieren und Werte über `parameters` bereitstellen
- [CLI](./cli.md) — Befehlsreferenz
- [Veröffentlichung](./publishing.md) — Module im Hub veröffentlichen
- [Projektstruktur](../start/structure.md) — Projektaufbau
