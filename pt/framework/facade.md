---
title: "Facade"
description: "Sirva e configure o Wippy Web Host por CDN com autenticação, navegação, temas e opções de implantação."
---

# Facade

O módulo `wippy/facade` serve uma página que carrega e configura o Wippy Web Host a partir de uma CDN. A página carrega `module.js` para o shell de compatibilidade padrão ou `managed-layout.js` para o modo gerenciado, trata a autenticação e envia a configuração do backend ao frontend. O módulo carregado controla a página e seu histórico do navegador.

Em integrações isoladas ou de página parcial, o host também pode ser incorporado manualmente por `iframe.html` e um handshake `SetConfig` via postMessage. A própria facade não usa esse modo de entrega.

Esta página é uma receita parcial de implantação e uma referência de configuração. O bloco de configuração pode ser adaptado a um projeto Wippy existente; os blocos de tema, resposta de configuração, navegação e publicação são exemplos independentes. Forneça páginas de login, entradas de filesystem, recursos estáticos e entradas de view citados pelo trecho adaptado. Para um projeto completo, siga [Servindo o Web Host com Facade](../tutorials/facade.md).

## Configuração

Adicione o módulo ao projeto:

```bash
wippy add wippy/facade
wippy install
```

Declare a dependência:

```yaml
version: "1.0"
namespace: app

entries:
  - name: gateway
    kind: http.service
    addr: :8090
    lifecycle:
      auto_start: true

  - name: api
    kind: http.router
    meta:
      server: app:gateway
    prefix: /api/public

  - name: dep.facade
    kind: ns.dependency
    component: wippy/facade
    version: "*"
    parameters:
      - name: server
        value: app:gateway
      - name: router
        value: app:api
```

### Parâmetros de Configuração

| Parâmetro | Obrigatório | Padrão | Descrição |
|-----------|-------------|--------|-----------|
| `server` | sim | — | Servidor HTTP para arquivos estáticos e páginas |
| `router` | sim | — | Roteador da API pública para o endpoint de configuração |
| `fe_facade_url` | não | `https://web-host.wippy.ai/webcomponents-1.0.56` | URL base da CDN do bundle frontend |
| `fe_entry_path` | não | `/iframe.html` | Caminho da entrada de **iframe** no bundle, usado no modo de incorporação por iframe. A página atual da facade carrega a entrada de módulo JS (`module.js`/`managed-layout.js`); o caminho permanece disponível para incorporações manuais sem facade. |
| `fe_mode` | não | `compat` | Shell carregado: `compat` usa `module.js`; `managed` usa `managed-layout.js`. Exposto por `/facade/config` como `mode`/`module_file`. |
| `host_config_layout` | não | `{}` | Configuração JSON de layout emitida como `hostConfig.layout`, usada apenas pelo shell **managed**. |
| `render_engine` | não | `iframe` | Mecanismo de renderização emitido como `hostConfig.renderEngine`. Consulte [Mecanismo de Renderização](#mecanismo-de-renderização). |
| `login_path` | não | `/login.html` | Caminho na origem para redirecionar usuários não autenticados; funciona com `login_redirect_param`. |
| `login_redirect_param` | não | `""` (desativado) | Nome do parâmetro de query que recebe a URL de retorno após o login. Vazio desativa o acréscimo. |
| `extra_scripts` | não | `[]` | Array JSON de URLs de scripts extras carregados pela facade; emitido como `extraScripts`. |

### Mecanismo de Renderização

`render_engine` seleciona o [mecanismo de renderização](../frontend/web-host/render-engines.md) da implantação inteira. Ele é emitido como `hostConfig.renderEngine` e lido pelo Web Host em seu único ponto de decisão de renderização.

| Valor | Efeito |
|-------|--------|
| `iframe` _(padrão)_ | Páginas são renderizadas como iframes srcdoc, o mecanismo principal. |
| `fragment` | Páginas são renderizadas como [Web Fragments](../frontend/web-host/render-engines.md), um realm `reframed` refletido em shadow root. |

Somente a string exata `fragment` habilita o modo; **qualquer outro valor, inclusive um erro como `fragmnet`, é limitado a `iframe`** de forma silenciosa e segura. O modo fragment também exige o [gateway `/@fragment`](./views.md#gateway-de-web-fragments), fornecido automaticamente por `wippy/views` ≥ 0.5.9. Uma página pode sobrescrever o padrão com [`wippy.renderEngine`](../frontend/frontend-registry/view-page.md#engine-de-renderização).

### Identidade da Aplicação

| Parâmetro | Padrão | Descrição |
|-----------|--------|-----------|
| `app_title` | `Wippy` | Título exibido na barra lateral |
| `app_name` | `Wippy AI` | Nome completo da aplicação |
| `app_icon` | `wippy:logo` | Referência de ícone Iconify |

### Flags de Funcionalidade

| Parâmetro | Padrão | Descrição |
|-----------|--------|-----------|
| `hide_nav_bar` | `false` | Oculta a barra lateral de navegação |
| `disable_right_panel` | `false` | Desabilita o painel lateral direito |
| `start_nav_open` | `false` | Abre a gaveta de navegação por padrão |
| `show_admin` | `true` | Exibe o controle do painel administrativo |
| `allow_select_model` | `false` | Permite selecionar o modelo LLM |
| `session_type` | `non-persistent` | Política de sessão: `cookie` armazena um cookie de token secundário; outros valores viram `non-persistent` e não usam esse cookie. |
| `history_mode` | `hash` | Modo do histórico: `hash` ou `browser`. Qualquer valor diferente de `browser` é tratado como `hash`. |
| `hide_session_selector` | `false` | Oculta o seletor de sessão |

O token de bootstrap do shell é separado de `session_type`. O shell sempre lê `localStorage["@wippy_token_info"]`, interpreta o campo JSON `token` e redireciona para `login_path` quando o valor está ausente ou inválido. Em modo `cookie`, o Web Host também grava o token no cookie `@wippy-gen2/token`; em `non-persistent`, não usa esse cookie secundário.

### Temas

Há três escopos: **global**, **host** (chrome do Web Host) e **children** (contextos `view.page` e componentes `view.component`). Consulte a [Matriz de Entrega de CSS](../frontend/web-host/css-injection.md#matriz-de-entrega-de-css).

| Parâmetro | Escopo | Padrão | Descrição |
|-----------|--------|--------|-----------|
| `custom_css` | global | import do Google Fonts | CSS global, aplicado ao host, páginas e shadow roots de componentes (1.0.43+). |
| `css_variables` | global | `{}` | Mapa JSON de propriedades CSS, compilado para modos Auto e forçados e levado aos shadow roots. |
| `icon_sets` | global | `{}` | Conjuntos Iconify por prefixo, somente JSON inline, sem `fs://` |
| `host_custom_css` | host | `""` | CSS somente do chrome do host. Limite regras por classe a `.wippy-host-app`. |
| `host_css_variables` | host | `{}` | Propriedades CSS somente do host |
| `host_icon_sets` | host | `{}` | Conjuntos de ícones somente do host, em JSON inline |
| `children_custom_css` | children | `""` | CSS somente dos filhos, injetado em páginas e shadow roots (1.0.43+), não no host |
| `children_css_variables` | children | `{}` | Propriedades CSS somente dos filhos |

Coloque a identidade visual compartilhada em `custom_css` e `css_variables`. Use `host_custom_css` e `host_css_variables` para elementos exclusivos do host. Um `view.component` pode rejeitar `*_custom_css` no shadow root com `customCss: false`.

#### Modo e Persistência do Tema

| Parâmetro | Padrão | Descrição |
|-----------|--------|-----------|
| `theme_mode` | `auto` | Tema forçado para host e filhos: `auto`, `light` ou `dark`. Emitido como `themeMode`. |
| `theme_persist` | `none` | Persistência da escolha: `none`, `cookie` ou `localStorage`. Em `cookie`, o shell Jet aplica a classe `w-theme-*` antes da primeira pintura. Emitido como `themePersist`. |
| `theme_storage_key` | `@wippy-theme-mode` | Chave de cookie/localStorage. Emitida como `themeStorageKey` e incorporada a `/facade/theme-persist.js`. |

A persistência é opt-in: `theme_persist` usa `none` por padrão. Quando habilitada, a facade serve **`GET /facade/theme-persist.js`** com chave e modo incorporados. Consulte [Persistência do Tema](../frontend/web-host/theme-persistence.md) para o evento `themeChanged` e integrações externas.

#### Reutilizando o Tema da Facade Fora do Web Host

Uma página externa ao Web Host, como `login.html`, pode reutilizar o tema. Mantenha `custom_css` e `css_variables` em arquivos próprios e aponte os parâmetros com `fs://` e um filesystem `content_fs`:

```yaml
custom_css:    fs://custom-css.facade.css
css_variables: fs://css-variables.facade.json
content_fs:    app:app_fs
```

Use `fs://`, resolvido por `content_fs` em runtime, e não `file://`, que é incorporado pelo loader em relação ao YAML. Mantenha os arquivos em `static/`, servidos pela aplicação em `/app` por uma entrada `app`.

A resolução `fs://` se aplica exatamente aos seis parâmetros `custom_css`, `css_variables`, `host_custom_css`, `host_css_variables`, `children_custom_css` e `children_css_variables`; arquivos `*_css_variables` são interpretados como mapas JSON. `icon_sets`, `host_icon_sets` e os demais parâmetros JSON são somente inline.

Uma página independente vincula ambos:

- **`custom_css`** — arquivo `.css`, vinculado diretamente.
- **`css_variables`** — JSON renderizado pela facade em **`GET /facade/variables.css`** com tipo `text/css`, como blocos base, Auto-light, Auto-dark, Light e Dark. Valores `@light` e `@dark` substituem nomes selecionados. A folha tem cache de 1h e usa o mesmo prefixo do roteador público.

```html
<!-- in login.html, served outside the Web Host -->
<link rel="stylesheet" href="/api/public/facade/variables.css">  <!-- css_variables, generated CSS -->
<link rel="stylesheet" href="/app/custom-css.facade.css">        <!-- custom_css file -->
```

Para compartilhar também o modo do tema, adicione o script gerado e chame `write()` no seletor:

```html
<script src="/api/public/facade/theme-persist.js"></script>
<!-- early-applies the stored theme and exposes window.wippyThemePersist -->
```

Consulte [Persistência do Tema → Páginas fora do Wippy](../frontend/web-host/theme-persistence.md) para um exemplo completo.

### Parâmetros JSON Opcionais

Cada parâmetro abaixo é uma string JSON; os padrões são vazios (`{}` ou `[]`).

Os quatro seguintes são expostos sem alterações em `hostConfig`:

| Parâmetro | Padrão | Descrição |
|-----------|--------|-----------|
| `additional_nav_items` | `[]` | Entradas extras na barra lateral |
| `state_cache` | `{}` | Configuração do cache de estado do frontend |
| `allow_additional_tags` | `{}` | Lista permitida do sanitizador HTML (`Record<string, string[]>`) |
| `chat` | `{}` | Sobrescritas da UI de chat |

Os três seguintes são emitidos como campos de nível superior de `AppConfig`, não dentro de `hostConfig`:

| Parâmetro | Emitido como | Padrão | Descrição |
|-----------|--------------|--------|-----------|
| `api_routes` | `apiRoutes` | `{}` | Sobrescritas de rotas do frontend |
| `axios_defaults` | `axiosDefaults` | `{}` | Padrões do cliente HTTP axios |
| `tanstack` | `tanstack` | `{}` | Padrões do TanStack Query: `{ default?, content?, lists? }`; `default` vale para tudo, `content` para recursos únicos e `lists` para navegação e índices. O padrão do host é `refetchOnWindowFocus:false`. |

## Endpoint de Configuração

A facade registra `GET /facade/config` no roteador público configurado. Com o prefixo `/api/public` da [Configuração](#configuração), a página busca `/api/public/facade/config`. O mesmo roteador expõe `GET /facade/variables.css`, que renderiza `css_variables` como uma folha de estilo `text/css` para páginas fora do Web Host. Consulte [Reutilizando o Tema da Facade Fora do Web Host](#reutilizando-o-tema-da-facade-fora-do-web-host). O frontend busca a configuração ao carregar:

```json
{
    "facade_url": "https://web-host.wippy.ai/webcomponents-1.0.56",
    "iframe_origin": "https://web-host.wippy.ai",
    "iframe_url": "https://web-host.wippy.ai/webcomponents-1.0.56/iframe.html?waitForCustomConfig",
    "login_path": "/login.html",
    "login_redirect_param": null,
    "mode": "compat",
    "module_file": "/module.js",
    "extraScripts": null,
    "env": {
        "APP_API_URL": "https://api.example.com",
        "APP_AUTH_API_URL": "https://api.example.com",
        "APP_WEBSOCKET_URL": "wss://api.example.com"
    },
    "routePrefix": "https://api.example.com",
    "themeMode": "auto",
    "themePersist": "none",
    "themeStorageKey": "@wippy-theme-mode",
    "apiRoutes":     { "...": "..." },
    "axiosDefaults": { "...": "..." },
    "tanstack":      { "lists": { "refetchOnWindowFocus": true } },
    "theming": {
        "global":  { "customCSS": "...", "cssVariables": {}, "iconSets": {} },
        "host":    { "customCSS": "...", "cssVariables": {}, "iconSets": {}, "i18n": { "app": { "title": "Wippy", "icon": "wippy:logo", "appName": "Wippy AI" } } },
        "children": { "customCSS": "...", "cssVariables": {} }
    },
    "hostConfig": {
        "session": { "type": "non-persistent" },
        "history": "hash",
        "renderEngine": "iframe",
        "showAdmin": true,
        "allowSelectModel": false,
        "startNavOpen": false,
        "hideNavBar": false,
        "disableRightPanel": false,
        "hideSessionSelector": false,
        "additionalNavItems": [],
        "stateCache":        { "...": "..." },
        "allowAdditionalTags": { "w-chart": ["data", "type"] },
        "chat":              { "...": "..." }
    }
}
```

A URL da API vem de `PUBLIC_API_URL`; `APP_WEBSOCKET_URL` é derivada pela troca de `http://` por `ws://` ou de `https://` por `wss://`. Os temas usam três escopos (`global`, `host` e `children`), e `host.i18n` contém a identidade da aplicação. As chaves de `hostConfig` usam camelCase e são montadas a partir dos parâmetros da facade: `session_type`, `history_mode`, `render_engine`, `show_admin`, `allow_select_model`, `start_nav_open`, `hide_nav_bar`, `disable_right_panel`, `hide_session_selector`, além dos opcionais `additional_nav_items`, `state_cache`, `allow_additional_tags` e `chat`. `render_engine` se torna `renderEngine` (consulte [Mecanismo de Renderização](#mecanismo-de-renderização)). `api_routes`, `axios_defaults` e `tanstack` são emitidos como campos de nível superior de `AppConfig` (`apiRoutes`, `axiosDefaults` e `tanstack`), no mesmo nível de `hostConfig`, não dentro dele.

Os campos `facade_url`, `iframe_origin`, `iframe_url`, `login_path`, `mode` e `module_file` pertencem ao nível do shell usado pela página de incorporação; não fazem parte do `AppConfig` filho com que o host é inicializado. `iframe_origin` e `iframe_url` são usados apenas por incorporações manuais de iframe sem facade (consulte [Ponto de Entrada da Facade](../frontend/web-host/entry-point.md)). `mode` é o `fe_mode` normalizado (`compat` ou `managed`), e `module_file` é a entrada de módulo JavaScript carregada pela página da facade: `/module.js` no modo compat e `/managed-layout.js` no modo managed.

## Barra Lateral de Navegação

Páginas registradas por `wippy/views` aparecem automaticamente conforme seus metadados:

```yaml
entries:
  - name: dashboard
    kind: registry.entry
    meta:
      type: view.page
      name: dashboard
      title: Dashboard
      icon: tabler:chart-bar
      group: Analytics
      group_icon: tabler:chart-dots
      group_order: 10
      order: 1
      announced: true
      secure: true
      url: https://cdn.example.com/dashboard/
```

### Grupos da Barra Lateral

Páginas com o mesmo `group` formam seções recolhíveis. Os grupos são ordenados por `group_order`, e as páginas por `order`.

| Campo | Descrição |
|-------|-----------|
| `group` | Nome da categoria exibida |
| `group_icon` | Ícone do cabeçalho da categoria |
| `group_order` | Posição do grupo, menor primeiro |
| `group_placement` | `"sidebar"` ou `"default"` |

Páginas sem `group` aparecem no nível superior.

### Controlando a Visibilidade

| Campo | Efeito |
|-------|--------|
| `announced: true` | A página aparece na navegação |
| `announced: false` | Fica oculta, mas ainda acessível pela URL |
| `inline: true` | Página interna, oculta de todas as listagens |
| `hide_nav_bar: true` | Parâmetro da facade que oculta toda a barra lateral |

## Publicando com Recursos Incorporados

Ao publicar um componente com arquivos estáticos, como o diretório `public/` da facade, use `--embed` para incluir entradas `fs.directory`:

```bash
wippy publish --embed facade:public_files
```

Sem `--embed`, entradas `fs.directory` são excluídas do pacote. A flag aceita IDs ou nomes dessas entradas.

## Veja Também

- [Views](framework/views.md) — Sistema de páginas e componentes
- [Servidor HTTP](http/server.md) — Configuração do serviço HTTP
- [Visão Geral do Framework](framework/overview.md) — Uso dos módulos do framework
- [Ponto de Entrada da Facade](../frontend/web-host/entry-point.md) — Como a facade inicia o Web Host
- [Injeção de CSS](../frontend/web-host/css-injection.md) — Como o tema chega aos iframes filhos
- [Mecanismos de Renderização](../frontend/web-host/render-engines.md) — Renderização por iframe e Web Fragment
