# Portabilidade de Surface

Um micro frontend app recebe uma **surface** — a área retangular que o Web Host aloca para ele. Essa área geralmente **não** é a janela do navegador: o app pode ser um painel entre vários em um [layout multi-painel](../web-host/multi-panel-layout.md), e o mesmo app pode ser renderizado por qualquer um dos [motores de renderização](../web-host/render-engines.md) em tamanhos diferentes na mesma tela.

Dimensionar um layout pela janela é, portanto, errado nos dois motores. O contrato de surface oferece uma alternativa portável em CSS e em JavaScript.

> **Status:** contrato 1, entregue. As variantes `surface-*` do Tailwind, a rolagem mediada pelo host e o hit testing profundo **ainda não foram entregues**; esta página documenta apenas o que existe hoje.

## O contrato em CSS

### Container queries

O host nomeia a caixa do app como `wippy-surface`, de modo que ela pode ser consultada como qualquer container CSS:

```css
@container wippy-surface (min-width: 640px) {
  .sidebar { display: block; }
}
```

Use isso em vez de `@media (min-width: 640px)` para qualquer coisa que responda ao espaço que o app ocupa. Unidades nativas de container resolvem contra a mesma caixa:

```css
.hero { inline-size: 50cqw; }
```

### Variáveis de surface

Quatro custom properties carregam a geometria como comprimentos simples em pixels:

| Propriedade | Significado |
|----------|---------|
| `--wippy-surface-width` | largura completa da surface |
| `--wippy-surface-width-unit` | 1% da largura da surface |
| `--wippy-surface-height` | altura completa da surface (apenas dimensionamento por container) |
| `--wippy-surface-height-unit` | 1% da altura da surface (apenas dimensionamento por container) |

Elas são a substituição portável para `vw` / `vh`:

```css
/* era: inline-size: 50vw */
.panel { inline-size: calc(var(--wippy-surface-width-unit) * 50); }
```

Os valores são herdados, então qualquer elemento do app pode lê-los. Eles reportam o **content box** da caixa de consulta, que é a mesma caixa contra a qual `100cqw` resolve.

As aplicações **não** devem declarar nem atribuir esses quatro nomes. Uma declaração descendente sombreia o valor herdado e silenciosamente desprende o app da surface.

Elas também precisam permanecer **não registradas**. Não as descreva com `@property` nem com `CSS.registerProperty()`. O host marca o eixo de bloco como indisponível atribuindo um valor garantidamente inválido, que computa para a string vazia apenas enquanto a propriedade estiver não registrada. Dê a uma delas um `initial-value` e ela computa para esse valor, de modo que um app dimensionado por conteúdo se reporta como dimensionado por container e `supports('block-size')` passa a retornar `true` — sem erro em lugar nenhum.

Duas ressalvas antes de comparar esses valores com `100cqw` pixel a pixel. O **primeiro frame pode ser mais largo**: o valor de boot é semeado a partir do elemento `<iframe>` do lado do host antes de o documento do app existir, então ele não tem como saber se o conteúdo levantará uma barra de rolagem. Esse valor é embutido no CSS do documento, então o primeiro layout o usa e é corrigido um frame depois. E os valores são **quantizados em 1/64 px**, então compare com uma tolerância.

## Dimensionamento por container e dimensionamento por conteúdo

| | Eixo inline | Eixo de bloco |
|---|---|---|
| **Dimensionamento por container** — o host impõe as duas dimensões | disponível | disponível |
| **Dimensionamento por conteúdo** — o conteúdo do app decide a altura | disponível | **indisponível** |

No dimensionamento por conteúdo, as propriedades de altura são deliberadamente inválidas, então `var(--wippy-surface-height, 400px)` recorre ao fallback em vez de reportar um número, e `@container wippy-surface (min-height: …)` nunca casa.

**Qual dos dois um app recebe não é escolha do autor**, e nada no `package.json` muda isso. O dimensionamento é definido por *onde o Web Host renderiza o app*:

| Renderizado como | Dimensionamento |
|---|---|
| uma página roteada, um painel de layout, o painel direito, uma aba de registry | **container** |
| um artefato embutido, um bloco de artefato inline, um widget da navbar | **conteúdo** |

Então o mesmo pacote é dimensionado por container em sua própria rota e dimensionado por conteúdo quando alguém o embute. Um app que precisa do eixo de bloco precisa, portanto, tolerar não tê-lo, ou declarar o requisito (abaixo) para que seja recusado em vez de renderizado quebrado. Leia o modo atual com `host.surface.snapshot.sizing` e condicione o comportamento a `host.surface.supports('block-size')` — nunca presuma.

`cqh` se comporta pior do que "indisponível": unidades de container recorrem ao **small viewport** quando nenhum container fornece o eixo de que precisam, então `cqh` produz silenciosamente um número plausível sem relação com a surface. Prefira `var(--wippy-surface-height, <fallback>)`, que é fixado na raiz e cai visivelmente para o fallback. A mesma armadilha aparece dentro de um app que declara `container-type: inline-size` em um elemento intermediário e depois usa `cqh` abaixo dele.

## Declarando requisitos

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

Os tokens aceitos são `block-size` e `surface-scroll`, ambos exigindo dimensionamento por container e sendo rejeitados quando a instância é dimensionada por conteúdo. `registered-hit-testing`, `native-document-hit-testing` e `owner-visibility` são vocabulário reservado e são rejeitados como não implementados, em vez de ignorados silenciosamente.

A validação roda antes da inicialização, então uma declaração insatisfazível falha visivelmente em vez de renderizar um app cujas queries de eixo de bloco nunca casam. Um app sem um bloco `surface` ainda renderiza e ainda recebe a caixa de consulta e as variáveis; ele simplesmente não anuncia portabilidade.

`surface-scroll` é aceito e reportado por `supports()`, mas esta release **não** entrega nenhuma API de rolagem mediada pelo host — declará-lo afirma uma intenção, não desbloqueia um método.

## Lendo a surface a partir do JavaScript

Veja [API do Proxy → Surface](./proxy-api.md#surface) para a assinatura completa.

```js
const { width, widthUnit, height, sizing } = host.surface.snapshot

if (host.surface.supports('block-size')) {
  // seguro depender do eixo de bloco
}

const off = host.surface.onChange((s) => reposition(s.width, s.height))
// chame off() no teardown
```

O snapshot é lido de volta a partir das mesmas custom properties computadas que o CSS resolve, então ele não pode divergir do que `@container` e `cqw` enxergam.

Prefira CSS para layout. Recorra à API JavaScript onde o CSS não alcança: dimensionamento de canvas, matemática de virtualização, seleção de recursos e estilos gerados em tempo de execução.

### `engine: 'host'`

`host.surface.engine` reporta `iframe`, `fragment` ou `host`. O último não é um motor de página — significa que o código está rodando onde nenhuma surface foi alocada:

- um web component montado diretamente no documento do host em vez de em uma página;
- o dev proxy standalone, sem nenhum Web Host.

Ali, o snapshot reporta `width: 0`, `height: null`, `sizing: 'content'`, e `supports()` é `false` para tudo. Isso é deliberado: substituir pela janela do navegador seria a falsa equivalência que o contrato existe para evitar. Um componente montado diretamente deve medir sua própria raiz em vez disso.

## O que o contrato não cobre

Container queries substituem media queries em **CSS**. Estes mecanismos vivem fora do CSS e continuam seguindo a janela do navegador:

| Mecanismo | Por quê | O que fazer |
|---|---|---|
| `<picture>` / `<source media>` | seleção de recursos em HTML; sem forma em container query | Controle a partir de `host.surface.onChange`, ou mova a direção de arte para um `background-image` em CSS sob `@container` |
| `srcset` + `sizes` | resolvem contra o viewport | Derive `sizes` a partir da surface, ou defina a fonte pelo JS |
| `matchMedia()` | pergunta à janela por definição | Use `host.surface.onChange` para geometria; mantenha `matchMedia` para preferências |

## Overlays

O contrato de surface **não** captura `position: fixed`. `container-type` estabelece um contexto de formatação independente sem containment de layout, então um container de consulta computa `contain: none` e não ancora nada. Overlays do PrimeVue e overlays fixos feitos à mão continuam funcionando, sem mudanças.

O comportamento do motor é uma questão separada: no motor Web Fragment, `position: fixed` resolve contra a **janela do host** em vez do painel do app. Veja [Motores de Renderização](../web-host/render-engines.md) e fixe o app com `wippy.renderEngine: "iframe"` se a ancoragem exata ao viewport importar.

Dimensionar um overlay é uma questão diferente de ancorá-lo. Para um backdrop ou drawer que deve cobrir exatamente a surface, abandone as unidades de viewport e use `inset: 0` — mas combine isso com o esquema de posicionamento que corresponde ao quão portável o app precisa ser:

```css
/* Portável nos DOIS motores: resolve contra a própria raiz do app em vez de
   contra o que quer que `fixed` acabe usando como referência.
   `min-block-size: 100%` é estrutural — veja abaixo. */
.app-root { position: relative; min-block-size: 100%; }
.backdrop { position: absolute; inset: 0; }
```

O bloco contêiner é a **raiz do app**, não a surface, então o overlay cobre a surface apenas se essa raiz o fizer. No dimensionamento por conteúdo, isso acontece automaticamente (o conteúdo *é* a altura). No dimensionamento por container, o host impõe uma altura à caixa de consulta que a raiz do app não herda, então, sem `min-block-size: 100%`, o backdrop para discretamente antes do fim — falhando exatamente no modo em que a versão com `fixed` teria parecido correta. Os dois também diferem no comportamento: `absolute` rola com o conteúdo, `fixed` fica preso.

Coloque `min-block-size: 100%` no elemento **mais externo** dentro da surface. Uma altura percentual precisa de uma cadeia ininterrupta de alturas definidas acima dela, então aplicá-la a uma raiz de componente aninhada dentro de um `#app` de altura automática resolve para zero e reintroduz a mesma lacuna. Verificado em Chromium, Firefox e WebKit, com o caso sem `min` como controle.

```css
/* Apenas no motor de iframe. `fixed` resolve contra o viewport do filho, que
   ALI É a surface — mas contra a JANELA DO HOST no motor de fragment, onde
   isso cobre a aplicação inteira em vez do painel. */
.backdrop { position: fixed; inset: 0; }
```

Evite `var(--wippy-surface-height)` para isso: ele é indisponível no dimensionamento por conteúdo, então um backdrop escrito dessa forma colapsa exatamente nas páginas em que é mais difícil de notar.

## O elemento raiz do app (`#app`)

**O motor Web Fragment exige que seu elemento raiz seja `id="app"`.** Não
`#root`, não `#main`, não `<main>` — o id é comparado literalmente.

O motor vincula a cadeia de altura da página a esse seletor e mede a altura do
seu conteúdo através dele. O documento refletido expõe `wf-html`/`wf-body` em vez
de `html`/`body`, então você não pode construir a cadeia a partir da raiz do
documento como faria dentro de um iframe.

**Sintoma quando está errado:** uma página fragment dimensionada por conteúdo cuja
raiz é `#root` (ou qualquer outra coisa) renderiza com **altura zero** — painel em
branco, sem erro no seu próprio código. O host registra um erro nomeando o
requisito. O motor de iframe não é afetado, porque ele tira a altura de
`CmdBodySize`, então o mesmo pacote pode parecer correto ali e ficar em branco
como fragment.

```html
<!-- correto -->
<body><div id="app"></div></body>
```

```js
createApp(App).mount('#app')
```

**Não tente corrigir um fragment de altura zero dando uma altura ao `#root`.**
Adicionar `height: 100%`, `min-height: 100dvh` ou `100vh` a uma raiz com outro
nome não faz o motor medi-la, e unidades de viewport são erradas aqui pela razão
pela qual esta página inteira existe — elas descrevem a janela do navegador, não a
sua surface. Renomeie o elemento para `app`.

## Limitações

- **Caixa do body.** No motor de iframe, o host zera `margin`, `padding` e `border` no `body` do app para que a surface alocada seja bem definida. Coloque o padding da página no seu próprio elemento raiz. O motor de fragment não faz isso, então um app que depende de padding no body renderiza um pouco diferente entre os motores. Ainda não há diagnóstico em tempo de build para isso.
- **Seletores `body > *` e regras que miram `html`/`body`.** No motor de **iframe**, o host envolve o conteúdo do body na caixa de surface, então seletores de filho direto enraizados em `body` não casam mais com elementos do app, e `body`/`html` se tornam *ancestrais* da caixa de consulta — uma regra `@container` que os mire nunca se aplica. O motor de **fragment** tem a topologia oposta (a caixa de consulta fica acima da árvore refletida), mas um seletor literal `body` ainda falha ali, porque o documento refletido é renomeado para `wf-html`/`wf-body`. Coloque essas regras no seu próprio elemento raiz dentro da surface; isso é correto nos dois motores.
- **Qualquer coisa renderizada através de `<w-iframe>` / `<w-artifact>` não recebe surface — incluindo um painel gerenciado de nível superior.** Esses elementos sempre constroem seu documento filho com o bootstrap de surface desabilitado e nada os mede, então `host.surface` reporta `width: 0` e `sizing: 'content'` — mas com `engine: 'iframe'`, não `engine: 'host'`. Verifique `snapshot.width` em vez de `engine` se seu componente puder ser embutido dessa forma. Isso é esperado para um embed *aninhado*; é fácil deixar passar no caso de um painel de layout gerenciado declarado como `{ kind: 'component', tagName: 'w-artifact' }`, que é um slot de nível superior em tamanho completo e ainda assim não recebe contrato. Use `kind: 'page'` para conteúdo que precise de um.
- **Sem eixo de bloco no dimensionamento por conteúdo.**
- **O motor de fragment exige que o elemento raiz do app seja `#app`.** Ele vincula a cadeia de altura da página a esse seletor e mede a altura do conteúdo através dele, porque o documento refletido expõe `wf-html`/`wf-body` em vez de `html`/`body`, então um app não consegue construir sua própria cadeia a partir da raiz como faria dentro de um iframe. Um app fragment dimensionado por conteúdo com outra raiz (`#root`, `<main>`) não pode ser medido: o host registra um erro nomeando o requisito e o painel renderiza com altura zero. O motor de iframe não é afetado — ele tira a altura de `CmdBodySize`.
- **A rota deprecada `/page/:id` não recebe surface.** Ela renderiza em um iframe puro que nunca mede nada, então opta por sair completamente — sem caixa de consulta, sem wrapper, sem mudança no DOM do app. Um app se comporta ali exatamente como se comportava antes deste contrato existir. Use `/c/:id` para obter uma surface. Como nos embeds aninhados, ela ainda reporta `engine: 'iframe'`, então teste `snapshot.width` em vez do nome do motor.
- **Os dois motores podem diferir por uma barra de rolagem.** O motor de iframe mede o eixo inline a partir da caixa de consulta *dentro* do documento do app, então uma barra de rolagem de documento o estreita. O motor de fragment mede um wrapper no documento do host, que a rolagem do conteúdo refletido não estreita. Mesmo painel alocado e mesmo conteúdo rolável: o motor de fragment reporta o número ligeiramente maior.
- **Não é um limite de isolamento.** O contrato governa layout. Ele não dá a um fragment documento, viewport, seleção, top layer ou origem independentes.

## Migração

[Migração de Surface](./surface-migration.md) traz conversões receita por receita para apps existentes, cada uma rotulada como automática, condicional, manual ou não convertível.
