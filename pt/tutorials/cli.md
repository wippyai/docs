# Aplicacoes CLI

Construa ferramentas de linha de comando que leem entrada, escrevem saida e interagem com usuarios.

## O Que Vamos Construir

Um CLI simples que sauda o usuario:

```
$ wippy run -x app:cli
Hello from CLI!
```

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

## Passo 2: Definicoes de Entradas

Crie `src/_index.yaml`:

```yaml
version: "1.0"
namespace: app

entries:
  # Terminal host conecta processos a stdin/stdout
  - name: terminal
    kind: terminal.host
    lifecycle:
      auto_start: true

  # Processo CLI
  - name: cli
    kind: process.lua
    source: file://cli.lua
    method: main
    modules:
      - io
```

<tip>
O <code>terminal.host</code> faz a ponte entre seu processo Lua e o terminal. Sem ele, <code>io.print()</code> nao tem para onde escrever.
</tip>

## Passo 3: Codigo CLI

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

Saida:
```
Hello from CLI!
```

<note>
A flag <code>-x</code> auto-detecta seu <code>terminal.host</code> e executa em modo silencioso para saida limpa.
</note>

## Lendo Entrada do Usuario

```lua
local io = require("io")

local function main()
    io.write("Enter your name: ")
    local name = io.readline()

    if name and #name > 0 then
        io.print("Hello, " .. name .. "!")
    else
        io.print("Hello, stranger!")
    end

    return 0
end

return { main = main }
```

## Saida Colorida

Use codigos de escape ANSI para cores:

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
    io.write(yellow("Enter a number: "))

    local input = io.readline()
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

## Informacoes do Sistema

Acesse estatisticas do runtime com o modulo `system`:

```yaml
# Adicionar a definicao da entrada
modules:
  - io
  - system
```

```lua
local io = require("io")
local system = require("system")

local function main()
    io.print("Host: " .. system.process.hostname())
    io.print("CPUs: " .. system.runtime.cpu_count())
    io.print("Goroutines: " .. system.runtime.goroutines())

    local mem = system.memory.stats()
    io.print("Memory: " .. string.format("%.1f MB", mem.heap_alloc / 1024 / 1024))

    return 0
end

return { main = main }
```

## Codigos de Saida

Retorne de `main()` para definir o codigo de saida:

```lua
local function main()
    if error_occurred then
        return 1  -- Erro
    end
    return 0      -- Sucesso
end
```

## Referencia de I/O

| Funcao | Descricao |
|--------|-----------|
| `io.print(...)` | Escrever em stdout com nova linha |
| `io.write(...)` | Escrever em stdout sem nova linha |
| `io.eprint(...)` | Escrever em stderr com nova linha |
| `io.readline()` | Ler linha de stdin |
| `io.flush()` | Descarregar buffer de saida |

## Flags CLI

| Flag | Descricao |
|------|-----------|
| `wippy run -x app:cli` | Executar processo CLI (auto-detecta terminal.host) |
| `wippy run -x app:cli --host app:term` | Terminal host explicito |
| `wippy run -x app:cli -v` | Com logging verbose |

## Proximos Passos

- [I/O Module](lua-io.md) - Referencia completa de I/O
- [System Module](lua-system.md) - Informacoes do runtime e sistema
- [Echo Service](echo-service.md) - Aplicacoes multi-processo
