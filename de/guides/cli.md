---
title: "CLI-Referenz"
description: "Befehle, Flags, Konfigurationsüberschreibungen und häufige Workflows für die Wippy-CLI."
---

# CLI-Referenz

Verwenden Sie die Wippy-CLI, um Projekte zu initialisieren, die Runtime auszuführen, Abhängigkeiten zu verwalten, Registry-Einträge zu untersuchen und Module zu veröffentlichen.

Dies ist eine Befehlsreferenz. Beispiele zu Quellcode, Lock-Datei, Registry-Einträgen oder Veröffentlichungsmetadaten setzen ein bestehendes Projekt beziehungsweise Modul voraus und bilden kein einzelnes End-to-End-Projekt.

## Globale Flags

Verfügbar bei allen Befehlen:

| Flag | Kurz | Beschreibung |
|------|------|--------------|
| `--config` | | Konfigurationsdatei, wiederholbar; spätere Dateien überschreiben frühere (Standard: .wippy.yaml). `wippy publish` definiert eine andere befehlsspezifische Option. |
| `--verbose` | `-v` | Debug-Logging aktivieren |
| `--very-verbose` | | Debug mit Stack-Traces |
| `--console` | `-c` | Farbige Konsolenausgabe |
| `--silent` | `-s` | Konsolenausgabe deaktivieren |
| `--event-streams` | `-e` | Logs an den Event-Bus streamen |
| `--profiler` | `-p` | pprof auf localhost:6060 aktivieren |
| `--memory-limit` | `-m` | Speicherlimit (z.B. 1G, 512M) |

Die Reihenfolge für das Speicherlimit ist `--memory-limit`, dann `GOMEMLIMIT`, dann der Standard von 1 GB.

Die globale Option `--config` kann mehrfach übergeben werden, um Konfigurationsdateien zu komponieren. Dateien werden von links nach rechts zusammengeführt. Jede explizit benannte Datei muss existieren; ohne `--config` ist `.wippy.yaml` optional. Die erste Datei verankert relative Pfade. Danach werden `--profile`-Overlays und zuletzt `--set`-Überschreibungen angewendet. Siehe [Konfiguration](./configuration.md#config-composition).

`wippy publish` überschattet die globale Option mit dem befehlsspezifischen `--config <dir>`. Dort ist der Wert das Verzeichnis mit `wippy.yaml`, nicht eine wiederholbare Runtime-Konfigurationsdatei.

## wippy init

`wippy.lock` erstellen oder die Einstellungen für Quell- und Modulverzeichnis aktualisieren. Der Befehl legt weder Anwendungsquellcode noch Registry-Einträge an.

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
wippy run                                   # Start runtime
wippy run list                              # List available commands
wippy run migrate                           # Run a named custom command
wippy run snapshot.wapp                     # Run from pack file
wippy run acme/http                         # Run module from hub
wippy run acme/http@1.2.3                   # Run specific version
wippy run --exec app:worker                 # Start runtime and execute a single process
```

| Flag | Kurz | Beschreibung |
|------|------|--------------|
| `--override` | `-o` | Entry-Werte überschreiben (`namespace:entry:field=value`); `field` kann `kind` sein, um die Entry-Art zu ändern |
| `--set` | | Konfigurationswert überschreiben (`section.path=value`, wiederholbar, hat Vorrang vor der Konfigurationsdatei) |
| `--exec` | `-x` | Prozess ausführen und beenden (`namespace:entry`) |
| `--host` | | Terminal-Host-ID für `--exec` (automatisch erkannt, wenn nur ein `terminal.host` existiert) |
| `--registry` | | Registry-URL für Hub-Module |
| `--profile` | | Ein Runtime-Profil aus `.wippy.yaml` oder gepackten Runtime-Metadaten anwenden (wiederholbar, in Reihenfolge angewendet) |

Das Ausführen eines Hub-Moduls (`wippy run org/module`) löst es einmal auf, hält es in `wippy.lock` fest und legt die verifizierten Packs lokal ab. Nachfolgende Läufe derselben Referenz starten aus dem Lock — ohne Netzwerkzugriff. Ein Versions-Selektor, der nicht mehr zum Lock passt, wird mit dem Hinweis abgelehnt, `wippy update` auszuführen.

`--set` schreibt jeden Laufzeit-Konfigurationswert über die Befehlszeile, pro Blatt über `.wippy.yaml` zusammengeführt:

```bash
wippy run --set cluster.enabled=true \
          --set cluster.membership.join_addrs=node-2:7946,node-3:7946 \
          --set cluster.raft.bootstrap_expect=3
```

Werte werden nach Form konvertiert: `true`/`false` zu Bool, Ganz- und Gleitkommazahlen zu Zahlen, alles andere bleibt ein String (Zeitdauern wie `5s` werden geparst, wo die Option eine erwartet).

## wippy test

Den Test-Entrypoint ausführen: den Prozess-Entry, der den Use Case `test` deklariert. Die Runtime bootet, führt diesen Entry aus und beendet sich. `wippy run` führt Test-Entrypoints nicht automatisch aus; Testen läuft immer über `wippy test`.

```bash
wippy test                     # Run tests from the local project
wippy test snapshot.wapp       # Run tests from a pack file
wippy test acme/module@1.2.3   # Run tests from a hub module
```

| Flag | Kurz | Beschreibung |
|------|------|--------------|
| `--override` | `-o` | Entry-Werte überschreiben (`namespace:entry:field=value`) |
| `--host` | | Terminal-Host-ID (automatisch erkannt, wenn nur ein `terminal.host` existiert) |
| `--registry` | | Registry-URL für Hub-Module |
| `--set` | | Konfigurationswert überschreiben (`section.path=value`, wiederholbar) |
| `--profile` | | Ein Runtime-Profil anwenden (wiederholbar, in Reihenfolge angewendet) |

## wippy lint

Lua-Code auf Typfehler und Warnungen prüfen.

```bash
wippy lint
wippy lint --level warning
wippy lint --json
wippy lint --rules
```

Validiert quellcodehaltige Einträge der Kinds `function.lua`, `library.lua`, `process.lua` und `workflow.lua`. Vorkompilierte `.bc`-Einträge enthalten keinen parsbaren Quellcode und werden übersprungen.

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
| `--profile` | | | Ein Workspace-Profil aus der zusammengeführten Runtime-Konfiguration anwenden (wiederholbar) |
| `--set` | | | Einen Wert der zusammengeführten Runtime-Konfiguration überschreiben (`section.path=value`, wiederholbar) |

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
wippy install                            # Install all
wippy install acme/http                  # Install specific module
wippy install --refresh acme/http        # Re-fetch a specific module
```

| Flag | Kurz | Standard | Beschreibung |
|------|------|----------|--------------|
| `--lock-file` | `-l` | wippy.lock | Pfad zur Lock-Datei |
| `--refresh` | | false | Jedes Modul neu herunterladen, Cache umgehen |
| `--force` | | false | Alias für `--refresh` |
| `--repair` | | false | Alias für `--refresh` |
| `--registry` | | | Registry-URL |
| `--profile` | | | Ein Workspace-Profil aus der zusammengeführten Runtime-Konfiguration anwenden (wiederholbar) |
| `--set` | | | Einen Wert der zusammengeführten Runtime-Konfiguration überschreiben (`section.path=value`, wiederholbar) |

## wippy update

Abhängigkeiten aktualisieren und Lock-Datei neu generieren.

```bash
wippy update                      # Update all
wippy update acme/http            # Update specific module
wippy update acme/http demo/sql   # Update multiple
```

| Flag | Kurz | Standard | Beschreibung |
|------|------|----------|--------------|
| `--lock-file` | `-l` | wippy.lock | Pfad zur Lock-Datei |
| `--src-dir` | `-d` | ./src | Quellverzeichnis |
| `--modules-dir` | | .wippy | Modulverzeichnis |
| `--registry` | | | Registry-URL |
| `--profile` | | | Ein Workspace-Profil aus der zusammengeführten Runtime-Konfiguration anwenden (wiederholbar) |
| `--set` | | | Einen Wert der zusammengeführten Runtime-Konfiguration überschreiben (`section.path=value`, wiederholbar) |

## wippy pack

Ein Snapshot-Pack (.wapp-Datei) erstellen.

```bash
wippy pack snapshot.wapp
wippy pack release.wapp --description "Release 1.0"
wippy pack app.wapp --embed app:assets --bytecode "**"
```

| Flag | Kurz | Beschreibung |
|------|------|--------------|
| `--lock-file` | `-l` | Pfad zur Lock-Datei |
| `--description` | `-d` | Pack-Beschreibung |
| `--tags` | `-t` | Pack-Tags (kommagetrennt) |
| `--meta` | | Benutzerdefinierte Metadaten (key=value) |
| `--embed` | | fs.directory-Entries einbetten (Muster) |
| `--embed-all` | | Alle fs.directory-Entries einbetten (nicht mit `--embed` kombinierbar) |
| `--list` | | fs.directory-Entries auflisten (Trockenlauf) |
| `--exclude-ns` | | Namespaces ausschließen (Muster) |
| `--exclude` | | Entries ausschließen (Muster) |
| `--bytecode` | | Lua zu Bytecode kompilieren (** für alle) |
| `--profile` | | Ein Runtime-Profil aus `.wippy.yaml` vor dem Packen anwenden (wiederholbar, in Reihenfolge angewendet) |

Ohne `--embed` oder `--embed-all` greifen die Embed-Muster auf den `embed:`-Abschnitt des Modul-Manifests `wippy.yaml` zurück. Das Packen einer Anwendung übernimmt auch eingebettete Ressourcen aus ihren Abhängigkeits-Packs, und nur die Befehle des Hauptmoduls werden vom resultierenden Pack bereitgestellt.

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
| `--module-type` | Modultyp: `library`, `application`, `agent` oder `plugin` (überschreibt `type:` in wippy.yaml) |
| `--module-display-name` | Anzeigename für neu erstellte Module (nur `--create`) |

Der Modultyp wird normalerweise als `type:` in `wippy.yaml` deklariert (siehe [Veröffentlichen](./publishing.md#wippyyaml)); `--module-type` überschreibt ihn für eine einzelne Veröffentlichung. Ist keiner der Werte gesetzt, erhalten neu erstellte Module standardmäßig den Typ `application` mit einer Deprecation-Warnung.

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

Registry-Einträge abfragen und inspizieren. Beide Unterbefehle akzeptieren `--profile` und `--set`, um die zusammengeführte Runtime-Konfiguration zu formen, unter der die Einträge geladen werden.

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
  - name: migrate_runner
    kind: process.lua
    meta:
      command:
        name: migrate
        short: Run database migrations
        security:
          actor:
            id: app:migrations
          policies:
            - app.security:migrations
          groups:
            - app.security:operators
    source: file://runner.lua
    method: main
    modules:
      - io
      - registry
      - funcs
```

Ausführen mit:

```bash
wippy run migrate
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
| `use_case` | Nein | Entrypoint-Kategorie, Standard `run`. Der Entry, der `use_case: test` deklariert, ist das, was `wippy test` ausführt |
| `security` | Nein | Nur für die CLI geltender Sicherheitskontext mit `actor`, `policies` und `groups` |

Der `security`-Block gehört in `meta.command`. Die gezeigten IDs sind Beispiele und müssen in der geladenen Registry auflösbar sein. Der Block gilt nur, wenn der Terminal-Host den Eintrag als CLI-Befehl startet; gewöhnliche Prozessstarts erben ihn nicht. Fehlerhafte oder nicht auflösbare Sicherheitsmetadaten verhindern den Start des Befehls.

Jede Art von Prozess-Entry funktioniert (`process.lua`, `process.wasm`). Der Befehlsname muss über alle geladenen Entries eindeutig sein. Argumente nach dem Befehlsnamen werden als String-Payloads an den Prozess übergeben.

## Beispiele

### Entwicklungs-Workflow

```bash
# Initialize dependency lock metadata
wippy init
wippy add wippy/test
wippy add wippy/llm
wippy install

# Check for errors
wippy lint

# Run with debug output
wippy run -c -v

# Override config for local dev
wippy run -o app:db:host=localhost -o app:db:port=5432
```

### Produktions-Deployment

```bash
# Create release pack with bytecode
wippy pack release.wapp --bytecode "**" --exclude-ns "test.**"

# Run from pack with memory limit
wippy run release.wapp -m 2G
```

### Debugging

```bash
# Execute single process
wippy run --exec app:worker

# With profiler enabled
wippy run -p -v
# Then: go tool pprof http://localhost:6060/debug/pprof/heap
```

### Abhängigkeitsverwaltung

```bash
# Add new dependency
wippy add acme/http@latest

# Force re-download
wippy install --force

# Update specific module
wippy update acme/http
```

### Veröffentlichung

```bash
# Login to hub
wippy auth login

# Validate module
wippy publish --dry-run

# Publish
wippy publish --version 1.0.0 --release-notes "Initial release"
```

## Umgebungsvariablen

| Variable | Wirkung |
|----------|---------|
| `WIPPY_TOKEN` | Registry-Auth-Token; hat Vorrang vor gespeicherten Zugangsdaten (ein via `hub.auth.authenticate` gesetztes Token rangiert noch höher) |
| `WIPPY_REGISTRY` | Standard-Registry-URL (wird von `--registry` überschrieben) |
| `WIPPY_CACHE_DIR` | Cache-Verzeichnis für via `wippy run org/module` ausgeführte Hub-Module (Standard: `~/.wippy/cache`) |
| `GOMEMLIMIT` | Fallback für das Speicherlimit, wenn `--memory-limit` nicht gesetzt ist |

Werte in `.wippy.yaml` können OS-Umgebungsvariablen mit `${env:NAME}` referenzieren, aufgelöst beim Laden der Datei; eine fehlende Variable lässt das Laden der Konfiguration fehlschlagen. Nackte `${name}`-Referenzen werden stattdessen aus dem `vars:`-Abschnitt der Konfiguration aufgelöst.

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

- [Konfiguration](./configuration.md) — Referenz der Konfigurationsdatei
- [Observability](./observability.md) — Monitoring und Logging
