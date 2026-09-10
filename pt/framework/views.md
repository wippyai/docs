---
title: "Views"
description: "Defina páginas renderizadas no servidor, aplicações frontend, componentes web, recursos e mapeamentos de ambiente com wippy/views."
---

# Views

O módulo `wippy/views` fornece um sistema de páginas e componentes virtuais com renderização de templates, gerenciamento de recursos e mapeamento de variáveis de ambiente. As páginas vêm em dois sabores distintos:

- **Páginas de template Jet** (`kind: template.jet`) — HTML renderizado no lado do servidor. Os dados e recursos da página são montados e injetados no servidor, e então o motor Jet renderiza o HTML final. Este é o modelo legado, renderizado no servidor. Veja [Páginas Template](#template-pages).
- **Frontends de entrada de registro** (`kind: registry.entry`) — dois tipos: aplicações micro frontend (`view.page`, SPAs completas) e web components reutilizáveis (`view.component`), servidos de um CDN ou de um mount estático. A entrada de registro guarda apenas o roteamento e a política de deployment; a injeção de proxy/CSS é declarada no `package.json` do pacote frontend. Veja [Páginas de Componente](#component-pages) e [Componentes de View](#view-components).

## Configuração

Adicione o módulo ao projeto:

```bash
wippy add wippy/views
wippy install
```

Declare a dependência:

```yaml
version: "1.0"
namespace: app

entries:
  - name: dep.views
    kind: ns.dependency
    component: wippy/views
    version: "*"
    parameters:
      - name: api_router
        value: app:api.public
      - name: env_storage
        value: app:env.storage
```

| Parâmetro | Obrigatório | Padrão | Descrição |
|-----------|----------|---------|-------------|
| `api_router` | sim | — | Roteador HTTP para os endpoints da API de views |
| `env_storage` | sim | — | Armazenamento de ambiente que respalda a variavel `PUBLIC_API_URL` |
| `server` | não | `app:gateway` | Serviço HTTP ao qual o roteador do [gateway de Web Fragments](#web-fragments-gateway) auto-montado (`/@fragment`) se vincula. Sobrescreva apenas se o id do seu `http.service` for diferente de `app:gateway`. |

## Páginas de Template

> **Modelo renderizado no servidor.** Páginas template são o mecanismo legado de renderização no lado do servidor: `wippy/views` monta os dados e recursos da página no servidor e renderiza o HTML final com o motor de templates Jet. Não há proxy de iframe nem micro-frontend no cliente — a resposta é HTML puro. Para SPAs e componentes externos, veja [Páginas de Componente](#component-pages).

Páginas template renderizam no lado do servidor usando templates Jet. Os dados são injetados via `data.set`, `data.data_func` e `data.resources` (injeção de recursos no servidor):

```yaml
entries:
  - name: contact_page
    kind: template.jet
    meta:
      type: view.page
      name: contact
      title: Contact Us
      icon: mail
      order: 5
      group: main
      group_icon: layout-grid
      group_order: 1
      announced: true
      secure: false
    data:
      set: app.templates:default
      data_func: app:contact_data
      resources:
        - contact_styles
```

### Metadados da Página

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `meta.type` | string | — | Deve ser `view.page` |
| `meta.name` | string | nome da entrada | Identificador da página |
| `meta.title` | string | — | Título exibido |
| `meta.icon` | string | — | Identificador do ícone |
| `meta.order` | number | `9999` | Ordem dentro do grupo |
| `meta.group` | string | — | Categoria do grupo |
| `meta.group_icon` | string | — | Ícone do grupo |
| `meta.group_order` | number | `9999` | Ordem do grupo |
| `meta.group_placement` | string | `"default"` | Posicionamento: `"default"`, `"sidebar"` |
| `meta.secure` | boolean | `false` | Exige autenticação |
| `meta.public` | boolean | `false` | Torna a página anunciada quando verdadeiro; não ignora o controle de acesso de `meta.secure` |
| `meta.announced` | boolean | `false` | Exibe na navegação. O resolvedor atual usa `announced or public`, portanto `public: true` prevalece sobre `announced: false` explícito |
| `meta.inline` | boolean | `false` | Retornado por `/pages/list` como o marcador numérico `hidden` |
| `meta.content_type` | string | `text/html` | Tipo MIME da resposta |
| `meta.parent` | string | — | ID da página pai |

### Dados do Template

| Campo | Descrição |
|-------|-----------|
| `data.set` | ID obrigatório da entrada do conjunto de templates |
| `data.data_func` | ID da função que retorna os dados da página |
| `data.resources` | Array de IDs de entradas de recurso |

A `data_func` recebe `{ params, query }` e retorna uma tabela que se torna o contexto `data` do template. Omitir `data.data_func`, ou retornar `nil`, produz uma tabela vazia. Uma função configurada que não possa ser resolvida, ou que retorne erro, interrompe a renderização.

### Pipeline de Renderização

1. Carregar a página do registro
2. Verificar o acesso
3. Chamar `data_func`, se definida
4. Coletar recursos globais, do conjunto de templates e específicos da página
5. Carregar variáveis de ambiente; falhas de mapeamento são registradas e produzem uma tabela `env` vazia
6. Renderizar o template Jet com o contexto `{ data, resources, query_params, route_params, env }`

## Páginas de Componente

Páginas de componente apontam para aplicações de página única externas (SPAs, micro-frontends) carregadas pelo Web Host dentro de um iframe. A entrada de registro guarda **apenas campos de roteamento de registro e de política de deployment** — serviço de URL, controle de acesso, rota de mount e sobrescritas de configuração por página:

> **Formato de registro obrigatório:** páginas de componente são `kind: registry.entry` com `meta.type: view.page`. `view.page` nunca é um valor de `kind`. Sobrescritas de deployment de proxy ficam em `meta.proxy`, não em `data.proxy`.

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      name: dashboard
      title: Dashboard
      icon: chart-bar
      url: /app
      base_path: app/dashboard
      entry_point: index.html
      mountRoute: /dashboard/:part(.*)*
      secure: true
      announced: true
      config_overrides:
        customization:
          cssVariables:
            "--p-primary": "#7c9ed9"
```

A API retorna um descritor de componente com a URL base resolvida. O Web Host renderiza a SPA em um iframe e aplica as injeções de proxy que o pacote frontend solicitou.

### Campos da Página de Componente

| Campo | Tipo | Padrão | Descrição |
|-------|------|---------|-------------|
| `meta.url` | string | — | Prefixo de URL base onde o bundle é montado (origem do CDN ou caminho `http.static`) |
| `meta.base_path` | string | — | Subdiretório dentro do mount estático |
| `meta.entry_point` | string | `index.html` | Arquivo HTML de entrada; combinado como `<url>/<base_path>/<entry_point>` |
| `meta.mountRoute` | string | — | Reivindica um caminho de URL no roteador do host; apenas a forma catch-all `/:part(.*)*` (raiz) ou `/<prefixo-literal>/:part(.*)*` é permitida — padrões arbitrários do Vue Router são rejeitados (HTTP 500). Veja [view-page.md](../frontend/frontend-registry/view-page.md) / [dynamic-routing.md](../frontend/frontend-registry/dynamic-routing.md) |
| `meta.announced` | boolean | — | Mostrar na navegação e em `pages/list` |
| `meta.secure` | boolean | `false` | Requer autenticação |
| `meta.config_overrides` | object | — | Sobrescritas de AppConfig por página (camelCase), mescladas profundamente sobre os padrões do bundle |

### Injeção de Proxy

A injeção de proxy para páginas SPA é configurada no bloco `wippy.proxy.injections` do package.json do FE (camelCase) e embutida em `wippy-meta.json` no momento do build. Ela também pode ser sobrescrita por deployment através de um bloco `proxy:` em camelCase aninhado sob `meta:` na entrada de registro (mesmo formato e mesmo wrapper `injections` do bloco `wippy.proxy` do package.json); o host o mescla profundamente sobre o `wippy.proxy` do bundle, e o valor do YAML vence por chave aninhada. Não existe forma em snake_case nem normalização de capitalização. Note que `config_overrides` só mescla profundamente `customization`, `axiosDefaults`, `routePrefix` e `apiRoutes` — nunca afeta `proxy.injections`. Veja [Aplicações Micro Frontend (view.page)](../frontend/frontend-registry/view-page.md) e [Injeção de CSS](../frontend/web-host/css-injection.md).

Formato mínimo correto de sobrescrita de deployment:

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      proxy:
        enabled: true
        injections:
          css:
            themeConfig: true
            customCss: true
            customVariables: true
          tailwindConfig: false
```

## Componentes de View

Componentes de view são custom elements reutilizáveis (web components, micro-frontends) que o Web Host descobre e registra — eles não são páginas e não têm entrada de navegação. Assim como as páginas de componente, a entrada de registro carrega apenas roteamento e política de deployment:

```yaml
entries:
  - name: reaction-bar
    kind: registry.entry
    meta:
      type: view.component
      name: reaction-bar
      tag_name: example-reaction-bar
      announced: true
      auto_register: true
      secure: false
      url: /app/wc/reaction-bar
      entry_point: index.js
```

Componentes usam `meta.type: view.component` em vez de `view.page`, se identificam por `meta.tag_name` e assumem `index.js` como ponto de entrada por padrão. A injeção de proxy e o CSS de tema para componentes também são declarados no package.json do FE (camelCase) e, para CSS de shadow DOM, declarados via `hostCssKeys` — não no YAML do registro. Veja [Web Components (view.component)](../frontend/frontend-registry/view-component.md) e [Injeção de CSS](../frontend/web-host/css-injection.md).

## Recursos

Recursos são arquivos CSS, JS e fontes associados às páginas:

```yaml
entries:
  - name: global_styles
    kind: registry.entry
    meta:
      type: view.resource
      name: Global Styles
      resource_type: style
      global: true
      order: 1
      url: https://cdn.example.com/global.css

  - name: app_script
    kind: registry.entry
    meta:
      type: view.resource
      name: App Script
      resource_type: script
      template_set: app.templates:default
      order: 10
      url: https://cdn.example.com/app.js
      defer: true
```

### Campos de Recurso

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `meta.type` | string | Deve ser `view.resource` |
| `meta.resource_type` | string | Livre, com padrão `"other"`; valores comuns são `"style"`, `"script"` e `"font"` |
| `meta.order` | number | Ordem dentro do tipo |
| `meta.global` | boolean | Aplicado a todas as páginas |
| `meta.template_set` | string | Específico de um conjunto de templates |
| `meta.url` | string | URL do recurso |
| `meta.integrity` | string | Hash SRI |
| `meta.crossorigin` | string | `"anonymous"` ou `"use-credentials"` |
| `meta.media` | string | Media query CSS |
| `meta.defer` | boolean | Carregamento de script adiado |
| `meta.async` | boolean | Carregamento assíncrono de script |

### Coleta de Recursos

Os recursos são selecionados cumulativamente de três fontes:

1. **Recursos globais** — `global: true`, aplicados a todas as páginas
2. **Recursos do conjunto de templates** — correspondentes ao ID de `template_set`
3. **Recursos da página** — listados no array `data.resources`

Após a coleta, os recursos são agrupados por `resource_type` e cada grupo é ordenado por `order`. As três fontes não estabelecem uma ordem de saída separada.

## Mapeamento de Variáveis de Ambiente

O carregador de ambiente mapeia variáveis para chaves do contexto do template por um sistema de prioridades.

### Definindo Mapeamentos

```yaml
entries:
  - name: app_env
    kind: registry.entry
    meta:
      type: view.env_mapping
      priority: 20
    data:
      mappings:
        api_endpoint: API_BASE_URL
        app_title: APP_NAME
        debug_mode: DEBUG_ENABLED
```

Cada entrada associa chaves de contexto, usadas como `env.api_endpoint`, a nomes de variáveis de ambiente.

### Sistema de Prioridades

| Faixa | Categoria | Descrição |
|-------|-----------|-----------|
| 0–9 | Padrões do framework | Mapeamentos integrados |
| 10–19 | Sobrescritas do sistema | Configuração do sistema |
| 20–29 | Mapeamentos da aplicação | Mapeamentos específicos da aplicação |
| 30–100 | Sobrescritas de ambiente | Sobrescritas em runtime |

A prioridade maior vence quando vários mapeamentos definem a mesma chave. Não defina a mesma chave mais de uma vez na mesma prioridade: a ordem entre prioridades iguais é indefinida.

### Usando em Templates

Os valores resolvidos ficam disponíveis no objeto de contexto `env`:

```html
<script>
    window.API_URL = "{{ env.api_endpoint }}";
    document.title = "{{ env.app_title }}";
</script>
```

## Endpoints da API HTTP

O módulo registra estes endpoints no roteador configurado:

| Método | Caminho | Descrição |
|--------|---------|-----------|
| GET | `/pages/list` | Lista páginas anunciadas e acessíveis |
| GET | `/components/list` | Lista componentes de view anunciados e acessíveis |
| GET | `/pages/content/{id}` | Renderiza a página ou retorna o descritor do componente |
| GET | `/pages/public/{id}` | Obtém a URL base do componente |
| GET | `/components/by-tag/{tag}` | Resolve um nome de tag de custom element para seu descritor `view.component` (usado pelo `loadByTagName` do host) |
| GET | `/pages/routes` | Retorna o mapa `mountRoute` → `pageId`; HTTP 500 em caso de `mountRoute` inválido ou duplicado. Não é filtrado por `announced` (páginas ocultas ainda precisam de resolução de URL); o controle de acesso se aplica a páginas seguras |

### Resposta de Renderização

Para páginas de template, retorna o HTML renderizado com o `content_type` da página.

Para páginas de componente, retorna um descritor:

```json
{
    "name": "dashboard",
    "version": "1.0.0",
    "specification": "wippy-component-1.0",
    "title": "Dashboard",
    "baseUrl": "https://cdn.example.com/dashboard/",
    "wippy": {
        "type": "page",
        "path": "index.html",
        "proxy": {
            "enabled": true,
            "injections": {
                "css": { "themeConfig": true, "iframe": true },
                "tailwindConfig": false,
                "resizeObserver": true,
                "preventLinkClicks": true
            }
        }
    }
}
```

As flags de injeção de `css` são `themeConfig`, `iframe`, `primevue`, `markdown`, `customCss` e `customVariables`. Não existe flag `fonts` — as Google Fonts são entregues via `theming.global.customCSS` (uma regra `@import`), injetada por `customCss`.

## Gateway de Web Fragments

Quando o Web Host renderiza uma página com o [render engine de fragments](../frontend/web-host/render-engines.md), a página é montada como `<web-fragment src="/@fragment/{id}/">`. `wippy/views` serve esse contrato de reframing através de um endpoint de gateway dedicado em **`/@fragment/{id}/{path...}`**.

Diferente da API de views (que monta no `api_router` do consumidor), o gateway é **auto-fornecido por `wippy/views` (≥ 0.5.9)**: o módulo declara internamente seu próprio `http.router` de nível superior `/@fragment`, de modo que ele é roteável por cache de CDN e livre de `token_auth` — o gateway é agnóstico de autenticação (o proxy de fragment injetado faz o handshake de autenticação com o host no cliente). **Um consumidor não precisa de nenhuma configuração de fragment** — nenhuma entrada de roteador e nenhum parâmetro `fragment_router`. A aplicação inicializa normalmente no engine de iframe, estejam os fragments habilitados ou não.

O roteador auto-montado se vincula a um requisito `server` que **assume `app:gateway` por padrão**. A única sobrescrita opcional: se a entrada `http.service` da sua aplicação tiver um id diferente de `app:gateway`, defina o parâmetro `server` de `wippy/views` para corresponder a ela:

```yaml
entries:
  - name: dep.views
    kind: ns.dependency
    component: wippy/views
    version: "*"
    parameters:
      - name: api_router
        value: app:api.public
      - name: env_storage
        value: app:env.storage
      - name: server                 # opcional — apenas se o id do seu http.service ≠ app:gateway
        value: app:my_http_service
```

> **Sem configuração de fragment, sem risco de boot.** Como `wippy/views` é dono do roteador `/@fragment` e o vincula a `server` (padrão `app:gateway`), um consumidor que atualiza o módulo inicializa normalmente no engine de iframe com zero configuração de fragment. Uma página que opta por fragments por página (`wippy.renderEngine: "fragment"`) em um deployment que de outra forma usa iframe é protegida por uma **sonda de capacidade** em tempo de execução que **silenciosamente a mantém no engine de iframe** quando o gateway ou `proxy-fragment.js` está indisponível. A chave global `render_engine: fragment` confia no operador e não faz sondagem.

### Contrato de reframing

O gateway responde à mesma URL `/@fragment/{id}/` de três formas, discriminadas pelo header `Sec-Fetch-Dest` da requisição e pelo subcaminho:

| Requisição | Resposta |
|---------|----------|
| Carregamento do iframe do realm (`Sec-Fetch-Dest: iframe`) | Um pequeno **stub reframed** carregando o import map do host + `loading.js` + `proxy-fragment.js`. |
| Fetch de documento (subcaminho vazio) | O HTML da aplicação da página, transformado para o realm (`<base>`, links de CSS do host, renomeação de `<html>`/`<head>`/`<body>` → `<wf-*>`). |
| Asset (subcaminho não vazio) | Encaminhado para o `base_url` real da página + subcaminho. |

As respostas carregam `Cache-Control`: o stub é cacheável de forma compartilhada (`public, max-age=300`); o documento e os assets protegidos por acesso são `private` (eles passam por uma verificação `can_access` por usuário, então um cache compartilhado vazaria entre usuários). Erros em tempo de execução são respostas HTTP explícitas — `400 Missing fragment id`, `404 Fragment page not found`, `401 Access denied`, `502 Fragment document fetch failed: … (url: …)`.

O FE seleciona o engine e monta o fragment — veja [Render Engines](../frontend/web-host/render-engines.md).

## Controle de Acesso

Páginas com `secure: true` exigem autenticação. O registro verifica `security.can("view", "page:<page_id>")` com o ator e o escopo atuais.

Páginas não seguras estão sempre acessíveis. A flag `announced` controla a visibilidade nas listagens de navegação sem afetar o acesso.

## Qualificação de IDs

IDs relativos nas definições de página são qualificados com o namespace da entrada:

```yaml
# In namespace "app"
data:
  data_func: my_data_func       # resolves to app:my_data_func
  set: templates:default         # stays as templates:default (already qualified)
  resources:
    - page_styles                # resolves to app:page_styles
```

## Veja Também

- [Facade](./facade.md) - Facade de iframe do frontend e barra lateral de navegação
- [Template](../system/template.md) - Motor de templates Jet
- [Segurança](../system/security.md) - Atores de segurança e controle de acesso
- [Ambiente](../system/env.md) - Armazenamento de variáveis de ambiente
- [Visão Geral do Framework](./overview.md) - Uso do módulo do framework
- [Aplicações Micro Frontend (view.page)](../frontend/frontend-registry/view-page.md) - Referência completa de metadados e injeção de proxy de view.page
- [Web Components (view.component)](../frontend/frontend-registry/view-component.md) - Referência completa de autoload e props de view.component
- [Render Engines](../frontend/web-host/render-engines.md) - Renderização de página com iframe vs Web Fragment (o consumidor do gateway `/@fragment`)
