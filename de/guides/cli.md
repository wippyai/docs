---
title: "CLI-Referenz"
description: "Kommandozeilenschnittstelle für die Wippy-Runtime."
---

# CLI-Referenz

Kommandozeilenschnittstelle für die Wippy-Runtime.

## Globale Flags

Verfügbar bei allen Befehlen:

| Flag | Kurz | Beschreibung |
|------|------|--------------|
| `--config` | | Konfigurationsdatei (Standard: .wippy.yaml) |
| `--verbose` | `-v` | Debug-Logging aktivieren |
| `--very-verbose` | | Debug mit Stack-Traces |
| `--console` | `-c` | Farbige Konsolenausgabe |
| `--silent` | `-s` | Konsolenausgabe deaktivieren |
| `--event-streams` | `-e` | Logs an den Event-Bus streamen |
| `--profiler` | `-p` | pprof auf localhost:6060 aktivieren |
| `--memory-limit` | `-m` | Speicherlimit (z.B. 1G, 512M) |

Priorität des Speicherlimits: `--memory-limit` Flag > `GOMEMLIMIT` Umgebungsvariable > 1GB Standard.

## wippy init

Eine neue Lock-Datei erstellen.

```bash
wippy init
wippy init --src-dir ./src --modules-dir .wippy
```

| Flag | Kurz | Standard | Beschreibung |
|------|------|----------|--------------|
| `--src-dir` | `-d` | ./src | Quellverzeichnis |
| `--modules-dir` | | .wippy | Modulverzeichnis |
| `--lock-file` | `-l` | wippy.lock | Pfad zur Lock-Datei |

## wippy run

Die Runtime starten oder einen Befehl ausführen.

```bash
wippy run                                   # Runtime starten
wippy run list                              # Verfügbare Befehle auflisten
wippy run test                              # Tests ausführen
wippy run snapshot.wapp                     # Aus Pack-Datei ausführen
wippy run acme/http                         # Modul aus dem Hub ausführen
wippy run acme/http@1.2.3                   # Bestimmte Version ausführen
wippy run --exec app:worker                 # Runtime starten und einen einzelnen Prozess ausführen
```

| Flag | Kurz | Beschreibung |
|------|------|--------------|
| `--override` | `-o` | Entry-Werte überschreiben (`namespace:entry:field=value`); `field` kann `kind` sein, um die Entry-Art zu ändern |
| `--set` | | Konfigurationswert überschreiben (`section.path=value`, wiederholbar, hat Vorrang vor der Konfigurationsdatei) |
| `--exec` | `-x` | Prozess ausführen und beenden (`namespace:entry`) |
| `--host` | | Terminal-Host-ID für `--exec` (automatisch erkannt, wenn nur ein `terminal.host` existiert) |
| `--registry` | | Registry-URL für Hub-Module |

`--set` schreibt jeden Laufzeit-Konfigurationswert über die Befehlszeile, pro Blatt über `.wippy.yaml` zusammengeführt:

```bash
wippy run --set cluster.enabled=true \
          --set cluster.membership.join_addrs=node-2:7946,node-3:7946 \
          --set cluster.raft.bootstrap_expect=3
```

Werte werden nach Form konvertiert: `true`/`false` zu Bool, Ganz- und Gleitkommazahlen zu Zahlen, alles andere bleibt ein String (Zeitdauern wie `5s` werden geparst, wo die Option eine erwartet).

## wippy lint

Lua-Code auf Typfehler und Warnungen prüfen.

```bash
wippy lint
wippy lint --level warning
wippy lint --json
wippy lint --rules
```

Validiert alle Lua-Entries: `function.lua`, `library.lua`, `process.lua`, `workflow.lua` (einschließlich ihrer `.bc`-Varianten).

| Flag | Kurz | Standard | Beschreibung |
|------|------|----------|--------------|
| `--lock-file` | `-l` | `wippy.lock` | Pfad zur Lock-Datei |
| `--level` | | `warning` | Minimaler Schweregrad: `error`, `warning`, `hint` |
| `--ns` | | | Filter nach Namespace-Mustern (z.B. `app`, `lib.*`) |
| `--code` | | | Filter nach Fehlercodes (z.B. `E0001,E0004`) |
| `--rules` | | `false` | Style-/Quality-Lint-Regeln aktivieren |
| `--summary` | | `false` | Ausgabe nach Fehlercode gruppieren |
| `--limit` | | `0` | Maximal angezeigte Diagnosen (0 = unbegrenzt) |
| `--json` | | `false` | JSON-Ausgabe |
| `--no-color` | | `false` | Farbige Ausgabe deaktivieren |
| `--cache-reset` | | `false` | Lua-Cache vor dem Linten leeren |

## wippy add

Eine Modulabhängigkeit hinzufügen.

```bash
wippy add acme/http
wippy add acme/http@1.2.3
wippy add acme/http@latest
```

| Flag | Kurz | Standard | Beschreibung |
|------|------|----------|--------------|
| `--lock-file` | `-l` | wippy.lock | Pfad zur Lock-Datei |
| `--registry` | | | Registry-URL |

## wippy install

Abhängigkeiten aus der Lock-Datei installieren.

```bash
wippy install                            # Alle installieren
wippy install acme/http                  # Bestimmtes Modul installieren
wippy install --refresh acme/http        # Bestimmtes Modul neu laden
```

| Flag | Kurz | Standard | Beschreibung |
|------|------|----------|--------------|
| `--lock-file` | `-l` | wippy.lock | Pfad zur Lock-Datei |
| `--refresh` | | false | Jedes Modul neu herunterladen, Cache umgehen |
| `--force` | | false | Alias für `--refresh` |
| `--repair` | | false | Alias für `--refresh` |
| `--registry` | | | Registry-URL |

## wippy update

Abhängigkeiten aktualisieren und Lock-Datei neu generieren.

```bash
wippy update                      # Alle aktualisieren
wippy update acme/http            # Bestimmtes Modul aktualisieren
wippy update acme/http demo/sql   # Mehrere aktualisieren
```

| Flag | Kurz | Standard | Beschreibung |
|------|------|----------|--------------|
| `--lock-file` | `-l` | wippy.lock | Pfad zur Lock-Datei |
| `--src-dir` | `-d` | ./src | Quellverzeichnis |
| `--modules-dir` | | .wippy | Modulverzeichnis |
| `--registry` | | | Registry-URL |

## wippy pack

Ein Snapshot-Pack (.wapp-Datei) erstellen.

```bash
wippy pack snapshot.wapp
wippy pack release.wapp --description "Release 1.0"
wippy pack app.wapp --embed app:assets --bytecode **
```

| Flag | Kurz | Beschreibung |
|------|------|--------------|
| `--lock-file` | `-l` | Pfad zur Lock-Datei |
| `--description` | `-d` | Pack-Beschreibung |
| `--tags` | `-t` | Pack-Tags (kommagetrennt) |
| `--meta` | | Benutzerdefinierte Metadaten (key=value) |
| `--embed` | | fs.directory-Entries einbetten (Muster) |
| `--list` | | fs.directory-Entries auflisten (Trockenlauf) |
| `--exclude-ns` | | Namespaces ausschließen (Muster) |
| `--exclude` | | Entries ausschließen (Muster) |
| `--bytecode` | | Lua zu Bytecode kompilieren (** für alle) |

## wippy publish

Modul im Hub veröffentlichen.

```bash
wippy publish
wippy publish --version 1.0.0
wippy publish --dry-run
```

Liest aus `wippy.yaml` im aktuellen Verzeichnis.

| Flag | Beschreibung |
|------|--------------|
| `--version` | Zu veröffentlichende Version |
| `--dry-run` | Validieren ohne zu veröffentlichen |
| `--label` | Als veränderbares Label statt Version veröffentlichen |
| `--release-notes` | Release-Notizen |
| `--protected` | Version als geschützt markieren |
| `--embed` | fs.directory-Entries nach ID oder Name einbetten |
| `--config` | Pfad zum Verzeichnis mit wippy.yaml (Standard: .) |
| `--registry` | Registry-URL |
| `--create` | Modul in der Registry erstellen, falls noch nicht vorhanden |
| `--module-visibility` | Sichtbarkeit für neu erstellte Module (nur `--create`): `public` oder `private` (Standard: private) |
| `--module-type` | Typ für neu erstellte Module (nur `--create`): `library`, `application`, `agent` oder `plugin` (Standard: application) |
| `--module-display-name` | Anzeigename für neu erstellte Module (nur `--create`) |

## wippy search

Module im Hub suchen.

```bash
wippy search http
wippy search "sql driver" --limit 20
wippy search auth --json
```

| Flag | Standard | Beschreibung |
|------|----------|--------------|
| `--json` | false | Ausgabe als JSON |
| `--limit` | 20 | Maximale Ergebnisse |
| `--registry` | | Registry-URL |

## wippy auth

Registry-Authentifizierung verwalten.

### wippy auth login

```bash
wippy auth login
wippy auth login --token YOUR_TOKEN
```

| Flag | Beschreibung |
|------|--------------|
| `--token` | API-Token |
| `--registry` | Registry-URL |
| `--local` | Zugangsdaten lokal speichern |

### wippy auth logout

```bash
wippy auth logout
```

| Flag | Beschreibung |
|------|--------------|
| `--registry` | Registry-URL |
| `--local` | Lokale Zugangsdaten entfernen |

### wippy auth status

```bash
wippy auth status
wippy auth status --json
```

| Flag | Beschreibung |
|------|--------------|
| `--json` | Ausgabe als JSON |

## wippy readme

README eines Moduls aus dem Hub abrufen.

```bash
wippy readme wippy/terminal
wippy readme wippy/terminal@1.2.3
wippy readme --json wippy/terminal@latest
```

| Flag | Beschreibung |
|------|--------------|
| `--json` | Ausgabe als JSON |
| `--registry` | Registry-URL (Standard: aus Zugangsdaten) |

## wippy registry

Registry-Einträge abfragen und inspizieren.

### wippy registry list

```bash
wippy registry list
wippy registry list --kind "function.lua.*"
wippy registry list --ns "app.*" --json
wippy registry list --meta "type=api" --meta "enabled=true"
```

| Flag | Kurz | Beschreibung |
|------|------|--------------|
| `--kind` | `-k` | Nach Art filtern (Glob-Muster) |
| `--ns` | `-n` | Nach Namespace filtern (Glob-Muster) |
| `--name` | | Nach Name filtern (Glob-Muster) |
| `--meta` | | Nach Metadaten filtern (wiederholbar) |
| `--json` | | Ausgabe als JSON |
| `--yaml` | | Ausgabe als YAML |
| `--lock-file` | `-l` | Pfad zur Lock-Datei |

Metadaten-Operatoren für `--meta`:

| Operator | Bedeutung |
|----------|-----------|
| `field=value` | Exakte Übereinstimmung |
| `field~regex` | Regex-Übereinstimmung |
| `field*substr` | Enthält Teilstring |
| `field^prefix` | Beginnt mit Präfix |
| `field$suffix` | Endet mit Suffix |

### wippy registry show

```bash
wippy registry show app:http:handler
wippy registry show app:config --yaml
```

| Flag | Kurz | Beschreibung |
|------|------|--------------|
| `--field` | `-f` | Bestimmtes Feld anzeigen |
| `--json` | | Ausgabe als JSON |
| `--yaml` | | Ausgabe als YAML |
| `--raw` | | Rohe Ausgabe |
| `--lock-file` | `-l` | Pfad zur Lock-Datei |

## wippy version

Versionsinformationen ausgeben.

```bash
wippy version
wippy version --short
```

## Benutzerdefinierte Befehle

Jeder `process.lua`- oder `process.wasm`-Entry kann als benannter Befehl registriert werden, indem `command`-Metadaten hinzugefügt werden:

```yaml
entries:
  - name: test_runner
    kind: process.lua
    meta:
      command:
        name: test
        short: Run application tests
    source: file://runner.lua
    method: main
    modules:
      - io
      - registry
      - funcs
```

Ausführen mit:

```bash
wippy run test
```

Alle verfügbaren Befehle auflisten:

```bash
wippy run list
```

### Befehl-Metadatenfelder

| Feld | Erforderlich | Beschreibung |
|------|--------------|--------------|
| `name` | Ja | Befehlsname, verwendet mit `wippy run <name>` |
| `short` | Nein | Kurzbeschreibung, angezeigt in `wippy run list` |
| `main` | Nein | Diesen Entry als Standardbefehl markieren (automatisch ausgewählt von Packs und Hub-Modulen, die einen einzigen Befehl ausliefern) |

Jede Art von Prozess-Entry funktioniert (`process.lua`, `process.wasm`). Der Befehlsname muss über alle geladenen Entries eindeutig sein. Argumente nach dem Befehlsnamen werden als String-Payloads an den Prozess übergeben.

## Beispiele

### Entwicklungs-Workflow

```bash
# Projekt initialisieren
wippy init
wippy add wippy/http wippy/sql
wippy install

# Auf Fehler prüfen
wippy lint

# Mit Debug-Ausgabe ausführen
wippy run -c -v

# Konfiguration für lokale Entwicklung überschreiben
wippy run -o app:db:host=localhost -o app:db:port=5432
```

### Produktions-Deployment

```bash
# Release-Pack mit Bytecode erstellen
wippy pack release.wapp --bytecode ** --exclude-ns test.**

# Aus Pack mit Speicherlimit ausführen
wippy run release.wapp -m 2G
```

### Debugging

```bash
# Einzelnen Prozess ausführen
wippy run --exec app:worker

# Mit aktiviertem Profiler
wippy run -p -v
# Dann: go tool pprof http://localhost:6060/debug/pprof/heap
```

### Abhängigkeitsverwaltung

```bash
# Neue Abhängigkeit hinzufügen
wippy add acme/http@latest

# Erneut herunterladen erzwingen
wippy install --force

# Bestimmtes Modul aktualisieren
wippy update acme/http
```

### Veröffentlichung

```bash
# Im Hub anmelden
wippy auth login

# Modul validieren
wippy publish --dry-run

# Veröffentlichen
wippy publish --version 1.0.0 --release-notes "Initial release"
```

## Konfigurationsdatei

`.wippy.yaml` für persistente Einstellungen erstellen:

```yaml
logger:
  encoding: console

logmanager:
  min_level: -1  # debug

profiler:
  enabled: true
  address: localhost:6060

override:
  app:gateway:addr: ":9090"
  app:db:host: "localhost"
```

## Siehe auch

- [Konfiguration](guides/configuration.md) - Referenz zur Konfigurationsdatei
- [Observability](guides/observability.md) - Monitoring und Logging
