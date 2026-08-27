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

Antes de usar os exemplos, configure um recurso de executor e sua allowlist de comandos conforme descrito em [Executor](../../system/exec.md), e conceda `exec.get` e `exec.run` para os recursos exatos utilizados. Os exemplos usam comandos e caminhos Unix; substitua-os por comandos disponíveis no host do executor.

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
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | string | ID do recurso |

**Retorna:** `Executor, error`

## Criando um Processo

Criar um novo processo com o comando específicado:

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

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `cmd` | string | Comando para executar |
| `options.work_dir` | string | Diretorio de trabalho |
| `options.env` | table | Variaveis de ambiente |

**Retorna:** `Process, error`

## start / wait

Iniciar o processo e aguardar conclusao.

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

## stdout_stream / stderr_stream

Obter streams para ler saida do processo.

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

## write_stdin

Escrever dados para stdin do processo.

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

## signal / close

Enviar sinais ou fechar o processo.

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

## Permissões

Operações de exec estao sujeitas a avaliação de política de segurança.

| Ação | Recurso | Descrição |
|------|---------|-----------|
| `exec.get` | ID do Executor | Obter um recurso de executor |
| `exec.run` | Comando | Executar um comando especifico |

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| ID inválido | `errors.INVALID` | não |
| Permissão negada | `errors.INVALID` | não |
| Processo fechado | `errors.INVALID` | não |
| Processo não iniciado | `errors.INVALID` | não |
| Ja iniciado | `errors.INVALID` | não |
| Falha ao obter executor ou criar processo | `errors.INTERNAL` | não |
| Falha em start, wait, signal, stdin ou operação de stream | `errors.INTERNAL` | não |

No runtime v0.3.32a, as negações de política de `exec.get` e `exec.run` usam `errors.INVALID`, não `errors.PERMISSION_DENIED`.

Veja [Tratamento de Erros](../core/errors.md) para trabalhar com erros.
