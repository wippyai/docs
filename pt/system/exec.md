# Executor

Executores de comandos executam processos externos com ambientes controlados. Dois tipos de executor estao disponiveis: processos nativos do SO e containers Docker.

## Tipos de Entradas

| Tipo | Descricao |
|------|-----------|
| `exec.native` | Executa comandos diretamente no SO host |
| `exec.docker` | Executa comandos dentro de containers Docker |

## Executor Nativo

Executa comandos diretamente no sistema operacional host.

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

| Campo | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `default_work_dir` | string | - | Diretorio de trabalho para todos os comandos |
| `default_env` | map | - | Variaveis de ambiente (mescladas com env por comando) |
| `command_whitelist` | string[] | - | Se definido, apenas estes comandos exatos sao permitidos |

<note>
Executores nativos usam um ambiente limpo por padrao. Apenas variaveis de ambiente explicitamente configuradas sao passadas para processos filhos.
</note>

## Executor Docker

Executa comandos dentro de containers Docker isolados.

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

| Campo | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `image` | string | **obrigatorio** | Imagem Docker a usar |
| `host` | string | unix socket | URL do daemon Docker |
| `default_work_dir` | string | - | Diretorio de trabalho dentro do container |
| `default_env` | map | - | Variaveis de ambiente |
| `command_whitelist` | string[] | - | Comandos permitidos (correspondencia exata) |
| `network_mode` | string | bridge | Modo de rede: `host`, `bridge`, `none` |
| `volumes` | string[] | - | Montagens de volume: `host:container[:ro]` |
| `user` | string | - | Usuario para executar dentro do container |
| `memory_limit` | int | 0 | Limite de memoria em bytes (0 = ilimitado) |
| `cpu_quota` | int | 0 | Cota de CPU (100000 = 1 CPU, 0 = ilimitado) |
| `auto_remove` | bool | false | Remove container apos sair |
| `read_only_rootfs` | bool | false | Torna sistema de arquivos raiz somente leitura |
| `no_new_privileges` | bool | false | Previne escalacao de privilegios |
| `cap_drop` | string[] | - | Capacidades Linux a remover |
| `cap_add` | string[] | - | Capacidades Linux a adicionar |
| `pids_limit` | int | 0 | Max processos (0 = ilimitado) |
| `tmpfs` | map | - | Montagens tmpfs para caminhos gravaveis |

## Whitelist de Comandos

Ambos os tipos de executor suportam whitelist de comandos. Quando configurado, apenas correspondencias exatas de comando sao permitidas:

```yaml
command_whitelist:
  - ls -la
  - cat /etc/passwd
```

Comandos nao na whitelist sao rejeitados com um erro.

## API Lua

O [Modulo Exec](lua-exec.md) fornece execucao de comandos:

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
