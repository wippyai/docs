---
title: "Filesystem"
description: "Leia, grave e gerencie arquivos em um volume de filesystem configurado."
---

# Filesystem
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

O módulo `fs` lê, grava e gerencia arquivos em volumes de filesystem configurados.

Esta página é uma referência de API. Os exemplos pressupõem um volume configurado e permissão para adquiri-lo. Cada bloco é uma operação isolada ou receita parcial; valores e callbacks da aplicação, como `config`, `message`, `process` e `report_cleanup_error`, já devem existir. `report_cleanup_error(err)` registra uma falha de fechamento sem substituir um erro anterior da operação.

Para configurar o filesystem, veja [Filesystem](../../system/filesystem.md).

## Carregamento

```lua
local fs = require("fs")
```

## Adquirindo um Volume

Obter um volume de filesystem por ID do registro:

```lua
local vol, err = fs.get("app:storage")
if err then
    return nil, err
end

local content, read_err = vol:readfile("/config.json")
if read_err then return nil, read_err end
return content
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `name` | string | ID do volume no registro |

**Retorna:** `FS, error`

<note>
Volumes não requerem liberação explicita. Sao gerenciados no nivel do sistema e se tornam indisponíveis se o filesystem for desanexado do registro.
</note>

## Lendo Arquivos

Ler conteudo completo do arquivo:

```lua
local json = require("json")

local vol, get_err = fs.get("app:config")
if get_err then return nil, get_err end

local data, err = vol:readfile("/settings.json")
if err then
    return nil, err
end

local config, decode_err = json.decode(data)
if decode_err then return nil, decode_err end
return config
```

Para arquivos grandes, use streaming com `open()`:

```lua
local errors = require("errors")

local file, err = vol:open("/data/large.csv", "r")
if err then
    return nil, err
end

while true do
    local chunk, err = file:read(65536)
    if err then
        if err:kind() == errors.NOT_FOUND then
            break -- EOF
        end
        local _, close_err = file:close()
        if close_err then report_cleanup_error(close_err) end
        return nil, err
    end
    process(chunk)
end

local _, close_err = file:close()
if close_err then return nil, close_err end
```

## Escrevendo Arquivos

Escrever dados em um arquivo:

```lua
local json = require("json")

local vol, get_err = fs.get("app:data")
if get_err then return nil, get_err end

-- Overwrite (default)
local encoded, encode_err = json.encode(config)
if encode_err then return nil, encode_err end
local _, write_err = vol:writefile("/config.json", encoded)
if write_err then return nil, write_err end

-- Append
local _, append_err = vol:writefile("/logs/app.log", message .. "\n", "a")
if append_err then return nil, append_err end

-- Exclusive write (fails if exists)
local ok, err = vol:writefile("/lock.pid", tostring(pid), "wx")
if err then return nil, err end

-- Copy from an open file or another reader-backed value
local source, err = vol:open("/incoming/report.csv", "r")
if err then
    return nil, err
end
local copied, err = vol:writefile("/archive/report.csv", source)
local _, close_err = source:close()
if err then
    if close_err then report_cleanup_error(close_err) end
    return nil, err
end
if close_err then return nil, close_err end
return copied
```

| Modo | Descrição |
|------|-----------|
| `"w"` | Sobrescrever (padrão) |
| `"a"` | Anexar |
| `"wx"` | Escrita exclusiva (falha se arquivo existe) |

Para escritas em streaming:

```lua
local file, open_err = vol:open("/output/report.txt", "w")
if open_err then return nil, open_err end
local _, header_err = file:write("Header\n")
if header_err then
    local _, close_err = file:close()
    if close_err then report_cleanup_error(close_err) end
    return nil, header_err
end
local _, data_err = file:write("Data: " .. value .. "\n")
if data_err then
    local _, close_err = file:close()
    if close_err then report_cleanup_error(close_err) end
    return nil, data_err
end
local _, sync_err = file:sync()
if sync_err then
    local _, close_err = file:close()
    if close_err then report_cleanup_error(close_err) end
    return nil, sync_err
end
local _, close_err = file:close()
if close_err then return nil, close_err end
```

## Verificando Caminhos

```lua
local vol, get_err = fs.get("app:data")
if get_err then return nil, get_err end

-- Check existence
local exists, exists_err = vol:exists("/cache/results.json")
if exists_err then return nil, exists_err end
if exists then
    return vol:readfile("/cache/results.json")
end

-- Check if directory
local is_dir, isdir_err = vol:isdir(path)
if isdir_err then return nil, isdir_err end
if is_dir then
    process_directory(path)
end

-- Get file info
local info, stat_err = vol:stat("/documents/report.pdf")
if stat_err then return nil, stat_err end
print(info.size, info.modified, info.type)
```

**Campos de stat:** `name`, `size`, `mode`, `modified`, `is_dir`, `type`

## Operações de Diretorio

`mkdir` cria um único diretório e não cria pais ausentes. `remove` aceita apenas arquivos e diretórios vazios.

```lua
local vol, get_err = fs.get("app:data")
if get_err then return nil, get_err end

-- Create directory
local _, mkdir_err = vol:mkdir("/uploads/" .. user_id)
if mkdir_err then return nil, mkdir_err end

-- List directory contents
local iter, state = vol:readdir("/documents")
if not iter then return nil, state end
for entry in iter, state do
    print(entry.name, entry.type)
end

-- Remove file or empty directory
local removed, remove_err = vol:remove("/temp/file.txt")
if remove_err then return nil, remove_err end
return removed
```

Campos de entrada: `name`, `type` ("file" ou "directory")

## Métodos de File Handle

Ao usar `vol:open()` para streaming:

| Método | Descrição |
|--------|-----------|
| `read(size?)` | Ler bytes (padrão: 4096) |
| `write(data)` | Escrever dados string |
| `seek(whence, offset)` | Definir posicao ("set", "cur", "end") |
| `stat()` | Obter info do arquivo (mesmos campos de `vol:stat`) |
| `sync()` | Flush para armazenamento |
| `close()` | Liberar file handle |
| `scanner(split?)` | Criar scanner de linha/palavra |

Sempre chame `close()` ao terminar com um file handle.

## Scanner

`scanner:scan()` retorna somente um booleano. Quando retornar `false`, chame `scanner:err()` para distinguir EOF limpo de falha de tokenização ou leitura. `scanner:err()` retorna um erro estruturado `INTERNAL` ou `nil`.

Para processamento linha por linha:

```lua
local file, err = vol:open("/data/users.csv", "r")
if err then
    return nil, err
end
local scanner, err = file:scanner("lines")
if err then
    local _, close_err = file:close()
    if close_err then report_cleanup_error(close_err) end
    return nil, err
end

scanner:scan()  -- skip header

while scanner:scan() do
    local line = scanner:text()
    process(line)
end

local scan_err = scanner:err()
if scan_err then
    local _, close_err = file:close()
    if close_err then report_cleanup_error(close_err) end
    return nil, scan_err
end

local _, close_err = file:close()
if close_err then return nil, close_err end
```

Modos de split: `"lines"` (padrão), `"words"`, `"bytes"`, `"runes"`

## Constantes

```lua
fs.type.FILE      -- "file"
fs.type.DIR       -- "directory"

fs.seek.SET       -- from start
fs.seek.CUR       -- from current
fs.seek.END       -- from end
```

## Métodos FS

| Método | Retorna | Descrição |
|--------|---------|-----------|
| `readfile(path)` / `read_file(path)` | `string, error` | Ler arquivo inteiro |
| `writefile(path, data, mode?)` / `write_file(path, data, mode?)` | `boolean, error` | Escrever arquivo |
| `exists(path)` | `boolean, error` | Verificar se caminho existe |
| `stat(path)` | `table, error` | Obter info do arquivo |
| `isdir(path)` | `boolean, error` | Verificar se e diretorio |
| `mkdir(path)` | `boolean, error` | Criar diretorio |
| `remove(path)` | `boolean, error` | Remover arquivo/diretorio vazio |
| `readdir(path)` | `iterator, state` | Listar diretório, para uso em loop genérico `for` |
| `open(path, mode)` | `File, error` | Abrir file handle |
| `chdir(path)` | `boolean, error` | Mudar diretorio de trabalho |
| `pwd()` | `string, error` | Obter diretorio de trabalho |

## Permissões

Acesso ao filesystem está sujeito a avaliação de política de segurança.

| Ação | Recurso | Descrição |
|------|---------|-----------|
| `fs.get` | ID do Volume | Adquirir volume de filesystem |

## Erros

`unspecified` significa que `err:retryable()` retorna `nil`; não é equivalente a `false`.

| Condição | Tipo | Retentável |
|----------|------|------------|
| Caminho vazio | `errors.INVALID` | não especificado |
| Caminho contém um byte nulo | `errors.INVALID` | não |
| Modo inválido | `errors.INVALID` | não especificado |
| `scanner()` chamado em um arquivo fechado | `errors.INVALID` | não especificado |
| Leitura, escrita, seek, stat ou sync em arquivo fechado | `errors.INTERNAL` | não |
| `close()` chamado em um arquivo já fechado | sucesso | não aplicável |
| Leitura pelo handle chegou ao EOF | `errors.NOT_FOUND` | não especificado |
| Caminho não encontrado | `errors.NOT_FOUND` | preservado do erro subjacente quando disponível |
| Caminho já existe | `errors.ALREADY_EXISTS` | não especificado |
| Permissão negada | `errors.PERMISSION_DENIED` | não |
| Falha de tokenização ou leitura no scanner | `errors.INTERNAL` | preservado do erro subjacente quando disponível |

Veja [Tratamento de Erros](../core/errors.md) para trabalhar com erros.
