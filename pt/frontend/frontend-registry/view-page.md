---
title: "Apps Micro Frontend (view.page)"
description: "Uma entrada view.page descreve uma aplicação single-page completa que o Web Host carrega dentro de um iframe. Cada entrada de página reivindica um caminho de URL no host…"
---

# Apps Micro Frontend (view.page)

Uma entrada `view.page` descreve uma aplicação single-page completa que o Web Host carrega dentro de um iframe. Cada entrada de página reivindica um caminho de URL no roteador do host, recebe seu próprio contexto de navegação isolado e recebe CSS e configuração injetados pelo host através da camada de proxy.

## Campos de Frontend (bloco wippy do package.json)

Estes campos são escritos pelo desenvolvedor de FE no bloco `wippy` do `package.json`. O plugin do vite os grava no `wippy-meta.json` em tempo de build, e o `wippy/views` os lê de lá como padrões.

> **Todos os campos desta seção podem ser sobrescritos pelo operador no `_index.yaml`. O YAML sempre tem precedência.**

### Exibição e Navegação

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `title` | string | — | Rótulo exibido na barra lateral de navegação e na aba do navegador |
| `icon` | string | — | Referência de ícone Iconify, por exemplo `tabler:layout-dashboard` |
| `type` | string | — | Deve ser `"page"` |
| `path` | string | — | Caminho até o arquivo HTML de entrada compilado, dentro do diretório de saída do bundle |

### Render engine

`renderEngine` seleciona a [render engine da página](../web-host/render-engines.md) para esta página (apenas `view.page`). A engine é transparente para o código do app — a mesma página renderiza de forma idêntica em ambos os casos — então defina-a apenas para tirar uma página da engine de fragment, ou colocá-la nela.

| Valor | Efeito |
|-------|--------|
| `"auto"` _(padrão, ou omitido)_ | Segue o switch global do deployment (`hostConfig.renderEngine`, definido pelo parâmetro de facade [`render_engine`](../../framework/facade.md#render-engine)). |
| `"iframe"` | Sempre renderiza como um iframe srcdoc, independentemente do switch. Use para páginas com tecnologia incompatível com reframing — hit-testing de ponteiro (`elementFromPoint`), layout com unidades de viewport (`vh`/`vw`, `matchMedia`), `position: fixed`. |
| `"fragment"` | Prefere a engine [Web Fragment](../web-host/render-engines.md). Em um deployment global-`fragment`: sempre. Em um deployment global-`iframe`: apenas se uma sondagem de capacidade em runtime confirmar que o [gateway `/@fragment`](../../framework/views.md#web-fragments-gateway) + proxy estão presentes (com fallback seguro para iframe caso contrário). |

```json
{
  "wippy": {
    "type": "page",
    "renderEngine": "auto"
  }
}
```

Veja [Render Engines](../web-host/render-engines.md) para o modelo completo de engines e as limitações de fragment.

### Configuração do Proxy

A injeção de proxy tem duas superfícies. O desenvolvedor de FE escreve os padrões
no bloco `wippy` do `package.json` do frontend com chaves em lower-camel-case
(`themeConfig`, `primevue`, `customCss`); o plugin do Vite as grava no
`wippy-meta.json`. O operador as sobrescreve com um bloco `proxy:` sob
`meta:` no YAML do registry. Os campos do registry seguem seu schema documentado, e não
uma regra universal de casing. Chaves aninhadas de proxy mantêm seus nomes definidos em
lower-camel-case, e o host faz deep-merge desse YAML sobre os padrões de frontend
gravados, sem converter chaves.

```json
{
  "wippy": {
    "type": "page",
    "proxy": {
      "enabled": true,
      "injections": {
        "css": {
          "themeConfig": true,
          "iframe": true,
          "primevue": true,
          "markdown": false,
          "customCss": true,
          "customVariables": true
        },
        "tailwindConfig": false,
        "resizeObserver": false,
        "preventLinkClicks": false,
        "iconifyIcons": false,
        "errorCapture": true
      }
    }
  }
}
```

`proxy.enabled: true` significa que o Web Host envolve a página em seu harness de iframe de proxy, que escreve `window.__WIPPY_APP_CONFIG__` e globais relacionados antes de o bundle da página ser avaliado.

Se `proxy.injections` for omitido, o proxy de iframe usa padrões de runtime permissivos e habilita a maioria das injeções. A lista abaixo mostra os **valores explícitos recomendados para um app micro frontend Vite típico** — não os padrões de runtime — para que revisores de pacote possam ver a intenção da página.

#### Valores explícitos de injeção recomendados

Estas são as flags que um app micro frontend normalmente declara e o valor a definir para um SPA Vite típico. Elas não são os padrões de runtime.

- `css.themeConfig` (`true`) — propriedades CSS customizadas do tema ativo
- `css.iframe` (`true`) — estilização padrão obrigatória de scrollbar tematizada; `iframe` é um nome histórico e a folha atual não fornece resets de layout
- `css.primevue` (`true`) — estilos base de componentes PrimeVue
- `css.markdown` (`false`) — estilos de renderização de markdown
- `css.customCss` (`true`) — CSS customizado projetado pelo filho
- `css.customVariables` (`true`) — sobrescritas de variáveis CSS projetadas pelo filho
- `tailwindConfig` (`false`) — objeto de configuração Tailwind do host (apenas Tailwind via CDN)
- `resizeObserver` (`false` para SPAs completos) — atualizações do tamanho do body do filho para o host
- `preventLinkClicks` (`false` para páginas) — roteia cliques em `<a>` através de `classifyLink`
- `iconifyIcons` (`false`) — pré-carrega coleções Iconify do host
- `errorCapture` (`true`) — encaminha erros não capturados do iframe para o host

A maioria das páginas SPA completas define `resizeObserver: false` e `preventLinkClicks: false` porque gerenciam seu próprio layout e roteamento. O app `main` do template define `errorCapture: true` para expor erros não capturados durante o desenvolvimento.

Não existe uma flag dedicada de injeção de web fonts. Google Fonts são entregues através de `theming.global.customCSS` (um `@import` no CSS customizado do tema), injetado pela flag `css.customCss` existente.

Referência completa de flags e padrões de runtime: [Injeção de CSS](../web-host/css-injection.md).

## Configuração do Operador (_index.yaml)

Estes campos são definidos pelo operador no bloco `meta` da entrada de registry do `_index.yaml`. A maioria deles — `announced`, `secure`, `url`, `base_path`, `mountRoute`, `auto_register`, `inline` — representa política de deployment (roteamento, controle de acesso e serving) que só faz sentido em tempo de deploy e não possui superfície de autoria no `package.json`. A única exceção é `entry_point`: ele é **autorado pelo FE** (o plugin do vite exige `wippy.path` no `package.json` e o grava no `wippy-meta.json`), e o campo `meta.entry_point` é apenas uma **sobrescrita opcional por deployment** desse padrão gravado.

> **Formato YAML obrigatório:** uma entrada de página é `kind: registry.entry` com `meta.type: view.page`. Não escreva `kind: view.page`.

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
    name: main
```

> **Os campos de política de deployment (`announced`, `secure`, `url`, `base_path`, `mountRoute`, `auto_register`, `inline`) não podem ser definidos no `package.json` — eles são definidos pelo operador para cada ambiente. `entry_point` é diferente: é autorado como `wippy.path` no `package.json`, e o valor em YAML apenas sobrescreve esse padrão.**

### URL e Serving de Arquivos

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `url` | string | — | Prefixo de URL base onde o bundle está montado (origem de CDN ou caminho `http.static` local). Somente YAML — sem superfície no `package.json` |
| `base_path` | string | — | Subdiretório dentro do mount estático. Somente YAML — sem superfície no `package.json` |
| `entry_point` | string | `index.html` | Arquivo HTML a carregar; combinado com `url` e `base_path`. Autorado pelo FE como `wippy.path` no `package.json` (gravado no `wippy-meta.json`); o valor em YAML é uma sobrescrita opcional por deployment |

A URL de entrada resolvida é `<url>/<base_path>/<entry_point>`. Um operador faz deploy do mesmo bundle sob múltiplas entradas apontando diferentes entradas de `_index.yaml` para o mesmo `base_path` com valores diferentes de `entry_point` ou `config_overrides`.

Diferente de `url` e `base_path`, `entry_point` não é um campo exclusivo de deploy. Ele é autorado pelo desenvolvedor de FE como `wippy.path` no bloco `wippy` do `package.json` e gravado no `wippy-meta.json` pelo plugin do vite — o plugin o **exige** e lança `wippy.path is required for a page package` se for omitido. O campo `meta.entry_point` no `_index.yaml` apenas sobrescreve esse padrão gravado por deployment; a ordem de resolução é `entry_point` do YAML → `wippy.path` do bundle → `index.html`.

### Visibilidade e Acesso

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `announced` | boolean | — | `true` → a página aparece em `GET /api/public/pages/list` e na barra lateral de navegação |
| `secure` | boolean | `false` | `true` → exige autenticação; requisições não autenticadas recebem 401 |
| `inline` | boolean | `false` | `true` → a página fica oculta em todas as listagens (barra lateral, API); use para visualizadores de artefatos incorporados ou rotas auxiliares |

`announced: false` oculta a página da navegação, mas não impede o carregamento. Um iframe ou uma URL direta ainda funcionam. `inline: true` é mais restritivo — ele suprime a página de todas as listagens públicas.

### Rota de Mount

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `mountRoute` | string | — | Reivindica um caminho de URL no roteador do host; o host renderiza esta página quando o navegador navega para um caminho correspondente |

> **Grafia temporária de compatibilidade:** `meta.mountRoute` é um bug de casing
> atual do backend. O campo pretendido no backend é `meta.mount_route`, e espera-se
> que uma versão futura do backend o altere. Use `meta.mountRoute` até que essa
> mudança de backend seja lançada; verifique novamente a versão do Wippy de destino ao atualizar.

`mountRoute` aceita apenas a forma catch-all v1 — `/:part(.*)*` (raiz) ou `/<prefixo-literal>/:part(.*)*`, onde o prefixo consiste em um ou mais segmentos alfanuméricos minúsculos com hífen, terminando no wildcard obrigatório `:part(.*)*`. Padrões arbitrários do Vue Router — parâmetros nomeados, regex customizada ou um nome de parâmetro diferente (por exemplo, `/home/:id`, `/users/:userId(\d+)`) — são rejeitados: o host levanta um conflito de mount-route do tipo `syntax` e `GET /api/public/pages/routes` retorna HTTP 500, renderizado como um erro fatal em tela cheia. O wildcard `:part(.*)*` permite que a aplicação filha gerencie suas próprias sub-rotas enquanto o host mantém a propriedade do caminho de nível superior.

```yaml
mountRoute: /home/:part(.*)*
```

Quando o Web Host inicia, ele busca `GET /api/public/pages/routes` e chama `router.addRoute()` para cada entrada que tenha um `mountRoute`. Veja [Roteamento Dinâmico](./dynamic-routing.md) para o mecanismo completo de sincronização.

### Sobrescritas de Configuração por Página

| Campo | Tipo | Descrição |
|---|---|---|
| `config_overrides` | object | Deep-merge sobre os valores de AppConfig que o Web Host injeta no iframe |

`config_overrides` é o nome do wrapper no registry. Seu objeto aninhado já usa
as chaves em lower-camel-case do schema do frontend, como
`customization.customCSS` e `customization.cssVariables`. O Web Host
faz deep-merge dessas chaves exatas sobre o `wippy.configOverrides` do bundle
vindo do `wippy-meta.json`; o valor do YAML vence por chave aninhada.

`config_overrides` altera o AppConfig injetado na página. Ele **não** altera as flags de injeção do proxy. Em particular, `config_overrides` nunca afeta `proxy.injections`, `wippy.proxy.injections` ou os padrões de runtime para injeção de CSS/script. Para sobrescrever flags de injeção do proxy em um deployment, use `meta.proxy` conforme descrito em [Sobrescrita de proxy pelo operador](#operator-proxy-override-_indexyaml).

Um caso de uso típico é executar o mesmo bundle com uma paleta de cores customizada:

```yaml
- name: iframe-demo-themed
  kind: registry.entry
  meta:
    type: view.page
    name: iframe-demo-themed
    title: Iframe Demo (Custom Palette)
    icon: tabler:paint
    order: 4
    announced: false
    secure: false
    url: /app
    base_path: app/iframe-demo
    entry_point: app.html
    mountRoute: /demo-themed/:part(.*)*
    config_overrides:
      customization:
        cssVariables:
          "--p-primary": "#7c9ed9"
          "--p-primary-color": "#7c9ed9"
          "--p-danger": "#e8a0a0"
        customCSS: |
          /* Os valores de paleta aqui são uma definição intencional de tema de página, não CSS de módulo. */
          :root { font-family: var(--wippy-brand-font, sans-serif); }
```

Note que `announced: false` é válido para entradas `view.page` — a página é acessível via seu `mountRoute`, mas não aparece na barra lateral.

### Sobrescrita de proxy pelo operador (_index.yaml)

Os padrões de injeção de proxy gravados no `wippy-meta.json` (a partir do
bloco `wippy` do `package.json`) podem ser sobrescritos por deployment com um bloco
`proxy:` colocado **sob `meta:`** na entrada do registry. Nomes de requisitos de facade
usam seus nomes documentados em snake_case. Os campos do registry atualmente incluem um
bug temporário de casing no backend: o wrapper é `config_overrides`, enquanto o campo de
rota ainda é lido como `mountRoute` até ser corrigido para `mount_route`.
Objetos aninhados de proxy/config são repassados e mantêm suas chaves definidas em
lower-camel-case. O host faz deep-merge de `meta.proxy` sobre o `wippy.proxy` do bundle.

Resposta curta: use `meta.proxy`, não `data.proxy`; mantenha campos de backend de nível superior
como `config_overrides` em snake_case, mas preserve chaves aninhadas de proxy/config
como `themeConfig` e `customCss`; mantenha o wrapper `injections`.
Não invente `meta.config` ou `meta.configOverrides`; o wrapper exato de
sobrescrita por página é `meta.config_overrides`.

Mantenha as duas grafias de frontend distintas:

- O `meta.proxy.injections.css.customCss` do backend permanece
  `wippy.proxy.injections.css.customCss`.
- O `meta.config_overrides.customization.customCSS` do backend projeta para
  o `wippy.configOverrides.customization.customCSS` do frontend e para o
  `config.theming.global.customCSS` do runtime.
- Não invente um wrapper `appConfig` em torno de nenhum dos formatos de frontend.

```yaml
- name: dashboard
  kind: registry.entry
  meta:
    type: view.page
    name: dashboard
    url: /app
    base_path: app/dashboard
    entry_point: app.html
    proxy:
      enabled: true
      injections:
        css:
          themeConfig: true
          iframe: true
          primevue: true
          customCss: true
          customVariables: true
        tailwindConfig: false
        iconifyIcons: false
```

Apenas as chaves que você define são sobrescritas; todo o resto mantém o valor gravado no `wippy-meta.json`. Referência completa de flags e padrões de runtime: [Injeção de CSS](../web-host/css-injection.md).
