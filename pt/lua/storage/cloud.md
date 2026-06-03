# Cloud Storage
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>
<secondary-label ref="permissions"/>

Acesse armazenamento de objetos compativel com S3. Upload, download, listagem e gerenciamento de arquivos com suporte a URLs pre-assinadas.

Para configuração de armazenamento, veja [Cloud Storage](system/cloudstorage.md).

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
| `options` | table | Metadados opcionais e opções de escrita condicional |

**Retorna:** `boolean, error`

### Opções de Upload

Anexe metadados ou proteja a escrita com uma tabela de opções:

```lua
storage:upload_object("reports/daily.json", body, {
    content_type = "application/json",
    cache_control = "max-age=3600",
    metadata = { owner = "team-a", run_id = "1234" },  -- armazenado como x-amz-meta-*
    only_if_absent = true                              -- falha se a chave já existir
})
```

| Opção | Tipo | Descrição |
|--------|------|-----------|
| `content_type` | string | Tipo MIME |
| `cache_control` | string | Header Cache-Control |
| `content_disposition` | string | Header Content-Disposition |
| `content_encoding` | string | Header Content-Encoding |
| `metadata` | table | Metadados do usuário (chaves/valores string), armazenados como `x-amz-meta-*` |
| `headers` | table | Headers de requisição adicionais (chaves/valores string) |
| `if_match` | string | Escreve somente se o ETag atual do objeto corresponder |
| `if_none_match` | string | Escreve somente se nenhum objeto corresponder ao ETag (`"*"` significa qualquer) |
| `only_if_absent` | boolean | Escreve somente se a chave não existir (alias para `if_none_match = "*"`) |

Uma escrita condicional que falha sua pré-condição retorna um erro `precondition_failed`.

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
| `options.if_match` | string | Baixa somente se o ETag do objeto corresponder |
| `options.if_none_match` | string | Baixa somente se o ETag não corresponder |

**Retorna:** `boolean, error`

Uma pré-condição que falha (`if_match`/`if_none_match`) retorna um erro `precondition_failed`.

## Listando Objetos

Listar objetos com filtragem opcional por prefixo:

```lua
local storage = cloudstorage.get("app.infra:files")

local result, err = storage:list_objects({
    prefix = "reports/2024/",
    max_keys = 100
})

for _, obj in ipairs(result.objects) do
    print(obj.key, obj.size, obj.etag)
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
| `options.include_owner` | boolean | Inclui o `owner` de cada objeto (`id`, `display_name`) |
| `options.include_versions` | boolean | Lista versões dos objetos; cada item inclui `version_id` |

**Retorna:** `table, error`

Resultado contem `objects`, `is_truncated`, `next_continuation_token`. Cada objeto tem `key`, `size`, `etag`, `storage_class` e, opcionalmente, `last_modified`, `version_id` e `owner`.

<note>
Em resultados de listagem o <code>content_type</code> é sempre vazio — operações de listagem do S3 não o retornam. Use <code>head_object</code> para ler o tipo de conteúdo e os metadados de um objeto.
</note>

## Metadados do Objeto

Obtenha os metadados de um único objeto sem baixar seu corpo:

```lua
local storage = cloudstorage.get("app.infra:files")

local meta, err = storage:head_object("reports/daily.json")
if err then
    return nil, err
end

print(meta.size, meta.etag, meta.content_type)
for k, v in pairs(meta.metadata) do
    print("meta", k, v)
end

storage:release()
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `key` | string | Chave do objeto |

**Retorna:** `table, error`

Campos do resultado:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `size` | integer | Tamanho do objeto em bytes |
| `etag` | string | Entity tag |
| `content_type` | string | Tipo MIME |
| `cache_control` | string | Header Cache-Control |
| `content_disposition` | string | Header Content-Disposition |
| `content_encoding` | string | Header Content-Encoding |
| `storage_class` | string | Classe de armazenamento |
| `version_id` | string | ID da versão (presente quando o versionamento está habilitado) |
| `last_modified` | integer | Horário da última modificação (segundos Unix) |
| `metadata` | table | Metadados do usuário (`x-amz-meta-*`) |
| `headers` | table | Headers brutos da resposta (chaves em minúsculas) |

Um objeto inexistente retorna um erro `not_found`.

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
| `upload_object(key, content, opts?)` | `boolean, error` | Upload de string ou conteudo de arquivo |
| `download_object(key, writer, opts?)` | `boolean, error` | Download para file writer |
| `head_object(key)` | `table, error` | Obter metadados do objeto |
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
| Pré-condição condicional falhou | `errors.CONFLICT` | não |
| Permissão negada | `errors.PERMISSION_DENIED` | não |
| Operação falhou | `errors.INTERNAL` | não |

Veja [Error Handling](lua/core/errors.md) para trabalhar com erros.
