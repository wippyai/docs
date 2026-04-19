# Views

O módulo `wippy/views` fornece um sistema de páginas e componentes virtuais com renderização de templates, gerenciamento de recursos e mapeamento de variáveis de ambiente. Páginas podem ser respaldadas por templates Jet ou componentes externos (SPAs, micro-frontends).

## Configuração

Adicione o módulo ao seu projeto:

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
| `env_storage` | não | interno | Armazenamento de ambiente que fornece a variavel `PUBLIC_API_URL` |

## Páginas Template

Páginas template renderizam no lado do servidor usando templates Jet:

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
|-------|------|---------|-------------|
| `meta.type` | string | — | Deve ser `view.page` |
| `meta.name` | string | nome da entrada | Identificador da página |
| `meta.title` | string | — | Título de exibição |
| `meta.icon` | string | — | Identificador do ícone |
| `meta.order` | number | `9999` | Ordem de classificação dentro do grupo |
| `meta.group` | string | — | Categoria do grupo |
| `meta.group_icon` | string | — | Ícone do grupo |
| `meta.group_order` | number | `9999` | Ordem de classificação do grupo |
| `meta.group_placement` | string | `"default"` | Posicionamento: `"default"`, `"sidebar"` |
| `meta.secure` | boolean | `false` | Requer autenticação |
| `meta.public` | boolean | `false` | Acessível publicamente |
| `meta.announced` | boolean | `= public` | Mostrar na navegação |
| `meta.inline` | boolean | `false` | Oculto da UI |
| `meta.content_type` | string | `text/html` | Tipo MIME da resposta |
| `meta.parent` | string | — | ID da página pai |

### Dados do Template

| Campo | Descrição |
|-------|-------------|
| `data.set` | ID do registro do conjunto de templates |
| `data.data_func` | ID da função que retorna dados da página |
| `data.resources` | Array de IDs de registro de recursos |

A `data_func` recebe `{ params, query }` e retorna uma tabela que se torna o contexto `data` no template.

### Pipeline de Renderização

1. Carrega a página do registro
2. Verifica acesso (segurança)
3. Chama `data_func` se definida
4. Coleta recursos: globais + recursos do conjunto de templates + recursos específicos da página
5. Carrega variáveis de ambiente
6. Renderiza o template Jet com o contexto: `{ data, resources, query_params, route_params, env }`

## Páginas de Componente

Páginas de componente apontam para aplicações externas (SPAs, micro-frontends):

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      name: dashboard
      title: Dashboard
      icon: chart-bar
      url: https://cdn.example.com/dashboard/
      secure: true
      announced: true
    data:
      proxy:
        enabled: true
        css:
          prime_vue: true
          theme_config: true
        tailwind_config: true
```

A API retorna um descritor de componente com a URL base e configuração de proxy. O frontend renderiza o componente em um iframe ou inline.

### Campos do Componente

| Campo | Tipo | Padrão | Descrição |
|-------|------|---------|-------------|
| `meta.url` | string | — | URL pública do componente |
| `meta.entry_point` | string | `index.html` (páginas), `index.js` (componentes) | Arquivo de entrada |

### Configuração do Proxy

O proxy controla qual CSS e comportamento é injetado no componente:

| Opção | Padrão | Descrição |
|--------|---------|-------------|
| `proxy.enabled` | `true` | Habilita o wrapper de proxy |
| `proxy.css.fonts` | `true` | Injeta estilos de fontes |
| `proxy.css.theme_config` | `true` | Injeta variáveis de tema |
| `proxy.css.iframe` | `true` | Estilos específicos de iframe |
| `proxy.css.prime_vue` | `false` | Estilos de componentes PrimeVue |
| `proxy.css.markdown` | `false` | Estilos de renderização Markdown |
| `proxy.css.custom_css` | `false` | CSS personalizado |
| `proxy.css.custom_variables` | `false` | Variáveis CSS personalizadas |
| `proxy.tailwind_config` | `false` | Injeta configuração do Tailwind |
| `proxy.resize_observer` | `true` | Auto-redimensionar iframe |
| `proxy.prevent_link_clicks` | `true` | Intercepta navegação por links |
| `proxy.iconify_icons` | `false` | Carrega o conjunto de ícones Iconify |

## Componentes de View

Componentes autônomos que não são páginas (sem entrada de navegação):

```yaml
entries:
  - name: widget
    kind: registry.entry
    meta:
      type: view.component
      name: chat-widget
      title: Chat Widget
      url: https://cdn.example.com/chat-widget/
    data:
      proxy:
        enabled: true
```

Componentes usam `meta.type: view.component` em vez de `view.page`. Eles assumem `index.js` como ponto de entrada por padrão.

## Recursos

Recursos são arquivos CSS, JS e fontes associados a páginas:

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
|-------|------|-------------|
| `meta.type` | string | Deve ser `view.resource` |
| `meta.resource_type` | string | Livre para escolher (padrao `"other"`); valores comuns sao `"style"`, `"script"`, `"font"` |
| `meta.order` | number | Ordem de classificação dentro do tipo |
| `meta.global` | boolean | Aplicado a todas as páginas |
| `meta.template_set` | string | Específico para um conjunto de templates |
| `meta.url` | string | URL do recurso |
| `meta.integrity` | string | Hash SRI |
| `meta.crossorigin` | string | `"anonymous"` ou `"use-credentials"` |
| `meta.media` | string | Media query CSS |
| `meta.defer` | boolean | Carregamento de script com defer |
| `meta.async` | boolean | Carregamento de script assíncrono |

### Coleta de Recursos

Recursos são coletados em três camadas, mescladas em ordem:

1. **Recursos globais** — `global: true`, aplicados a todas as páginas
2. **Recursos do conjunto de templates** — combinados pelo ID de `template_set`
3. **Recursos da página** — listados no array `data.resources`

Dentro de cada camada, recursos são agrupados por `resource_type` e ordenados por `order`.

## Mapeamento de Variáveis de Ambiente

O carregador de env mapeia variáveis de ambiente para chaves de contexto do template através de um sistema baseado em prioridade.

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

Cada entrada de mapeamento associa chaves de contexto (usadas em templates como `env.api_endpoint`) com nomes de variáveis de ambiente.

### Sistema de Prioridade

| Faixa | Categoria | Descrição |
|-------|----------|-------------|
| 0–9 | Padrões do framework | Mapeamentos embutidos do framework |
| 10–19 | Sobrescritas do sistema | Configuração a nível de sistema |
| 20–29 | Mapeamentos da aplicação | Mapeamentos específicos da aplicação |
| 30–100 | Sobrescritas de ambiente | Sobrescritas em tempo de execução |

A maior prioridade vence quando múltiplos mapeamentos definem a mesma chave de contexto.

### Usando em Templates

Valores de ambiente resolvidos estão disponíveis no objeto de contexto `env`:

```html
<script>
    window.API_URL = "{{ env.api_endpoint }}";
    document.title = "{{ env.app_title }}";
</script>
```

## Endpoints HTTP da API

O módulo views registra estes endpoints no roteador configurado:

| Método | Caminho | Descrição |
|--------|------|-------------|
| GET | `/pages/list` | Lista páginas anunciadas e acessíveis |
| GET | `/components/list` | Lista componentes de view |
| GET | `/pages/content/{id}` | Renderiza a página ou retorna o descritor do componente |
| GET | `/pages/public/{id}` | Obtém a URL base do componente |

### Resposta de Renderização

Para páginas template, retorna o HTML renderizado com o `content_type` da página.

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
                "css": { "fonts": true, "themeConfig": true, "iframe": true },
                "tailwindConfig": false,
                "resizeObserver": true,
                "preventLinkClicks": true
            }
        }
    }
}
```

## Controle de Acesso

Páginas com `secure: true` exigem autenticação. O registro de páginas verifica `security.can("view", "page:<page_id>")` contra o ator e escopo atuais.

Páginas não seguras estão sempre acessíveis. A flag `announced` controla a visibilidade nas listagens de navegação sem afetar o acesso.

## Qualificação de IDs

IDs relativos em definições de páginas são qualificados com o namespace da entrada:

```yaml
# No namespace "app"
data:
  data_func: my_data_func       # resolve para app:my_data_func
  set: templates:default         # permanece como templates:default (já qualificado)
  resources:
    - page_styles                # resolve para app:page_styles
```

## Veja Também

- [Facade](facade.md) - Facade de iframe do frontend e barra lateral de navegação
- [Template](../system/template.md) - Motor de templates Jet
- [Segurança](../system/security.md) - Atores de segurança e controle de acesso
- [Ambiente](../system/env.md) - Armazenamento de variáveis de ambiente
- [Visão Geral do Framework](overview.md) - Uso do módulo do framework
