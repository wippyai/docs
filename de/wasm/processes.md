---
title: "WASM-Prozesse"
description: "WASM-Module mit process.wasm unter einem Wippy Process Host ausführen."
---

# WASM-Prozesse

Ein `process.wasm`-Eintrag führt ein WASM-Modul unter einem Wippy Process Host aus und unterstützt Starten, Überwachen und kontrolliertes Herunterfahren.

**Klassifizierung: Referenz zur Prozesskonfiguration und zum Lebenszyklus.** Blöcke
mit Binärdateien setzen einen externen Komponenten-Build sowie anwendungseigene
Dateisystem-, Process-Host-, Umgebungs- und Policy-Einträge voraus. Platzhalter-Hashes
müssen durch den exakten Digest der Binärdatei ersetzt werden.

## Eintragskonfiguration

```yaml
entries:
  - name: wasm_binaries
    kind: fs.directory
    directory: ./wasm

  - name: compute_worker
    kind: process.wasm
    fs: myns:wasm_binaries
    path: /worker.wasm
    hash: sha256:292b796376f8b4cc360acf2ea6b82d1084871c3607a079f30b446da8e5c984a4
    method: compute
```

### Konfigurationsfelder

| Feld | Erforderlich | Beschreibung |
|------|--------------|--------------|
| `fs` | Ja | ID des Dateisystemeintrags mit der Binärdatei |
| `path` | Ja | Pfad zur `.wasm`-Datei innerhalb des Dateisystems |
| `hash` | Ja | SHA-256-Hash für die Integritätsprüfung |
| `method` | Ja | Name der auszuführenden exportierten Funktion |
| `transport` | Nein | Aufruf-Transport: `payload` (Standard) oder `wasi-http` |
| `wit` | Nein | WIT-Signatur für Raw/Core-Module |
| `imports` | Nein | Zu aktivierende Host-Imports |
| `wasi` | Nein | WASI-Konfiguration (`args`, `cwd`, `env` und `mounts`) |
| `limits` | Nein | Ausführungslimits |

<note>
`process.wasm` verwendet dieselbe Konfigurationsstruktur wie `function.wasm`. Daher akzeptiert das Schema einen `pool`-Block, ignoriert ihn jedoch — Prozesse laufen unter dem Process Host statt in einem Funktions-Pool.
</note>

## CLI-Befehle

Registrieren Sie einen WASM-Prozess mit `meta.command` als benannten Befehl:

```yaml
  - name: greet
    kind: process.wasm
    meta:
      command:
        name: greet
        short: Greet someone via WASM
    fs: myns:wasm_binaries
    path: /component.wasm
    hash: sha256:...
    method: greet
```

Führen Sie ihn so aus:

```bash
wippy run greet
```

Listen Sie die verfügbaren Befehle auf:

```bash
wippy run list
```

| Feld | Erforderlich | Beschreibung |
|------|--------------|--------------|
| `name` | Ja | Befehlsname für `wippy run <name>` |
| `short` | Nein | Kurzbeschreibung in `wippy run list` |
| `main` | Nein | Den Eintrag als Standardbefehl eines Packs oder Hub-Moduls markieren |
| `use_case` | Nein | Kategorie des Einstiegspunkts; Standard ist `run` |
| `security` | Nein | Sicherheitskontext, der nur angewendet wird, wenn der vertrauenswürdige Terminal-Launcher diesen Befehl startet |

Für CLI-Befehle muss ein `terminal.host` vorhanden sein. Er besitzt den Scheduler
für den Befehlsprozess, sodass kein separater `process.host` erforderlich ist. Wenn
mehrere Terminal Hosts vorhanden sind, wählen Sie einen mit `--host` aus.

## Prozesslebenszyklus

WASM-Prozesse folgen dem Lebenszyklus Init/Step/Close:

1. **Init** - Aufrufkontext, Methode und Eingabeargumente werden erfasst
2. **Step** - Der erste Schritt instanziiert und startet das Modul. Weitere Schritte führen über den Dispatcher vermittelte Operationen fort; eine synchrone Ausführung kann bereits im ersten Schritt abgeschlossen werden.
3. **Close** - Ressourcen der Instanz werden freigegeben

## Aus Lua starten

Starten Sie einen WASM-Prozess und überwachen Sie ihn bis zum Abschluss:

```lua
-- Spawn with monitoring
local pid, err = process.spawn_monitored(
    "myns:compute_worker",   -- entry ID
    "myns:processes",        -- process host
    6, 7                     -- arguments passed to the WASM function
)

if err then
    return nil, err
end

-- Wait for the process to complete
local events = process.events()
while true do
    local event, open = events:receive()
    if not open then return nil, errors.new("process event channel closed") end
    if event.kind == process.event.EXIT and event.from == pid then
        local result = event.result.value  -- return value from the WASM function
        return result, event.result.error
    end
end
```

## Asynchrone Ausführung

WASM-Prozesse können für Host-Operationen yielden, die die Runtime über den
Dispatcher vermittelt. Dazu gehören unterstütztes Clock-Polling und ausgehendes
HTTP. Der Scheduler pausiert den Prozess, bis die ausstehende Operation abgeschlossen
ist, und setzt ihn dann fort:

```yaml
  - name: http_worker
    kind: process.wasm
    fs: myns:wasm_binaries
    path: /http_worker.wasm
    hash: sha256:...
    method: run
    imports:
      - wasi:io
      - wasi:cli
      - wasi:http
    wasi:
      env:
        - id: myns:api_url
          name: API_URL
          required: true
```

Für diese asyncifizierten Operationen ist der Yield/Resume-Mechanismus für den
Gast transparent. Gehen Sie nicht davon aus, dass jeder blockierende WASI-Aufruf
yieldet: Stream-Lese- und -Schreiboperationen sind in der gepinnten Runtime synchron.

## WASI-Konfiguration

Prozesse unterstützen dieselbe WASI-Konfiguration wie Funktionen:

```yaml
  - name: file_processor
    kind: process.wasm
    fs: myns:wasm_binaries
    path: /processor.wasm
    hash: sha256:...
    method: process
    imports:
      - wasi:cli
      - wasi:io
      - wasi:clocks
      - wasi:filesystem
    wasi:
      args: ["--input", "/data/input.csv"]
      cwd: "/app"
      env:
        - id: myns:output_format
          name: OUTPUT_FORMAT
      mounts:
        - fs: myns:input_data
          guest: /data
          read_only: true
        - fs: myns:output_dir
          guest: /output
```

## Siehe auch

- [Übersicht](wasm/overview.md) - Übersicht über die WebAssembly-Runtime
- [Funktionen](wasm/functions.md) - Konfiguration von WASM-Funktionen
- [Host-Funktionen](wasm/hosts.md) - Verfügbare Host-Schnittstellen
- [Prozessmodell](concepts/process-model.md) - Prozesslebenszyklus
- [Supervision](guides/supervision.md) - Prozess-Supervision-Trees
