# Streams
<secondary-label ref="function"/>
<secondary-label ref="process"/>

Operacoes de leitura/escrita de stream para manipular dados eficientemente. Objetos stream sao obtidos de outros modulos (HTTP, filesystem, etc.).

## Carregamento

```lua
-- De corpo de requisicao HTTP
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
| `size` | integer | Bytes para ler (0 = ler tudo disponível) |

**Retorna:** `string, error` - nil em EOF

```lua
-- Ler todos os dados restantes
local data, err = stream:read_all()
```

## Escrita

```lua
local bytes, err = stream:write(data)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `data` | string | Dados para escrever |

**Retorna:** `integer, error` - bytes escritos

## Seeking

```lua
local pos, err = stream:seek(whence, offset)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `whence` | string | `"set"`, `"cur"` ou `"end"` |
| `offset` | integer | Offset em bytes |

**Retorna:** `integer, error` - nova posicao

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

### Metodos do Scanner

```lua
local has_more = scanner:scan()  -- Avancar para proximo token
local token = scanner:text()      -- Obter token atual
local err_msg = scanner:err()     -- Obter erro se houver
```

```lua
while scanner:scan() do
    local line = scanner:text()
    process(line)
end
if scanner:err() then
    return nil, errors.new("INTERNAL", scanner:err())
end
```

## Erros

| Condição | Tipo |
|----------|------|
| Tipo whence/split invalido | `INVALID` |
| Stream fechado | `INTERNAL` |
| Não legivel/gravavel | `INTERNAL` |
| Falha de leitura/escrita | `INTERNAL` |
