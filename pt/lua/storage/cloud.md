---
title: "Cloud Storage"
description: "Faça upload, download, listagem e gerenciamento de objetos em armazenamento compatível com S3."
---

# Cloud Storage
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="external"/>
<secondary-label ref="permissions"/>

O módulo `cloudstorage` faz upload, download, listagem e gerenciamento de objetos em armazenamento compatível com S3. Ele também cria URLs pré-assinadas para acesso direto.

Esta página é uma referência de API. Seus trechos pressupõem uma entrada de storage configurada, acesso a qualquer volume de filesystem mencionado e as permissões listadas abaixo. Os blocos de multipart e URLs pré-assinadas são receitas parciais de integração do cliente; a aplicação deve executar as transferências HTTP e fornecer os ETags retornados. Quando uma operação e a limpeza do recurso podem falhar, a aplicação fornece `report_cleanup_error(err)` para registrar a falha de limpeza sem substituir o erro inicial.

Para configurar o armazenamento, veja [Cloud Storage](../../system/cloudstorage.md).

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

local uploaded, upload_err = storage:upload_object("data/file.txt", "content")
storage:release()
if upload_err then return nil, upload_err end
return uploaded
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | string | ID do recurso de armazenamento |

**Retorna:** `Storage, error`

## Fazendo Upload de Objetos

Upload de conteudo de string ou arquivo:

```lua
local json = require("json")

local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end

-- Upload string content
local body, encode_err = json.encode({
    date = "2024-01-15",
    total = 1234
})
if encode_err then
    storage:release()
    return nil, encode_err
end
local ok, err = storage:upload_object("reports/daily.json", body)
if err then
    storage:release()
    return nil, err
end

-- Upload from file
local fs = require("fs")
local vol, fs_err = fs.get("app:data")
if fs_err then
    storage:release()
    return nil, fs_err
end
local file, open_err = vol:open("/large-file.bin", "r")
if open_err then
    storage:release()
    return nil, open_err
end

local uploaded, file_upload_err = storage:upload_object("backups/large-file.bin", file)
local _, close_err = file:close()

storage:release()
if file_upload_err then
    if close_err then report_cleanup_error(close_err) end
    return nil, file_upload_err
end
if close_err then return nil, close_err end
return uploaded
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
local uploaded, err = storage:upload_object("reports/daily.json", body, {
    content_type = "application/json",
    cache_control = "max-age=3600",
    metadata = { owner = "team-a", run_id = "1234" },  -- stored as x-amz-meta-*
    only_if_absent = true                              -- fail if the key already exists
})
if err then return nil, err end
return uploaded
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
local fs = require("fs")
local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end
local vol, fs_err = fs.get("app:temp")
if fs_err then
    storage:release()
    return nil, fs_err
end

local file, open_err = vol:open("/downloaded.json", "w")
if open_err then
    storage:release()
    return nil, open_err
end
local ok, err = storage:download_object("reports/daily.json", file)
local _, close_err = file:close()
if err then
    if close_err then report_cleanup_error(close_err) end
    storage:release()
    return nil, err
end
if close_err then
    storage:release()
    return nil, close_err
end

-- Download partial content (first 1KB)
local partial, partial_open_err = vol:open("/partial.bin", "w")
if partial_open_err then
    storage:release()
    return nil, partial_open_err
end
local partial_ok, partial_err = storage:download_object("backups/large-file.bin", partial, {
    range = "bytes=0-1023"
})
local _, partial_close_err = partial:close()

storage:release()
if partial_err then
    if partial_close_err then report_cleanup_error(partial_close_err) end
    return nil, partial_err
end
if partial_close_err then return nil, partial_close_err end
return partial_ok
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
local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end

local result, err = storage:list_objects({
    prefix = "reports/2024/",
    max_keys = 100
})
if err then
    storage:release()
    return nil, err
end

for _, obj in ipairs(result.objects) do
    print(obj.key, obj.size, obj.etag)
end

-- Paginate through large results
local token = nil
repeat
    local page, page_err = storage:list_objects({
        prefix = "logs/",
        max_keys = 1000,
        continuation_token = token
    })
    if page_err then
        storage:release()
        return nil, page_err
    end
    for _, obj in ipairs(page.objects) do
        process(obj)
    end
    token = page.next_continuation_token
    if not page.is_truncated then break end
until false

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
local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end

local meta, err = storage:head_object("reports/daily.json")
if err then
    storage:release()
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
local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end

local deleted, err = storage:delete_objects({
    "temp/file1.txt",
    "temp/file2.txt",
    "temp/file3.txt"
})

storage:release()
if err then return nil, err end
return deleted
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

-- Return URL to client for direct download
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

-- Return URL to client for direct upload
return {upload_url = url}
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `key` | string | Chave do objeto |
| `options.expiration` | integer | Segundos até URL expirar (padrão: 3600) |
| `options.content_type` | string | Content type obrigatorio para upload |
| `options.content_length` | integer | Tamanho exato esperado do upload em bytes |

**Retorna:** `string, error`

## URLs de Upload Multipart

Para uploads grandes feitos pelo cliente, crie um upload multipart, emita URLs pré-assinadas para suas partes e conclua o upload com os ETags retornados pelas requisições das partes. A aplicação fornece `report_cleanup_error(err)` para que uma falha de abort seja observável sem substituir o erro que iniciou a limpeza:

```lua
local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end

local key = "uploads/user-123/video.mp4"
local upload, err = storage:create_multipart_upload(key, {
    content_type = "video/mp4"
})
if err then
    storage:release()
    return nil, err
end

local urls, err = storage:presigned_part_urls(key, upload.upload_id, {
    count = 3,
    expiration = 900
})
if err then
    local _, abort_err = storage:abort_multipart_upload(key, upload.upload_id)
    storage:release()
    if abort_err then
        report_cleanup_error(abort_err)
    end
    return nil, err
end

-- Upload each part to its URL and retain the ETag response header.
local completed, err = storage:complete_multipart_upload(key, upload.upload_id, {
    {part_number = 1, etag = part_1_etag},
    {part_number = 2, etag = part_2_etag},
    {part_number = 3, etag = part_3_etag}
})
if err then
    local _, abort_err = storage:abort_multipart_upload(key, upload.upload_id)
    storage:release()
    if abort_err then
        report_cleanup_error(abort_err)
    end
    return nil, err
end

storage:release()
return completed
```

`presigned_part_urls` aceita exatamente uma das opções `count` ou `parts`. Uma chamada pode retornar no máximo 1.000 URLs, e os números das partes variam de 1 a 10.000. O padrão de `expiration` é 3.600 segundos, e `headers` opcionais são incluídos na assinatura. `create_multipart_upload` aceita `content_type`, `cache_control`, `content_disposition`, `content_encoding`, `metadata` e `headers`. As requisições de conclusão podem listar as partes em qualquer ordem.

| Método | Retorna | Descrição |
|--------|---------|-----------|
| `create_multipart_upload(key, opts?)` | `table, error` | Iniciar um upload e retornar `{upload_id}` |
| `presigned_part_urls(key, upload_id, opts)` | `table[], error` | Retornar registros `{part_number, url}` |
| `complete_multipart_upload(key, upload_id, parts)` | `table, error` | Concluir o upload e retornar seu ETag e versão/localização opcional |
| `abort_multipart_upload(key, upload_id)` | `boolean, error` | Abortar um upload incompleto |

Aborte uploads que não serão concluídos. Regras de ciclo de vida do bucket são uma proteção para uploads abandonados, não substituem a limpeza explícita. Os métodos multipart retornam `errors.UNAVAILABLE` quando o provider configurado não suporta o recurso necessário.

## Reader de Acesso Aleatório

`open_reader` expõe um objeto somente leitura e reposicionável sem baixá-lo por completo. Ele busca ranges quando há cache miss e envia o ETag do momento da abertura como condição `If-Match`. Providers que aplicam a condição retornam `errors.CONFLICT` quando o objeto muda, evitando misturar versões.

```lua
local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end

local reader, err = storage:open_reader("archives/large.zip", {
    block_size = 8 * 1024 * 1024,
    cache_blocks = 4
})
if err then
    storage:release()
    return nil, err
end

print(reader:key(), reader:size())

local _, close_err = reader:close()
storage:release()
if close_err then return nil, close_err end
```

| Opção | Padrão | Intervalo válido |
|-------|--------|------------------|
| `block_size` | 8 MiB | 64 KiB a 128 MiB |
| `cache_blocks` | 4 | 1 a 64 |

O cache (`block_size * cache_blocks`) não pode exceder 256 MiB. Cache misses executam I/O de rede bloqueante e são serializados, portanto o reader se destina a consumidores sequenciais com acesso aleatório, como leitores de arquivos compactados. O provider deve fornecer um ETag; caso contrário, abrir o reader retorna `errors.UNAVAILABLE`. Um provider que fornece ETag mas ignora precondições de leitura por range não pode garantir a detecção de sobrescrita.

| Método do reader | Retorna | Descrição |
|------------------|---------|-----------|
| `size()` | `number` | Tamanho do objeto em bytes |
| `key()` | `string` | Chave do objeto |
| `close()` | `boolean, error` | Fechar o reader; idempotente |

Readers são fechados automaticamente ao fim da tarefa, mas feche-os explicitamente quando o trabalho terminar.

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
| `create_multipart_upload(key, opts?)` | `table, error` | Iniciar um upload multipart |
| `presigned_part_urls(key, upload_id, opts)` | `table[], error` | Gerar URLs de upload multipart |
| `complete_multipart_upload(key, upload_id, parts)` | `table, error` | Concluir um upload multipart |
| `abort_multipart_upload(key, upload_id)` | `boolean, error` | Abortar um upload multipart |
| `open_reader(key, opts?)` | `Reader, error` | Abrir um reader reposicionável por ranges |
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
| Objeto alterado enquanto um reader por ranges estava aberto | `errors.CONFLICT` | não |
| Upload multipart não encontrado | `errors.NOT_FOUND` | não |
| Provider sem suporte a multipart ou reader por ranges | `errors.UNAVAILABLE` | não |
| Permissão negada por `cloudstorage.get` | erro Lua lançado | não se aplica |
| Falha de operação do provider | preservada do provider quando disponível; caso contrário, não especificada | varia |

Veja [Tratamento de Erros](../core/errors.md) para trabalhar com erros.
