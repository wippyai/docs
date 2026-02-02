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
| `cmd` | string | Comando para executar |
| `options.work_dir` | string | Diretorio de trabalho |
| `options.env` | table | Variaveis de ambiente |

**Retorna:** `Process, error`

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
-- Pipe de dados para comando
local proc = executor:exec("sort")
local stdout = proc:stdout_stream()

proc:start()

-- Escrever input
proc:write_stdin("banana\napple\ncherry\n")
proc:write_stdin("")  -- Sinalizar EOF

-- Ler saida ordenada
local sorted = stdout:read()
print(sorted)  -- "apple\nbanana\ncherry\n"

proc:wait()
stdout:close()
```

## signal / close

Enviar sinais ou fechar o processo.

```lua
local proc = executor:exec("./long-running-server.sh")
proc:start()

-- ... depois, precisa parar ...

-- Shutdown gracioso (SIGTERM)
proc:close()

-- Ou force kill (SIGKILL)
proc:close(true)

-- Ou enviar sinal especifico
local SIGINT = 2
proc:signal(SIGINT)
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
| Permissão negada | `errors.PERMISSION_DENIED` | não |
| Processo fechado | `errors.INVALID` | não |
| Processo não iniciado | `errors.INVALID` | não |
| Ja iniciado | `errors.INVALID` | não |

Veja [Error Handling](lua/core/errors.md) para trabalhar com erros.
