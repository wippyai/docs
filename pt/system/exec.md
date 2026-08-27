---
title: "Executor"
description: "Configure executores de comandos nativos ou Docker, diretórios de trabalho, ambientes, allowlists e controles de recursos."
---

# Executor

Entradas de executor executam comandos externos como processos nativos do sistema operacional ou em containers Docker.

Esta página é uma referência de configuração e API. Os blocos de entrada são fragmentos para uma lista existente; o exemplo Lua pressupõe um executor `app:shell` e o comando permitido `git status`.

## Tipos de Entradas

| Tipo | Descrição |
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

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `default_work_dir` | string | - | Diretório de trabalho para todos os comandos |
| `default_env` | map | - | Variáveis de ambiente (mescladas com env por comando) |
| `command_whitelist` | string[] | - | Se definido, apenas estes comandos exatos são permitidos |

<note>
Executores nativos usam um ambiente limpo por padrão. Apenas variáveis de ambiente explicitamente configuradas são passadas para processos filhos.
</note>

Os comandos são analisados como executável e lista de argumentos; não passam por um shell. Pipes, redirecionamentos, expansão de variáveis e outras sintaxes de shell não têm significado especial. Para executar uma expressão de shell, permita e invoque o shell explicitamente, incluindo sua flag de comando e a expressão como argumentos.

## Executor Docker

Executa comandos em containers Docker. Eles também são analisados diretamente como executável e argumentos e atribuídos ao comando do container; não recebem expansão de shell sem invocá-lo explicitamente.

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

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `image` | string | **obrigatório** | Imagem Docker a usar |
| `host` | string | padrão do cliente Docker | URL do daemon Docker; quando omitido, o cliente usa seu ambiente e o padrão da plataforma |
| `default_work_dir` | string | - | Diretório de trabalho dentro do container |
| `default_env` | map | - | Variáveis de ambiente |
| `command_whitelist` | string[] | - | Comandos permitidos (correspondência exata) |
| `network_mode` | string | padrão do Docker | Modo de rede, como `host`, `bridge` ou `none` |
| `volumes` | string[] | - | Montagens de volume: `host:container[:ro]` |
| `user` | string | - | Usuário para executar dentro do container |
| `memory_limit` | int | 0 | Limite de memória em bytes (0 = ilimitado) |
| `cpu_quota` | int | 0 | Cota de CPU (100000 = 1 CPU, 0 = ilimitado) |
| `auto_remove` | bool | false | Remove container após sair |
| `read_only_rootfs` | bool | false | Torna sistema de arquivos raiz somente leitura |
| `no_new_privileges` | bool | false | Previne escalação de privilégios |
| `cap_drop` | string[] | - | Capacidades Linux a remover |
| `cap_add` | string[] | - | Capacidades Linux a adicionar |
| `pids_limit` | int | 0 | Max processos (0 = ilimitado) |
| `tmpfs` | map | - | Montagens tmpfs para caminhos graváveis |

## Whitelist de Comandos

Ambos os executores oferecem allowlists. Quando a lista não está vazia, somente correspondências exatas da string original do comando são permitidas:

```yaml
command_whitelist:
  - ls -la
  - cat /etc/passwd
```

Comandos ausentes da allowlist são rejeitados. Uma lista omitida ou vazia permite qualquer comando aprovado pela política de segurança. A API Lua verifica separadamente `exec.get` para o ID do executor e `exec.run` para a string exata do comando.

## API Lua

O [Módulo Exec](../lua/dynamic/exec.md) fornece execução de comandos:

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

## Veja Também

- [Módulo Exec](../lua/dynamic/exec.md) - Referência da API Lua
- [Process Host](./process-host.md) - Host que executa processos Wippy
- [Filesystem](./filesystem.md) - Entradas de filesystem usadas como diretórios de trabalho
