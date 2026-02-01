# CLI-Referenz

Kommandozeilenschnittstelle für die Wippy-Runtime.

## Globale Flags

Verfügbar für alle Befehle:

| Flag | Kurz | Beschreibung |
|------|------|--------------|
| `--config` | | Konfigurationsdatei (Standard: .wippy.yaml) |
| `--verbose` | `-v` | Debug-Logging aktivieren |
| `--very-verbose` | | Debug mit Stack-Traces |
| `--console` | `-c` | Farbiges Konsolen-Logging |
| `--silent` | `-s` | Konsolen-Logging deaktivieren |
| `--event-streams` | `-e` | Logs zum Event-Bus streamen |
| `--profiler` | `-p` | pprof auf localhost:6060 aktivieren |
| `--memory-limit` | `-m` | Speicherlimit (z.B. 1G, 512M) |

Speicherlimit-Priorität: `--memory-limit` Flag > `GOMEMLIMIT` Umgebungsvariable > 1GB Standard.

## wippy init

Neue Lock-Datei erstellen.

```bash
wippy init
wippy init --src-dir ./src --modules-dir .wippy
```

| Flag | Kurz | Standard | Beschreibung |
|------|------|----------|--------------|
| `--src-dir` | `-d` | ./src | Quellverzeichnis |
| `--modules-dir` | | .wippy | Modulverzeichnis |
| `--lock-file` | `-l` | wippy.lock | Lock-Datei-Pfad |

## wippy run

Runtime starten oder Befehl ausführen.

```bash
wippy run                                    # Runtime starten
wippy run list                               # Verfügbare Befehle auflisten
wippy run test                               # Tests ausführen
wippy run snapshot.wapp                      # Aus Pack-Datei ausführen
wippy run acme/http                          # Modul ausführen
wippy run --exec app:processes/app:worker   # Einzelnen Prozess ausführen
```

| Flag | Kurz | Beschreibung |
|------|------|--------------|
| `--override` | `-o` | Entry-Werte überschreiben (namespace:entry:field=value) |
| `--exec` | `-x` | Prozess ausführen und beenden (host/namespace:entry) |
| `--host` | | Host für Ausführung |
| `--registry` | | Registry-URL |

## wippy lint

Lua-Code auf Typfehler und Warnungen prüfen.

```bash
wippy lint
wippy lint --level warning
```

Validiert alle Lua-Einträge: `function.lua.*`, `library.lua.*`, `process.lua.*`, `workflow.lua.*`.

| Flag | Beschreibung |
|------|--------------|
| `--level` | Minimales Schweregrad-Level für Meldungen |

## wippy add

Modulabhängigkeit hinzufügen.

```bash
wippy add acme/http
wippy add acme/http@1.2.3
wippy add acme/http@latest
```

| Flag | Kurz | Standard | Beschreibung |
|------|------|----------|--------------|
| `--lock-file` | `-l` | wippy.lock | Lock-Datei-Pfad |
| `--registry` | | | Registry-URL |

## wippy install

Abhängigkeiten aus Lock-Datei installieren.

```bash
wippy install
wippy install --force
wippy install --repair
```

| Flag | Kurz | Beschreibung |
|------|------|--------------|
| `--lock-file` | `-l` | Lock-Datei-Pfad |
| `--force` | | Cache umgehen, immer herunterladen |
| `--repair` | | Hashes verifizieren, bei Abweichung neu herunterladen |
| `--registry` | | Registry-URL |

## wippy update

Abhängigkeiten aktualisieren und Lock-Datei neu generieren.

```bash
wippy update                      # Alle aktualisieren
wippy update acme/http            # Bestimmtes Modul aktualisieren
wippy update acme/http demo/sql   # Mehrere aktualisieren
```

| Flag | Kurz | Standard | Beschreibung |
|------|------|----------|--------------|
| `--lock-file` | `-l` | wippy.lock | Lock-Datei-Pfad |
| `--src-dir` | `-d` | . | Quellverzeichnis |
| `--modules-dir` | | .wippy | Modulverzeichnis |
| `--registry` | | | Registry-URL |

## wippy pack

Snapshot-Pack (.wapp-Datei) erstellen.

```bash
wippy pack snapshot.wapp
wippy pack release.wapp --description "Release 1.0"
wippy pack app.wapp --embed app:assets --bytecode **
```

| Flag | Kurz | Beschreibung |
|------|------|--------------|
| `--lock-file` | `-l` | Lock-Datei-Pfad |
| `--description` | `-d` | Pack-Beschreibung |
| `--tags` | `-t` | Pack-Tags (kommasepariert) |
| `--meta` | | Benutzerdefinierte Metadaten (key=value) |
| `--embed` | | fs.directory-Einträge einbetten (Muster) |
| `--list` | | fs.directory-Einträge auflisten (Trockenlauf) |
| `--exclude-ns` | | Namespaces ausschließen (Muster) |
| `--exclude` | | Einträge ausschließen (Muster) |
| `--bytecode` | | Lua zu Bytecode kompilieren (** für alle) |

## wippy publish

Modul zum Hub veröffentlichen.

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
| `--label` | Versions-Label |
| `--release-notes` | Release-Notizen |
| `--protected` | Als geschützt markieren |
| `--registry` | Registry-URL |

## wippy search

Im Hub nach Modulen suchen.

```bash
wippy search http
wippy search "sql driver" --limit 20
wippy search auth --json
```

| Flag | Beschreibung |
|------|--------------|
| `--json` | Als JSON ausgeben |
| `--limit` | Maximale Ergebnisse |
| `--registry` | Registry-URL |

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
| `--local` | Anmeldedaten lokal speichern |

### wippy auth logout

```bash
wippy auth logout
```

| Flag | Beschreibung |
|------|--------------|
| `--registry` | Registry-URL |
| `--local` | Lokale Anmeldedaten entfernen |

### wippy auth status

```bash
wippy auth status
wippy auth status --json
```

## wippy registry

Registry-Einträge abfragen und inspizieren.

### wippy registry list

```bash
wippy registry list
wippy registry list --kind function.lua
wippy registry list --ns app --json
```

| Flag | Kurz | Beschreibung |
|------|------|--------------|
| `--kind` | `-k` | Nach Kind filtern |
| `--ns` | `-n` | Nach Namespace filtern |
| `--name` | | Nach Name filtern |
| `--meta` | | Nach Metadaten filtern |
| `--json` | | Als JSON ausgeben |
| `--yaml` | | Als YAML ausgeben |
| `--lock-file` | `-l` | Lock-Datei-Pfad |

### wippy registry show

```bash
wippy registry show app:http:handler
wippy registry show app:config --yaml
```

| Flag | Kurz | Beschreibung |
|------|------|--------------|
| `--field` | `-f` | Bestimmtes Feld anzeigen |
| `--json` | | Als JSON ausgeben |
| `--yaml` | | Als YAML ausgeben |
| `--raw` | | Rohe Ausgabe |
| `--lock-file` | `-l` | Lock-Datei-Pfad |

## wippy version

Versionsinformationen ausgeben.

```bash
wippy version
wippy version --short
```

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
wippy run --exec app:processes/app:worker

# Mit aktiviertem Profiler
wippy run -p -v
# Dann: go tool pprof http://localhost:6060/debug/pprof/heap
```

### Abhängigkeitsverwaltung

```bash
# Neue Abhängigkeit hinzufügen
wippy add acme/http@latest

# Beschädigte Module reparieren
wippy install --repair

# Erneuten Download erzwingen
wippy install --force

# Bestimmtes Modul aktualisieren
wippy update acme/http
```

### Veröffentlichung

```bash
# Beim Hub anmelden
wippy auth login

# Modul validieren
wippy publish --dry-run

# Veröffentlichen
wippy publish --version 1.0.0 --release-notes "Erste Veröffentlichung"
```

## Konfigurationsdatei

`.wippy.yaml` für dauerhafte Einstellungen erstellen:

```yaml
logger:
  mode: development
  level: debug
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

- [Konfiguration](guide-configuration.md) - Konfigurationsdatei-Referenz
- [Observability](guide-observability.md) - Monitoring und Logging
