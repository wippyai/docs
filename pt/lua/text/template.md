# Template Engine
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="external"/>

Renderize conteudo dinamico usando o [Jet template engine](https://github.com/CloudyKit/jet). Construa paginas HTML, emails e documentos com heranca de templates e includes.

Para configuracao de template sets, veja [Template Engine](system-template.md).

## Carregamento

```lua
local templates = require("templates")
```

## Obtendo Template Sets

Obter um template set pelo ID do registry para comecar a renderizar:

```lua
local set, err = templates.get("app.views:emails")
if err then
    return nil, err
end

-- Usar o set...

set:release()
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `id` | string | ID do template set no registry |

**Retorna:** `Set, error`

## Renderizando Templates

Renderizar um template pelo nome com dados:

```lua
local set = templates.get("app.views:emails")

local html, err = set:render("welcome", {
    user = {name = "Alice", email = "alice@example.com"},
    activation_url = "https://example.com/activate?token=abc"
})

if err then
    set:release()
    return nil, err
end

set:release()
return html
```

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `name` | string | Nome do template dentro do set |
| `data` | table | Variaveis para passar ao template (opcional) |

**Retorna:** `string, error`

## Metodos do Set

| Metodo | Retorna | Descricao |
|--------|---------|-----------|
| `render(name, data?)` | `string, error` | Renderizar template com dados |
| `release()` | `boolean` | Liberar set de volta ao pool |

## Referencia da Sintaxe Jet

Jet usa `{{ }}` para expressoes e estruturas de controle, `{* *}` para comentarios.

### Variaveis

```html
{{ user.name }}
{{ user.email }}
{{ items[0].price }}
```

### Condicionais

```html
{{ if order.shipped }}
    <p>Enviado!</p>
{{ else if order.processing }}
    <p>Processando...</p>
{{ else }}
    <p>Recebido.</p>
{{ end }}
```

### Loops

```html
{{ range items }}
    <li>{{ .name }} - R${{ .price }}</li>
{{ end }}

{{ range i, item := items }}
    <p>{{ i }}. {{ item.name }}</p>
{{ end }}
```

### Heranca

```html
{* Parent: layout.jet *}
<html>
<head><title>{{ yield title() }}</title></head>
<body>{{ yield body() }}</body>
</html>

{* Child: page.jet *}
{{ extends "layout" }}
{{ block title() }}Minha Pagina{{ end }}
{{ block body() }}<p>Conteudo</p>{{ end }}
```

### Includes

```html
{{ include "partials/header" }}
<main>Conteudo</main>
{{ include "partials/footer" }}
```

## Erros

| Condicao | Tipo | Retentavel |
|----------|------|------------|
| ID vazio | `errors.INVALID` | nao |
| Nome de template vazio | `errors.INVALID` | nao |
| Permissao negada | `errors.PERMISSION_DENIED` | nao |
| Template nao encontrado | `errors.NOT_FOUND` | nao |
| Erro de renderizacao | `errors.INTERNAL` | nao |
| Set ja liberado | `errors.INTERNAL` | nao |

Veja [Error Handling](lua-errors.md) para trabalhar com erros.
