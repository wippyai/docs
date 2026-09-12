---
title: "Streams"
description: "Operações de leitura/escrita de stream para manipular dados eficientemente. Objetos stream sao obtidos de outros modulos (HTTP, filesystem, etc.)."
---

# Streams
<secondary-label ref="function"/>
<secondary-label ref="process"/>

Streams fornecem I/O incremental para HTTP, filesystem e outros módulos. Os módulos proprietários dos dados subjacentes criam os objetos stream. Esta página é uma referência de API; o loop do scanner usa um callback `process(token)` definido pela aplicação.

## Obtendo um Stream

```lua
-- From HTTP request body
local stream, err = req:stream()
if err then return nil, err end

-- From filesystem
local fs = require("fs")
local volume, err = fs.get("app:data")
if err then return nil, err end

local stream, err = volume:open("/file.txt", "r")
if err then return nil, err end
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

`flush` grava os dados em buffer no destino subjacente.

## Informações do Stream

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

`close` libera os recursos do stream e pode ser chamado mais de uma vez.

## Scanner

Crie um scanner que tokeniza o conteúdo do stream:

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

Quando `scan()` retorna `false`, verifique `scanner:err()` antes de tratar o resultado como EOF. Falhas de tokenização e de leitura subjacente ficam armazenadas no scanner e não aparecem no segundo valor retornado por `scan()`.

## Erros

| Condição | Tipo |
|----------|------|
| Tipo whence/split inválido | levantado como erro Lua (não retornado) |
| Stream fechado | `INTERNAL` |
| Não legivel/gravavel | `INTERNAL` |
| Falha de leitura/escrita | `INTERNAL` |
