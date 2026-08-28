---
title: "Sanitização HTML"
description: "Sanitize HTML não confiável com políticas predefinidas ou personalizadas de elementos, atributos e URLs."
---

# Sanitização HTML
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

O módulo `html` sanitiza HTML não confiável com políticas baseadas em [bluemonday](https://github.com/microcosm-cc/bluemonday).

A sanitização analisa um fragmento HTML e o filtra por uma política de allowlist. Elementos e atributos não permitidos são removidos, e o fragmento restante é normalizado durante a serialização.

Esta página é uma referência de API. Os blocos de construtores são exemplos autocontidos de políticas; os blocos posteriores são trechos parciais de configuração que pressupõem uma `policy` já criada. A saída sanitizada é adequada somente ao contexto de conteúdo de um elemento HTML. Ela não é segura para interpolação em JavaScript, CSS, URLs ou atributos HTML; use um encoder próprio para o contexto real de saída.

## Carregamento

```lua
local html = require("html")
```

Adicione `html` à lista `modules:` da entrada executável antes de importá-lo.

## Políticas Predefinidas

O módulo oferece três construtores de políticas predefinidas:

| Política | Caso de Uso | Permite |
|----------|-------------|---------|
| `new_policy` | Sanitização customizada | Nada (construir do zero) |
| `ugc_policy` | Comentarios de usuários, foruns | Formatação comum (`p`, `b`, `i`, `a`, listas, etc.) |
| `strict_policy` | Extração de texto puro | Nada (remove todo HTML) |

Os três construtores retornam `Policy, nil`; atualmente, a criação da política não falha.

### Política Vazia

Cria uma política que não permite nada. Use para construir uma whitelist customizada do zero.

```lua
local policy, err = html.sanitize.new_policy()
if err then return nil, err end

policy:allow_elements("p", "strong", "em")
policy:allow_attrs("class"):globally()

local clean = policy:sanitize(user_input)
```

**Retorna:** `Policy, error`

### Política de Conteúdo de Usuário

Pre-configurada para conteudo gerado por usuários. Permite elementos de formatação comuns.

```lua
local policy, err = html.sanitize.ugc_policy()
if err then return nil, err end

local safe = policy:sanitize('<p>Hello <strong>world</strong></p>')
-- '<p>Hello <strong>world</strong></p>'

local xss = policy:sanitize('<p>Hello <script>alert("xss")</script></p>')
-- '<p>Hello </p>'
```

**Retorna:** `Policy, error`

### Política Restrita

Remove todo HTML, retorna apenas texto puro.

```lua
local policy, err = html.sanitize.strict_policy()
if err then return nil, err end

local text = policy:sanitize('<p>Hello <b>world</b>!</p>')
-- 'Hello world!'
```

**Retorna:** `Policy, error`

## Controle de Elementos

### Permitir Elementos

Whitelist de elementos HTML especificos.

```lua
local policy, err = html.sanitize.new_policy()
if err then return nil, err end
policy:allow_elements("p", "strong", "em", "br")
policy:allow_elements("h1", "h2", "h3")
policy:allow_elements("a", "img")

local result = policy:sanitize('<p>Hello <strong>world</strong></p>')
-- '<p>Hello <strong>world</strong></p>'
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `...` | string | Nomes de tags de elementos |

**Retorna:** `Policy`

## Controle de Atributos

### Permitir Atributos

Iniciar permissão de atributo. Encadear com `on_elements()` ou `globally()`.

```lua
policy:allow_attrs("href"):on_elements("a")
policy:allow_attrs("src", "alt"):on_elements("img")
policy:allow_attrs("class", "id"):globally()
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `...` | string | Nomes de atributos |

**Retorna:** `AttrBuilder`

### Em Elementos Específicos

Permitir atributos apenas em elementos especificos.

```lua
policy:allow_elements("a", "img")
policy:allow_attrs("href", "target"):on_elements("a")
policy:allow_attrs("src", "alt", "width", "height"):on_elements("img")
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `...` | string | Nomes de tags de elementos |

**Retorna:** `Policy`

### Em Todos os Elementos

Permitir atributos globalmente em qualquer elemento permitido.

```lua
policy:allow_attrs("class"):globally()
policy:allow_attrs("id"):globally()
```

**Retorna:** `Policy`

### Com correspondência de padrões :id=with-pattern-matching

Validar valores de atributo contra padrão regex.

```lua
-- Only allow hex colors in style
local builder, err = policy:allow_attrs("style"):matching("^color:#[0-9a-fA-F]{6}$")
if err then
    return nil, err
end
builder:on_elements("span")

policy:sanitize('<span style="color:#ff0000">Red</span>')
-- '<span style="color:#ff0000">Red</span>'

policy:sanitize('<span style="background:red">Bad</span>')
-- '<span>Bad</span>'
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `pattern` | string | Expressão regular compatível com Go RE2 |

**Retorna:** `AttrBuilder, error`

## Segurança de URL

### URLs Padrão

Habilita a política padrão de tratamento de URLs. Ela exige URLs analisáveis, permite URLs relativas e os esquemas `mailto`, `http` e `https`, e adiciona `rel="nofollow"` aos elementos de link permitidos.

```lua
policy:allow_elements("a")
policy:allow_attrs("href"):on_elements("a")
policy:allow_standard_urls()
```

**Retorna:** `Policy`

### Esquemas de URL

Restringir quais esquemas de URL sao permitidos.

```lua
policy:allow_url_schemes("https", "mailto")

policy:sanitize('<a href="https://example.com">OK</a>')
-- '<a href="https://example.com">OK</a>'

policy:sanitize('<a href="javascript:alert(1)">XSS</a>')
-- '<a>XSS</a>'
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `...` | string | Esquemas permitidos |

**Retorna:** `Policy`

### URLs Relativas

Permitir ou proibir URLs relativas.

```lua
policy:allow_relative_urls(true)

policy:sanitize('<a href="/page">Link</a>')
-- '<a href="/page">Link</a>'
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `allow` | boolean | Permitir URLs relativas |

**Retorna:** `Policy`

### Exigir URLs Parseaveis

Rejeitar URLs que nao sao parseadas corretamente. Com `true`, URLs de atributos que o sanitizador HTML nao consegue parsear sao removidas ao inves de passadas.

```lua
policy:require_parseable_urls(true)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `require` | boolean | Exigir que URLs sejam parseaveis |

**Retorna:** `Policy`

### Links Nofollow

Adicionar `rel="nofollow"` a todos os links. Previne spam de SEO.

```lua
policy:allow_attrs("href", "rel"):on_elements("a")
policy:allow_url_schemes("https")
policy:require_parseable_urls(true)
policy:require_nofollow_on_links(true)

policy:sanitize('<a href="https://example.com">Link</a>')
-- '<a href="https://example.com" rel="nofollow">Link</a>'
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `require` | boolean | Adicionar nofollow |

**Retorna:** `Policy`

### Links Noreferrer

Adicionar `rel="noreferrer"` a todos os links. Previne vazamento de referrer.

```lua
policy:require_noreferrer_on_links(true)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `require` | boolean | Adicionar noreferrer |

**Retorna:** `Policy`

### Links Externos em Nova Aba

Adicionar `target="_blank"` a URLs totalmente qualificadas.

```lua
policy:allow_attrs("href", "target"):on_elements("a")
policy:allow_url_schemes("https")
policy:require_parseable_urls(true)
policy:add_target_blank_to_fully_qualified_links(true)

policy:sanitize('<a href="https://example.com">Link</a>')
-- '<a href="https://example.com" target="_blank">Link</a>'
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `add` | boolean | Adicionar target blank |

**Retorna:** `Policy`

Ao abrir links não confiáveis em uma nova aba, habilite também `require_noreferrer_on_links(true)` para impedir vazamento do referrer e mitigar acesso via opener.

## Métodos de Conveniencia

### Permitir Imagens

Permite `<img>` com `align`, `alt`, `height`, `width` e `src`. Este helper também habilita a política padrão de URLs, mas não permite imagens em data URI.

```lua
policy:allow_images()

policy:sanitize('<img src="photo.jpg" alt="Photo">')
-- '<img src="photo.jpg" alt="Photo">'
```

**Retorna:** `Policy`

### Permitir Imagens Data URI

Permite imagens data URI sintaticamente válidas e codificadas em Base64 nos formatos `gif`, `jpeg`, `png`, `svg+xml` ou `webp`. O sanitizador valida o media type e a codificação Base64, não o conteúdo decodificado da imagem. Data URIs podem carregar conteúdo ativo; habilite-as somente quando confiar nos dados da imagem:

```lua
policy:allow_elements("img")
policy:allow_attrs("src"):on_elements("img")
policy:allow_data_uri_images()

local input = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2O9sAAAAASUVORK5CYII=">'
policy:sanitize(input)
-- The data URI is preserved.
```

**Retorna:** `Policy`

### Permitir Listas

Permite `ul`, `ol`, `li`, `dl`, `dt` e `dd`. O helper também aceita atributos `type` validados em `ul`, `ol` e `li`, além de um atributo inteiro `value` em `li`.

```lua
policy:allow_lists()

policy:sanitize('<ul><li>Item 1</li><li>Item 2</li></ul>')
-- '<ul><li>Item 1</li><li>Item 2</li></ul>'
```

**Retorna:** `Policy`

### Permitir Tabelas

Permite `table`, `caption`, `col`, `colgroup`, `thead`, `tbody`, `tfoot`, `tr`, `td` e `th`. Também permite dimensões, alinhamento, spans, headers, scope e atributos de apresentação relacionados, todos validados pelo helper.

```lua
policy:allow_tables()

policy:sanitize('<table><tr><td>Cell</td></tr></table>')
-- '<table><tr><td>Cell</td></tr></table>'
```

**Retorna:** `Policy`

### Permitir Atributos Padrão

Permite globalmente os atributos padrão `dir`, `id`, `lang` e `title`. Os valores são restritos: `dir` deve ser `ltr` ou `rtl`, `lang` deve ter de 2 a 20 letras ASCII e `id` e `title` devem corresponder aos padrões de caracteres seguros do sanitizador. Este helper não permite `class`.

```lua
policy:allow_elements("p")
policy:allow_standard_attributes()

policy:sanitize('<p id="intro" class="text" title="Introduction">Hello</p>')
-- '<p id="intro" title="Introduction">Hello</p>'
```

**Retorna:** `Policy`

## Sanitize

Aplicar política a string HTML.

```lua
local policy, err = html.sanitize.ugc_policy()
if err then return nil, err end
policy:require_nofollow_on_links(true)

local dirty = '<p>Hello</p><script>alert("xss")</script>'
local clean = policy:sanitize(dirty)
-- '<p>Hello</p>'
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `html` | string | HTML para sanitizar |

**Retorna:** `string`

`sanitize` retorna somente uma string. No runtime `v0.3.32a`, o parser de fragmentos subjacente pode transformar uma entrada malformada que não consegue analisar em uma string vazia, e o wrapper Lua não distingue esse caso de uma entrada válida cujo conteúdo foi removido pela política. Trate a sanitização como filtro de saída, não como validação de entrada; valide separadamente o conteúdo obrigatório quando um resultado vazio for relevante.

## Erros

| Condição | Tipo | Retentável |
|----------|------|------------|
| Padrão regex inválido | `errors.INVALID` | não |

Veja [Tratamento de Erros](../core/errors.md) para trabalhar com erros.
