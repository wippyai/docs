---
title: "Terminal"
description: "Hosts de terminal executam scripts Lua com acesso a stdin/stdout/stderr."
---

# Terminal

Um `terminal.host` executa scripts Lua com os streams padrão de entrada, saída e erro. Esta página é uma referência de configuração; o bloco Lua é um fragmento de handler que pressupõe execução por esse host.

<note>
Um host de terminal executa exatamente um processo por vez. O processo em si é um processo Lua regular com acesso ao contexto de I/O do terminal.
</note>

## Tipo de Entrada

| Tipo | Descrição |
|------|-----------|
| `terminal.host` | Host de sessão de terminal |

## Configuração

```yaml
- name: cli_host
  kind: terminal.host
  hide_logs: false
  lifecycle:
    auto_start: true
```

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `hide_logs` | bool | false | Envia logs ao event bus enquanto suprime a propagação posterior desses logs |

## Contexto de Terminal

Scripts executando em um host de terminal recebem um contexto de terminal com:

- **stdin** - Leitor de entrada padrão
- **stdout** - Escritor de saída padrão
- **stderr** - Escritor de erro padrão
- **args** - Argumentos de linha de comando

## API Lua

O [módulo de I/O](lua/system/io.md) fornece operações de terminal:

```lua
local io = require("io")

local _, write_err = io.write("Enter name: ")
if write_err then return nil, write_err end

local name, read_err = io.readline()
if read_err then return nil, read_err end

local _, print_err = io.print("Hello, " .. name)
if print_err then return nil, print_err end

local args = io.args()
```

`io.write`, `io.print` e `io.readline` retornam erros fora de um contexto de terminal. `io.args()` retorna uma tabela vazia quando não há contexto de terminal disponível.

## Consulte também

- [I/O de terminal](lua/system/io.md) — Operações stdin/stdout/stderr
- [TTY](lua/system/tty.md) — Eventos de entrada bruta, estilos e layout
