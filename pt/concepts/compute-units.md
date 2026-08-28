---
title: "Unidades de Computação"
description: "Compare funções, processos e workflows do Wippy por tempo de vida, estado, comunicação e tratamento de falhas."
---

# Unidades de Computação

O Wippy fornece três formas de executar código: funções, processos e workflows. Elas compartilham os mesmos mecanismos subjacentes, mas diferem no tempo de vida, no destino do estado e no que acontece quando ocorrem falhas.

## Funções

Funções executam quando são chamadas e retornam um resultado. Trate cada chamada como stateless: o estado durável ou compartilhado deve residir em um banco de dados ou store. Pools de funções podem reutilizar estados Lua; portanto, globais de módulo e upvalues de closures são locais ao worker e não formam um store confiável entre chamadas.

```lua
local funcs = require("funcs")

local result, err = funcs.call("app.math:add", 2, 3)
if err then
    return nil, err
end
```

Funções executam no contexto do chamador. Se ele for cancelado ou encerrar, as chamadas de função em execução também serão canceladas.

<tip>
Use funções para handlers HTTP, transformações de dados e qualquer operação que deva terminar rapidamente e retornar um resultado.
</tip>

## Processos

Processos são atores. Eles mantêm estado entre várias mensagens, executam independentemente de quem os iniciou e se comunicam por passagem de mensagens.

```lua
local pid, err = process.spawn("app.workers:handler", "app:processes")
if err then return nil, err end

local ok, send_err = process.send(pid, "job", {task = "process_data"})
if send_err then return nil, send_err end
return ok
```

Depois de iniciado, um processo executa independentemente do código que o criou. Processos podem monitorar ou vincular-se uns aos outros e participar de árvores de supervisão que reiniciam filhos que falharam.

O scheduler multiplexa milhares de processos em um pool de workers. Cada processo cede a execução enquanto aguarda I/O, permitindo que outros executem.

<tip>
Use processos para jobs em segundo plano, daemons de serviço e qualquer operação que precise sobreviver ao seu criador ou manter estado entre mensagens.
</tip>

## Workflows

Workflows destinam-se a operações duráveis que precisam se recuperar de interrupções. Um provedor de workflow, como o Temporal, registra o histórico de execução e o reproduz para reconstruir o estado após crashes, reinicializações ou mudanças de infraestrutura.

```lua
-- The provider records this workflow so a worker restart can replay it.
local pid, err = process.spawn("app.orders:process", "app:temporal_worker", order_id)
if err then return nil, err end
return pid
```

A durabilidade acrescenta latência porque as operações do workflow são registradas. Use workflows quando a recuperação for mais importante do que a latência menor de funções ou processos, como em processos de negócio com várias etapas e orquestrações de longa duração.

<note>
O Wippy registra as operações de workflow compatíveis para que produzam os mesmos resultados durante o replay. O código de workflow usa a mesma sintaxe Lua das outras unidades de computação.
</note>

## Comparação

| | Funções | Processos | Workflows |
|---|---|---|---|
| **Estado** | Local à chamada; não dependa do reúso de workers | Em memória | Reconstruído a partir do histórico persistido |
| **Tempo de vida** | Uma chamada | Até encerrar ou falhar | Persiste entre reinicializações |
| **Comunicação** | Valor de retorno + mensagens | Passagem de mensagens | Chamadas de atividades + mensagens |
| **Tratamento de falhas** | O chamador trata | Árvores de supervisão | Recuperação pelo provedor; retries seguem a política |
| **Latência** | Mais baixa | Baixa | Mais alta |

## Mesmo código, comportamento diferente

Muitos módulos se adaptam automaticamente ao contexto. Por exemplo, `time.sleep()` cede a execução tanto em funções quanto em processos, permitindo que outros trabalhos executem; em um workflow, o provedor também registra o timer para que o replay não inicie um segundo timer.
