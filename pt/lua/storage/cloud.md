# Cloud Storage
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>
<secondary-label ref="permissions"/>

Acesse armazenamento de objetos compativel com S3. Upload, download, listagem e gerenciamento de arquivos com suporte a URLs pre-assinadas.

Para configuração de armazenamento, veja [Cloud Storage](system-cloudstorage.md).

## Carregamento

```lua
local cloudstorage = require("cloudstorage")
```

## Adquirindo Storage

Obter um recurso de cloud storage por ID do registro:

```lua
local storage, err = cloudstorage.get("app.infra:files")
if err then
    return nil, err
end

storage:upload_object("data/file.txt", "content")
storage:release()
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | string | ID do recurso de armazenamento |

**Retorna:** `Storage, error`

## Fazendo Upload de Objetos

Upload de conteudo de string ou arquivo:

```lua
local storage = cloudstorage.get("app.infra:files")

-- Upload de conteudo string
local ok, err = storage:upload_object("reports/daily.json", json.encode({
    date = "2024-01-15",
    total = 1234
}))

-- Upload de arquivo
local fs = require("fs")
local vol = fs.get("app:data")
local file = vol:open("/large-file.bin", "r")

storage:upload_object("backups/large-file.bin", file)
file:close()

storage:release()
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `key` | string | Chave/caminho do objeto |
| `content` | string ou Reader | Conteudo como string ou file reader |

**Retorna:** `boolean, error`

## Baixando Objetos

Baixar um objeto para um file writer:

```lua
local storage = cloudstorage.get("app.infra:files")
local fs = require("fs")
local vol = fs.get("app:temp")

local file = vol:open("/downloaded.json", "w")
local ok, err = storage:download_object("reports/daily.json", file)
file:close()

-- Baixar conteudo parcial (primeiro 1KB)
local partial = vol:open("/partial.bin", "w")
storage:download_object("backups/large-file.bin", partial, {
    range = "bytes=0-1023"
})
partial:close()

storage:release()
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `key` | string | Chave do objeto para baixar |
| `writer` | Writer | File writer de destino |
| `options.range` | string | Faixa de bytes (ex: "bytes=0-1023") |

**Retorna:** `boolean, error`

## Listando Objetos

Listar objetos com filtragem opcional por prefixo:

```lua
local storage = cloudstorage.get("app.infra:files")

local result, err = storage:list_objects({
    prefix = "reports/2024/",
    max_keys = 100
})

for _, obj in ipairs(result.objects) do
    print(obj.key, obj.size, obj.content_type)
end

-- Paginar através de resultados grandes
local token = nil
repeat
    local result = storage:list_objects({
        prefix = "logs/",
        max_keys = 1000,
        continuation_token = token
    })
    for _, obj in ipairs(result.objects) do
        process(obj)
    end
    token = result.next_continuation_token
until not result.is_truncated

storage:release()
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `options.prefix` | string | Filtrar por prefixo de chave |
| `options.max_keys` | integer | Maximo de objetos a retornar |
| `options.continuation_token` | string | Token de paginação |

**Retorna:** `table, error`

Resultado contem `objects`, `is_truncated`, `next_continuation_token`.

## Deletando Objetos

Remover multiplos objetos:

```lua
local storage = cloudstorage.get("app.infra:files")

storage:delete_objects({
    "temp/file1.txt",
    "temp/file2.txt",
    "temp/file3.txt"
})

storage:release()
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `keys` | string[] | Array de chaves de objetos para deletar |

**Retorna:** `boolean, error`

## URLs de Download

Criar uma URL temporaria que permite baixar um objeto sem credenciais. Util para compartilhar arquivos com usuários externos ou servir conteudo através da sua aplicação.

```lua
local storage, err = cloudstorage.get("app.infra:files")
if err then
    return nil, err
end

local url, err = storage:presigned_get_url("reports/quarterly.pdf", {
    expiration = 3600
})

storage:release()

if err then
    return nil, err
end

-- Retornar URL ao cliente para download direto
return {download_url = url}
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `key` | string | Chave do objeto |
| `options.expiration` | integer | Segundos até URL expirar (padrão: 3600) |

**Retorna:** `string, error`

## URLs de Upload

Criar uma URL temporaria que permite fazer upload de um objeto sem credenciais. Permite que clientes facam upload de arquivos diretamente para o armazenamento sem fazer proxy pelo seu servidor.

```lua
local storage, err = cloudstorage.get("app.infra:files")
if err then
    return nil, err
end

local url, err = storage:presigned_put_url("uploads/user-123/avatar.jpg", {
    expiration = 600,
    content_type = "image/jpeg",
    content_length = 1024 * 1024
})

storage:release()

if err then
    return nil, err
end

-- Retornar URL ao cliente para upload direto
return {upload_url = url}
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `key` | string | Chave do objeto |
| `options.expiration` | integer | Segundos até URL expirar (padrão: 3600) |
| `options.content_type` | string | Content type obrigatorio para upload |
| `options.content_length` | integer | Tamanho maximo de upload em bytes |

**Retorna:** `string, error`

## Métodos de Storage

| Método | Retorna | Descrição |
|--------|---------|-----------|
| `upload_object(key, content)` | `boolean, error` | Upload de string ou conteudo de arquivo |
| `download_object(key, writer, opts?)` | `boolean, error` | Download para file writer |
| `list_objects(opts?)` | `table, error` | Listar objetos com filtro de prefixo |
| `delete_objects(keys)` | `boolean, error` | Deletar multiplos objetos |
| `presigned_get_url(key, opts?)` | `string, error` | Gerar URL temporaria de download |
| `presigned_put_url(key, opts?)` | `string, error` | Gerar URL temporaria de upload |
| `release()` | `boolean` | Liberar recurso de storage |

## Permissões

Operações de cloud storage estao sujeitas a avaliação de política de segurança.

| Ação | Recurso | Descrição |
|------|---------|-----------|
| `cloudstorage.get` | ID do Storage | Adquirir um recurso de storage |

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| ID de recurso vazio | `errors.INVALID` | não |
| Recurso não encontrado | `errors.NOT_FOUND` | não |
| Não e recurso cloud storage | `errors.INVALID` | não |
| Storage liberado | `errors.INVALID` | não |
| Chave vazia | `errors.INVALID` | não |
| Conteudo nil | `errors.INVALID` | não |
| Writer não valido | `errors.INVALID` | não |
| Objeto não encontrado | `errors.NOT_FOUND` | não |
| Permissão negada | `errors.PERMISSION_DENIED` | não |
| Operação falhou | `errors.INTERNAL` | não |

Veja [Error Handling](lua-errors.md) para trabalhar com erros.
