---
title: "Archives"
description: "Leia, percorra, extraia e crie archives ZIP, TAR, TAR compactados com gzip e TAR compactados com Zstandard."
---

# Archives
<secondary-label ref="function"/>
<secondary-label ref="io"/>
<secondary-label ref="encoding"/>

O módulo `archive` lê e grava archives das famílias ZIP e TAR por meio de leitores de acesso aleatório, streams sequenciais e destinos de sistema de arquivos.

Esta é uma referência de API com receitas parciais de I/O. As operações de streaming limitam os buffers de cópia por entry, mas metadados, estado do codec, fontes de bytes brutos e resultados de `read()` ainda consomem memória. Para archives grandes de acesso aleatório, use arquivos com seek ou leitores por intervalo; para entrada somente para frente, use `scan()`; e defina limites explícitos adequados à aplicação.

## Carregamento

```lua
local archive = require("archive")
```

Adicione `archive` à lista `modules:` do entry executável antes de importá-lo. Receitas que usam sistemas de arquivos, leitores de cloud ou streams HTTP também exigem essas capacidades e suas políticas de segurança.

## Formatos

O módulo detecta os formatos nativos pelos magic bytes ou usa o formato informado em `opts.format`.

| Formato | Leitura aleatória | Varredura sequencial | Escrita |
|--------|:-----------:|:---------------:|:-----:|
| `zip` | sim | sim (headers locais) | sim |
| `tar` | sim | sim | sim |
| `tar.gz` | não | sim | sim |
| `tar.zst` | não | sim | sim |

`archive.formats()` retorna a lista de nomes de formatos registrados.

```lua
local names = archive.formats()  -- {"zip", "tar", "tar.gz", "tar.zst", ...}
```

## Opções

Cada ponto de entrada aceita uma tabela `opts` opcional:

| Chave | Padrão | Significado |
|-----|---------|---------|
| `format` | auto | `"zip"`, `"tar"`, `"tar.gz"`, `"tar.zst"`; auto = detecta magic bytes, senão usa a extensão |
| `max_entries` | 100000 | Rejeita archives com mais entries (defesa contra bomba de descompressão) |
| `max_total_bytes` | 2 GiB | Limite acumulado da saída descompactada de `extract_all()` |
| `max_file_bytes` | 1 GiB | Limite do tamanho descompactado de um único entry |
| `max_inline_bytes` | 16 MiB | Limite rígido da chamada `read()`, que materializa em RAM; acima disso, use `stream()`/`extract()` |
| `buffer_bytes` | 64 KiB | Buffer de cópia dos caminhos de streaming extract/add; não limita a alocação de `read()` |

`max_file_bytes` limita cada entry, enquanto `max_total_bytes` é aplicado somente por `extract_all()` do reader e do walker. Aplicações que usam `read()`, `stream()`, `extract()` para um entry ou uma caminhada manual precisam impor seu próprio orçamento acumulado. `max_inline_bytes` limita os dados do entry materializados por `read()`; `buffer_bytes` não. Esses limites não incluem todas as alocações de metadados e codecs.

## Leitura — acesso aleatório

`archive.open(source, ...)` abre uma fonte **com seek** para acesso aleatório completo (o diretório central ZIP é lido de início; os entries são descompactados sob demanda). A fonte pode ser um handle `fs.FS` com um caminho, um `fs.File` aberto, um leitor de cloud storage ou bytes brutos (os bytes mantêm o archive inteiro em RAM — apenas archives pequenos).

```lua
local fs = require("fs")
local archive = require("archive")

-- Open by fs handle + path (the module opens the file and owns its lifecycle)
local uploads, fs_err = fs.get("app:uploads")
if fs_err then return nil, fs_err end
local r, err = archive.open(uploads, "incoming.zip")
if err then return nil, err end
-- Or from an already-open seekable fs.File
-- local r, err = archive.open(open_file)
-- Or from raw bytes (small archives only)
-- local r, err = archive.open(zip_bytes, { format = "zip" })
```

Para um archive grande em cloud storage, passe o leitor por intervalo retornado por `open_reader`:

```lua
local cloudstorage = require("cloudstorage")

local storage, storage_err = cloudstorage.get("app.infra:files")
if storage_err then return nil, storage_err end
local source, source_err = storage:open_reader("uploads/large.zip")
if source_err then
    storage:release()
    return nil, source_err
end
local r, archive_err = archive.open(source)
if archive_err then
    source:close()
    storage:release()
    return nil, archive_err
end

-- Read archive entries here.

local _, reader_close_err = r:close()
local _, source_close_err = source:close()
storage:release()
if reader_close_err then return nil, reader_close_err end
if source_close_err then return nil, source_close_err end
```

O archive reader é proprietário de um arquivo que ele abre a partir de um handle `fs.FS` e de um caminho. Ele não é proprietário de um `fs.File` ou leitor por intervalo fornecido externamente; feche primeiro o archive reader e depois os inputs e handles pertencentes ao chamador.

**Retorna:** `Reader, error`

**Permissão:** `archive.read`

### `entries`

Percorra os metadados dos entries sem descompactar seu conteúdo:

```lua
for e in r:entries() do
    -- e: name, size, compressed_size, is_dir, mode, modified, method, crc32, type
    print(e.name, e.size, e.is_dir)
end
```

### `stat`

Leia os metadados de um entry pelo nome sem descompactar seu conteúdo:

```lua
local info, err = r:stat("docs/readme.md")
if err then return nil, err end
```

### `read`

Materialize um único entry como string Lua. Acima de `max_inline_bytes`, retorna erro (`kind = Invalid`); para qualquer conteúdo grande, use `stream()` ou `extract()`:

```lua
local data, err = r:read("docs/readme.md")  -- small entries only
if err then return nil, err end
```

### `stream`

Retorne um entry como `stream.Stream` descompactado sob demanda. O resultado pode ser percorrido, passado a `fs:writefile()` ou entregue a outro consumidor de stream:

```lua
local es, err = r:stream("big.csv")
if err then return nil, err end
while true do
    local chunk, read_err = es:read(65536)
    if read_err then
        es:close()
        return nil, read_err
    end
    if not chunk then break end
    process(chunk)
end
local _, close_err = es:close()
if close_err then return nil, close_err end
```

### `extract`

Transmita um entry para um sistema de arquivos de destino:

```lua
local out, fs_err = fs.get("app:out")
if fs_err then return nil, fs_err end
local ok, err = r:extract("docs/readme.md", out)
if err then return nil, err end
-- optional destination path:
-- r:extract("docs/readme.md", out, "readme.md")
```

### `extract_all`

Transmita todos os entries para um sistema de arquivos de destino:

```lua
local out, fs_err = fs.get("app:out")
if fs_err then return nil, fs_err end
local count, err = r:extract_all(out, {
    prefix = "job123/",          -- prepend to each destination path
    strip  = 1,                  -- drop N leading path components
    filter = function(e) return not e.is_dir end,
})
if err then return nil, err end
```

Resolva o sistema de arquivos de destino separadamente no código da aplicação para poder tratar erros de `fs.get`. Em `extract` de um único entry, nomes de destino inseguros retornam erro. `extract_all` ignora entries cujo caminho resultante contenha `..`, seja absoluto ou tenha prefixo de drive ou UNC do Windows.

### `close`

Feche o reader. A operação é idempotente, e o reader também é fechado automaticamente no escopo da task.

```lua
local ok, err = r:close()
if err then return nil, err end
```

## Leitura — varredura sequencial

`archive.scan(source, opts?)` abre uma fonte **somente para frente**, como o body de um upload HTTP ou um stream de arquivo multipart. Os entries são visitados na ordem do archive, e cada reader de entry permanece válido somente até a caminhada avançar. O acesso aleatório `read(name)` não está disponível.

```lua
local up, stream_err = form.files.upload[1]:stream()        -- stream.Stream
if stream_err then return nil, stream_err end
local s, err = archive.scan(up, { format = "zip" })
if err then
    up:close()
    return nil, err
end

local uploads, fs_err = fs.get("app:uploads")
if fs_err then
    s:close()
    up:close()
    return nil, fs_err
end

local count, extract_err = s:extract_all(uploads, {prefix = "job123/"})
if extract_err then
    s:close()
    up:close()
    return nil, extract_err
end
local _, close_err = s:close()
local _, upload_close_err = up:close()
if close_err then return nil, close_err end
if upload_close_err then return nil, upload_close_err end
```

**Retorna:** `Walker, error`

**Permissão:** `archive.read`

`extract_all` aplica a mesma higienização de caminho de destino e o limite de tamanho total descritos acima. Quando uma aplicação avança `s:walk()` diretamente, erros do iterador são lançados como erros Lua e cada stream de entry permanece válido somente até a próxima iteração. A limpeza no escopo da task ainda libera o walker e seu stream atual; feche explicitamente os streams de input pertencentes ao chamador quando o controle continuar na aplicação.

`tar`, `tar.gz` e `tar.zst` operam por streaming nativo. `zip` é analisado por headers locais de entry; entries gravados com um data descriptor de streaming (tamanho/CRC após os dados) são lidos pela descompactação até o limite do entry. Para tratar de modo robusto uploads ZIP grandes, primeiro grave o upload como arquivo (uma cópia sequencial limitada) e depois use `archive.open`:

```lua
local uuid = require("uuid")

local dst, fs_err = fs.get("app:tmp")
if fs_err then return nil, fs_err end
local upload, stream_err = req:stream()
if stream_err then return nil, stream_err end
local stage_id, id_err = uuid.v7()
if id_err then
    upload:close()
    return nil, id_err
end
local stage_path = stage_id .. ".zip"
local copied, copy_err = dst:writefile(stage_path, upload, "wx")
local _, upload_close_err = upload:close()
if copy_err or upload_close_err then
    dst:remove(stage_path)
    return nil, copy_err or upload_close_err
end
local r, open_err = archive.open(dst, stage_path)   -- robust random access
if open_err then
    dst:remove(stage_path)
    return nil, open_err
end

-- Replace this operation with the random-access work the handler needs.
local info, operation_err = r:stat("manifest.json")
local _, close_err = r:close()
local removed, remove_err = dst:remove(stage_path)
if operation_err then return nil, operation_err end
if close_err then return nil, close_err end
if remove_err then return nil, remove_err end
return info
```

Cada requisição gera um nome imprevisível para o arquivo temporário e o cria de forma exclusiva, evitando que handlers concorrentes trunquem os arquivos uns dos outros. O erro principal de cópia, fechamento do upload, abertura ou operação no archive é retornado depois da tentativa de remover o arquivo temporário. Handlers de produção podem registrar separadamente uma falha de limpeza quando já existe um erro principal. Adicione `uuid` à allowlist de módulos do entry executável para esta receita.

## Escrita

`archive.create(dest, ...)` transmite entries para um caminho de sistema de arquivos, arquivo gravável aberto ou `stream.Stream` gravável.

```lua
local tmp, fs_err = fs.get("app:tmp")
if fs_err then return nil, fs_err end
local w, err = archive.create(tmp, "out.zip", { format = "zip" })
if err then return nil, err end
```

**Retorna:** `Writer, error`

**Permissão:** `archive.write`

### `add`

Adicione um entry a partir de uma string Lua contendo texto ou bytes, um `fs.File` aberto ou um `stream.Stream`:

```lua
local ok, err = w:add("notes.txt", "hello")
if err then return nil, err end
local added, add_err = w:add("from_upload", some_stream, { method = "deflate", mode = 420 }) -- 0644
if add_err then return nil, add_err end
```

### `add_file`

Transmita um entry a partir de um arquivo em um sistema de arquivos:

```lua
local data_fs, fs_err = fs.get("app:data")
if fs_err then return nil, fs_err end
local ok, err = w:add_file("data/big.bin", data_fs, "big.bin")
if err then return nil, err end
```

### `add_dir`

Adicione um entry de diretório:

```lua
local ok, err = w:add_dir("empty/")
if err then return nil, err end
```

### `close`

Finalize o archive, inclusive o diretório central ZIP. A operação é idempotente, e o writer também é fechado automaticamente no escopo da task.

```lua
local ok, err = w:close()
if err then return nil, err end
```

As opções de `add` são `{method = "store"|"deflate", mode, size}`. `size` é obrigatório ao adicionar um stream a um archive da família TAR; strings e `add_file` fornecem o tamanho automaticamente. `add_file` aceita `method` e `mode`, e `add_dir` não recebe opções. O writer ZIP usa data descriptors quando o destino é um stream gravável sem seek.

Literais numéricos Lua são decimais; use `420` para os bits de permissão Unix normalmente escritos como octal `0644`.

O writer não fecha um arquivo ou stream fornecido externamente e usado como fonte de entry ou destino do archive. Feche os recursos pertencentes ao chamador após `w:close()`.

## Erros

| Condição | Tipo |
|-----------|------|
| Formato desconhecido ou incompatível | `errors.INVALID` |
| Archive corrompido ou truncado informado pelo wrapper Lua atual | `errors.INTERNAL` |
| Limite de `read()` inline ou total de `extract_all` excedido | `errors.INVALID` |
| Limite de entry/archive exposto ao abrir ou ler pelo wrapper Lua atual | `errors.INTERNAL` |
| Acesso aleatório em formato somente de stream (use `scan`) | `errors.UNAVAILABLE` |
| Nome de entry não encontrado | `errors.NOT_FOUND` |
| Política de archive negada | `errors.PERMISSION_DENIED` |
| Falha de I/O da origem ou destino | `errors.INTERNAL` |
| Leitura de entry transmitido obsoleto depois que a caminhada avançou | `errors.INTERNAL` |

Consulte [Tratamento de erros](../core/errors.md) para trabalhar com erros.

## Consulte também

- [Sistema de arquivos](../storage/filesystem.md) — sistemas de arquivos de origem e destino
- [Cloud storage](../storage/cloud.md) — leitores por intervalo para archives hospedados em cloud
- [Stream](../core/stream.md) — objetos de stream entregues e recebidos por archives
- [Compactação](./compress.md) — gzip/deflate/zstd em memória
