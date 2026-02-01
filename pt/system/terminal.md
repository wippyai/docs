# Terminal

Hosts de terminal executam scripts Lua com acesso a stdin/stdout/stderr.

<note>
Um host de terminal executa exatamente um processo por vez. O processo em si e um processo Lua regular com acesso ao contexto de I/O do terminal.
</note>

## Tipo de Entrada

| Tipo | Descricao |
|------|-----------|
| `terminal.host` | Host de sessao de terminal |

## Configuracao

```yaml
- name: cli_host
  kind: terminal.host
  hide_logs: false
  lifecycle:
    auto_start: true
```

| Campo | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `hide_logs` | bool | false | Suprime saida de log para barramento de eventos |

## Contexto de Terminal

Scripts executando em um host de terminal recebem um contexto de terminal com:

- **stdin** - Leitor de entrada padrao
- **stdout** - Escritor de saida padrao
- **stderr** - Escritor de erro padrao
- **args** - Argumentos de linha de comando

## API Lua

O [Modulo IO](lua-io.md) fornece operacoes de terminal:

```lua
local io = require("io")

io.write("Digite o nome: ")
local name = io.readline()
io.print("Ola, " .. name)

local args = io.args()
```

Funcoes retornam erros se chamadas fora de um contexto de terminal.
