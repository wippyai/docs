# Executor

Befehlsausführer führen externe Prozesse mit kontrollierten Umgebungen aus. Zwei Executor-Typen sind verfügbar: native OS-Prozesse und Docker-Container.

## Entry-Typen

| Kind | Beschreibung |
|------|--------------|
| `exec.native` | Befehle direkt auf dem Host-OS ausführen |
| `exec.docker` | Befehle in Docker-Containern ausführen |

## Native Executor

Führt Befehle direkt auf dem Host-Betriebssystem aus.

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

## Docker Executor

Führt Befehle in isolierten Docker-Containern aus.

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
| `host` | string | Unix Socket | Docker-Daemon-URL |
| `default_work_dir` | string | - | Arbeitsverzeichnis im Container |
| `default_env` | map | - | Umgebungsvariablen |
| `command_whitelist` | string[] | - | Erlaubte Befehle (exakter Match) |
| `network_mode` | string | bridge | Netzwerkmodus: `host`, `bridge`, `none` |
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

Beide Executor-Typen unterstützen Befehls-Whitelisting. Wenn konfiguriert, sind nur exakte Befehls-Matches erlaubt:

```yaml
command_whitelist:
  - ls -la
  - cat /etc/passwd
```

Befehle, die nicht in der Whitelist sind, werden mit einem Fehler abgelehnt.

## Lua-API

Das [Exec-Modul](lua/dynamic/exec.md) bietet Befehlsausführung:

```lua
local exec = require("exec")

local executor, err = exec.get("app:shell")
if err then return nil, err end

local proc = executor:exec("git status", {
    work_dir = "/app/repo"
})

local stdout = proc:stdout_stream()
proc:start()
local output = stdout:read()
proc:wait()

stdout:close()
executor:release()
```
