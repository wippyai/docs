---
title: "Streams"
description: "Operações de leitura/escrita de stream para manipular dados eficientemente. Objetos stream sao obtidos de outros modulos (HTTP, filesystem, etc.)."
---

# Streams
<secondary-label ref="function"/>
<secondary-label ref="process"/>

Operações de leitura/escrita de stream para manipular dados eficientemente. Objetos stream sao obtidos de outros modulos (HTTP, filesystem, etc.).

## Carregamento

```lua
-- De corpo de requisição HTTP
local stream = req:stream()

-- De filesystem
local fs = require("fs")
local stream = fs.get("app:data"):open("/file.txt", "r")
```

## Leitura

```lua
local chunk, err = stream:read(size)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `size` | integer | Bytes para ler (0 = bloco padrão de 32KB) |

**Retorna:** `string, error` — `nil, nil` em EOF

## Escrita

```lua
local bytes, err = stream:write(data)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | Dados para escrever |

**Retorna:** `integer, error` — bytes escritos

## Seeking

```lua
local pos, err = stream:seek(whence, offset)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `whence` | string | `"set"`, `"cur"` ou `"end"` |
| `offset` | integer | Offset em bytes |

**Retorna:** `integer, error` — nova posicao

## Flushing

```lua
local ok, err = stream:flush()
```

Flush de dados em buffer para armazenamento subjacente.

## Informacoes do Stream

```lua
local info, err = stream:stat()
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `size` | integer | Tamanho total (-1 se desconhecido) |
| `position` | integer | Posicao atual |
| `readable` | boolean | Pode ler |
| `writable` | boolean | Pode escrever |
| `seekable` | boolean | Pode fazer seek |

## Fechando

```lua
local ok, err = stream:close()
```

Fechar stream e liberar recursos. Seguro chamar multiplas vezes.

## Scanner

Criar um tokenizador para conteudo do stream:

```lua
local scanner, err = stream:scanner(split)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `split` | string | `"lines"`, `"words"`, `"bytes"`, `"runes"` |

### Métodos do Scanner

```lua
local has_more, err = scanner:scan()  -- avancar para o proximo token
local token = scanner:text()           -- token atual
local err_msg = scanner:err()          -- erro do scanner, se houver
```

```lua
while true do
    local has_token, err = scanner:scan()
    if err then return nil, err end
    if not has_token then break end  -- EOF
    process(scanner:text())
end
```

## Erros

| Condição | Tipo |
|----------|------|
| Tipo whence/split inválido | `INVALID` |
| Stream fechado | `INTERNAL` |
| Não legivel/gravavel | `INTERNAL` |
| Falha de leitura/escrita | `INTERNAL` |
