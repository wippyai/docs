---
title: "Executor"
description: "Konfigurieren Sie native oder Docker-Befehls-Executors, Arbeitsverzeichnisse, Umgebungen, Allowlists und Ressourcensteuerung."
---

# Executor

Executor-Einträge führen externe Befehle als native Betriebssystemprozesse oder in Docker-Containern aus.

Diese Seite ist eine Konfigurations- und API-Referenz. Entry-Blöcke sind Fragmente für eine bestehende Entry-Liste; das Lua-Beispiel setzt einen Executor namens `app:shell` und einen erlaubten Befehl `git status` voraus.

## Entry-Typen

| Art | Beschreibung |
|------|--------------|
| `exec.native` | Befehle direkt auf dem Host-OS ausführen |
| `exec.docker` | Befehle in Docker-Containern ausführen |

## Native Executor

Der native Executor führt Befehle direkt auf dem Host-Betriebssystem aus.

```yaml
- name: shell
  kind: exec.native
  default_work_dir: /app
  default_env:
    PATH: /usr/local/bin:/usr/bin:/bin
    LANG: en_US.UTF-8
  command_whitelist:
    - git status
    - git diff
    - npm run build
```

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `default_work_dir` | string | - | Arbeitsverzeichnis für alle Befehle |
| `default_env` | map | - | Umgebungsvariablen (mit pro-Befehl env zusammengeführt) |
| `command_whitelist` | string[] | - | Wenn gesetzt, nur diese exakten Befehle erlaubt |

<note>
Native Executors verwenden standardmäßig eine saubere Umgebung. Nur explizit konfigurierte Umgebungsvariablen werden an Kindprozesse übergeben.
</note>

Befehle werden in eine ausführbare Datei und eine Argumentliste geparst und nicht über eine Shell ausgeführt. Pipes, Umleitungen, Variablenerweiterung und andere Shell-Syntax besitzen keine besondere Bedeutung. Um einen Shell-Ausdruck auszuführen, müssen Sie die Shell ausdrücklich erlauben und aufrufen, einschließlich ihres Befehlsflags und des Ausdrucks als Argumente.

## Docker Executor

Der Docker-Executor führt Befehle in Docker-Containern aus.

Auch Docker-Befehle werden direkt in eine ausführbare Datei und Argumente geparst und als Containerbefehl gesetzt. Eine Shell-Erweiterung findet nur statt, wenn der Befehl ausdrücklich eine Shell aufruft.

```yaml
- name: sandbox
  kind: exec.docker
  image: python:3.11-slim
  default_work_dir: /workspace
  network_mode: none
  memory_limit: 536870912
  cpu_quota: 50000
  auto_remove: true
  read_only_rootfs: true
  no_new_privileges: true
  cap_drop:
    - ALL
  tmpfs:
    /tmp: rw,noexec,nosuid,size=64m
  volumes:
    - /app/data:/workspace/data:ro
```

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `image` | string | **erforderlich** | Zu verwendendes Docker-Image |
| `host` | string | Standardwert des Docker-Clients | Docker-Daemon-URL; fehlt sie, verwendet der Client seine Umgebungs- und Plattformstandards |
| `default_work_dir` | string | - | Arbeitsverzeichnis im Container |
| `default_env` | map | - | Umgebungsvariablen |
| `command_whitelist` | string[] | - | Erlaubte Befehle (exakte Übereinstimmung) |
| `network_mode` | string | Docker-Standard | Docker-Netzwerkmodus wie `host`, `bridge` oder `none` |
| `volumes` | string[] | - | Volume-Mounts: `host:container[:ro]` |
| `user` | string | - | Benutzer zum Ausführen im Container |
| `memory_limit` | int | 0 | Speicherlimit in Bytes (0 = unbegrenzt) |
| `cpu_quota` | int | 0 | CPU-Quota (100000 = 1 CPU, 0 = unbegrenzt) |
| `auto_remove` | bool | false | Container nach Exit entfernen |
| `read_only_rootfs` | bool | false | Root-Dateisystem schreibgeschützt machen |
| `no_new_privileges` | bool | false | Privilegieneskalation verhindern |
| `cap_drop` | string[] | - | Linux-Capabilities zu entfernen |
| `cap_add` | string[] | - | Linux-Capabilities hinzuzufügen |
| `pids_limit` | int | 0 | Max Prozesse (0 = unbegrenzt) |
| `tmpfs` | map | - | Tmpfs-Mounts für beschreibbare Pfade |

## Befehls-Whitelist

Beide Executor-Typen unterstützen Befehls-Allowlists. Wenn die Liste nicht leer ist, sind nur exakte Übereinstimmungen mit dem ursprünglichen Befehlsstring erlaubt:

```yaml
command_whitelist:
  - ls -la
  - cat /etc/passwd
```

Befehle, die nicht in der Whitelist sind, werden mit einem Fehler abgelehnt.

Eine fehlende oder leere Allowlist erlaubt jeden Befehl, der die Sicherheitsrichtlinie erfüllt. Die Lua-API prüft zusätzlich `exec.get` für die Executor-ID und `exec.run` für den exakten Befehlsstring.

## Lua-API

Das [Exec-Modul](../lua/dynamic/exec.md) bietet Befehlsausführung:

```lua
local exec = require("exec")

local executor, err = exec.get("app:shell")
if err then return nil, err end

local proc, proc_err = executor:exec("git status", {
    work_dir = "/app/repo"
})
if proc_err then
    executor:release()
    return nil, proc_err
end

local stdout, stream_err = proc:stdout_stream()
if stream_err then
    proc:close()
    executor:release()
    return nil, stream_err
end

local ok, start_err = proc:start()
if start_err then
    stdout:close()
    proc:close()
    executor:release()
    return nil, start_err
end

local chunks = {}
while true do
    local chunk, read_err = stdout:read(4096)
    if read_err then
        stdout:close()
        proc:close(true)
        executor:release()
        return nil, read_err
    end
    if chunk == nil then break end
    chunks[#chunks + 1] = chunk
end

local exit_code, wait_err = proc:wait()
local _, stream_close_err = stdout:close()
local _, release_err = executor:release()

if wait_err then return nil, wait_err end
if stream_close_err then return nil, stream_close_err end
if release_err then return nil, release_err end
return table.concat(chunks), exit_code
```

## Siehe auch

- [Exec-Modul](../lua/dynamic/exec.md) - Lua-API-Referenz
- [Process Host](./process-host.md) - Host, der Wippy-Prozesse ausführt
- [Dateisystem](./filesystem.md) - Als Arbeitsverzeichnisse genutzte Dateisystem-Einträge
