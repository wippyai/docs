---
title: "Execução de Comandos"
description: "Inicie processos externos, troque dados por streams, aguarde a conclusão e envie sinais."
---

# Execução de Comandos
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

O módulo `exec` inicia executáveis externos e fornece acesso à entrada, saída, ciclo de vida e sinais. Esta página é uma referência de API com receitas parciais: IDs de executores, comandos, caminhos, valores de ambiente e políticas de segurança vêm da aplicação.

O executor analisa uma string de comando em executável e argumentos; ele não invoca um shell. Operadores shell como pipes, redirects, expansão de variáveis e substituição de comandos não são interpretados. Um script executável só pode ser iniciado diretamente quando o backend e o sistema operacional selecionados oferecem suporte.

Antes de usar os exemplos, configure um recurso de executor e sua allowlist de comandos conforme descrito em [Executor](system/exec.md), e conceda `exec.get` e `exec.run` para os recursos exatos utilizados. Os exemplos usam comandos e caminhos Unix; substitua-os por comandos disponíveis no host do executor.

## Carregamento

```lua
local exec = require("exec")
```

## Obtendo um Executor

Obtém um executor de processos pelo ID do registry:

```lua
local executor, err = exec.get("app:exec")
if err then
    return nil, err
end
```

Mantenha o executor adquirido enquanto cria e executa seus processos. Chame `executor:release()` em todo caminho de retorno depois que o último processo for criado; a liberação é idempotente.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | string | ID do recurso |

**Retorna:** `Executor, error`

## Criando um Processo

Cria um processo para o comando especificado:

```lua
local proc, err = executor:exec("python script.py", {
    work_dir = "/scripts",
    env = {
        PYTHONPATH = "/app/lib",
        DEBUG = "true",
        API_KEY = api_key
    }
})
if err then
    executor:release() -- release is specified to return true, nil
    return nil, err
end
```

Argumentos entre aspas são agrupados pelo parser do executor nativo. Eles são passados diretamente ao executável, sem avaliação por shell. No executor nativo, as entradas de `command_whitelist` e o recurso da política `exec.run` correspondem à string completa do comando, não apenas ao nome do executável.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `cmd` | string | Comando para executar |
| `options.work_dir` | string | Diretorio de trabalho |
| `options.env` | table | Variaveis de ambiente |

**Retorna:** `Process, error`

## `start` / `wait`

Inicia o processo e aguarda sua conclusão.

```lua
local executor, get_err = exec.get("app:exec")
if get_err then
    return nil, get_err
end

local proc, create_err = executor:exec("./build.sh")
if create_err then
    executor:release()
    return nil, create_err
end

local ok, start_err = proc:start()
if start_err then
    proc:close(true)
    executor:release()
    return nil, start_err
end

local exit_code, wait_err = proc:wait()
local _, release_err = executor:release()
if wait_err then
    return nil, wait_err
end
if release_err then
    return nil, release_err
end

if exit_code ~= 0 then
    return nil, errors.new({
        message = "Build failed with exit code: " .. exit_code,
        kind = errors.INTERNAL
    })
end
```

`wait()` cede a execução até o processo filho terminar, retorna seu código de saída, coleta o processo e fecha seu handle. Depois de `wait()`, os demais métodos do processo reportam `errors.INVALID`, pois ele está fechado.

## `stdout_stream` / `stderr_stream`

Abre streams para ler a saída depois de `start()`. Streams de processos executados por Docker não ficam disponíveis antes que o contêiner inicie. Se stdout e stderr puderem produzir dados, drene-os concorrentemente: ler todo o stdout antes do stderr pode causar deadlock quando o processo filho preencher o pipe de stderr não lido.

```lua
local function fail(err)
    proc:close(true)   -- close is specified to return true, nil
    executor:release()
    return nil, err
end

local function drain(stream, done)
    coroutine.spawn(function()
        local chunks = {}
        while true do
            local chunk, read_err = stream:read(4096)
            if read_err then
                done:send({err = read_err})
                return
            end
            if not chunk then
                done:send({data = table.concat(chunks)})
                return
            end
            table.insert(chunks, chunk)
        end
    end)
end

local _, start_err = proc:start()
if start_err then return fail(start_err) end

local stdout, stdout_err = proc:stdout_stream()
if stdout_err then return fail(stdout_err) end
local stderr, stderr_err = proc:stderr_stream()
if stderr_err then return fail(stderr_err) end

local stdout_done = channel.new(1)
local stderr_done = channel.new(1)
drain(stdout, stdout_done)
drain(stderr, stderr_done)

local stdout_result
local stderr_result
while not stdout_result or not stderr_result do
    local cases = {}
    if not stdout_result then table.insert(cases, stdout_done:case_receive()) end
    if not stderr_result then table.insert(cases, stderr_done:case_receive()) end

    local selected = channel.select(cases)
    if not selected.ok then
        return fail(errors.new("output drain channel closed"))
    end
    if selected.value.err then return fail(selected.value.err) end

    if selected.channel == stdout_done then
        stdout_result = selected.value
    else
        stderr_result = selected.value
    end
end

local _, stdout_close_err = stdout:close()
if stdout_close_err then return fail(stdout_close_err) end
local _, stderr_close_err = stderr:close()
if stderr_close_err then return fail(stderr_close_err) end

local exit_code, wait_err = proc:wait()
if wait_err then return fail(wait_err) end

local _, release_err = executor:release()
if release_err then return nil, release_err end

return {
    exit_code = exit_code,
    stdout = stdout_result.data,
    stderr = stderr_result.data
}
```

Esta receita parcial pressupõe que `proc` foi criado a partir do `executor` ativo. Os globais `channel` e `coroutine` coordenam os dois leitores no mesmo processo Lua.

## `write_stdin`

Escreve dados na entrada padrão do processo. `write_stdin` não fecha stdin; use um comando com contrato de entrada limitado quando a conclusão depender desse stream.

```lua
-- This command exits after reading three lines; it does not require an EOF signal
local proc, create_err = executor:exec("head -n 3")
if create_err then
    executor:release()
    return nil, create_err
end

local function fail(err)
    proc:close(true)
    executor:release()
    return nil, err
end

local _, start_err = proc:start()
if start_err then
    return fail(start_err)
end

local stdout, stream_err = proc:stdout_stream()
if stream_err then
    return fail(stream_err)
end

for _, line in ipairs({"banana\n", "apple\n", "cherry\n"}) do
    local _, write_err = proc:write_stdin(line)
    if write_err then
        return fail(write_err)
    end
end

-- Read until the bounded command exits and closes stdout
local chunks = {}
while true do
    local chunk, read_err = stdout:read(4096)
    if read_err then
        return fail(read_err)
    end
    if not chunk then break end
    table.insert(chunks, chunk)
end
print(table.concat(chunks))  -- "banana\napple\ncherry\n"

local _, close_err = stdout:close()
if close_err then
    return fail(close_err)
end

local exit_code, wait_err = proc:wait()
if wait_err then return fail(wait_err) end
local _, release_err = executor:release()
if release_err then return nil, release_err end
if exit_code ~= 0 then
    return nil, errors.new("head exited with code " .. exit_code)
end
```

Esta receita parcial pressupõe que `executor` esteja ativo no início do bloco.

## `signal` / `close`

Escolha um único caminho de encerramento para um processo iniciado:

```lua
-- Stop and discard the handle. close() sends SIGTERM, reaps in the
-- background, and returns true even if signaling fails.
local _, close_err = proc:close()
if close_err then return nil, close_err end

-- For immediate forced shutdown, use this instead:
-- local _, close_err = proc:close(true) -- SIGKILL

-- When the exit code matters, signal and then wait instead of closing:
-- local _, signal_err = proc:signal(2) -- SIGINT on Unix
-- if signal_err then return nil, signal_err end
-- local exit_code, wait_err = proc:wait()
```

`close()` é idempotente. Depois que `close()` ou `wait()` fechar o handle, chamadas posteriores a `signal()`, `start()`, `wait()` e ao acesso de streams retornam `errors.INVALID`. Os números e o comportamento dos sinais dependem do backend do executor e do sistema operacional.

## Permissões

Operações de exec estao sujeitas a avaliação de política de segurança.

| Ação | Recurso | Descrição |
|------|---------|-----------|
| `exec.get` | ID do Executor | Obter um recurso de executor |
| `exec.run` | Comando | Executar um comando especifico |

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| ID de executor vazio | `errors.INVALID` | não |
| Permissão negada | `errors.INVALID` | não |
| Processo fechado | `errors.INVALID` | não |
| Processo não iniciado | `errors.INVALID` | não |
| Ja iniciado | `errors.INVALID` | não |
| Falha ao obter executor ou criar processo | `errors.INTERNAL` | não |
| Falha em start, wait, signal, stdin ou operação de stream | `errors.INTERNAL` | não |

No runtime v0.3.32a, as negações de política de `exec.get` e `exec.run` usam `errors.INVALID`, não `errors.PERMISSION_DENIED`.

Veja [Tratamento de Erros](lua/core/errors.md) para trabalhar com erros.
