---
title: "Execução de Comandos"
description: "<secondary-label ref='function'/ <secondary-label ref='process'/ <secondary-label ref='io'/ <secondary-label ref='permissions'/"
---

# Execução de Comandos
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Execute comandos externos e scripts shell com controle total sobre streams de I/O.

Para configuração de executor, veja [Executor](system/exec.md).

## Carregamento

```lua
local exec = require("exec")
```

## Obtendo um Executor

Obter um recurso de executor de processo pelo ID:

```lua
local executor, err = exec.get("app:exec")
if err then
    return nil, err
end

-- Usar executor
local proc = executor:exec("ls -la")
-- ...

-- Liberar quando terminar
executor:release()
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | string | ID do recurso |

**Retorna:** `Executor, error`

## Criando um Processo

Criar um novo processo com o comando específicado:

```lua
-- Comando simples
local proc, err = executor:exec("echo 'Hello, World!'")

-- Com diretorio de trabalho
local proc = executor:exec("npm install", {
    work_dir = "/app/project"
})

-- Com variaveis de ambiente
local proc = executor:exec("python script.py", {
    work_dir = "/scripts",
    env = {
        PYTHONPATH = "/app/lib",
        DEBUG = "true",
        API_KEY = api_key
    }
})

-- Executar script shell
local proc = executor:exec("./deploy.sh production", {
    work_dir = "/app/scripts",
    env = {
        DEPLOY_ENV = "production"
    }
})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `cmd` | string | Executavel e argumentos literais |
| `options.work_dir` | string | Diretorio de trabalho |
| `options.env` | table | Variaveis de ambiente |
| `options.pty` | table | Aloca um pseudo-terminal para o processo filho |

**Retorna:** `Process, error`

O processo é criado mas não iniciado.

### Parsing do Comando

`cmd` é dividido em um executável e argumentos literais usando aspas no estilo shell: aspas simples e duplas agrupam uma palavra, e a barra invertida escapa o caractere seguinte. Não há shell, portanto não ocorre expansão de variáveis, globbing, pipes ou redirecionamento. Uma aspa não fechada retorna `errors.INVALID`.

```lua
-- Um argumento contendo um espaço, passado literalmente
local proc = executor:exec("grep 'hello world' notes.txt")

-- $HOME é passado como os quatro caracteres $HOME, sem expansão
local proc = executor:exec("echo $HOME")
```

Para usar recursos do shell, invoque um shell explicitamente:

```lua
local proc = executor:exec("/bin/sh -c 'ls *.log | wc -l'")
```

### Opções de PTY

Alocar um PTY dá ao processo filho um terminal real: edição de linha, controle de jobs e programas de tela cheia funcionam como em um shell.

```lua
local proc = executor:exec("/bin/bash --noprofile --norc", {
    pty = {width = 100, height = 30, term = "xterm-256color"},
})
```

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `width` | number | 80 | Colunas iniciais do PTY, 1 a 65535 |
| `height` | number | 24 | Linhas iniciais do PTY, 1 a 65535 |
| `term` | string | nenhum | Valor de `TERM` do processo filho |

Largura vezes altura não pode exceder 262.144 células. Um processo com PTY mescla a saída do filho em um único stream de terminal; conduza-o com [resize](#resize) e [attach_terminal](#attach_terminal) em vez dos métodos de pipe stdin/stdout.

## start / wait

Iniciar o processo e aguardar conclusao.

```lua
local proc = executor:exec("./build.sh")

local ok, err = proc:start()
if err then
    return nil, err
end

local exit_code, err = proc:wait()
if err then
    return nil, err
end

if exit_code ~= 0 then
    return nil, errors.new("INTERNAL", "Build falhou com código de saida: " .. exit_code)
end
```

## stdout_stream / stderr_stream

Obter streams para ler saida do processo.

```lua
local proc = executor:exec("./process-data.sh")

local stdout = proc:stdout_stream()
local stderr = proc:stderr_stream()

proc:start()

-- Ler todo stdout
local output = {}
while true do
    local chunk = stdout:read(4096)
    if not chunk then break end
    table.insert(output, chunk)
end
local result = table.concat(output)

-- Verificar erros
local err_output = {}
while true do
    local chunk = stderr:read(4096)
    if not chunk then break end
    table.insert(err_output, chunk)
end

local exit_code = proc:wait()

stdout:close()
stderr:close()

if exit_code ~= 0 then
    return nil, errors.new("INTERNAL", table.concat(err_output))
end

return result
```

## write_stdin

Escrever dados para stdin do processo.

```lua
local proc = executor:exec("head -n 3")
local stdout = proc:stdout_stream()

proc:start()

proc:write_stdin("banana\napple\ncherry\n")

local lines = stdout:read()

proc:wait()
stdout:close()
```

Cada chamada escreve os bytes fornecidos e retorna. Não há método que feche o stdin: ele permanece aberto durante toda a vida do processo, então um comando que lê até o fim da entrada, como `sort`, nunca vê EOF e termina apenas quando o processo é sinalizado ou fechado. Escolha um comando que pare de ler por conta própria, como faz `head -n 3`, ou execute um que precise de EOF por trás de um pipeline de shell que forneça sua entrada.

## signal / close

Enviar sinais ou liberar o processo.

```lua
local proc = executor:exec("./long-running-server.sh")
proc:start()

-- ... depois, precisa parar ...

-- Envia SIGTERM e libera o handle
proc:close()

-- Envia SIGKILL e libera o handle
proc:close(true)

-- Ou envia um sinal específico e mantém o handle
local SIGINT = 2
proc:signal(SIGINT)
```

`close(force?)` sinaliza um filho iniciado com `SIGTERM`, ou `SIGKILL` quando `force` é verdadeiro, e então o coleta em segundo plano, de modo que a chamada não bloqueia. Um filho que ainda executa após um período de carência é morto para que a coleta sempre se complete. Um handle não iniciado é simplesmente invalidado, e fechar duas vezes não é um erro.

A coleta fecha os pipes de stdout e stderr do filho, então leia a saída de que precisa antes de chamar `close()`. Depois disso, todo método do processo, incluindo `wait()`, reporta `process closed` — use `signal()` e `wait()` quando o código de saída importar.

## resize

Redimensiona o PTY de um processo com PTY. Um processo baseado em pipe retorna um erro.

```lua
local ok, err = proc:resize(120, 40)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `width` | number | Colunas, 1 a 65535 |
| `height` | number | Linhas, 1 a 65535 |

**Retorna:** `boolean, error`

Use-o para definir a geometria inicial antes de entregar o processo a uma sessão de terminal. Uma vez que a sessão é dona do processo, envie a ela um evento `resize`.

## attach_terminal

Anexa um processo com PTY não iniciado ao terminal do processo chamador e retorna uma `TerminalSession`.

```lua
local exec = require("exec")
local tty = require("tty")

local executor = assert(exec.get("app:exec"))
local proc = assert(executor:exec("/bin/bash --noprofile --norc", {
    pty = {term = "xterm-256color"},
}))
local session = assert(proc:attach_terminal())
```

**Retorna:** `TerminalSession, error`

A chamada consome o processo: a sessão torna-se a única dona do seu ciclo de vida e o handle original não pode mais ser usado. A sessão abre uma surface na porta de terminal atual e é dona da emulação de PTY, codificação de entrada, redimensionamento, término gracioso e forçado, e coleta. Ela precisa de uma porta de terminal — um processo em [terminal host](system/terminal.md), ou um processo criado com uma [concessão de viewport](lua/system/tty.md#viewport) — e falha quando a porta não tem controlador de entrada ou já tem uma surface aberta.

### TerminalSession

| Método | Retorna | Descrição |
|--------|---------|-----------|
| `send(event)` | `boolean, error` | Encaminha um evento TTY canônico ao processo filho |
| `done()` | channel | Canal que dispara uma vez quando o filho termina |
| `status()` | `string, error` | `"running"` ou `"done"`, com o erro de falha quando falhou |
| `close()` | `boolean, error` | Solicita o término de um filho em execução |

`send` aceita os registros de tecla, mouse, resize, foco e paste descritos em [TTY](lua/system/tty.md#event-types). Enviar após o filho ter terminado retorna um erro.

```lua
local channel = require("channel")

local events = assert(tty.events())
assert(tty.start())
local done = session:done()

while true do
    local selected = channel.select({
        events:case_receive(),
        done:case_receive(),
    })
    if not selected.ok or selected.channel == done then break end
    if selected.value.type == "close" then break end
    assert(session:send(selected.value))
end

assert(session:close())
```

## Permissões

Operações de exec estao sujeitas a avaliação de política de segurança.

| Ação | Recurso | Descrição |
|------|---------|-----------|
| `exec.get` | ID do Executor | Obter um recurso de executor |
| `exec.run` | Comando | Executar um comando especifico |

`exec.run` é avaliado contra a string de comando bruta, com as opções solicitadas como metadados:

| Chave | Tipo | Descrição |
|-------|------|-----------|
| `work_dir` | string | Diretório de trabalho solicitado, vazio quando não definido |
| `env_names` | string[] | Nomes das variáveis de ambiente passadas, ordenados; os valores não são expostos |
| `pty.requested` | boolean | Se um PTY foi solicitado |
| `pty.width` | number | Colunas do PTY resolvidas, presente quando solicitado |
| `pty.height` | number | Linhas do PTY resolvidas, presente quando solicitado |
| `pty.term` | string | Valor de `TERM` solicitado, presente quando solicitado |

Uma política pode, portanto, permitir comandos simples enquanto restringe aqueles que pedem um terminal ou um diretório de trabalho específico.

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| ID inválido | `errors.INVALID` | não |
| Permissão negada | `errors.INVALID` | não |
| Processo fechado | `errors.INVALID` | não |
| Processo não iniciado | `errors.INVALID` | não |
| Ja iniciado | `errors.INVALID` | não |
| Aspa não fechada no comando | `errors.INVALID` | não |
| Nenhum PTY no processo | `errors.INVALID` | não |
| Porta de terminal indisponível | `errors.UNAVAILABLE` | não |

Veja [Error Handling](lua/core/errors.md) para trabalhar com erros.

## Veja Também

- [Executor](system/exec.md) — configuração do executor
- [TTY](lua/system/tty.md) — eventos de terminal, surfaces e viewports
- [UI de Terminal](tutorials/tty.md) — um shell que hospeda um filho com PTY em um viewport
