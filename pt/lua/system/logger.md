# Logging
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>
<secondary-label ref="io"/>

Logging estruturado com niveis debug, info, warn e error.

## Carregamento

```lua
local logger = require("logger")
```

## Niveis de Log

### Debug

```lua
logger:debug("message", {key = "value"})
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `message` | string | Mensagem de log |
| `fields` | table? | Pares chave-valor contextuais |

### Info

```lua
logger:info("message", {key = "value"})
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `message` | string | Mensagem de log |
| `fields` | table? | Pares chave-valor contextuais |

### Warn

```lua
logger:warn("message", {key = "value"})
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `message` | string | Mensagem de log |
| `fields` | table? | Pares chave-valor contextuais |

### Error

```lua
logger:error("message", {key = "value"})
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `message` | string | Mensagem de log |
| `fields` | table? | Pares chave-valor contextuais |

## Customizacao do Logger

### Com Campos

Criar um logger filho com campos persistentes.

```lua
local child = logger:with({request_id = id})
child:info("message")
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `fields` | table | Campos para anexar a todos os logs |

**Retorna:** `Logger`

### Logger Nomeado

Criar um logger filho nomeado.

```lua
local named = logger:named("auth")
named:info("message")
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `name` | string | Nome do logger |

**Retorna:** `Logger`

## Erros

| Condicao | Tipo | Retentavel |
|----------|------|------------|
| String de nome vazia | `errors.INVALID` | nao |

Veja [Error Handling](lua-errors.md) para trabalhar com erros.
