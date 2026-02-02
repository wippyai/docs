# Lua Runtime

Runtime de computação principal do Wippy otimizado para workloads I/O-bound e lógica de negócios. Código executa em processos isolados que comunicam através de passagem de mensagens - sem memória compartilhada, sem locks.

Wippy é projetado como um runtime poliglota. Enquanto Lua é a linguagem principal, versões futuras suportarão linguagens adicionais através de WebAssembly e integração Temporal para workloads intensivas em computação ou especializadas.

## Processos

Seu código Lua executa dentro de **processos** - contextos de execução isolados gerenciados pelo scheduler. Cada processo:

- Tem seu próprio espaço de memória
- Cede em operações bloqueantes (I/O, channels)
- Pode ser monitorado e supervisionado
- Escala para milhares por máquina

<note>
Um processo Lua típico tem um overhead de memória base de ~13 KB.
</note>

```lua
local pid = process.spawn("app.workers:handler", "app:processes")
process.send(pid, "task", {data = "work"})
```

Veja [Process Management](lua/core/process.md) para criação, vinculação e supervisão.

## Channels

Channels estilo Go para comunicação:

```lua
local ch = channel.new()        -- sem buffer
local buffered = channel.new(10)

ch:send(value)                  -- bloqueia até receber
local val, ok = ch:receive()    -- bloqueia até pronto
```

Veja [Channels](lua/core/channel.md) para select e padrões.

## Corrotinas

Dentro de um processo, crie corrotinas leves:

```lua
coroutine.spawn(function()
    local data = fetch_data()
    ch:send(data)
end)

do_other_work()  -- continua imediatamente
```

Corrotinas criadas são gerenciadas pelo scheduler - sem yield/resume manual.

## Select

Trate múltiplas fontes de eventos:

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

Estes estão sempre disponíveis sem require:

- `process` - gerenciamento de processos e mensagens
- `channel` - channels estilo Go
- `os` - funções de tempo e sistema
- `coroutine` - concorrência leve

## Módulos

```lua
local json = require("json")
local sql = require("sql")
local http = require("http_client")
```

Módulos disponíveis dependem da configuração da entrada. Veja [Entry Definitions](lua/entries.md).

## Bibliotecas Externas

Wippy usa sintaxe Lua 5.3 com um [sistema de tipos gradual](lua/types.md) inspirado por Luau. Tipos são valores de runtime de primeira classe - chamáveis para validação, passáveis como argumentos e inspecionáveis - substituindo a necessidade de bibliotecas de schema como Zod ou Pydantic.

Bibliotecas Lua externas (LuaRocks, etc.) não são suportadas. O runtime fornece seu próprio sistema de módulos com extensões integradas para I/O, rede e integração de sistema.

Para extensões customizadas, veja [Modules](internals/modules.md) na documentação de internals.

## Tratamento de Erros

Funções retornam pares `result, error`:

```lua
local data, err = json.decode(input)
if err then
    return nil, errors.wrap(err, "decode failed")
end
```

Veja [Error Handling](lua/core/errors.md) para padrões.

## Próximos Passos

- [Entry Definitions](lua/entries.md) - Configurar pontos de entrada
- [Channels](lua/core/channel.md) - Padrões de channel
- [Process Management](lua/core/process.md) - Criação e supervisão
- [Functions](lua/core/funcs.md) - Chamadas entre processos
