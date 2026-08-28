---
title: "Views"
description: "Defina páginas renderizadas no servidor, aplicações frontend, componentes web, recursos e mapeamentos de ambiente com wippy/views."
---

# Views

O módulo `wippy/views` define páginas e componentes, gerencia seus recursos e mapeia variáveis de ambiente para a saída renderizada. Ele oferece dois modelos de página:

- **Páginas de template Jet** (`kind: template.jet`) renderizam HTML no servidor após reunir os dados e recursos da página. Consulte [Páginas de Template](#páginas-de-template).
- **Frontends como entradas de registro** (`kind: registry.entry`) descrevem aplicações de micro frontend (`view.page`) e componentes web reutilizáveis (`view.component`) servidos por CDN ou montagem estática. A entrada de registro contém as políticas de roteamento e implantação. Os metadados do frontend vêm do `wippy-meta.json` gerado pelo pacote, e os campos explícitos do registro têm precedência. Consulte [Páginas de Componente](#páginas-de-componente) e [Componentes de View](#componentes-de-view).

Esta página é uma referência do registro e da API HTTP. Seus blocos YAML, HTML e JSON são trechos independentes, não um único projeto executável. Antes de adaptá-los, forneça o `http.router`, o armazenamento de ambiente e o serviço HTTP referenciados pela dependência, além dos conjuntos de templates, funções, recursos ou bundles de frontend usados pelo exemplo escolhido.

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
|-----------|-------------|--------|-----------|
| `api_router` | sim | — | Roteador HTTP dos endpoints da API de views |
| `env_storage` | sim | — | Armazenamento de ambiente que fornece a variável `PUBLIC_API_URL` |
| `server` | não | `app:gateway` | Serviço HTTP ao qual se vincula o roteador automontado do [gateway de Web Fragments](#gateway-de-web-fragments) (`/@fragment`). Sobrescreva apenas se o ID de `http.service` for diferente de `app:gateway`. |

## Páginas de Template

> **Modelo renderizado no servidor.** O `wippy/views` reúne dados e recursos de template no servidor e renderiza o HTML final com Jet. A resposta é HTML puro e não usa proxy de iframe nem micro frontend no cliente. Para SPAs e componentes externos, consulte [Páginas de Componente](#páginas-de-componente).

Páginas de template são renderizadas no servidor com templates Jet. Os dados são injetados por `data.set`, `data.data_func` e `data.resources`:

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

Páginas de componente apontam para SPAs ou micro frontends externos carregados pelo Web Host com o mecanismo de página configurado: iframe por padrão ou Web Fragment quando habilitado. Suas entradas de registro definem a URL, o controle de acesso, a rota de montagem e sobrescritas de configuração por página.

> **Formato obrigatório do registro:** páginas de componente usam `kind: registry.entry` com `meta.type: view.page`. `view.page` nunca é um valor de `kind`. Sobrescritas de implantação do proxy ficam em `meta.proxy`, não em `data.proxy`.

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

A API retorna um descritor de componente com a URL base resolvida. O Web Host renderiza a SPA com o mecanismo de iframe ou Web Fragment selecionado. Páginas em iframe aplicam as injeções de proxy solicitadas pelo pacote frontend; o gateway de Fragment usa seu próprio caminho fixo de transformação e injeção de CSS do Host.

### Campos da Página de Componente

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `meta.name` | string | — | Nome da página. Mantenha-o no YAML do registro porque `/pages/list` não carrega metadados do bundle |
| `meta.title` | string | — | Título exibido. Mantenha-o no YAML porque `/pages/list` ordena os títulos brutos do registro |
| `meta.url` | string | — | Prefixo da URL base onde o bundle está montado, em uma CDN ou caminho `http.static` |
| `meta.base_path` | string | — | Subdiretório dentro da montagem estática |
| `meta.entry_point` | string | `wippy.path` do bundle, depois `index.html` | Arquivo HTML de entrada, combinado como `<url>/<base_path>/<entry_point>` |
| `meta.mountRoute` | string | — | Reserva uma rota no host; somente `/:part(.*)*` ou `/<literal-prefix>/:part(.*)*` são aceitos. Padrões Vue Router arbitrários retornam HTTP 500. Consulte [view-page.md](../frontend/frontend-registry/view-page.md) e [dynamic-routing.md](../frontend/frontend-registry/dynamic-routing.md) |
| `meta.announced` | boolean | `announced or public or false` | Exibe na navegação e em `/pages/list`; `public: true` prevalece sobre `announced: false` explícito |
| `meta.secure` | boolean | `false` | Exige autenticação |
| `meta.render_engine` | string | `wippy.renderEngine` do bundle | Preferência por página: `auto`, `iframe` ou `fragment` |
| `meta.config_overrides` | object | — | Sobrescritas AppConfig por página em camelCase, mescladas recursivamente sobre os padrões do bundle |

Ao criar o descritor, o `wippy/views` solicita `wippy-meta.json` da raiz resolvida do bundle. O YAML do registro prevalece campo a campo; os metadados do bundle preenchem campos omitidos, como versão, caminho de entrada, proxy, mecanismo de renderização e sobrescritas. Se os metadados não puderem ser usados, o módulo recorre ao descritor YAML legado. Mantenha `meta.name` e `meta.title` no YAML: `/pages/list` consome os campos brutos sem buscar o bundle, e títulos ausentes podem quebrar a ordenação. `config_overrides` aceita `customization`, `axiosDefaults`, `routePrefix`, `apiRoutes` e `themeMode`.

### Injeção de Proxy

Para páginas SPA, configure a injeção no bloco camelCase `wippy.proxy.injections` do pacote frontend, dentro de `wippy.proxy`. O build grava essa configuração em `wippy-meta.json`. Uma implantação pode sobrescrevê-la com um bloco camelCase `proxy:` em `meta:`, com o mesmo formato e wrapper `injections`. O host mescla a configuração da implantação sobre a do bundle, e o YAML prevalece em cada chave aninhada. Não há formato snake_case nem normalização de caixa. `config_overrides` mescla apenas `customization`, `axiosDefaults`, `routePrefix`, `apiRoutes` e `themeMode`; ele não afeta `proxy.injections`. Consulte [Aplicações de Micro Frontend (`view.page`)](../frontend/frontend-registry/view-page.md) e [Injeção de CSS](../frontend/web-host/css-injection.md).

Exemplo de sobrescrita da implantação:

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      proxy:
        injections:
          css:
            themeConfig: true
            customCss: true
            customVariables: true
          tailwindConfig: false
```

## Componentes de View

Componentes de view são elementos personalizados reutilizáveis descobertos e registrados pelo Web Host. Eles não são páginas nem aparecem na navegação. Como nas páginas de componente, suas entradas definem as políticas de roteamento e implantação:

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

Componentes usam `meta.type: view.component` em vez de `view.page`. O YAML pode sobrescrever `tag_name`, `entry_point`, `props` e `events`; caso contrário, esses campos vêm de `wippy-meta.json`, com `index.js` como fallback final. Componentes não usam o bloco de injeção do proxy de iframe da página. O CSS de plataforma no Shadow DOM é solicitado pela implementação por `hostCssKeys`. Consulte [Componentes Web (`view.component`)](../frontend/frontend-registry/view-component.md) e [Injeção de CSS](../frontend/web-host/css-injection.md).

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
| GET | `/pages/content/{id}` | Renderiza uma página ou retorna o descritor do componente |
| GET | `/pages/public/{id}` | Obtém a URL base do componente |
| GET | `/components/by-tag/{tag}` | Resolve o nome de uma tag personalizada para seu descritor `view.component`, usado por `loadByTagName` no host |
| GET | `/pages/routes` | Retorna o mapa `mountRoute` → `pageId`; responde HTTP 500 para rotas inválidas ou duplicadas. Não é filtrado por `announced`, pois páginas ocultas ainda precisam de resolução; o controle de acesso se aplica às páginas seguras |

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

As flags de injeção de `css` são `themeConfig`, `iframe`, `primevue`, `markdown`, `customCss` e `customVariables`. Não há flag `fonts`: Google Fonts são entregues por `theming.global.customCSS`, com uma regra `@import`, injetada por `customCss`.

## Gateway de Web Fragments

Quando o Web Host renderiza uma página com o [mecanismo de fragmentos](../frontend/web-host/render-engines.md), ela é montada como `<web-fragment src="/@fragment/{id}/">`. O `wippy/views` oferece esse contrato por um endpoint dedicado em **`/@fragment/{id}/{path...}`**.

Ao contrário da API de views, montada no `api_router` do consumidor, o gateway declara seu próprio `http.router` de nível superior em `/@fragment`, tornando-o roteável por cache de CDN e independente de `token_auth`. A autenticação ocorre no cliente pelo handshake do proxy de fragmento injetado com o host. Consumidores não precisam de entrada de roteador nem parâmetro `fragment_router`, e aplicações com iframe não exigem configuração de fragmentos.

O roteador automontado se vincula ao requisito `server`, cujo padrão é `app:gateway`. Se o `http.service` da aplicação tiver outro ID, defina o parâmetro `server` do `wippy/views`:

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
      - name: server                 # optional — only if your http.service id ≠ app:gateway
        value: app:my_http_service
```

> **Disponibilidade de fragmentos.** Uma página que define `wippy.renderEngine: "fragment"` em uma implantação baseada em iframe usa uma verificação de capacidade em runtime. Se o gateway ou `proxy-fragment.js` estiver indisponível, ela permanece no iframe sem relatar erro. A configuração global `render_engine: fragment` não faz essa verificação.

### Contrato de Reframing

O gateway responde à mesma URL `/@fragment/{id}/` de três formas, distinguidas pelo cabeçalho `Sec-Fetch-Dest` e pelo subcaminho:

| Requisição | Resposta |
|------------|----------|
| Carregamento do iframe do realm (`Sec-Fetch-Dest: iframe`) | Um pequeno **stub reframed** com o import map do host, `loading.js` e `proxy-fragment.js`. |
| Busca do documento (subcaminho vazio) | O HTML da aplicação transformado para o realm: remove o primeiro import map e o placeholder de desenvolvimento, reescreve atributos relativos `href="./…"` e `src="./…"`, injeta links de CSS do Host e renomeia `<html>`/`<head>`/`<body>` para `<wf-*>`. O gateway não injeta `<base>`. |
| Recurso (subcaminho não vazio) | Encaminhado para o `base_url` real da página mais o subcaminho. |

As respostas incluem `Cache-Control`: o stub pode ser compartilhado em cache (`public, max-age=300`); o documento e os recursos protegidos são `private`, pois passam por `can_access` por usuário. Erros de runtime são respostas HTTP explícitas: `400 Missing fragment id`, `404 Fragment page not found`, `401 Access denied`, `502 Fragment document fetch failed: … (url: …)`.

O frontend seleciona o mecanismo e monta o fragmento; consulte [Mecanismos de Renderização](../frontend/web-host/render-engines.md).

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

- [Facade](framework/facade.md) — Facade do frontend e barra lateral de navegação
- [Template](system/template.md) — Motor de templates Jet
- [Segurança](system/security.md) — Atores e controle de acesso
- [Ambiente](system/env.md) — Armazenamento de variáveis de ambiente
- [Visão Geral do Framework](framework/overview.md) — Uso dos módulos do framework
- [Aplicações de Micro Frontend (`view.page`)](../frontend/frontend-registry/view-page.md) — Referência completa de metadados e injeção de proxy de `view.page`
- [Componentes Web (`view.component`)](../frontend/frontend-registry/view-component.md) — Referência de autoload e props de `view.component`
- [Mecanismos de Renderização](../frontend/web-host/render-engines.md) — Renderização de páginas por iframe e Web Fragment
