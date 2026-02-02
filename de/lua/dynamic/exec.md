# Befehlsausführung
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Führen Sie externe Befehle und Shell-Skripte mit voller Kontrolle über I/O-Streams aus.

Für Executor-Konfiguration siehe [Executor](system-exec.md).

## Laden

```lua
local exec = require("exec")
```

## Einen Executor beschaffen

Holen Sie eine Prozess-Executor-Ressource nach ID:

```lua
local executor, err = exec.get("app:exec")
if err then
    return nil, err
end

-- Executor verwenden
local proc = executor:exec("ls -la")
-- ...

-- Freigeben wenn fertig
executor:release()
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `id` | string | Ressourcen-ID |

**Gibt zurück:** `Executor, error`

## Einen Prozess erstellen

Erstellen Sie einen neuen Prozess mit dem angegebenen Befehl:

```lua
-- Einfacher Befehl
local proc, err = executor:exec("echo 'Hello, World!'")

-- Mit Arbeitsverzeichnis
local proc = executor:exec("npm install", {
    work_dir = "/app/project"
})

-- Mit Umgebungsvariablen
local proc = executor:exec("python script.py", {
    work_dir = "/scripts",
    env = {
        PYTHONPATH = "/app/lib",
        DEBUG = "true",
        API_KEY = api_key
    }
})

-- Shell-Skript ausführen
local proc = executor:exec("./deploy.sh production", {
    work_dir = "/app/scripts",
    env = {
        DEPLOY_ENV = "production"
    }
})
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `cmd` | string | Auszuführender Befehl |
| `options.work_dir` | string | Arbeitsverzeichnis |
| `options.env` | table | Umgebungsvariablen |

**Gibt zurück:** `Process, error`

## start / wait

Starten Sie den Prozess und warten Sie auf Abschluss.

```lua
local proc = executor:exec("./build.sh")

local ok, err = proc:start()
if err then
    return nil, err
end

local exit_code, err = proc:wait()
if err then
    return nil, err
end

if exit_code ~= 0 then
    return nil, errors.new("INTERNAL", "Build failed with exit code: " .. exit_code)
end
```

## stdout_stream / stderr_stream

Holen Sie Streams zum Lesen der Prozessausgabe.

```lua
local proc = executor:exec("./process-data.sh")

local stdout = proc:stdout_stream()
local stderr = proc:stderr_stream()

proc:start()

-- Alle stdout lesen
local output = {}
while true do
    local chunk = stdout:read(4096)
    if not chunk then break end
    table.insert(output, chunk)
end
local result = table.concat(output)

-- Auf Fehler prüfen
local err_output = {}
while true do
    local chunk = stderr:read(4096)
    if not chunk then break end
    table.insert(err_output, chunk)
end

local exit_code = proc:wait()

stdout:close()
stderr:close()

if exit_code ~= 0 then
    return nil, errors.new("INTERNAL", table.concat(err_output))
end

return result
```

## write_stdin

Schreiben Sie Daten an Prozess-stdin.

```lua
-- Daten an Befehl pipen
local proc = executor:exec("sort")
local stdout = proc:stdout_stream()

proc:start()

-- Eingabe schreiben
proc:write_stdin("banana\napple\ncherry\n")
proc:write_stdin("")  -- EOF signalisieren

-- Sortierte Ausgabe lesen
local sorted = stdout:read()
print(sorted)  -- "apple\nbanana\ncherry\n"

proc:wait()
stdout:close()
```

## signal / close

Senden Sie Signale oder schließen Sie den Prozess.

```lua
local proc = executor:exec("./long-running-server.sh")
proc:start()

-- ... später, muss gestoppt werden ...

-- Graceful Shutdown (SIGTERM)
proc:close()

-- Oder Force Kill (SIGKILL)
proc:close(true)

-- Oder spezifisches Signal senden
local SIGINT = 2
proc:signal(SIGINT)
```

## Berechtigungen

Exec-Operationen unterliegen der Sicherheitsrichtlinienauswertung.

| Aktion | Ressource | Beschreibung |
|--------|----------|-------------|
| `exec.get` | Executor-ID | Executor-Ressource beschaffen |
| `exec.run` | Befehl | Einen bestimmten Befehl ausführen |

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Ungültige ID | `errors.INVALID` | nein |
| Berechtigung verweigert | `errors.PERMISSION_DENIED` | nein |
| Prozess geschlossen | `errors.INVALID` | nein |
| Prozess nicht gestartet | `errors.INVALID` | nein |
| Bereits gestartet | `errors.INVALID` | nein |

Siehe [Fehlerbehandlung](lua-errors.md) für die Arbeit mit Fehlern.
