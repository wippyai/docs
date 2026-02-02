# Sanitizacao HTML
<secondary-label ref="function"/>
<secondary-label ref="process"/>
<secondary-label ref="workflow"/>

Sanitize HTML não confiavel para prevenir ataques XSS. Baseado em [bluemonday](https://github.com/microcosm-cc/bluemonday).

A sanitizacao funciona parseando HTML e filtrando atraves de uma politica de whitelist. Elementos e atributos não explicitamente permitidos sao removidos. A saida e sempre HTML bem formado.

## Carregamento

```lua
local html = require("html")
```

## Politicas Predefinidas

Tres politicas embutidas para casos de uso comuns:

| Politica | Caso de Uso | Permite |
|----------|-------------|---------|
| `new_policy` | Sanitizacao customizada | Nada (construir do zero) |
| `ugc_policy` | Comentarios de usuarios, foruns | Formatacao comum (`p`, `b`, `i`, `a`, listas, etc.) |
| `strict_policy` | Extracao de texto puro | Nada (remove todo HTML) |

### Politica Vazia

Cria uma politica que não permite nada. Use para construir uma whitelist customizada do zero.

```lua
local policy, err = html.sanitize.new_policy()

policy:allow_elements("p", "strong", "em")
policy:allow_attrs("class"):globally()

local clean = policy:sanitize(user_input)
```

**Retorna:** `Policy, error`

### Politica de Conteudo de Usuario

Pre-configurada para conteudo gerado por usuarios. Permite elementos de formatacao comuns.

```lua
local policy = html.sanitize.ugc_policy()

local safe = policy:sanitize('<p>Hello <strong>world</strong></p>')
-- '<p>Hello <strong>world</strong></p>'

local xss = policy:sanitize('<p>Hello <script>alert("xss")</script></p>')
-- '<p>Hello </p>'
```

**Retorna:** `Policy, error`

### Politica Restrita

Remove todo HTML, retorna apenas texto puro.

```lua
local policy = html.sanitize.strict_policy()

local text = policy:sanitize('<p>Hello <b>world</b>!</p>')
-- 'Hello world!'
```

**Retorna:** `Policy, error`

## Controle de Elementos

### Permitir Elementos

Whitelist de elementos HTML especificos.

```lua
local policy = html.sanitize.new_policy()
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

Iniciar permissao de atributo. Encadear com `on_elements()` ou `globally()`.

```lua
policy:allow_attrs("href"):on_elements("a")
policy:allow_attrs("src", "alt"):on_elements("img")
policy:allow_attrs("class", "id"):globally()
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `...` | string | Nomes de atributos |

**Retorna:** `AttrBuilder`

### Em Elementos Especificos

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

### Com Pattern Matching

Validar valores de atributo contra padrão regex.

```lua
-- Permitir apenas cores hex no style
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
| `pattern` | string | Padrão regex |

**Retorna:** `AttrBuilder, error`

## Seguranca de URL

### URLs Padrão

Habilitar tratamento de URL com padroes de seguranca.

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

### Links Nofollow

Adicionar `rel="nofollow"` a todos os links. Previne spam de SEO.

```lua
policy:allow_attrs("href", "rel"):on_elements("a")
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
policy:add_target_blank_to_fully_qualified_links(true)

policy:sanitize('<a href="https://example.com">Link</a>')
-- '<a href="https://example.com" target="_blank">Link</a>'
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `add` | boolean | Adicionar target blank |

**Retorna:** `Policy`

## Metodos de Conveniencia

### Permitir Imagens

Permitir `<img>` com atributos padrão.

```lua
policy:allow_images()

policy:sanitize('<img src="photo.jpg" alt="Photo">')
-- '<img src="photo.jpg" alt="Photo">'
```

**Retorna:** `Policy`

### Permitir Imagens Data URI

Permitir imagens embutidas em base64.

```lua
policy:allow_elements("img")
policy:allow_attrs("src"):on_elements("img")
policy:allow_data_uri_images()

policy:sanitize('<img src="data:image/png;base64,iVBORw...">')
-- '<img src="data:image/png;base64,iVBORw...">'
```

**Retorna:** `Policy`

### Permitir Listas

Permitir elementos de lista: `ul`, `ol`, `li`, `dl`, `dt`, `dd`.

```lua
policy:allow_lists()

policy:sanitize('<ul><li>Item 1</li><li>Item 2</li></ul>')
-- '<ul><li>Item 1</li><li>Item 2</li></ul>'
```

**Retorna:** `Policy`

### Permitir Tabelas

Permitir elementos de tabela: `table`, `thead`, `tbody`, `tfoot`, `tr`, `td`, `th`, `caption`.

```lua
policy:allow_tables()

policy:sanitize('<table><tr><td>Cell</td></tr></table>')
-- '<table><tr><td>Cell</td></tr></table>'
```

**Retorna:** `Policy`

### Permitir Atributos Padrão

Permitir atributos comuns: `id`, `class`, `title`, `dir`, `lang`.

```lua
policy:allow_elements("p")
policy:allow_standard_attributes()

policy:sanitize('<p id="intro" class="text" title="Introduction">Hello</p>')
-- '<p id="intro" class="text" title="Introduction">Hello</p>'
```

**Retorna:** `Policy`

## Sanitize

Aplicar politica a string HTML.

```lua
local policy = html.sanitize.ugc_policy()
policy:require_nofollow_on_links(true)

local dirty = '<p>Hello</p><script>alert("xss")</script>'
local clean = policy:sanitize(dirty)
-- '<p>Hello</p>'
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `html` | string | HTML para sanitizar |

**Retorna:** `string`

## Erros

| Condição | Tipo | Retentavel |
|----------|------|------------|
| Padrão regex invalido | `errors.INVALID` | não |

Veja [Error Handling](lua-errors.md) para trabalhar com erros.
