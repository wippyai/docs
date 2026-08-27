---
title: "Lua Runtime"
description: "Como o código Lua é executado em processos do Wippy, se comunica por channels, carrega módulos e trata erros."
---

# Lua Runtime

Lua é o principal runtime do Wippy para trabalhos vinculados a I/O e lógica de negócios. O código é executado em processos isolados que se comunicam por troca de mensagens, sem memória compartilhada.

Esta página apresenta uma visão geral conceitual. Seus blocos de código são trechos de referência isolados; nomes como `inbox`, `events` e `handle_message` representam valores ou callbacks fornecidos pela aplicação.

Para conhecer as decisões de design por trás de Lua e sua relação com WebAssembly, veja [Por que o Wippy usa Lua](why-lua.md).

## Processos

O código Lua é executado em **processos**: contextos de execução isolados gerenciados pelo scheduler. Cada processo:

- tem seu próprio espaço de memória;
- cede durante operações bloqueantes, como I/O e acesso a channels;
- pode ser monitorado e supervisionado; e
- pode ser executado junto a milhares de outros processos na mesma máquina.

```lua
local pid, err = process.spawn("app.workers:handler", "app:processes")
if err then
    return nil, err
end

local sent, send_err = process.send(pid, "task", {data = "work"})
if send_err then
    return nil, send_err
end
```

Entradas Lua executáveis recebem `process` como global ambiente. Ele também pode ser carregado com `require("process")` sem ser adicionado à lista `modules` da entrada. Veja [Gerenciamento de Processos](core/process.md) para criação, vinculação e supervisão.

## Channels

Channels permitem a comunicação entre tarefas concorrentes:

```lua
local sync_ch = channel.new()   -- unbuffered
local buffered = channel.new(10)

buffered:send("work")           -- completes while buffer space is available
local val, ok = buffered:receive()  -- val is "work" and ok is true
```

Veja [Channels](core/channel.md) para `select` e padrões.

## Corrotinas

Dentro de um processo, use corrotinas leves para trabalho concorrente:

```lua
coroutine.spawn(function()
    local data = fetch_data()
    ch:send(data)
end)

do_other_work()  -- continues immediately
```

O scheduler gerencia as corrotinas criadas, portanto os chamadores não executam `yield` ou `resume` manualmente.

## Select

Use `channel.select` para aguardar várias fontes de eventos:

```lua
local r = channel.select {
    inbox:case_receive(),
    events:case_receive(),
    timeout:case_receive()
}

if r.channel == timeout then
    -- timed out
elseif r.channel == events then
    handle_event(r.value)
else
    handle_message(r.value)
end
```

## Globais

Os globais a seguir estão disponíveis sem `require` e não precisam ser listados em `modules:`:

- `channel` - channels estilo Go
- `payload` - o payload de entrada da entrada
- `process` - criação de processos, mensagens, monitoramento e operações do ciclo de vida
- `print`, `subscribe`, `unsubscribe` - logging e pub/sub
- `os`, `table`, `math`, `string`, `coroutine`, `errors` - bibliotecas padrão

## Módulos

Os módulos integrados do runtime que não são ambientes são carregados com `require()` e devem aparecer na allowlist `modules:` da entrada. Entradas executáveis recebem `process` como global ambiente; `require("process")` também é permitido sem uma declaração em `modules:`.

```lua
local process = require("process")
local json = require("json")
local sql = require("sql")
local http = require("http_client")
```

Os módulos disponíveis dependem da configuração da entrada. Veja [Definições de Entradas](entries.md).

Bibliotecas do registro usam a mesma sintaxe `require("alias")`, mas são declaradas separadamente no mapa `imports:` da entrada.

## Suporte a Linguagem e Bibliotecas

Wippy usa a sintaxe Lua 5.3 com um [sistema de tipos gradual](types.md) inspirado no Luau. Os tipos são valores de runtime de primeira classe que podem ser usados para validação, passados como argumentos e inspecionados durante a execução.

Bibliotecas Lua externas (LuaRocks, etc.) não são suportadas. O runtime fornece seu próprio sistema de módulos com extensões integradas para I/O, rede e integração de sistema.

Para extensões personalizadas, veja [Módulos](../internals/modules.md) na documentação interna.

## Tratamento de Erros

As funções normalmente retornam pares `result, error`:

```lua
local data, err = json.decode(input)
if err then
    return nil, errors.wrap(err, "decode failed")
end
```

Esse trecho pressupõe que `json` esteja habilitado na lista `modules` da entrada e que `input` contenha a string a ser decodificada. Veja [Tratamento de Erros](core/errors.md) para conhecer os padrões.

## Próximos Passos

- [Definições de Entradas](entries.md) - Configurar pontos de entrada
- [Channels](core/channel.md) - Padrões de channel
- [Gerenciamento de Processos](core/process.md) - Criação e supervisão
- [Funções](core/funcs.md) - Chamadas entre processos
