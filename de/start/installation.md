# Installation

## Schnellinstallation

```bash
curl -fsSL https://hub.wippy.ai/install.sh | bash
```

Oder laden Sie direkt von [hub.wippy.ai/releases](https://hub.wippy.ai/releases) herunter.

## Überprüfung

```bash
wippy version
```

## Schnellstart

```bash
# Neues Projekt erstellen
mkdir myapp && cd myapp
wippy init

# Abhängigkeiten hinzufügen
wippy add wippy/http
wippy install

# Ausführen
wippy run
```

## Befehlsübersicht

| Befehl | Beschreibung |
|--------|--------------|
| `wippy init` | Neues Projekt initialisieren |
| `wippy run` | Runtime starten |
| `wippy lint` | Code auf Fehler prüfen |
| `wippy add` | Abhängigkeit hinzufügen |
| `wippy install` | Abhängigkeiten installieren |
| `wippy update` | Abhängigkeiten aktualisieren |
| `wippy pack` | Snapshot erstellen |
| `wippy publish` | Zum Hub veröffentlichen |
| `wippy search` | Nach Modulen suchen |
| `wippy auth` | Authentifizierung verwalten |
| `wippy version` | Versionsinformationen ausgeben |

Siehe [CLI-Referenz](guides/cli.md) für vollständige Dokumentation.

## Nächste Schritte

- [Hello World](tutorials/hello-world.md) - Erstellen Sie Ihr erstes Projekt
- [Projektstruktur](start/structure.md) - Verstehen Sie die Struktur
- [CLI-Referenz](guides/cli.md) - Alle Befehle und Optionen
