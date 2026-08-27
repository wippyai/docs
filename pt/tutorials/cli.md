---
title: "Aplicações CLI"
description: "Construa ferramentas de linha de comando que leem entrada, escrevem saída e interagem com usuários."
---

# Aplicações CLI

Crie um processo de linha de comando que escreve no terminal e estenda-o com entrada, cores, informações do sistema e comandos nomeados.

**Classificação:** tutorial executável. A aplicação de saudação é completa. As seções posteriores substituem opcionalmente `src/cli.lua` ou a entrada `app:cli`, conforme indicado.

## O Que Vamos Construir

Um CLI simples que saúda o usuário:

```
$ wippy run -x app:cli
Hello from CLI!
```

## Pré-requisitos

- Runtime Wippy `v0.3.32a` disponível como `wippy`; confirme com `wippy version --short`.
- Um terminal interativo. Exemplos de entrada exigem stdin, e os de cor exigem suporte a sequências ANSI.

## Estrutura do Projeto

```
cli-app/
├── wippy.lock
└── src/
    ├── _index.yaml
    └── cli.lua
```

## Passo 1: Criar Projeto

```bash
mkdir cli-app && cd cli-app
mkdir src
```

## Passo 2: Definições de Entradas

Crie `src/_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  # Terminal host connects processes to stdin/stdout
  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true

  # CLI process
  - name: cli
    kind: process.lua
    source: file://cli.lua
    method: main
    modules:
      - io
```

<tip>
O <code>terminal.host</code> faz a ponte entre seu processo Lua e o terminal. Sem ele, <code>io.print()</code> não tem para onde escrever.
</tip>

## Passo 3: Código CLI

Crie `src/cli.lua`:

```lua
local io = require("io")

local function main()
    io.print("Hello from CLI!")
    return 0
end

return { main = main }
```

## Passo 4: Executar

```bash
wippy init
wippy run -x app:cli
```

Saída:
```
Hello from CLI!
```

<note>
A flag <code>-x</code> executa o processo como comando e detecta automaticamente o único <code>terminal.host</code>. Use <code>--host</code> quando houver mais de um. Sem flag de logs, o modo comando suprime logs do runtime para manter a saída legível.
</note>

## Lendo Entrada do Usuário

```lua
local io = require("io")

local function main()
    local _, write_err = io.write("Enter your name: ")
    if write_err then
        io.eprint("Cannot write prompt:", write_err)
        return 1
    end

    local _, flush_err = io.flush()
    if flush_err then
        io.eprint("Cannot flush prompt:", flush_err)
        return 1
    end

    local name, read_err = io.readline()
    if read_err then
        io.eprint("Cannot read input:", read_err)
        return 1
    end

    if name and #name > 0 then
        io.print("Hello, " .. name .. "!")
    else
        io.print("Hello, stranger!")
    end

    return 0
end

return { main = main }
```

## Saída Colorida

Use códigos de escape ANSI para cores:

```lua
local io = require("io")

local reset = "\027[0m"
local function red(s) return "\027[31m" .. s .. reset end
local function green(s) return "\027[32m" .. s .. reset end
local function yellow(s) return "\027[33m" .. s .. reset end
local function cyan(s) return "\027[36m" .. s .. reset end
local function bold(s) return "\027[1m" .. s .. reset end

local function main()
    io.print(bold(cyan("Welcome!")))
    local _, write_err = io.write(yellow("Enter a number: "))
    if write_err then
        io.eprint("Cannot write prompt:", write_err)
        return 1
    end

    local _, flush_err = io.flush()
    if flush_err then
        io.eprint("Cannot flush prompt:", flush_err)
        return 1
    end

    local input, read_err = io.readline()
    if read_err then
        io.eprint("Cannot read input:", read_err)
        return 1
    end
    local n = tonumber(input)

    if n then
        io.print("Squared: " .. green(tostring(n * n)))
        return 0
    else
        io.print(red("Error: ") .. "not a number")
        return 1
    end
end

return { main = main }
```

## Informações do Sistema

As leituras do sistema são operações protegidas. Adicione esta política e substitua a entrada `app:cli` para que o comando tenha um actor, a política e o módulo `system`:

```yaml
  - name: cli-system-read
    kind: security.policy
    policy:
      actions:
        - system.read
      resources: "*"
      effect: allow

  - name: cli
    kind: process.lua
    source: file://cli.lua
    method: main
    modules:
      - io
      - system
    security:
      actor:
        id: app:cli
      policies:
        - app:cli-system-read
```

Depois, substitua `src/cli.lua`:

```lua
local io = require("io")
local system = require("system")

local function main()
    local hostname, hostname_err = system.process.hostname()
    if hostname_err then
        io.eprint("Cannot read hostname:", hostname_err)
        return 1
    end

    local cpu_count, cpu_err = system.runtime.cpu_count()
    if cpu_err then
        io.eprint("Cannot read CPU count:", cpu_err)
        return 1
    end

    local goroutines, goroutine_err = system.runtime.goroutines()
    if goroutine_err then
        io.eprint("Cannot read goroutine count:", goroutine_err)
        return 1
    end

    local mem, memory_err = system.memory.stats()
    if memory_err then
        io.eprint("Cannot read memory stats:", memory_err)
        return 1
    end

    io.print("Host: " .. hostname)
    io.print("CPUs: " .. cpu_count)
    io.print("Goroutines: " .. goroutines)
    io.print("Memory: " .. string.format("%.1f MB", mem.heap_alloc / 1024 / 1024))

    return 0
end

return { main = main }
```

## Comandos Nomeados

Em vez de usar `-x app:cli`, você pode registrar seu processo como um comando nomeado:

```yaml
  - name: cli
    kind: process.lua
    meta:
      command:
        name: greet
        short: Greet the user
    source: file://cli.lua
    method: main
    modules:
      - io
```

Agora execute pelo nome:

```bash
wippy run greet
```

Liste todos os comandos disponíveis:

```bash
wippy run list
```

```
Available commands:

  greet  Greet the user  (app:cli)

Run with: wippy run <command>
```

## Códigos de Saída

Retorne de `main()` para definir o código de saída:

```lua
local function main()
    if error_occurred then
        return 1  -- Error
    end
    return 0      -- Success
end
```

## Referência de I/O

| Função | Retorna | Descrição |
|--------|---------|-----------|
| `io.print(...)` | `boolean` ou `nil, error` sem contexto de terminal | Escreve em stdout com tabs e nova linha final |
| `io.write(...)` | `boolean, error` | Escreve em stdout sem separadores nem nova linha |
| `io.eprint(...)` | `boolean` ou `nil, error` sem contexto de terminal | Escreve em stderr com tabs e nova linha final |
| `io.readline()` | `string, error` | Lê uma linha sem a nova linha final; EOF sem dados é erro |
| `io.flush()` | `boolean, error` | Descarrega stdout quando o stream oferece suporte |

## Flags CLI

| Flag | Descrição |
|------|-----------|
| `wippy run -x app:cli` | Executar processo CLI (auto-detecta terminal.host) |
| `wippy run -x app:cli --host app:terminal` | Terminal host explícito |
| `wippy run -x app:cli -v` | Com logging verbose |

## Solução de Problemas e Limpeza

- `no terminal host found` indica que o registro não contém `terminal.host`; use a entrada da etapa 2. Com vários hosts, passe `--host app:terminal`.
- `no terminal context` indica que o processo não foi iniciado por um host de terminal. Use `wippy run -x app:cli`, não um `process.service` em background.
- Erros de entrada em EOF são esperados com stdin fechado.
- Se sequências ANSI aparecerem como texto, use o exemplo sem cor.
- Após sair do diretório, exclua `cli-app/` se era apenas um exercício descartável.

## Próximos Passos

- [Módulo I/O](../lua/system/io.md) - Referência da API de I/O
- [Módulo System](../lua/system/system.md) - Informações de runtime e sistema
- [Serviço Echo](echo-service.md) - Aplicações multiprocesso
