# Runtime WebAssembly

> O runtime WASM e uma extensao experimental. A configuracao e estavel, mas os detalhes internos do runtime podem mudar entre versoes.

O Wippy executa modulos WebAssembly como entradas de registro de primeira classe junto com codigo Lua. Funcoes e processos WASM sao executados dentro do mesmo agendador, compartilham o mesmo modelo de seguranca e interoperam com Lua atraves do registro de funcoes.

## Tipos de Entradas

| Kind | Descricao |
|------|-----------|
| `function.wat` | Funcao em formato WebAssembly Text inline definida em YAML |
| `function.wasm` | Binario WASM pre-compilado carregado de uma entrada de sistema de arquivos |
| `process.wasm` | Binario WASM executado como processo (comandos CLI ou longa duracao) |

## Como Funciona

1. Modulos WASM sao declarados como entradas de registro em `_index.yaml`
2. Na inicializacao, os modulos sao compilados e colocados em pools de workers
3. Codigo Lua (ou outro WASM) os chama via `funcs.call()`
4. Argumentos e valores de retorno sao mapeados automaticamente entre tabelas Lua e tipos WIT
5. Operacoes assincronas (I/O, sleep, HTTP) cedem controle atraves do dispatcher, da mesma forma que Lua

## Modelo de Componentes

O Wippy suporta o WebAssembly Component Model com WIT (WebAssembly Interface Types). Modulos de componentes recebem mapeamento completo de tipos entre o host e o guest:

- Records mapeiam para tabelas Lua com campos nomeados
- Lists mapeiam para arrays Lua
- Results mapeiam para tuplas de retorno `(value, error)`
- Primitivos (`s32`, `f64`, `string`, etc.) mapeiam diretamente

Modulos WASM raw/core tambem sao suportados com assinaturas WIT explicitas.

## Chamando WASM a partir de Lua

Funcoes WASM sao chamadas da mesma forma que qualquer outra funcao no registro:

```lua
local funcs = require("funcs")

-- Sem argumentos
local result, err = funcs.call("myns:answer_wat")

-- Com argumentos
local result, err = funcs.call("myns:compute", 6, 7)

-- Com dados complexos
local users = {
    {id = 1, name = "Alice", tags = {"admin"}, active = true},
    {id = 2, name = "Bob", tags = {"user"}, active = false},
}
local transformed, err = funcs.call("myns:transform_users", users)
```

## Chamando Entre Modulos WASM

Componentes WASM podem chamar outras funcoes do Wippy (Lua ou WASM) atraves da interface host `wippy:runtime/funcs`:

```wit
call-string: func(target: string, input: string) -> result<string, string>;
call-bytes: func(target: string, input: list<u8>) -> result<list<u8>, string>;
```

Importe o host `funcs` na configuracao da sua entrada:

```yaml
imports:
  - funcs
```

## Seguranca

Execucoes WASM herdam o contexto de seguranca do chamador por padrao:

- A identidade do ator e herdada
- O escopo e herdado
- O contexto da requisicao e herdado

Capacidades do host sao opt-in atraves de imports explicitos. Cada entrada declara exatamente quais interfaces WASI precisa (`wasi:cli`, `wasi:filesystem`, etc.), limitando a superficie de acesso do modulo.

## Veja Tambem

- [Funcoes](wasm/functions.md) - Configuracao de entradas de funcoes WASM
- [Funcoes Host](wasm/hosts.md) - Interfaces WASI e Wippy host disponiveis
- [Processos](wasm/processes.md) - Executando WASM como processos de longa duracao
