# Lua Runtime

Runtime de computacao principal do Wippy otimizado para workloads I/O-bound e logica de negocios. Codigo executa em processos isolados que comunicam atraves de passagem de mensagens - sem memoria compartilhada, sem locks.

Wippy e projetado como um runtime poliglota. Enquanto Lua e a linguagem principal, versoes futuras suportarao linguagens adicionais atraves de WebAssembly e integracao Temporal para workloads intensivas em computacao ou especializadas.

## Processos

Seu codigo Lua executa dentro de **processos** - contextos de execucao isolados gerenciados pelo scheduler. Cada processo:

- Tem seu proprio espaco de memoria
- Cede em operacoes bloqueantes (I/O, channels)
- Pode ser monitorado e supervisionado
- Escala para milhares por maquina

<note>
Um processo Lua tipico tem um overhead de memoria base de ~13 KB.
</note>

```lua
local pid = process.spawn("app.workers:handler", "app:processes")
process.send(pid, "task", {data = "work"})
```

Veja [Process Management](lua-process.md) para criacao, vinculacao e supervisao.

## Channels

Channels estilo Go para comunicacao:

```lua
local ch = channel.new()        -- sem buffer
local buffered = channel.new(10)

ch:send(value)                  -- bloqueia ate receber
local val, ok = ch:receive()    -- bloqueia ate pronto
```

Veja [Channels](lua-channel.md) para select e padroes.

## Corrotinas

Dentro de um processo, crie corrotinas leves:

```lua
coroutine.spawn(function()
    local data = fetch_data()
    ch:send(data)
end)

do_other_work()  -- continua imediatamente
```

Corrotinas criadas sao gerenciadas pelo scheduler - sem yield/resume manual.

## Select

Trate multiplas fontes de eventos:

```lua
local r = channel.select {
    inbox:case_receive(),
    events:case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    -- timeout
elseif r.channel == events then
    handle_event(r.value)
else
    handle_message(r.value)
end
```

## Globais

Estes estao sempre disponiveis sem require:

- `process` - gerenciamento de processos e mensagens
- `channel` - channels estilo Go
- `os` - funcoes de tempo e sistema
- `coroutine` - concorrencia leve

## Modulos

```lua
local json = require("json")
local sql = require("sql")
local http = require("http_client")
```

Modulos disponiveis dependem da configuracao da entrada. Veja [Entry Definitions](lua-entries.md).

## Bibliotecas Externas

Wippy usa sintaxe Lua 5.3 com um [sistema de tipos gradual](lua-types.md) inspirado por Luau. Tipos sao valores de runtime de primeira classe - chamaveis para validacao, passaveis como argumentos e inspecionaveis - substituindo a necessidade de bibliotecas de schema como Zod ou Pydantic.

Bibliotecas Lua externas (LuaRocks, etc.) nao sao suportadas. O runtime fornece seu proprio sistema de modulos com extensoes integradas para I/O, rede e integracao de sistema.

Para extensoes customizadas, veja [Modules](internal-modules.md) na documentacao de internals.

## Tratamento de Erros

Funcoes retornam pares `result, error`:

```lua
local data, err = json.decode(input)
if err then
    return nil, errors.wrap(err, "decode failed")
end
```

Veja [Error Handling](lua-errors.md) para padroes.

## Proximos Passos

- [Entry Definitions](lua-entries.md) - Configurar pontos de entrada
- [Channels](lua-channel.md) - Padroes de channel
- [Process Management](lua-process.md) - Criacao e supervisao
- [Functions](lua-funcs.md) - Chamadas entre processos
