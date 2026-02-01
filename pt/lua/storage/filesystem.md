# Filesystem
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="io"/>
<secondary-label ref="permissions"/>

Leia, escreva e gerencie arquivos dentro de volumes de filesystem em sandbox.

Para configuracao de filesystem, veja [Filesystem](system-filesystem.md).

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

local content = vol:readfile("/config.json")
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `name` | string | ID do volume no registro |

**Retorna:** `FS, error`

<note>
Volumes nao requerem liberacao explicita. Sao gerenciados no nivel do sistema e se tornam indisponiveis se o filesystem for desanexado do registro.
</note>

## Lendo Arquivos

Ler conteudo completo do arquivo:

```lua
local vol = fs.get("app:config")

local data, err = vol:readfile("/settings.json")
if err then
    return nil, err
end

local config = json.decode(data)
```

Para arquivos grandes, use streaming com `open()`:

```lua
local file = vol:open("/data/large.csv", "r")

while true do
    local chunk = file:read(65536)
    if not chunk or #chunk == 0 then break end
    process(chunk)
end

file:close()
```

## Escrevendo Arquivos

Escrever dados em um arquivo:

```lua
local vol = fs.get("app:data")

-- Sobrescrever (padrao)
vol:writefile("/config.json", json.encode(config))

-- Anexar
vol:writefile("/logs/app.log", message .. "\n", "a")

-- Escrita exclusiva (falha se existe)
local ok, err = vol:writefile("/lock.pid", tostring(pid), "wx")
```

| Modo | Descricao |
|------|-----------|
| `"w"` | Sobrescrever (padrao) |
| `"a"` | Anexar |
| `"wx"` | Escrita exclusiva (falha se arquivo existe) |

Para escritas em streaming:

```lua
local file = vol:open("/output/report.txt", "w")
file:write("Header\n")
file:write("Data: " .. value .. "\n")
file:sync()
file:close()
```

## Verificando Caminhos

```lua
local vol = fs.get("app:data")

-- Verificar existencia
if vol:exists("/cache/results.json") then
    return vol:readfile("/cache/results.json")
end

-- Verificar se e diretorio
if vol:isdir(path) then
    process_directory(path)
end

-- Obter informacoes do arquivo
local info = vol:stat("/documents/report.pdf")
print(info.size, info.modified, info.type)
```

**Campos de stat:** `name`, `size`, `mode`, `modified`, `is_dir`, `type`

## Operacoes de Diretorio

```lua
local vol = fs.get("app:data")

-- Criar diretorio
vol:mkdir("/uploads/" .. user_id)

-- Listar conteudo do diretorio
for entry in vol:readdir("/documents") do
    print(entry.name, entry.type)
end

-- Remover arquivo ou diretorio vazio
vol:remove("/temp/file.txt")
```

Campos de entrada: `name`, `type` ("file" ou "directory")

## Metodos de File Handle

Ao usar `vol:open()` para streaming:

| Metodo | Descricao |
|--------|-----------|
| `read(size?)` | Ler bytes (padrao: 4096) |
| `write(data)` | Escrever dados string |
| `seek(whence, offset)` | Definir posicao ("set", "cur", "end") |
| `sync()` | Flush para armazenamento |
| `close()` | Liberar file handle |
| `scanner(split?)` | Criar scanner de linha/palavra |

Sempre chame `close()` ao terminar com um file handle.

## Scanner

Para processamento linha por linha:

```lua
local file = vol:open("/data/users.csv", "r")
local scanner = file:scanner("lines")

scanner:scan()  -- pular header

while scanner:scan() do
    local line = scanner:text()
    process(line)
end

file:close()
```

Modos de split: `"lines"` (padrao), `"words"`, `"bytes"`, `"runes"`

## Constantes

```lua
fs.type.FILE      -- "file"
fs.type.DIR       -- "directory"

fs.seek.SET       -- do inicio
fs.seek.CUR       -- do atual
fs.seek.END       -- do fim
```

## Metodos FS

| Metodo | Retorna | Descricao |
|--------|---------|-----------|
| `readfile(path)` | `string, error` | Ler arquivo inteiro |
| `writefile(path, data, mode?)` | `boolean, error` | Escrever arquivo |
| `exists(path)` | `boolean, error` | Verificar se caminho existe |
| `stat(path)` | `table, error` | Obter info do arquivo |
| `isdir(path)` | `boolean, error` | Verificar se e diretorio |
| `mkdir(path)` | `boolean, error` | Criar diretorio |
| `remove(path)` | `boolean, error` | Remover arquivo/diretorio vazio |
| `readdir(path)` | `iterator` | Listar diretorio |
| `open(path, mode)` | `File, error` | Abrir file handle |
| `chdir(path)` | `boolean, error` | Mudar diretorio de trabalho |
| `pwd()` | `string` | Obter diretorio de trabalho |

## Permissoes

Acesso ao filesystem esta sujeito a avaliacao de politica de seguranca.

| Acao | Recurso | Descricao |
|------|---------|-----------|
| `fs.get` | ID do Volume | Adquirir volume de filesystem |

## Erros

| Condicao | Tipo | Retentavel |
|----------|------|------------|
| Caminho vazio | `errors.INVALID` | nao |
| Modo invalido | `errors.INVALID` | nao |
| Arquivo fechado | `errors.INVALID` | nao |
| Caminho nao encontrado | `errors.NOT_FOUND` | nao |
| Caminho ja existe | `errors.ALREADY_EXISTS` | nao |
| Permissao negada | `errors.PERMISSION_DENIED` | nao |

Veja [Error Handling](lua-errors.md) para trabalhar com erros.
