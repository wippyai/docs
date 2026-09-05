---
title: "Archive"
description: "Leia e escreva arquivos zip/tar com memória limitada. Os arquivos nunca são carregados em RAM nem extraídos para disco — o pico de memória independe…"
---

# Archive
<secondary-label ref="function"/>
<secondary-label ref="io"/>
<secondary-label ref="encoding"/>

Leia e escreva arquivos zip/tar com memória limitada. Os arquivos nunca são carregados em RAM nem extraídos para disco — o pico de memória independe do tamanho do arquivo e das entradas, então arquivos de vários GB rodam em um servidor com pouca RAM.

## Carregamento

```lua
local archive = require("archive")
```

## Formatos

Os formatos integrados são detectados por magic bytes, ou forçados com `opts.format`:

| Formato | Leitura aleatória | Varredura sequencial | Escrita |
|--------|:-----------:|:---------------:|:-----:|
| `zip` | sim | sim (cabeçalhos locais) | sim |
| `tar` | sim | sim | sim |
| `tar.gz` | não | sim | sim |
| `tar.zst` | não | sim | sim |

`archive.formats()` retorna a lista de nomes de formatos registrados.

```lua
local names = archive.formats()  -- {"zip", "tar", "tar.gz", "tar.zst", ...}
```

## Opções

Todos os pontos de entrada aceitam uma tabela `opts` opcional:

| Chave | Padrão | Significado |
|-----|---------|---------|
| `format` | auto | `"zip"`, `"tar"`, `"tar.gz"`, `"tar.zst"`; auto = detecta magic bytes, senão a extensão |
| `max_entries` | 100000 | Rejeita arquivos com mais entradas (defesa contra bomba de descompressão) |
| `max_total_bytes` | 2 GiB | Limite da saída descomprimida acumulada durante leitura/extração |
| `max_file_bytes` | 1 GiB | Limite do tamanho descomprimido de uma única entrada |
| `max_inline_bytes` | 16 MiB | Limite rígido para a chamada `read()`, que materializa em RAM; acima dele, use `stream()`/`extract()` |
| `buffer_bytes` | 64 KiB | Buffer de cópia por streaming para leitura/extração/adição |

`max_total_bytes`/`max_file_bytes` são limites de trabalho, não limites de RAM — fazer streaming de uma entrada nunca retém mais que `buffer_bytes` mais a janela de descompressão do codec. O único ajuste que dimensiona a RAM é `max_inline_bytes`.

## Leitura — Acesso Aleatório

`archive.open(source, ...)` abre uma fonte **seekable** para acesso aleatório completo (o diretório central do zip é lido antecipadamente; as entradas são descomprimidas sob demanda). A fonte pode ser um handle `fs.FS` mais um caminho, um `fs.File` aberto, bytes brutos (bytes mantêm o arquivo inteiro em RAM — apenas arquivos pequenos), ou qualquer leitor de acesso aleatório entregue por outro módulo.

Um leitor de outro módulo se qualifica quando implementa `io.ReaderAt` e informa seu `Size`; um `Name` opcional é usado para detecção pela extensão quando `opts.format` é omitido. O `open_reader` de [`cloudstorage`](lua/storage/cloud.md) é um deles, e lê um arquivo de vários GB diretamente do armazenamento de objetos. Nesse caso o archive não abre nada e nunca fecha o leitor — quem o fecha é seu dono.

```lua
local fs = require("fs")
local archive = require("archive")

-- Abre por handle de fs + caminho (o módulo abre o arquivo e é dono do seu ciclo de vida)
local r, err = archive.open(fs.get("app:uploads"), "incoming.zip")
-- Ou a partir de um fs.File seekable já aberto
-- local r = archive.open(fs:get("app:uploads"):open("x.zip"))
-- Ou a partir de bytes brutos (apenas arquivos pequenos)
-- local r = archive.open(zip_bytes, { format = "zip" })
-- Ou a partir de um leitor de acesso aleatório pertencente a outro módulo
-- local reader = cloudstorage.get("app:files"):open_reader("incoming.zip")
-- local r = archive.open(reader)
```

**Retorna:** `Reader, error`

**Permissão:** `archive.read`

### entries

Itera o diretório (apenas metadados — sem descompressão):

```lua
for e in r:entries() do
    -- e: name, size, compressed_size, is_dir, mode, modified, method, crc32, type
    print(e.name, e.size, e.is_dir)
end
```

### stat

Obtém os metadados de uma entrada pelo nome (sem descompressão):

```lua
local info, err = r:stat("docs/readme.md")
```

### read

Materializa uma única entrada como uma string Lua. Falha (`kind = Invalid`) acima de `max_inline_bytes` — para qualquer coisa grande, use `stream()` ou `extract()`:

```lua
local data, err = r:read("docs/readme.md")  -- apenas entradas pequenas
```

### stream

Retorna a entrada como um `stream.Stream` que descomprime sob demanda. Compõe-se em todo lugar em que um stream se compõe — `:scanner()`, `fs:writefile()`, ou entregue a outro módulo:

```lua
local es, err = r:stream("big.csv")
while true do
    local chunk = es:read(65536)
    if not chunk then break end
    process(chunk)
end
es:close()
```

### extract

Faz streaming de uma entrada para um sistema de arquivos de destino:

```lua
local ok, err = r:extract("docs/readme.md", fs.get("app:out"))
-- caminho de destino opcional:
-- r:extract("docs/readme.md", fs.get("app:out"), "readme.md")
```

### extract_all

Faz streaming de cada entrada para um sistema de arquivos de destino:

```lua
local count, err = r:extract_all(fs.get("app:out"), {
    prefix = "job123/",          -- prefixa cada caminho de destino
    strip  = 1,                  -- descarta N componentes iniciais do caminho
    filter = function(e) return not e.is_dir end,
})
```

Os nomes das entradas são sanitizados na extração — segmentos `..`, caminhos absolutos e prefixos de unidade/UNC do Windows são rejeitados (defesa contra zip-slip).

### close

Fecha o leitor. Idempotente; também fechado automaticamente no escopo da task.

```lua
r:close()
```

## Leitura — Varredura Sequencial

`archive.scan(source, opts?)` abre um stream **somente para frente** (um corpo de upload HTTP, um stream de arquivo multipart). As entradas são visitadas na ordem do arquivo; o leitor de cada entrada é válido apenas até você avançar. Não há `read(name)` aleatório.

```lua
local up = form.files.upload[1]:stream()        -- stream.Stream
local s, err = archive.scan(up, { format = "zip" })

for e, entry in s:walk() do                      -- entry é um stream.Stream
    if not e.is_dir then
        fs.get("app:uploads"):writefile("job123/" .. e.name, entry)
    end
end
s:close()
```

**Retorna:** `Walker, error`

**Permissão:** `archive.read`

Um walker também suporta `extract_all` com as mesmas opções do leitor de acesso aleatório, transmitindo cada entrada para um filesystem de destino em uma única chamada:

```lua
local count, err = s:extract_all(fs.get("app:uploads"), { prefix = "job123/" })
```

`tar`, `tar.gz` e `tar.zst` fazem streaming nativamente. `zip` é analisado via cabeçalhos locais por entrada; entradas escritas com um data descriptor de streaming (tamanho/CRC após os dados) são lidas descomprimindo até o limite da entrada. Para um tratamento robusto de zip em uploads grandes, grave o upload como arquivo primeiro (uma cópia sequencial limitada) e então use `archive.open`:

```lua
local dst = fs.get("app:tmp")
dst:writefile("u.zip", req:stream())   -- cópia por streaming do upload → arquivo no fs
local r = archive.open(dst, "u.zip")   -- acesso aleatório robusto
-- ... entries / extract_all ...
r:close()
dst:remove("u.zip")
```

## Escrita

`archive.create(dest, ...)` constrói um arquivo fazendo streaming das entradas para um destino — um arquivo em um fs (com um caminho) ou um `stream.Stream` gravável (por exemplo, uma resposta HTTP), de modo que um `.zip` de download é gerado direto para a rede com memória limitada.

```lua
local w, err = archive.create(fs.get("app:tmp"), "out.zip", { format = "zip" })
-- ou faça streaming para uma resposta:
-- local w = archive.create(res:stream(), { format = "zip" })
```

**Retorna:** `Writer, error`

**Permissão:** `archive.write`

### add

Adiciona uma entrada a partir de uma string, bytes, leitor ou `stream.Stream`:

```lua
w:add("notes.txt", "hello")
w:add("from_upload", some_stream, { method = "deflate", mode = tonumber("644", 8) })
```

### add_file

Faz streaming de uma entrada a partir de um arquivo em um sistema de arquivos:

```lua
w:add_file("data/big.bin", fs.get("app:data"), "big.bin")
```

### add_dir

Adiciona uma entrada de diretório:

```lua
w:add_dir("empty/")
```

### close

Finaliza o arquivo (escreve o diretório central no caso do zip). Idempotente; também fechado automaticamente no escopo da task.

```lua
w:close()
```

Opções de `add*`: `{ method = "store"|"deflate", mode, size }`. Formatos tar precisam do tamanho da entrada antecipadamente, então `add()` a partir de um stream ou reader para um arquivo `tar*` exige `size` (strings e `add_file` o fornecem). O escritor de zip faz streaming para escritores não-seekable usando data descriptors, então escrever em um stream de resposta funciona.

## Erros

| Condição | Tipo |
|-----------|------|
| A fonte não é um handle de fs, um arquivo de fs, bytes ou um leitor de acesso aleatório | `errors.INVALID` |
| Formato desconhecido / incompatível | `errors.INVALID` |
| Arquivo corrompido ou truncado | `errors.INVALID` |
| Limite excedido (entradas / total / arquivo / inline) | `errors.INVALID` |
| Acesso aleatório em um formato somente de stream (use `scan`) | `errors.UNAVAILABLE` |
| Nome de entrada não encontrado | `errors.NOT_FOUND` |
| Fonte não legível / destino não gravável | `errors.PERMISSION_DENIED` |
| Leitura de uma entrada de stream obsoleta depois que a varredura avançou | `errors.INTERNAL` |

Veja [Error Handling](lua/core/errors.md) para trabalhar com erros.

## Veja Também

- [Filesystem](lua/storage/filesystem.md) - Sistemas de arquivos de origem e destino
- [Stream](lua/core/stream.md) - Objetos de stream entregues a e recebidos de arquivos
- [Compressão](lua/data/compress.md) - gzip/deflate/zstd em memória
- [Cloud Storage](lua/storage/cloud.md) - `open_reader` como fonte de arquivo com acesso aleatório
