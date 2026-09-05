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
| `--config` | | Konfigurationsdatei, wiederholbar; spätere Dateien überschreiben frühere (Standard: .wippy.yaml) |
| `--verbose` | `-v` | Debug-Logging aktivieren |
| `--very-verbose` | | Debug mit Stack-Traces |
| `--console` | `-c` | Farbige Konsolenausgabe |
| `--silent` | `-s` | Konsolenausgabe deaktivieren |
| `--event-streams` | `-e` | Logs an den Event-Bus streamen |
| `--profiler` | `-p` | pprof auf localhost:6060 aktivieren |
| `--memory-limit` | `-m` | Speicherlimit (z.B. 1G, 512M) |

Priorität des Speicherlimits: `--memory-limit` Flag > `GOMEMLIMIT` Umgebungsvariable > 1GB Standard.

`--config` kann mehrfach übergeben werden, um Konfigurationsdateien zu komponieren. Dateien werden von links nach rechts zusammengeführt: Spätere Dateien überschreiben übereinstimmende Werte und behalten alles andere bei. Jede explizit benannte Datei muss existieren; ohne `--config` ist die Standarddatei `.wippy.yaml` optional. Die erste Datei verankert das Verzeichnis, gegen das relative Pfade aufgelöst werden. Die Konfiguration wird in dieser Reihenfolge angewendet: Datei-Komposition, dann `--profile`-Auswahlen, dann `--set`-Überschreibungen. Siehe [Konfiguration](guides/configuration.md#config-composition).

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
wippy run migrate                           # Einen benannten benutzerdefinierten Befehl ausführen
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
| `--profile` | | Ein Runtime-Profil aus `.wippy.yaml` oder gepackten Runtime-Metadaten anwenden (wiederholbar, in Reihenfolge angewendet) |

Das Ausführen eines Hub-Moduls (`wippy run org/module`) löst es einmal auf, hält es in `wippy.lock` fest und legt die verifizierten Packs lokal ab. Nachfolgende Läufe derselben Referenz starten aus dem Lock — ohne Netzwerkzugriff. Ein Versions-Selektor, der nicht mehr zum Lock passt, wird mit dem Hinweis abgelehnt, `wippy update` auszuführen.

Bei einer lokalen Anwendung repariert `wippy run` einen veralteten Lock, bevor irgendein Runtime-Dienst startet. Es lädt die Abhängigkeitsdeklarationen aus den Quellen, und wenn der Lock sie bereits erfüllt, löst es den Graphen ausschließlich aus lokalen und installierten Belegen erneut auf (verifiziert-offline, ohne Netzwerkzugriff). Stimmt diese Offline-Auflösung mit dem Lock überein, läuft der Boot unverändert weiter. Andernfalls wird der Hub kontaktiert, der Kandidaten-Graph heruntergeladen und verifiziert, und erst dann wird `wippy.lock` neu geschrieben. Ein Lock, der eine Deployment-Wurzel auswählt, ist maßgeblich und wird nie erneut aufgelöst.

`--exec` blockiert, bis der gestartete Prozess sein Ergebnis liefert, und gibt dann den Exit-Code des Prozesses als Exit-Code der CLI weiter. Strg-C während `--exec` bricht den laufenden Prozess ab, und die Runtime fährt trotzdem sauber herunter; ein zweites Signal erzwingt den sofortigen Abbruch.

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
wippy test                     # Tests aus dem lokalen Projekt ausführen
wippy test snapshot.wapp       # Tests aus einer Pack-Datei ausführen
wippy test acme/module@1.2.3   # Tests aus einem Hub-Modul ausführen
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
| `--profile` | | | Ein Workspace-Profil aus der zusammengeführten Runtime-Konfiguration anwenden (wiederholbar) |
| `--set` | | | Einen Wert der zusammengeführten Runtime-Konfiguration überschreiben (`section.path=value`, wiederholbar) |

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
| `--profile` | | | Ein Workspace-Profil aus der zusammengeführten Runtime-Konfiguration anwenden (wiederholbar) |
| `--set` | | | Einen Wert der zusammengeführten Runtime-Konfiguration überschreiben (`section.path=value`, wiederholbar) |

## wippy artifacts

Mit Build-Zeit-Dateisystem-Artefakten arbeiten.

### wippy artifacts materialize

Ein Artefakt-Dateisystem aus einem vorhandenen Pack validieren und materialisieren.

```bash
wippy artifacts materialize snapshot.wapp app:package_fs
wippy artifacts materialize snapshot.wapp app:package_fs --root build
```

| Flag | Standard | Beschreibung |
|------|----------|--------------|
| `--root` | `.wippy` | Materialisierungs-Wurzel |

Die Ressource wird über ihren vollständigen `namespace:name` adressiert, muss `meta.artifact.format` deklarieren, und dieses Format muss in der CLI registriert sein. Der Befehl löst keine Modulabhängigkeiten auf, verändert `wippy.lock` nicht, ruft keine Paketmanager auf und nimmt an der Runtime-Komposition nicht teil. Siehe [Build-Zeit-Artefakte](guides/artifacts.md#materializing-explicitly).

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
| `--embed-all` | | Alle fs.directory-Entries einbetten (nicht mit `--embed` kombinierbar) |
| `--list` | | fs.directory-Entries auflisten (Trockenlauf) |
| `--exclude-ns` | | Namespaces ausschließen (Muster) |
| `--exclude` | | Entries ausschließen (Muster) |
| `--bytecode` | | Lua zu Bytecode kompilieren (** für alle) |
| `--profile` | | Ein Runtime-Profil aus `.wippy.yaml` vor dem Packen anwenden (wiederholbar, in Reihenfolge angewendet) |

Ohne `--embed` oder `--embed-all` greifen die Embed-Muster auf den `embed:`-Abschnitt des Modul-Manifests `wippy.yaml` zurück. Das Packen einer Anwendung übernimmt auch eingebettete Ressourcen aus ihren Abhängigkeits-Packs, und nur die Befehle des Hauptmoduls werden vom resultierenden Pack bereitgestellt.

Die Ausgabedatei wird atomar geschrieben: Das Pack wird in eine temporäre Datei im Zielverzeichnis gebaut, synchronisiert, verifiziert und erst dann über das Ziel umbenannt, wobei es die Berechtigungen einer vorhandenen Datei übernimmt. Ein fehlgeschlagener Pack-Lauf lässt die vorherige Datei unangetastet. Eine Ausgabe zu benennen, die zugleich eine der Eingaben des Packs ist — derselbe Pfad oder ein Hard- bzw. Symlink, der auf dieselbe Datei zeigt — wird abgelehnt, statt die Eingabe mitten im Lesen abzuschneiden.

`--meta` kann keine reservierten Metadaten schreiben. Der Schlüssel `registry` sowie alles unter den Präfixen `wippy.` oder `system.` gehört dem Pack-Format und wird abgelehnt.

Ressourcen, die `meta.artifact.format` deklarieren, werden beim Packen validiert, sodass ein fehlerhaftes Artefakt hier scheitert und nicht erst beim Konsumenten. Siehe [Build-Zeit-Artefakte](guides/artifacts.md).

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

Der Modultyp wird normalerweise als `type:` in `wippy.yaml` deklariert (siehe [Publishing](guides/publishing.md#wippy-yaml)); `--module-type` überschreibt ihn für eine einzelne Veröffentlichung. Ist keins von beiden gesetzt, erhalten neu erstellte Module standardmäßig den Typ `application` mit einer Deprecation-Warnung.

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
| `--registry-meta` | | Registry-eigene Metadaten (`owner`, `root`) in die JSON- oder YAML-Ausgabe aufnehmen; erfordert `--json` oder `--yaml` |
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
| `security` | Nein | Sicherheitskontext, unter dem der Befehl läuft, wenn er über die CLI gestartet wird |

Jede Art von Prozess-Entry funktioniert (`process.lua`, `process.wasm`). Der Befehlsname muss über alle geladenen Entries eindeutig sein. Argumente nach dem Befehlsnamen werden als String-Payloads an den Prozess übergeben.

### Befehlssicherheit

Ein Befehls-Entry deklariert den Actor und den Policy-Scope, unter dem sein CLI-Start läuft:

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
            id: system.migrations
            meta:
              role: operator
          policies:
            - app.security:migrations_policy
          groups:
            - app.security:operators
    source: file://runner.lua
    method: main
```

| Feld | Beschreibung |
|------|--------------|
| `actor.id` | Actor-Identität für den gestarteten Prozess |
| `actor.meta` | Actor-Attribute, die von Policies ausgewertet werden |
| `policies` | Registry-IDs (`namespace:name`) einzelner Policies, die dem Scope hinzugefügt werden |
| `groups` | Registry-IDs von Policy-Gruppen, deren Policies dem Scope hinzugefügt werden |

Der Block steht innerhalb von `meta.command`, weil er nur für den CLI-Startpfad gilt — der Operator hat den Befehl auf seinem eigenen Deployment gestartet, und das ist der Vertrauensanker. Auf gewöhnliche Spawns desselben Prozess-Entries hat er keine Wirkung; diese folgen dem eigenen [`security:`-Block](guides/entry-kinds.md#process-security) des Entries.

Die Deklaration ist fail-closed und wird validiert, bevor der Prozess startet:

- Unbekannte Felder innerhalb von `security` werden abgelehnt.
- Ein leerer `security`-Block (kein Actor, keine Policies, keine Gruppen) wird abgelehnt.
- `security` ohne `name` wird abgelehnt — ein Befehl muss benennbar sein, um gestartet werden zu können.
- Eine Policy oder Gruppe, die nicht aufgelöst werden kann, verweigert den Start; die Auflösung ist atomar, sodass nie ein unvollständiger Scope installiert wird.

Lässt der Block `actor` weg, wird der Actor des Aufrufers geerbt. Lässt er sowohl `policies` als auch `groups` weg, wird der Scope des Aufrufers geerbt.

## Beispiele

### Entwicklungs-Workflow

```bash
# Projekt initialisieren
wippy init
wippy add wippy/test wippy/llm
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

- [Konfiguration](guides/configuration.md) - Referenz zur Konfigurationsdatei
- [Observability](guides/observability.md) - Monitoring und Logging
