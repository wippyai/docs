---
title: "Facade"
description: "O módulo wippy/facade fornece uma facade portátil que carrega e configura o frontend do Wippy a partir de um CDN. Ele serve uma página HTML enxuta que carrega…"
---

# Facade

O módulo `wippy/facade` fornece uma facade portátil que carrega e configura o frontend do Wippy a partir de um CDN. Ele serve uma página HTML enxuta que carrega a entrada JS-module do Web Host (`module.js` para o shell de compatibilidade padrão, ou `managed-layout.js` para o modo gerenciado), trata a autenticação e faz a ponte da configuração entre backend e frontend. O módulo carregado assume a página inteira e seu histórico de navegação.

A entrega baseada em iframe (`iframe.html` + o handshake PostMessage `SetConfig`) continua disponível para embeddings manuais, sem facade, nos quais você mesmo incorpora o host para isolamento ou uso parcial da página, mas a própria facade não a utiliza mais.

## Setup

Adicione o módulo ao seu projeto:

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
|-----------|----------|---------|-------------|
| `server` | sim | — | Servidor HTTP para servir estáticos e páginas |
| `router` | sim | — | Router de API pública para o endpoint de config |
| `fe_facade_url` | não | `https://web-host.wippy.ai/<release-tag>` | URL base do CDN para o bundle do frontend |
| `fe_entry_path` | não | `/iframe.html` | Caminho da entrada **iframe** no bundle, usado pelo modo de embedding por iframe. A página da facade atual carrega a entrada JS-module (`module.js`/`managed-layout.js`); este caminho de iframe permanece disponível para embeddings manuais por iframe, sem facade. |
| `fe_mode` | não | `compat` | Qual shell a página da facade carrega: `compat` carrega `module.js` (o shell de chat padrão); `managed` carrega `managed-layout.js` (layout declarativo multi-painel, opcional). Exposto em `/facade/config` como `mode`/`module_file`. |
| `host_config_layout` | não | `{}` | Config de layout JSON emitida como `hostConfig.layout`; consumida apenas pelo shell **managed**. |
| `render_engine` | não | `iframe` | Engine de renderização de página, emitida como `hostConfig.renderEngine`. Veja [Engine de renderização](#render-engine). |
| `login_path` | não | `/login.html` | Caminho na origem da página para onde redirecionar usuários não autenticados; funciona com `login_redirect_param`. |
| `login_redirect_param` | não | `""` (desligado) | Nome do parâmetro de query ao qual anexar a URL de retorno pós-login ao redirecionar para `login_path`. Vazio desativa o anexo da URL de retorno. |
| `extra_scripts` | não | `[]` | Array JSON de URLs de scripts extras que a página da facade carrega; emitido em `/facade/config` como `extraScripts`. |

### Engine de renderização

`render_engine` seleciona a [engine de renderização de página](../frontend/web-host/render-engines.md) para toda a implantação. Ela é emitida como `hostConfig.renderEngine` e lida pelo Web Host no seu único ponto de bifurcação da renderização de página.

| Valor | Efeito |
|-------|--------|
| `iframe` _(padrão)_ | Páginas renderizam como iframes srcdoc — a engine principal (padrão). |
| `fragment` | Páginas renderizam como [Web Fragments](../frontend/web-host/render-engines.md) (um realm `reframed` refletido em um shadow root). |

Somente a string exata `fragment` ativa a opção; **qualquer outro valor — incluindo um erro de digitação como `fragmnet` — é reduzido a `iframe`** (à prova de falhas, porém silencioso). Habilitar a engine de fragment também exige o [gateway `/@fragment`](./views.md#web-fragments-gateway), que é auto-provido pelo `wippy/views` (≥ 0.5.9) — sem configuração do consumidor. Uma página pode sobrescrever o padrão da implantação página a página com [`wippy.renderEngine`](../frontend/frontend-registry/view-page.md#render-engine).

### Identidade da Aplicação

| Parâmetro | Padrão | Descrição |
|-----------|---------|-------------|
| `app_title` | `Wippy` | Título exibido na sidebar |
| `app_name` | `Wippy AI` | Nome completo da aplicação |
| `app_icon` | `wippy:logo` | Referência de ícone Iconify |

### Feature Flags

| Parâmetro | Padrão | Descrição |
|-----------|---------|-------------|
| `hide_nav_bar` | `false` | Oculta a sidebar de navegação à esquerda |
| `disable_right_panel` | `false` | Desativa o painel lateral direito |
| `start_nav_open` | `false` | Gaveta de navegação aberta por padrão |
| `show_admin` | `true` | Exibe o toggle do painel admin |
| `allow_select_model` | `false` | Permite que o usuário selecione o modelo LLM |
| `session_type` | `non-persistent` | Armazenamento do token de auth: `non-persistent` (em memória) ou `cookie`. O Web Host trata qualquer valor diferente de `cookie` como `non-persistent`. |
| `history_mode` | `hash` | Modo de histórico do navegador: `hash` ou `browser`. O Web Host trata qualquer valor diferente de `browser` como `hash`. |
| `hide_session_selector` | `false` | Oculta a UI de seleção de sessão |

### Tematização

Três escopos se aplicam: **global** (em todos os lugares), **host** (o chrome do Web Host — sidebar, chat, área de página) e **children** (tanto os iframes de `view.page` filhos **quanto** os web components `view.component`). Para saber qual superfície cada opção alcança, veja a [Matriz de Entrega de CSS](../frontend/web-host/css-injection.md#css-delivery-matrix).

| Parâmetro | Escopo | Padrão | Descrição |
|-----------|-------|---------|-------------|
| `custom_css` | global | Import do Google Fonts | CSS global — alcança o chrome do host, os iframes de `view.page` e os shadow roots de `view.component` (1.0.43+). |
| `css_variables` | global | `{}` | Mapa JSON de CSS custom properties arbitrárias; compilado para os modos Auto e forçado e repassado aos shadow roots dos componentes. |
| `icon_sets` | global | `[]` | URLs de conjuntos de ícones Iconify (apenas JSON inline — sem `fs://`) |
| `host_custom_css` | host | `""` | CSS apenas para o chrome do host — não para os filhos. Restrinja regras baseadas em classe a `.wippy-host-app`. |
| `host_css_variables` | host | `{}` | CSS custom properties apenas para o chrome do host |
| `host_icon_sets` | host | `[]` | Conjuntos de ícones apenas para o host (apenas JSON inline) |
| `children_custom_css` | children | `""` | CSS apenas para os filhos — injetado nos iframes de `view.page` e nos shadow roots de `view.component` (1.0.43+), não no chrome do host |
| `children_css_variables` | children | `{}` | CSS custom properties apenas para os filhos |

**Orientação padrão:** coloque estilos compartilhados/de marca em `custom_css` e `css_variables` (global) — é ali que ~95% da tematização pertence, e isso alcança todas as superfícies. Reserve `host_custom_css` / `host_css_variables` para o chrome exclusivo do host (a sidebar, o painel de chat, os divisores). Um `view.component` opta por não receber o `*_custom_css` do shadow root com `customCss: false`.

#### Modo de tema e persistência

| Parâmetro | Padrão | Descrição |
|-----------|---------|-------------|
| `theme_mode` | `auto` | Tema forçado para host + filhos: `auto` (segue o SO), `light` ou `dark`. Emitido em `/facade/config` como `themeMode`. |
| `theme_persist` | `none` | Persiste o tema escolhido pelo usuário entre recarregamentos: `none`, `cookie` ou `localStorage`. No modo `cookie` o shell renderizado por Jet lê o cookie no servidor e aplica a classe `w-theme-*` antes da primeira pintura (sem flash). Emitido como `themePersist`. |
| `theme_storage_key` | `@wippy-theme-mode` | Chave de cookie / localStorage sob a qual o modo é armazenado. Emitida como `themeStorageKey` e embutida no `/facade/theme-persist.js` gerado. |

A persistência de tema é **opcional**: `theme_persist` tem padrão `none`, então nada é armazenado até que uma implantação a defina como `cookie` ou `localStorage`. Quando habilitada, a facade serve um script pronto em **`GET /facade/theme-persist.js`** com a chave e o modo embutidos; inclua-o em qualquer página que deva compartilhar o tema. Veja [Persistência de Tema](../frontend/web-host/theme-persistence.md) para o modelo completo, o evento de host `themeChanged` e a integração com páginas fora do Wippy.

#### Reutilizando a tematização da facade em páginas fora do Web Host

Uma página servida **fora** do Web Host — seu `login.html`, uma página de erro, uma página de confirmação de e-mail — pode reutilizar o *mesmo* tema de marca da facade em vez de duplicá-lo, de modo que seus tokens e regras customizadas fiquem em um só lugar.

Primeiro, mantenha `custom_css` e `css_variables` em arquivos separados em vez de inline, e aponte os parâmetros para esses arquivos com `fs://` mais um filesystem `content_fs`:

```yaml
custom_css:    fs://custom-css.facade.css
css_variables: fs://css-variables.facade.json
content_fs:    app:app_fs
```

Use `fs://` (resolvido por `content_fs` em runtime), **não** `file://` — `file://` é embutido pelo loader do wippy relativo ao YAML no momento do carregamento. Mantenha os arquivos na mesma pasta estática de onde a página do seu `login_path` é servida (em `app`, `static/` servido em `/app`).

A resolução de `fs://` se aplica exatamente aos **seis parâmetros de tematização** — `custom_css`, `css_variables`, `host_custom_css`, `host_css_variables`, `children_custom_css`, `children_css_variables` (strings de CSS são lidas literalmente; arquivos JSON `*_css_variables` são parseados como o mapa de variáveis). `icon_sets` / `host_icon_sets` e todos os demais parâmetros JSON (`api_routes`, `chat`, `tanstack`, …) são **apenas inline**; `fs://` não é resolvido neles.

Uma página independente então referencia ambos:

- **`custom_css`** — já é um arquivo `.css`, então referencie-o diretamente de onde é servido.
- **`css_variables`** — é JSON, portanto não é referenciável como está. A facade o renderiza em **`GET /facade/variables.css`** como bloco base mais os blocos efetivos Auto-light, Auto-dark, Light forçado e Dark forçado. Valores de nível superior se aplicam em todos os lugares; `@light` / `@dark` substituem nomes selecionados. A folha é cacheada por 1h e registrada no mesmo router público de `/facade/config`, portanto carrega o prefixo do router.

```html
<!-- em login.html, servido fora do Web Host -->
<link rel="stylesheet" href="/api/public/facade/variables.css">  <!-- css_variables, CSS gerado -->
<link rel="stylesheet" href="/app/custom-css.facade.css">        <!-- arquivo custom_css -->
```

Para compartilhar também o **modo de tema** (para que um `login.html` respeite e persista a mesma escolha claro/escuro do host), adicione o script de persistência de tema gerado e chame o `write()` dele a partir do seu seletor:

```html
<script src="/api/public/facade/theme-persist.js"></script>
<!-- aplica antecipadamente o tema armazenado e expõe window.wippyThemePersist -->
```

Veja [Persistência de Tema → Páginas não hospedadas pelo Wippy](../frontend/web-host/theme-persistence.md) para um exemplo completo de seletor.

### Parâmetros JSON opcionais

Cada um dos parâmetros abaixo é uma string codificada em JSON; os padrões são vazios (`{}` ou `[]`).

Estes quatro são expostos literalmente sob `hostConfig` para o frontend:

| Parâmetro | Padrão | Descrição |
|-----------|---------|-------------|
| `additional_nav_items` | `[]` | Entradas extras na sidebar |
| `state_cache` | `{}` | Configuração do cache de estado do frontend |
| `allow_additional_tags` | `{}` | Whitelist de tags do sanitizador HTML (`Record<string, string[]>`, tag → atributos permitidos) |
| `chat` | `{}` | Sobrescritas de UI do chat |

Estes três são emitidos como campos de **nível superior** do `AppConfig` (irmãos de `hostConfig`), não sob `hostConfig`:

| Parâmetro | Emitido como | Padrão | Descrição |
|-----------|------------|---------|-------------|
| `api_routes` | `apiRoutes` | `{}` | Sobrescritas de rotas para o frontend |
| `axios_defaults` | `axiosDefaults` | `{}` | Padrões do cliente HTTP axios do frontend |
| `tanstack` | `tanstack` | `{}` | Padrões do TanStack Query: `{ default?, content?, lists? }`. `default` se aplica a todas as queries; `content` mira renderizações de recurso único, `lists` mira queries de navegação/índice. O padrão do host é `refetchOnWindowFocus:false` |

## Config Endpoint

A facade registra `GET /facade/config` no router configurado. Esse caminho é registrado *no* router público, então a URL que a página realmente busca inclui o prefixo do router — com o prefixo de exemplo `/api/public` (veja [Setup](#setup)), ela é `/api/public/facade/config`, que é exatamente o que a página da facade distribuída busca. (A facade registra mais uma rota no mesmo router — `GET /facade/variables.css`, as `css_variables` renderizadas como folha de estilo `text/css` para páginas fora do Web Host; veja [Reutilizando a tematização da facade em páginas fora do Web Host](#reusing-facade-theming-on-non-web-host-pages).) O frontend busca a config no carregamento:

```json
{
    "facade_url": "https://web-host.wippy.ai/<release-tag>",
    "iframe_origin": "https://web-host.wippy.ai",
    "iframe_url": "https://web-host.wippy.ai/<release-tag>/iframe.html?waitForCustomConfig",
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
        "allowAdditionalTags": [],
        "chat":              { "...": "..." }
    }
}
```

A URL da API é lida da variável de ambiente `PUBLIC_API_URL`; `APP_WEBSOCKET_URL` é derivada substituindo `http://` por `ws://` ou `https://` por `wss://`. A tematização tem três escopos (`global`, `host`, `children`) — `host.i18n` carrega a marca da aplicação. As chaves de `hostConfig` estão em camelCase e são montadas a partir dos parâmetros da facade: `session_type`, `history_mode`, `render_engine`, `show_admin`, `allow_select_model`, `start_nav_open`, `hide_nav_bar`, `disable_right_panel`, `hide_session_selector`, mais os opcionais `additional_nav_items`, `state_cache`, `allow_additional_tags` e `chat`. `render_engine` vira `renderEngine` (veja [Engine de renderização](#render-engine)). Os parâmetros `api_routes`, `axios_defaults` e `tanstack` são emitidos como campos de nível superior do `AppConfig` (`apiRoutes`, `axiosDefaults`, `tanstack`), irmãos de `hostConfig`, não dentro dele.

Os campos `facade_url`, `iframe_origin`, `iframe_url`, `login_path`, `mode` e `module_file` são campos de **nível de shell** usados pela página de embedding para se construir — eles não fazem parte do `AppConfig` filho com o qual o host se inicializa. Os campos `iframe_origin`/`iframe_url` são consumidos apenas por embeddings manuais por iframe, sem facade (veja [Ponto de Entrada da Facade](../frontend/web-host/entry-point.md)). O campo `mode` é o `fe_mode` normalizado (`compat` ou `managed`), e `module_file` é a entrada JS-module que a página da facade carrega — `/module.js` para compat, `/managed-layout.js` para managed.

## Navigation Sidebar

Páginas registradas via `wippy/views` aparecem automaticamente na sidebar com base em seus metadados:

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

### Grupos da Sidebar

Páginas com o mesmo valor de `group` são reunidas em seções recolhíveis. Grupos são ordenados por `group_order` (menor primeiro), e as páginas dentro dos grupos por `order`.

| Campo | Descrição |
|-------|-------------|
| `group` | Nome da categoria exibido na sidebar |
| `group_icon` | Ícone para o cabeçalho da categoria |
| `group_order` | Posição de ordenação do grupo (menor = mais acima) |
| `group_placement` | `"sidebar"` (na sidebar) ou `"default"` (apenas na área principal) |

Páginas sem um `group` aparecem como itens de nível superior.

### Controlando a Visibilidade

| Campo | Efeito |
|-------|--------|
| `announced: true` | A página aparece na navegação da sidebar |
| `announced: false` | A página fica oculta da navegação, mas continua acessível por URL |
| `inline: true` | Página interna, oculta de todas as listagens de UI |
| `hide_nav_bar: true` | Parâmetro da facade — oculta toda a sidebar esquerda |

## Publicando com Assets Embutidos

Ao publicar um componente que inclui arquivos estáticos (como o diretório `public/` da facade), use `--embed` para incluir entradas `fs.directory` no pacote:

```bash
wippy publish --embed facade:public_files
```

Sem `--embed`, entradas `fs.directory` são excluídas do pacote publicado. A flag `--embed` aceita IDs de entrada ou nomes que correspondam a entradas `fs.directory`.

## Veja Também

- [Views](./views.md) - Sistema de páginas e componentes
- [HTTP Server](../http/server.md) - Configuração do serviço HTTP
- [Framework Overview](./overview.md) - Uso dos módulos do framework
- [Facade Entry Point](../frontend/web-host/entry-point.md) - Como a facade inicializa o Web Host (perspectiva do FE)
- [CSS Injection](../frontend/web-host/css-injection.md) - Como a tematização da facade flui para os iframes filhos
- [Render Engines](../frontend/web-host/render-engines.md) - Renderização de páginas via iframe vs Web Fragment (o interruptor `render_engine`)
