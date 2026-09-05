---
title: "Terminal"
description: "Hosts de terminal executam scripts Lua com acesso a stdin/stdout/stderr."
---

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

## Terminais Componíveis

O terminal que um processo enxerga é uma porta, não um dispositivo. Isso torna a posse do terminal componível.

Um processo em um host de terminal detém a porta física. Ele chama `tty.surface()` para tomar o lease de apresentação da porta e publica frames completos — ele é dono da tela inteira.

Um processo shell hospeda outros processos criando terminais virtuais com `tty.viewport()`. Ele passa `viewport:grant()` a um processo filho através da opção de spawn `terminal`; o filho resolve essa concessão em uma porta de terminal comum e executa sem alterações, sem saber que não está conectado a um dispositivo. O shell lê os frames do filho com `viewport:snapshot()`, os posiciona em qualquer lugar do seu próprio layout, e traduz a entrada para as coordenadas do filho com `viewport:send()`.

```lua
local view = assert(tty.viewport({width = 78, height = 20}))
local child = assert(process.with_options({terminal = assert(view:grant())})
    :spawn_monitored("app:child", "app:workers"))
```

Uma concessão é de uso único: a admissão do processo a consome, um start rejeitado a deixa não resolvida, e um host que não pode anexar terminais rejeita o spawn em vez de descartar a opção.

Programas orientados a bytes entram no mesmo modelo através de `exec`. Um processo filho aloca um processo PTY e chama `process:attach_terminal()`; esse adaptador é dono da emulação de PTY, codificação de entrada, redimensionamento e término, e apresenta na porta que o filho detiver — física ou virtual.

```text
physical terminal -> shell surface -> viewport -> child process -> PTY proxy
```

## API Lua

O [Módulo IO](lua/system/io.md) fornece operações de terminal orientadas a linha:

```lua
local io = require("io")

io.write("Digite o nome: ")
local name = io.readline()
io.print("Olá, " .. name)

local args = io.args()
```

Funções retornam erros se chamadas fora de um contexto de terminal.

Para eventos de entrada raw, renderização estilizada, surfaces e viewports, veja [TTY](lua/system/tty.md). Para processos PTY e sessões de terminal, veja [Execução de Comandos](lua/dynamic/exec.md).

## Veja Também

- [Terminal I/O](lua/system/io.md) — Operações stdin/stdout/stderr
- [TTY](lua/system/tty.md) — Eventos de entrada, surfaces, canvases e viewports
- [Execução de Comandos](lua/dynamic/exec.md) — Processos PTY e sessões de terminal
- [UI de Terminal](tutorials/tty.md) — construa um shell que hospeda um filho em um viewport
