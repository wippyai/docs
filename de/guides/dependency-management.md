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
| `modules[].hash` | Inhalts-Hash zur Integritatsprufung |

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
- **Root-Deklarationen gewinnen gegen transitive**: Wenn Ihre App und eine Abhangigkeit dasselbe Modul oder dieselbe Anforderung einziehen, hat Ihre Deklaration Vorrang. Ein Abhangigkeits-Eintrag mit `meta.module` ist transitiv, sofern er nicht explizit als Root markiert ist — veroffentlichte Anwendungen behalten ihre im Quellcode deklarierten Abhangigkeiten als Roots.
- Dieselbe Komponente darf nur einmal als Root-Abhangigkeit deklariert werden — eine doppelte Deklaration wird mit einem Konfliktfehler abgelehnt. Aktualisieren Sie stattdessen die bestehende Abhangigkeit.

Die Runtime persistiert jeden aufgelosten Graphen in ihrer Registry-Historie und spielt ihn beim Start wieder ab, statt neu aufzulosen, sodass eine deployte Anwendung mit genau den Versionen bootet, die beim Anwenden der Abhangigkeitsanderung aufgelost wurden. `wippy.lock` bleibt der portable Snapshot fur Quellprojekte.

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
      http/
        wippy.yaml
        src/
          _index.yaml
          ...
```

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

Schlussel sind `org/module`, Werte sind Verzeichnisse (relative Pfade werden gegen das Verzeichnis der ersten `--config`-Datei aufgelost; der Pfad muss existieren und ein Verzeichnis sein). Das Setzen einer Ersetzung auf `null` deaktiviert eine aus einer fruheren Konfigurationsschicht oder einem Profil geerbte Ersetzung. Ersetzungen konnen auch in einem [Profil](guides/configuration.md#profiles) liegen, sodass sie nur mit `--profile workspace` aktiv werden.

Workspace-Ersetzungen wirken auf den Ladegraphen beim Start und werden nie in `wippy.lock` geschrieben. Anderungen an der lokalen Quelle werden direkt abgeglichen, ohne den Hub zu kontaktieren. Die `exclude:`-Globs aus der `wippy.yaml` des Moduls gelten auch fur Ersetzungsverzeichnisse, sowohl beim Laden von Eintragen als auch beim Hashen des Inhalts.

Ein `replacements:`-Abschnitt in `wippy.lock` ist veraltet: Er wird noch geladen, gibt aber eine Warnung aus. Verschieben Sie diese Eintrage nach `workspace.replacements` in einer Konfigurationsdatei.

## Ladereihenfolge

Beim Start ladt Wippy Eintrage aus Verzeichnissen in dieser Reihenfolge:

1. Quellverzeichnis (`src`)
2. Ersetzungsverzeichnisse
3. Herstellergebundene Modulverzeichnisse

Module mit aktiven Ersetzungen uberspringen ihren Vendor-Pfad.

## Integritatsprufung

Jedes Modul in der Lock-Datei hat einen Inhalts-Hash. Wahrend der Installation werden heruntergeladene Module anhand ihrer erwarteten Hashes uberpruft. Module mit abweichenden Hashes werden abgelehnt und erneut aus der Registry heruntergeladen.

## Siehe auch

- [Komponenten bauen](guides/components.md) - Die Autorenseite: `ns.requirement` und Werte via `parameters` bereitstellen
- [CLI](guides/cli.md) - Befehlsreferenz
- [Veroffentlichung](guides/publishing.md) - Module im Hub veroffentlichen
- [Projektstruktur](start/structure.md) - Projektaufbau
