---
title: "Logging"
description: "Escreva mensagens de log estruturadas e crie loggers filhos com contexto persistente."
---

# Logging
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="io"/>

O módulo `logger` escreve mensagens estruturadas nos níveis debug, info, warn e error.

Esta é uma referência de API. Cada exemplo é uma operação de logging isolada e pressupõe um contexto de execução com a configuração de logger desejada.

As chamadas de log não retornam valores. Quando o contexto de execução os fornece, cada chamada também adiciona o `pid` do processo e a `location` de origem derivada do frame atual.

## Carregamento

```lua
local logger = require("logger")
```

## Níveis de log

### `logger:debug`

Escreve uma mensagem de log no nível debug.

```lua
logger:debug("message", {key = "value"})
```

### `logger:info`

Escreve uma mensagem de log no nível info.

```lua
logger:info("message", {key = "value"})
```

### `logger:warn`

Escreve uma mensagem de log no nível warning.

```lua
logger:warn("message", {key = "value"})
```

### `logger:error`

Escreve uma mensagem de log no nível error.

```lua
logger:error("message", {key = "value"})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `message` | string | Mensagem de log |
| `fields` | table? | Pares chave-valor contextuais |

Os quatro métodos de nível de log aceitam os mesmos parâmetros. Apenas chaves string se tornam nomes de campos. Strings, números, inteiros, booleanos, erros e valores Lua estruturados são convertidos em campos de log; chaves que não sejam strings são ignoradas.

Em `logger:error`, um campo chamado `error` é emitido como campo de erro e removido da tabela fornecida antes do processamento dos demais campos. Não reutilize essa tabela se a entrada `error` precisar permanecer intacta.

## Customização do Logger

### `logger:with`

Cria um logger filho que adiciona os mesmos campos a todas as mensagens.

```lua
local function request_logger(request_id)
    return logger:with({request_id = request_id})
end

request_logger("req-123"):info("message")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `fields` | table | Campos para anexar a todos os logs |

**Retorna:** `Logger`

O logger original não é alterado. Loggers filhos podem encadear chamadas adicionais a `with` e `named`.

### `logger:named`

Cria um logger filho com um nome.

```lua
local named = logger:named("auth")
named:info("message")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `name` | string | Nome do logger |

**Retorna:** `Logger`

Um nome vazio gera um erro de argumento Lua. Ele não é retornado como valor estruturado `errors.INVALID`.

Os métodos de logging não retornam erros estruturados. Tipos de argumentos inválidos geram erros de argumento Lua. Se nenhum logger estiver anexado ao contexto de execução, o módulo usa um logger no-op e descarta a mensagem.
