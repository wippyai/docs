# Terminal

Hosts de terminal executam scripts Lua com acesso a stdin/stdout/stderr.

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
| `hide_logs` | bool | false | Suprime saída de log para barramento de eventos |

## Contexto de Terminal

Scripts executando em um host de terminal recebem um contexto de terminal com:

- **stdin** - Leitor de entrada padrão
- **stdout** - Escritor de saída padrão
- **stderr** - Escritor de erro padrão
- **args** - Argumentos de linha de comando

## API Lua

O [Módulo IO](lua-io.md) fornece operações de terminal:

```lua
local io = require("io")

io.write("Digite o nome: ")
local name = io.readline()
io.print("Olá, " .. name)

local args = io.args()
```

Funções retornam erros se chamadas fora de um contexto de terminal.
