---
title: "Installation"
description: "Installieren Sie die Wippy-Runtime und prüfen Sie, ob der Befehl verfügbar ist."
---

# Installation

## Installation

```bash
curl -fsSL https://hub.wippy.ai/install.sh | bash
```

Das Installationsskript setzt eine POSIX-Shell voraus. Laden Sie die Runtime unter Windows von
[hub.wippy.ai/releases](https://hub.wippy.ai/releases) herunter und nehmen Sie `wippy.exe` in den
`PATH` auf.

## Überprüfung

```bash
wippy version
```

## Abhängigkeitsmetadaten initialisieren

```bash
# Create a project directory
mkdir myapp
cd myapp

# Create or update wippy.lock
wippy init
```

`wippy init` schreibt den Dependency-Lock sowie dessen Einstellungen für Quell- und Modulverzeichnisse. Der Befehl legt weder Quellcode für die Anwendung noch Registry-Einträge an. Folgen Sie [Hello World](../tutorials/hello-world.md), um eine ausführbare Anwendung zu erstellen, und starten Sie sie anschließend mit `wippy run`.

Die Runtime umfasst HTTP-, SQL-, Storage- und Process-Hosting-Funktionen. Fügen Sie Framework-Module aus dem Hub hinzu, wenn die Anwendung sie benötigt:

```bash
wippy add wippy/test
wippy install
```

## Befehlsübersicht

| Befehl | Beschreibung |
| --------- | ------------- |
| `wippy init` | `wippy.lock` erstellen oder aktualisieren |
| `wippy run` | Runtime starten |
| `wippy test` | Test-Entrypoint ausführen |
| `wippy lint` | Code auf Fehler prüfen |
| `wippy add` | Abhängigkeit hinzufügen |
| `wippy install` | Abhängigkeiten installieren |
| `wippy update` | Abhängigkeiten aktualisieren |
| `wippy pack` | Snapshot erstellen |
| `wippy publish` | Im Hub veröffentlichen |
| `wippy search` | Nach Modulen suchen |
| `wippy readme` | README eines Moduls aus dem Hub abrufen |
| `wippy registry` | Geladene Registry-Einträge untersuchen |
| `wippy auth` | Authentifizierung verwalten |
| `wippy version` | Versionsinformationen ausgeben |

Die vollständige Dokumentation finden Sie in der [CLI-Referenz](../guides/cli.md).

## Fehlerbehebung

Wenn die Shell `wippy` nach der Installation nicht findet, öffnen Sie sie erneut und prüfen Sie, ob das Installationsverzeichnis im `PATH` liegt.

## Nächste Schritte

- [Hello World](../tutorials/hello-world.md) — Erstellen Sie Ihre erste Anwendung
- [Projektstruktur](./structure.md) — Lernen Sie den Projektaufbau kennen
- [CLI-Referenz](../guides/cli.md) — Sehen Sie sich alle Befehle und Optionen an
