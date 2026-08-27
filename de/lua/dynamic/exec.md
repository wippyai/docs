---
title: "Befehlsausführung"
description: "Externe Prozesse starten, Stream-Daten austauschen, auf den Abschluss warten und Signale senden."
---

# Befehlsausführung
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Das Modul `exec` startet externe Programme und stellt deren Ein- und Ausgabe, Lebenszyklus und Signale bereit. Diese Seite ist eine API-Referenz mit Teilrezepten: Executor-IDs, Befehle, Pfade, Umgebungswerte und Sicherheitsrichtlinien stammen aus der umgebenden Anwendung.

Der Executor zerlegt eine Befehlszeichenkette in Programm und Argumente; er startet keine Shell. Shell-Operatoren wie Pipes, Umleitungen, Variablenexpansion und Command-Substitution werden nicht interpretiert. Ein ausführbares Skript kann nur direkt gestartet werden, wenn Backend und Betriebssystem dies unterstützen.

Konfigurieren Sie vor diesen Beispielen eine Executor-Ressource und deren Befehls-Allowlist wie unter [Executor](../../system/exec.md) beschrieben. Gewähren Sie `exec.get` und `exec.run` für die tatsächlich verwendeten Ressourcen. Die Beispiele verwenden Unix-Befehle und -Pfade; ersetzen Sie sie durch auf dem Executor-Host verfügbare Befehle.

## Laden

```lua
local exec = require("exec")
```

## Einen Executor beschaffen

Beziehen Sie einen Prozess-Executor über seine Registry-ID:

```lua
local executor, err = exec.get("app:exec")
if err then
    return nil, err
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `id` | string | Ressourcen-ID |

Halten Sie den Executor, solange Sie seine Prozesse erzeugen und ausführen. Rufen Sie nach dem letzten erzeugten Prozess auf jedem Rückkehrpfad `executor:release()` auf; die Freigabe ist idempotent.

**Gibt zurück:** `Executor, error`

## Einen Prozess erstellen

Erstellen Sie einen Prozess für den angegebenen Befehl:

```lua
local proc, err = executor:exec("python script.py", {
    work_dir = "/scripts",
    env = {
        PYTHONPATH = "/app/lib",
        DEBUG = "true",
        API_KEY = api_key
    }
})
if err then
    executor:release() -- release is specified to return true, nil
    return nil, err
end
```

| Parameter | Typ | Beschreibung |
|-----------|------|-------------|
| `cmd` | string | Auszuführender Befehl |
| `options.work_dir` | string | Arbeitsverzeichnis |
| `options.env` | table | Umgebungsvariablen |

In Anführungszeichen gesetzte Argumente werden vom Parser des nativen Executors gruppiert und ohne Shell-Auswertung direkt an das Programm übergeben. Beim nativen Executor gleichen Einträge in `command_whitelist` und die Richtlinienressource `exec.run` die vollständige Befehlszeichenkette ab, nicht nur den Programmnamen.

**Gibt zurück:** `Process, error`

## `start` / `wait`

Starten Sie den Prozess und warten Sie auf Abschluss.

```lua
local executor, get_err = exec.get("app:exec")
if get_err then
    return nil, get_err
end

local proc, create_err = executor:exec("./build.sh")
if create_err then
    executor:release()
    return nil, create_err
end

local ok, start_err = proc:start()
if start_err then
    proc:close(true)
    executor:release()
    return nil, start_err
end

local exit_code, wait_err = proc:wait()
local _, release_err = executor:release()
if wait_err then
    return nil, wait_err
end
if release_err then
    return nil, release_err
end

if exit_code ~= 0 then
    return nil, errors.new({
        message = "Build failed with exit code: " .. exit_code,
        kind = errors.INTERNAL
    })
end
```

`wait()` yieldet bis zum Ende des Kindprozesses, liefert dessen Exit-Code, räumt ihn ab und schließt den Prozess-Handle. Nach `wait()` melden andere Prozessmethoden `errors.INVALID`, weil der Prozess geschlossen ist.

## `stdout_stream` / `stderr_stream`

Öffnen Sie nach `start()` Streams zum Lesen der Prozessausgabe. Bei Docker-Prozessen sind sie vor dem Containerstart nicht verfügbar. Können sowohl stdout als auch stderr Daten enthalten, lesen Sie beide parallel: Das vollständige Lesen von stdout vor stderr kann blockieren, sobald der Kindprozess die ungelesene stderr-Pipe füllt.

```lua
local function fail(err)
    proc:close(true)   -- close is specified to return true, nil
    executor:release()
    return nil, err
end

local function drain(stream, done)
    coroutine.spawn(function()
        local chunks = {}
        while true do
            local chunk, read_err = stream:read(4096)
            if read_err then
                done:send({err = read_err})
                return
            end
            if not chunk then
                done:send({data = table.concat(chunks)})
                return
            end
            table.insert(chunks, chunk)
        end
    end)
end

local _, start_err = proc:start()
if start_err then return fail(start_err) end

local stdout, stdout_err = proc:stdout_stream()
if stdout_err then return fail(stdout_err) end
local stderr, stderr_err = proc:stderr_stream()
if stderr_err then return fail(stderr_err) end

local stdout_done = channel.new(1)
local stderr_done = channel.new(1)
drain(stdout, stdout_done)
drain(stderr, stderr_done)

local stdout_result
local stderr_result
while not stdout_result or not stderr_result do
    local cases = {}
    if not stdout_result then table.insert(cases, stdout_done:case_receive()) end
    if not stderr_result then table.insert(cases, stderr_done:case_receive()) end

    local selected = channel.select(cases)
    if not selected.ok then
        return fail(errors.new("output drain channel closed"))
    end
    if selected.value.err then return fail(selected.value.err) end

    if selected.channel == stdout_done then
        stdout_result = selected.value
    else
        stderr_result = selected.value
    end
end

local _, stdout_close_err = stdout:close()
if stdout_close_err then return fail(stdout_close_err) end
local _, stderr_close_err = stderr:close()
if stderr_close_err then return fail(stderr_close_err) end

local exit_code, wait_err = proc:wait()
if wait_err then return fail(wait_err) end

local _, release_err = executor:release()
if release_err then return nil, release_err end

return {
    exit_code = exit_code,
    stdout = stdout_result.data,
    stderr = stderr_result.data
}
```

Dieses Teilrezept setzt voraus, dass `proc` vom noch gültigen `executor` erzeugt wurde. Die Globals `channel` und `coroutine` koordinieren beide Reader im selben Lua-Prozess.

## `write_stdin`

Schreiben Sie Daten nach stdin. `write_stdin` schließt stdin nicht; verwenden Sie deshalb einen Befehl mit begrenztem Eingabevertrag, wenn sein Abschluss vom Eingabestrom abhängt.

```lua
-- This command exits after reading three lines; it does not require an EOF signal
local proc, create_err = executor:exec("head -n 3")
if create_err then
    executor:release()
    return nil, create_err
end

local function fail(err)
    proc:close(true)
    executor:release()
    return nil, err
end

local _, start_err = proc:start()
if start_err then
    return fail(start_err)
end

local stdout, stream_err = proc:stdout_stream()
if stream_err then
    return fail(stream_err)
end

for _, line in ipairs({"banana\n", "apple\n", "cherry\n"}) do
    local _, write_err = proc:write_stdin(line)
    if write_err then
        return fail(write_err)
    end
end

-- Read until the bounded command exits and closes stdout
local chunks = {}
while true do
    local chunk, read_err = stdout:read(4096)
    if read_err then
        return fail(read_err)
    end
    if not chunk then break end
    table.insert(chunks, chunk)
end
print(table.concat(chunks))  -- "banana\napple\ncherry\n"

local _, close_err = stdout:close()
if close_err then
    return fail(close_err)
end

local exit_code, wait_err = proc:wait()
if wait_err then return fail(wait_err) end
local _, release_err = executor:release()
if release_err then return nil, release_err end
if exit_code ~= 0 then
    return nil, errors.new("head exited with code " .. exit_code)
end
```

Dieses Teilrezept setzt voraus, dass `executor` zu Beginn des Blocks gültig ist.

## `signal` / `close`

Wählen Sie für einen gestarteten Prozess genau einen Beendigungspfad.

```lua
-- Stop and discard the handle. close() sends SIGTERM, reaps in the
-- background, and returns true even if signaling fails.
local _, close_err = proc:close()
if close_err then return nil, close_err end

-- For immediate forced shutdown, use this instead:
-- local _, close_err = proc:close(true) -- SIGKILL

-- When the exit code matters, signal and then wait instead of closing:
-- local _, signal_err = proc:signal(2) -- SIGINT on Unix
-- if signal_err then return nil, signal_err end
-- local exit_code, wait_err = proc:wait()
```

`close()` ist idempotent. Nachdem `close()` oder `wait()` den Handle geschlossen hat, liefern weitere Aufrufe von `signal()`, `start()`, `wait()` und Stream-Zugriffe `errors.INVALID`. Signalnummern und Verhalten hängen von Backend und Betriebssystem ab.

## Berechtigungen

Exec-Operationen unterliegen der Sicherheitsrichtlinienauswertung.

| Aktion | Ressource | Beschreibung |
|--------|----------|-------------|
| `exec.get` | Executor-ID | Executor-Ressource beschaffen |
| `exec.run` | Befehl | Einen bestimmten Befehl ausführen |

## Fehler

| Bedingung | Art | Wiederholbar |
|-----------|------|-----------|
| Leere Executor-ID | `errors.INVALID` | nein |
| Berechtigung verweigert | `errors.INVALID` | nein |
| Prozess geschlossen | `errors.INVALID` | nein |
| Prozess nicht gestartet | `errors.INVALID` | nein |
| Bereits gestartet | `errors.INVALID` | nein |
| Bezug des Executors oder Prozesserzeugung schlägt fehl | `errors.INTERNAL` | nein |
| Start-, Wait-, Signal-, stdin- oder Stream-Operation schlägt fehl | `errors.INTERNAL` | nein |

In Runtime v0.3.32a verwenden verweigerte Richtlinien für `exec.get` und `exec.run` den Fehler `errors.INVALID`, nicht `errors.PERMISSION_DENIED`.

Siehe [Fehlerbehandlung](../core/errors.md) für die Arbeit mit Fehlern.
