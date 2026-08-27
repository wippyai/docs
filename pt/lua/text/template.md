---
title: "Template Engine"
description: "Renderize templates Jet a partir de conjuntos de templates configurados."
---

# Template Engine
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="external"/>

O módulo `templates` renderiza templates [Jet](https://github.com/CloudyKit/jet) a partir de conjuntos configurados. Os templates podem usar herança e includes. Esta página é uma referência de API com exemplos isolados de renderização, não um deployment de templates independente. Os IDs do registry e as fontes dos templates já devem estar configurados, e a entrada executável deve habilitar `templates` e ter a permissão `template.get` para o conjunto solicitado.

Para configurar conjuntos de templates, veja [Template Engine](../../system/template.md).

## Carregamento

```lua
local templates = require("templates")
```

## `templates.get`

Adquire um conjunto de templates pelo ID do registry:

```lua
local set, err = templates.get("app.views:emails")
if err then
    return nil, err
end

-- Use the set...

return set:release()
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | string | ID do conjunto de templates no registry |

**Retorna:** `Set, error`

## `set:render`

Renderiza um template por nome com os dados fornecidos:

```lua
local set, get_err = templates.get("app.views:emails")
if get_err then
    return nil, get_err
end

local html, err = set:render("welcome", {
    user = {name = "Alice", email = "alice@example.com"},
    activation_url = "https://example.invalid/activate"
})

set:release()
if err then
    return nil, err
end

return html
```

O chamador é responsável por cada conjunto adquirido até chamar `release()`. Libere-o depois da última renderização, inclusive em caminhos de erro verificados; chamadas repetidas de `release()` são seguras. A renderização não torna os valores fornecidos pela aplicação seguros para todos os contextos de saída. Não registre segredos nem URLs de uso único e aplique o escaping ou a sanitização exigidos no local em que a string renderizada será consumida.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `name` | string | Nome do template dentro do set |
| `data` | table | Variáveis passadas ao template (opcional) |

**Retorna:** `string, error`

## Métodos do Set

O handle do conjunto oferece estes métodos:

| Método | Retorna | Descrição |
|--------|---------|-----------|
| `render(name, data?)` | `string, error` | Renderizar template com dados |
| `release()` | `boolean` | Liberar o conjunto de volta ao pool |

## Referência da Sintaxe Jet

Jet usa `{{ }}` para expressões e estruturas de controle e `{* *}` para comentários.

### Variáveis

```html
{{ user.name }}
{{ user.email }}
{{ items[0].price }}
```

### Condicionais

```html
{{ if order.shipped }}
    <p>Shipped!</p>
{{ else if order.processing }}
    <p>Processing...</p>
{{ else }}
    <p>Received.</p>
{{ end }}
```

### Loops

```html
{{ range items }}
    <li>{{ .name }} - ${{ .price }}</li>
{{ end }}

{{ range i, item := items }}
    <p>{{ i }}. {{ item.name }}</p>
{{ end }}
```

### Herança

```html
{* Parent: layout.jet *}
<html>
<head><title>{{ yield title() }}</title></head>
<body>{{ yield body() }}</body>
</html>

{* Child: page.jet *}
{{ extends "layout" }}
{{ block title() }}My Page{{ end }}
{{ block body() }}<p>Content</p>{{ end }}
```

### Includes

```html
{{ include "partials/header" }}
<main>Content</main>
{{ include "partials/footer" }}
```

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| ID vazio | `errors.INVALID` | não |
| Nome de template vazio | `errors.INVALID` | não |
| Permissão negada | `errors.PERMISSION_DENIED` | não |
| Conjunto de templates ausente, indisponível ou com tipo de recurso incorreto | `errors.INTERNAL` | não |
| Template não encontrado | `errors.NOT_FOUND` | não |
| Erro de renderização | `errors.INTERNAL` | não |
| Tentativa de renderização após liberar o conjunto | `errors.INTERNAL` | não |

Veja [Tratamento de Erros](../core/errors.md) para trabalhar com erros.
