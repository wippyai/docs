---
title: "Runtime WebAssembly"
description: "Execute funções WAT e WASM ou processos WASM junto com Lua por meio de entradas do registro."
---

# Runtime WebAssembly

> O runtime WASM é uma extensão experimental. A configuração é estável, mas os detalhes internos do runtime podem mudar entre versões.

O Wippy registra módulos WebAssembly junto com código Lua. Entradas de função participam do registro de funções e são executadas por pools de funções; entradas de processo registram fábricas de processos e são executadas sob hosts de processos. Ambas usam o agendador e o modelo de segurança do runtime.

**Classificação: visão geral conceitual.** O bloco Lua contém padrões de chamada independentes e pressupõe que as entradas WASM nomeadas e seus contratos WIT já estejam registrados. Consulte o tutorial de Rust/WASM para ver um projeto com um componente compilado.

## Tipos de entradas

| Kind | Descrição |
|------|-----------|
| `function.wat` | Função em formato WebAssembly Text inline definida em YAML |
| `function.wasm` | Binário WASM pré-compilado carregado de uma entrada de sistema de arquivos |
| `process.wasm` | Binário WASM executado como processo, para comandos CLI ou tarefas de longa duração |

## Como Funciona

1. Módulos WASM são declarados como entradas do registro em `_index.yaml`.
2. Na inicialização, entradas `function.wat` e `function.wasm` são compiladas, registradas como funções e colocadas nos pools de funções configurados.
3. Lua chama essas entradas de função por `funcs.call()`.
4. Entradas `process.wasm` registram fábricas de processos e são iniciadas sob um host de processos.
5. Argumentos de função e valores de retorno são mapeados entre tabelas Lua e tipos WIT.
6. Operações com bridge do dispatcher, incluindo polling de relógio e HTTP de saída, cedem a execução para que o agendador execute outros trabalhos.

## Component Model

O Wippy suporta o WebAssembly Component Model com WIT (WebAssembly Interface Types). Módulos de componentes mapeiam estes tipos entre host e guest:

- Records são mapeados para tabelas Lua com campos nomeados.
- Lists são mapeadas para arrays Lua.
- Results são mapeados para tuplas de retorno `(value, error)`.
- Primitivos (`s32`, `f64`, `string` etc.) são mapeados diretamente.

Módulos WASM raw/core também são compatíveis com assinaturas WIT explícitas.

## Chamando WASM a partir de Lua

Chame uma função WASM por seu ID no registro usando `funcs.call()`:

```lua
local funcs = require("funcs")

-- No arguments
local result, err = funcs.call("myns:answer_wat")
if err then return nil, err end

-- With arguments
local computed, compute_err = funcs.call("myns:compute", 6, 7)
if compute_err then return nil, compute_err end

-- With complex data
local users = {
    {id = 1, name = "Alice", tags = {"admin"}, active = true},
    {id = 2, name = "Bob", tags = {"user"}, active = false},
}
local transformed, err = funcs.call("myns:transform_users", users)
if err then return nil, err end
```

## Segurança

Execuções WASM herdam o contexto de segurança do chamador por padrão:

- A identidade do ator é herdada.
- O escopo é herdado.
- O contexto da requisição é herdado.

As capacidades do host são opt-in por imports explícitos. Cada entrada declara os perfis de host necessários, como `funcs`, `wasi1`, `wasi:cli` ou `wasi:filesystem`, limitando a superfície de acesso do módulo. Ativar um perfil não ignora as verificações de segurança do runtime em operações como chamadas de função, sockets ou HTTP de saída.

## Veja também

- [Funções](./functions.md) - Configuração de entradas de funções WASM
- [Funções do host](./hosts.md) - Interfaces WASI e Wippy disponíveis no host
- [Processos](./processes.md) - Execução de WASM como processos de longa duração
- [Tutorial de Rust/WASM](../tutorials/rust-wasm.md) - Compile e registre um componente
