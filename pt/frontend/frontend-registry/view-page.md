---
title: "Apps de micro frontend (view.page)"
description: "Referência para declarar, rotear, servir e configurar um app de micro frontend view.page."
---

# Apps de micro frontend (view.page)

Uma entrada `view.page` descreve uma aplicação single-page completa que o Web
Host carrega pelo engine selecionado, iframe ou Web Fragment. Cada entrada pode
assumir uma rota do host e recebe CSS, configuração e APIs do host pelo adapter
de proxy do engine.

## Campos do frontend (bloco wippy de package.json)

O desenvolvedor frontend define estes campos no bloco `wippy` de
`package.json`. O plugin do Vite os incorpora em `wippy-meta.json` durante o
build, e `wippy/views` os lê dali como defaults.

> **Todos os campos desta seção podem ser sobrescritos pelo operador em `_index.yaml`. O YAML sempre tem precedência.**

### Exibição e navegação

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `title` | string | — | Rótulo exibido na barra lateral de navegação e na aba do navegador |
| `icon` | string | — | Referência de ícone Iconify, por exemplo `tabler:layout-dashboard` |
| `type` | string | — | Deve ser `"page"` |
| `path` | string | — | Caminho para o arquivo HTML de entrada compilado dentro do diretório de saída do bundle |

### Engine de renderização

`renderEngine` seleciona o [engine de renderização de página](../web-host/render-engines.md) para esta página (somente `view.page`). A Proxy API é portátil entre engines, mas o layout do navegador e o comportamento do DOM podem variar; revise as limitações de fragment antes de escolher esse engine para uma página.

| Valor | Efeito |
|-------|--------|
| `"auto"` _(padrão ou omitido)_ | Segue a opção global da implantação (`hostConfig.renderEngine`, definida pelo parâmetro [`render_engine`](../../framework/facade.md) da facade). |
| `"iframe"` | Sempre renderiza como iframe srcdoc, independentemente da opção global. Use em páginas com tecnologia incompatível com reframing — hit testing de ponteiro (`elementFromPoint`), layout com unidades de viewport (`vh`/`vw`, `matchMedia`), `position: fixed`. |
| `"fragment"` | Prefere o engine [Web Fragment](../web-host/render-engines.md). Em uma implantação global `fragment`: sempre. Em uma implantação global `iframe`: somente se uma sondagem de capacidade em runtime confirmar a presença do [gateway `/@fragment`](../../framework/views.md) e da proxy (caso contrário, fallback seguro para iframe). |

```json
{
  "wippy": {
    "type": "page",
    "renderEngine": "auto"
  }
}
```

Consulte [Engines de renderização](../web-host/render-engines.md) para o modelo completo e as limitações de fragment.

### Configuração da proxy

A injeção da proxy tem duas superfícies. O desenvolvedor FE define defaults no
bloco `wippy` do `package.json` frontend, com chaves lower camel case
(`themeConfig`, `primevue`, `customCss`); o plugin do Vite as incorpora em
`wippy-meta.json`. O operador as sobrescreve com um bloco `proxy:` sob `meta:`
no YAML do registro. Os campos do registro seguem o schema documentado, não uma
regra universal de casing. Chaves aninhadas da proxy preservam seus nomes lower
camel case, e o host faz deep merge desse YAML sobre os defaults incorporados
do frontend sem converter chaves.

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

No engine iframe, `proxy.injections` configura os assets adicionados pela proxy
srcdoc. Quando omitido, esse adapter usa defaults permissivos e habilita a
maioria das injeções. O Web Host 1.0.56 transporta `proxy.enabled` como
metadado, mas não o usa como opção de runtime.

O Web Host 1.0.56 não traduz essas flags para o engine Fragment. O gateway
Fragment sempre fornece `loading.js`, `proxy-fragment.js` e as quatro folhas de
estilo do Host (configuração do tema, estilos da barra de rolagem do iframe,
PrimeVue/Tailwind e Markdown); sua proxy também instala a captura de erros
incondicionalmente. Uma página que possa usar iframe como fallback ainda deve
declarar explicitamente a intenção de injeção para iframe.

A lista abaixo mostra os **valores explícitos recomendados para iframe em um app
de micro frontend Vite típico** — não os defaults de runtime — para que revisores
do pacote vejam o comportamento de fallback da página.

#### Valores explícitos de injeção recomendados

Estas são as flags que um app de micro frontend normalmente declara para seu
caminho de entrega por iframe. Elas não são os defaults de runtime, e o gateway
Fragment do Web Host 1.0.56 não as utiliza.

- `css.themeConfig` (`true`) — propriedades CSS personalizadas do tema ativo
- `css.iframe` (`true`) — estilo padrão obrigatório da barra de rolagem com tema; `iframe` é um nome histórico e a folha atual não fornece resets de layout
- `css.primevue` (`true`) — estilos-base dos componentes PrimeVue
- `css.markdown` (`false`) — estilos de renderização de markdown
- `css.customCss` (`true`) — CSS personalizado projetado para o child
- `css.customVariables` (`true`) — overrides de variáveis CSS projetados para o child
- `tailwindConfig` (`false`) — objeto de configuração Tailwind do host (somente Tailwind CDN)
- `resizeObserver` (`false` em SPAs completas) — atualizações do tamanho do body do child para o host
- `preventLinkClicks` (`false` em páginas) — instala o hook de classificação de `<a>` bruto do engine iframe; use `@wippy-fe/router` para classificação portátil de links entre engines
- `iconifyIcons` (`false`) — pré-carrega coleções Iconify do host
- `errorCapture` (`true`) — encaminha erros não capturados da página ao host

A maioria das páginas SPA completas define `resizeObserver: false` e `preventLinkClicks: false`, pois gerencia seu próprio layout e roteamento. O app `main` do template define `errorCapture: true` para expor erros não capturados durante o desenvolvimento.

Não há uma flag dedicada de injeção de fontes web. Google Fonts são entregues por `theming.global.customCSS` (um `@import` no CSS personalizado do tema), injetado pela flag existente `css.customCss`.

Referência completa das flags e defaults de runtime: [Injeção de CSS](../web-host/css-injection.md).

## Configuração do operador (_index.yaml)

Esses campos são definidos pelo operador no bloco `meta` da entrada `_index.yaml` do registro. A maioria — `announced`, `secure`, `url`, `base_path`, `mountRoute`, `auto_register`, `inline` — representa política de implantação (roteamento, controle de acesso e entrega) que só faz sentido na implantação e não possui superfície de autoria em `package.json`. A exceção é `entry_point`: ele é **definido pelo FE** (o plugin do Vite exige `wippy.path` em `package.json` e o incorpora em `wippy-meta.json`), e o campo `meta.entry_point` é apenas um **override opcional por implantação** desse default incorporado.

> **Formato YAML obrigatório:** uma entrada de página usa `kind: registry.entry` com `meta.type: view.page`. Não escreva `kind: view.page`.

```yaml
- name: main
  kind: registry.entry
  meta:
    type: view.page
    name: main
```

### URL e entrega de arquivos

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `url` | string | — | Prefixo da URL-base onde o bundle é montado (origem CDN ou caminho local `http.static`). Somente YAML — sem superfície em `package.json` |
| `base_path` | string | — | Subdiretório dentro da montagem estática. Somente YAML — sem superfície em `package.json` |
| `entry_point` | string | `index.html` | Arquivo HTML a carregar; combinado com `url` e `base_path`. Definido pelo FE como `wippy.path` em `package.json` (incorporado em `wippy-meta.json`); o valor YAML é um override opcional por implantação |

A URL de entrada resolvida é `<url>/<base_path>/<entry_point>`. Um operador implanta o mesmo bundle em várias entradas apontando entradas `_index.yaml` diferentes para o mesmo `base_path`, com valores distintos de `entry_point` ou `config_overrides`.

Ao contrário de `url` e `base_path`, `entry_point` não é exclusivo da implantação. O desenvolvedor FE o define como `wippy.path` no bloco `wippy` de `package.json`, e o plugin do Vite o incorpora em `wippy-meta.json` — o plugin **o exige** e lança `wippy.path is required for a page package` quando omitido. O campo `meta.entry_point` em `_index.yaml` apenas sobrescreve esse default incorporado por implantação; a ordem de resolução é `entry_point` do YAML → `wippy.path` do bundle → `index.html`.

### Visibilidade e acesso

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `announced` | boolean | — | `true` → a página aparece em `GET /api/public/pages/list` e na barra lateral de navegação |
| `secure` | boolean | `false` | `true` → exige autenticação; solicitações não autenticadas recebem 401 |
| `inline` | boolean | `false` | `true` → a página fica oculta em todas as listagens (barra lateral, API); use para visualizadores de artefatos incorporados ou rotas auxiliares |

`announced: false` oculta a página da navegação, mas não impede seu carregamento. Ela ainda pode ser incorporada ou acessada pela rota. `inline: true` é mais restrito — remove a página de todas as listagens públicas.

### Rota de montagem

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `mountRoute` | string | — | Reivindica um caminho de URL no router do host; o host renderiza esta página quando o navegador acessa um caminho correspondente |

> **Exceção de casing:** o schema atual do registro lê `meta.mountRoute` e o
> armazena no campo interno `mount_route`; a saída da API volta a usar
> `mountRoute`. Na autoria, use a grafia lower camel case mostrada aqui.

`mountRoute` aceita somente a forma catch-all v1 — `/:part(.*)*` (raiz) ou `/<literal-prefix>/:part(.*)*`, em que o prefixo contém um ou mais segmentos alfanuméricos minúsculos, com hífen, e termina no wildcard obrigatório `:part(.*)*`. Padrões arbitrários do Vue Router — parâmetros nomeados, regex personalizada ou outro nome de parâmetro (por exemplo, `/home/:id`, `/users/:userId(\d+)`) — são rejeitados: o backend registra um conflito de rota de montagem `syntax`, `GET /api/public/pages/routes` retorna HTTP 500 e a inicialização do Host para, com o erro encaminhado pelo handler de erros do Host. O wildcard `:part(.*)*` permite que a aplicação child gerencie suas próprias sub-rotas enquanto o host mantém a propriedade do caminho de nível superior.

```yaml
mountRoute: /home/:part(.*)*
```

Quando o Web Host inicia, ele busca `GET /api/public/pages/routes` e chama `router.addRoute()` para cada entrada que possui `mountRoute`. Consulte [Roteamento dinâmico](./dynamic-routing.md) para o mecanismo completo de sincronização.

### Overrides de configuração por página

| Campo | Tipo | Descrição |
|---|---|---|
| `config_overrides` | object | Aplicado por deep merge sobre os valores de AppConfig que o Web Host injeta no contexto da página |

`config_overrides` é o nome do wrapper do registro. Seu objeto aninhado já usa
as chaves lower camel case do schema frontend, como `customization.customCSS` e
`customization.cssVariables`. O Web Host aplica deep merge dessas chaves exatas
sobre o `wippy.configOverrides` empacotado em `wippy-meta.json`; o valor YAML
prevalece em cada chave aninhada.

`config_overrides` altera o AppConfig injetado na página. Ele **não** altera as flags de injeção da proxy. Em particular, `config_overrides` nunca afeta `proxy.injections`, `wippy.proxy.injections` nem os defaults de runtime da injeção de CSS/scripts. Para sobrescrever as flags de injeção da proxy em uma implantação, use `meta.proxy` conforme descrito em [Override de proxy pelo operador](#override-de-proxy-pelo-operador-_indexyaml).

Um caso de uso típico é executar o mesmo bundle com uma paleta de cores personalizada:

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
          /* Palette values here are an intentional page-theme definition, not module CSS. */
          :root { font-family: var(--wippy-brand-font, sans-serif); }
```

Observe que `announced: false` é válido em entradas `view.page` — a página pode ser acessada por `mountRoute`, mas não aparece na barra lateral.

### Override de proxy pelo operador (_index.yaml)

Os defaults de injeção da proxy incorporados em `wippy-meta.json` (a partir do
bloco `wippy` de `package.json`) podem ser sobrescritos por implantação com um
bloco `proxy:` colocado **sob `meta:`** na entrada do registro. Nomes de
requisitos da facade usam seus nomes snake case documentados. O wrapper é
`config_overrides`, enquanto o schema do registro define o campo de rota como
`mountRoute`, armazena-o no campo interno `mount_route` e emite `mountRoute` na
saída da API. Objetos aninhados de proxy/configuração são repassados e preservam
suas chaves lower camel case definidas. O host aplica deep merge de `meta.proxy`
sobre o `wippy.proxy` empacotado.

Use `meta.proxy`, não `data.proxy`. Mantenha campos de backend de nível superior,
como `config_overrides`, em snake case, mas preserve chaves aninhadas da
proxy/configuração, como `themeConfig` e `customCss`; mantenha o wrapper
`injections`. Não invente `meta.config` nem `meta.configOverrides`; o wrapper
exato de override por página é `meta.config_overrides`.

Mantenha distintas as duas grafias do frontend:

- `meta.proxy.injections.css.customCss` no backend permanece
  `wippy.proxy.injections.css.customCss`.
- `meta.config_overrides.customization.customCSS` no backend é projetado para
  `wippy.configOverrides.customization.customCSS` no frontend e
  `config.theming.global.customCSS`.
- Não invente um wrapper `appConfig` ao redor de nenhuma das formas frontend.

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

Somente as chaves definidas são sobrescritas; todo o restante preserva o valor incorporado em `wippy-meta.json`. Referência completa das flags e defaults de runtime: [Injeção de CSS](../web-host/css-injection.md).
