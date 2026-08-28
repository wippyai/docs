---
title: "Portabilidade de superfície"
description: "Use container queries, variáveis de superfície e host.surface para dimensionar apps view.page sem depender do viewport."
---

# Portabilidade de superfície

**Classificação: referência do contrato de renderização com exemplos
direcionados.** Os blocos CSS, JavaScript e de metadados ilustram regras
isoladas; não formam uma aplicação completa.

Um app de micro frontend recebe uma **superfície**: a área retangular reservada
pelo Web Host. Em geral, ela **não** é a janela do navegador. O app pode ocupar
um entre vários painéis de um [layout multipainel](../web-host/multi-panel-layout.md),
e o mesmo app pode ser renderizado por qualquer
[engine](../web-host/render-engines.md), em tamanhos distintos na mesma tela.

Dimensionar o layout pela janela é incorreto nos dois engines. O contrato de
superfície fornece uma alternativa portável em CSS e JavaScript.

> **Status:** contrato 1, entregue. Variantes Tailwind `surface-*`, rolagem
> mediada pelo host e hit testing profundo **ainda não foram entregues**; esta
> página documenta somente o que existe hoje.

## O contrato CSS

### Container queries

O host nomeia a caixa do app como `wippy-surface`, para que ela possa ser consultada como qualquer container CSS:

```css
@container wippy-surface (min-width: 640px) {
  .sidebar { display: block; }
}
```

Use isso em vez de `@media (min-width: 640px)` para tudo que responde ao espaço ocupado pelo app. As unidades nativas de container são resolvidas em relação à mesma caixa:

```css
.hero { inline-size: 50cqw; }
```

### Variáveis de superfície

Quatro propriedades personalizadas transportam a geometria como comprimentos simples em pixels:

| Propriedade | Significado |
|----------|---------|
| `--wippy-surface-width` | largura total da superfície |
| `--wippy-surface-width-unit` | 1% da largura da superfície |
| `--wippy-surface-height` | altura total da superfície (somente dimensionamento por container) |
| `--wippy-surface-height-unit` | 1% da altura da superfície (somente dimensionamento por container) |

Elas são o substituto portátil para `vw` / `vh`:

```css
/* was: inline-size: 50vw */
.panel { inline-size: calc(var(--wippy-surface-width-unit) * 50); }
```

Os valores são herdados, portanto qualquer elemento do app pode lê-los. Eles representam a **caixa de conteúdo** do container de consulta, a mesma caixa em relação à qual `100cqw` é resolvido.

As aplicações **não** devem declarar nem atribuir esses quatro nomes. Uma declaração descendente oculta o valor herdado e, silenciosamente, desvincula o app da superfície.

Elas também devem permanecer **não registradas**. Não as descreva com `@property` nem com `CSS.registerProperty()`. O host marca o eixo de bloco como indisponível atribuindo um valor garantidamente inválido, que resulta em string vazia somente enquanto a propriedade não está registrada. Se você definir um `initial-value`, ela passa a resultar nesse valor; assim, um app dimensionado pelo conteúdo se identifica como dimensionado pelo container e `supports('block-size')` começa a retornar `true` — sem erro algum.

Duas ressalvas antes de comparar esses valores com `100cqw` pixel a pixel. O **primeiro frame pode ser mais largo**: o valor inicial vem do elemento `<iframe>` no host antes de o documento do app existir, portanto ainda não é possível saber se o conteúdo criará uma barra de rolagem. Esse valor é incorporado ao CSS do documento; o primeiro layout o utiliza e é corrigido um frame depois. Além disso, os valores são **quantizados em 1/64 px**, então compare com uma tolerância.

## Dimensionamento pelo container e pelo conteúdo

| | Inline axis | Block axis |
|---|---|---|
| **Dimensionamento por container** — o host impõe as duas dimensões | disponível | disponível |
| **Dimensionamento pelo conteúdo** — o conteúdo do app determina a altura | disponível | **indisponível** |

No dimensionamento pelo conteúdo, as propriedades de altura são deliberadamente inválidas. Assim, `var(--wippy-surface-height, 400px)` usa o fallback em vez de retornar um número, e `@container wippy-surface (min-height: …)` nunca corresponde.

**O modo recebido pelo app não é uma escolha do autor**, e nada em `package.json` o altera. O dimensionamento é definido por *onde o Web Host renderiza o app*:

| Renderizado como | Dimensionamento |
|---|---|
| uma página roteada, um painel de layout, o painel direito, uma aba do registro | **container** |
| an embedded artifact, an inline artifact block, a navbar widget | **content** |

Portanto, o mesmo pacote é dimensionado pelo container em sua própria rota e pelo conteúdo quando é incorporado. Um app que precisa do eixo de bloco deve tolerar sua ausência ou declarar o requisito (abaixo), para ser recusado em vez de renderizado de forma incorreta. Leia o modo atual em `host.surface.snapshot.sizing` e condicione o comportamento a `host.surface.supports('block-size')` — nunca presuma.

`cqh` se comporta pior do que “indisponível”: unidades de container usam o **viewport pequeno** como fallback quando nenhum container fornece o eixo necessário. Assim, `cqh` produz silenciosamente um número plausível, mas sem relação com a superfície. Prefira `var(--wippy-surface-height, <fallback>)`, que fica fixado na raiz e usa o fallback de forma observável. A mesma armadilha ocorre quando um app declara `container-type: inline-size` em um elemento intermediário e usa `cqh` abaixo dele.

## Declaração de requisitos

Opcional, no `package.json` do app:

```json
{
  "wippy": {
    "path": "index.html",
    "surface": {
      "contract": 1,
      "requirements": ["block-size"]
    }
  }
}
```

Os tokens aceitos são `block-size` e `surface-scroll`; ambos exigem dimensionamento por container e são recusados quando a instância é dimensionada pelo conteúdo. `registered-hit-testing`, `native-document-hit-testing` e `owner-visibility` são vocabulário reservado e são recusados como não implementados, em vez de ignorados silenciosamente.

A validação ocorre antes da inicialização. Assim, uma declaração impossível falha de forma visível, em vez de renderizar um app cujas consultas do eixo de bloco nunca correspondem. Um app sem bloco `surface` ainda é renderizado e recebe a caixa de consulta e as variáveis; ele apenas não anuncia portabilidade.

`surface-scroll` é aceito e informado por `supports()`, mas esta versão **não** fornece uma API de rolagem mediada pelo host — declará-lo expressa uma intenção, não libera um método.

## Leitura da superfície em JavaScript

Consulte [Proxy API → Superfície](./proxy-api.md#superfície) para a assinatura completa.

```js
const { width, widthUnit, height, sizing } = host.surface.snapshot

if (host.surface.supports('block-size')) {
  // safe to rely on the block axis
}

const off = host.surface.onChange((s) => reposition(s.width, s.height))
// call off() on teardown
```

O snapshot é lido das mesmas propriedades personalizadas computadas que o CSS resolve, portanto não pode divergir do que `@container` e `cqw` enxergam.

Prefira CSS para layout. Use a API JavaScript onde o CSS não alcança: dimensionamento de canvas, cálculos de virtualização, seleção de recursos e estilos gerados em runtime.

### `engine: 'host'`

`host.surface.engine` informa `iframe`, `fragment` ou `host`. O último não é um engine de página — significa que o código está executando onde nenhuma superfície foi alocada:

- um web component montado diretamente no documento do host, em vez de dentro de uma página;
- o proxy de desenvolvimento independente, sem Web Host.

Nesse caso, o snapshot informa `width: 0`, `height: null`, `sizing: 'content'`, e `supports()` é `false` para tudo. Isso é deliberado: substituir pela janela do navegador criaria exatamente a equivalência falsa que o contrato evita. Um componente montado diretamente deve medir sua própria raiz.

## O que o contrato não cobre

Container queries substituem media queries no **CSS**. Estes mecanismos ficam fora do CSS e continuam seguindo a janela do navegador:

| Mecanismo | Motivo | Ação |
|---|---|---|
| `<picture>` / `<source media>` | seleção de recursos HTML; não há forma de container query | Controle por `host.surface.onChange` ou mova a direção de arte para um `background-image` CSS sob `@container` |
| `srcset` + `sizes` | resolvidos em relação ao viewport | Derive `sizes` da superfície ou defina a fonte via JS |
| `matchMedia()` | consulta a janela por definição | Use `host.surface.onChange` para geometria; mantenha `matchMedia` para preferências |

## Overlays

O contrato de superfície **não** captura `position: fixed`. `container-type` estabelece um contexto de formatação independente sem contenção de layout; portanto, um container de consulta computa `contain: none` e não ancora nada. Overlays PrimeVue e overlays fixos personalizados continuam funcionando sem alteração.

O comportamento do engine é uma questão separada: no engine Web Fragment, `position: fixed` é resolvido em relação à **janela do host**, não ao painel do app. Consulte [Engines de renderização](../web-host/render-engines.md) e fixe o app com `wippy.renderEngine: "iframe"` se a ancoragem exata ao viewport for importante.

Dimensionar um overlay é diferente de ancorá-lo. Para um backdrop ou drawer que deve cobrir exatamente a superfície, abandone unidades de viewport e use `inset: 0` — combinado ao esquema de posicionamento adequado ao nível de portabilidade exigido pelo app:

```css
/* Portable across BOTH engines: resolves against the app's own root rather
   than against whatever `fixed` happens to be relative to.
   `min-block-size: 100%` is load-bearing — see below. */
.app-root { position: relative; min-block-size: 100%; }
.backdrop { position: absolute; inset: 0; }
```

O bloco de contenção é a **raiz do app**, não a superfície; o overlay só cobre a superfície se a raiz também a cobrir. No dimensionamento pelo conteúdo, isso ocorre automaticamente (o conteúdo *é* a altura). No dimensionamento por container, o host impõe uma altura à caixa de consulta que a raiz do app não herda. Sem `min-block-size: 100%`, o backdrop termina antes do limite, embora a versão `fixed` cobrisse a superfície. Os dois também diferem no comportamento: `absolute` rola com o conteúdo, enquanto `fixed` permanece fixado.

Coloque `min-block-size: 100%` no elemento **mais externo** dentro da superfície. Uma altura percentual precisa de uma cadeia contínua de alturas definidas acima dela. Aplicá-la à raiz de um componente aninhado em um `#app` de altura automática resulta em zero e recria a mesma lacuna. Isso foi verificado no Chromium, Firefox e WebKit, usando o caso sem `min` como controle.

```css
/* Iframe engine only. `fixed` resolves against the child viewport, which IS
   the surface there — but against the HOST WINDOW in the fragment engine,
   where this covers the whole application instead of the panel. */
.backdrop { position: fixed; inset: 0; }
```

Evite `var(--wippy-surface-height)` para isso: ela fica indisponível no dimensionamento pelo conteúdo, então um backdrop escrito dessa forma colapsa em páginas dimensionadas pelo conteúdo.

## Elemento raiz do app (`#app`)

**O engine Web Fragment exige que o elemento raiz tenha `id="app"`.** Não
`#root`, nem `#main`, nem `<main>` — o id é comparado literalmente.

O engine vincula a cadeia de alturas da página a esse seletor e mede por ele a
altura do conteúdo. O documento refletido expõe `wf-html`/`wf-body` em vez de
`html`/`body`; portanto, não é possível construir a cadeia a partir da raiz do
documento como dentro de um iframe.

**Sintoma quando está incorreto:** uma página fragment dimensionada pelo
conteúdo cuja raiz é `#root` (ou qualquer outro nome) renderiza com **altura
zero** — painel vazio, sem erro no próprio código. O host registra um erro que
nomeia o requisito. O engine iframe não é afetado, pois obtém a altura de
`CmdBodySize`; assim, o mesmo pacote pode parecer correto ali e ficar em branco
quando renderizado como fragment.

```html
<!-- correct -->
<body><div id="app"></div></body>
```

```js
createApp(App).mount('#app')
```

**Não tente corrigir um fragment de altura zero atribuindo altura a `#root`.**
Adicionar `height: 100%`, `min-height: 100dvh` ou `100vh` a uma raiz com outro
nome não faz o engine medi-la. Unidades de viewport descrevem a janela do
navegador, não a superfície alocada.
Em vez disso, renomeie o elemento para `app`.

## Limitações

- **Caixa do body.** No engine iframe, o host zera `margin`, `padding` e `border` do `body` do app para definir bem a superfície alocada. Coloque o padding da página no seu próprio elemento raiz. O engine fragment não faz isso; portanto, um app que depende do padding do body renderiza de forma ligeiramente diferente entre engines. Ainda não há diagnóstico disso no build.
- **Seletores `body > *` e regras direcionadas a `html`/`body`.** No engine **iframe**, o host envolve o conteúdo do body na caixa de superfície. Assim, seletores de filhos diretos baseados em `body` deixam de corresponder aos elementos do app, e `body`/`html` tornam-se *ancestrais* da caixa de consulta — uma regra `@container` direcionada a eles nunca se aplica. O engine **fragment** tem a topologia oposta (a caixa de consulta fica acima da árvore refletida), mas um seletor literal `body` também falha porque o documento refletido é renomeado para `wf-html`/`wf-body`. Coloque essas regras no seu próprio elemento raiz dentro da superfície; isso funciona nos dois engines.
- **Tudo que é renderizado por `<w-iframe>` / `<w-artifact>` fica sem superfície — inclusive um painel gerenciado de nível superior.** Esses elementos sempre constroem o documento child com o bootstrap de superfície desativado e nada os mede. Assim, `host.surface` informa `width: 0` e `sizing: 'content'` — mas com `engine: 'iframe'`, não `engine: 'host'`. Verifique `snapshot.width`, não `engine`, se o componente puder ser incorporado dessa forma. Isso é esperado em uma incorporação *aninhada*, mas pode passar despercebido em um painel de layout gerenciado declarado como `{ kind: 'component', tagName: 'w-artifact' }`: ele ocupa todo o slot superior, porém continua sem contrato. Use `kind: 'page'` para conteúdo que precisa dele.
- **Sem eixo de bloco no dimensionamento do conteúdo.**
- **Seletor raiz do fragment.** Apps fragment devem ser montados em `#app`; consulte [O elemento raiz do app (`#app`)](#elemento-raiz-do-app-app) para o requisito da cadeia de alturas e o sintoma de altura zero.
- **A rota obsoleta `/page/:id` não recebe superfície.** Ela renderiza em um iframe simples que não mede nada, ficando totalmente fora do contrato — sem caixa de consulta, wrapper nem alteração no DOM do app. Nesse local, o app se comporta exatamente como antes da existência do contrato. Use `/c/:id` para receber uma superfície. Assim como incorporações aninhadas, ela ainda informa `engine: 'iframe'`; portanto, teste `snapshot.width`, não o nome do engine.
- **Os dois engines podem diferir pela largura de uma barra de rolagem.** O engine iframe mede o eixo inline a partir da caixa de consulta *dentro* do documento do app; uma barra de rolagem do documento reduz essa largura. O engine fragment mede um wrapper do documento do host, cuja largura não é reduzida pela rolagem do conteúdo refletido. Com o mesmo painel alocado e conteúdo rolável, o engine fragment informa um número ligeiramente maior.
- **Não é um limite de isolamento.** O contrato governa o layout. Ele não fornece a um fragment documento, viewport, seleção, camada superior ou origem independentes.

## Migração

[Migração de superfície](./surface-migration.md) traz conversões receita por receita para apps existentes, cada uma classificada como automática, condicional, manual ou não conversível.
