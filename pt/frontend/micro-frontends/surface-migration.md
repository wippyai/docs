---
title: "Migração de superfície"
description: "Receitas para converter regras responsivas baseadas no viewport para o contrato de superfície Wippy."
---

# Migração de superfície

**Classificação: coleção de receitas parciais de migração.** Cada bloco
antes/depois converte um padrão isolado. Aplique a árvore de decisão à folha
completa e verifique a página nos dois engines e nos dois modos de
dimensionamento.

Estas receitas convertem um app de micro frontend existente, baseado no
viewport, para o [contrato de superfície](./surface-portability.md).

Cada receita recebe uma classificação:

| Classificação | Significado |
| --- | --- |
| **automático** | Mecânico. A regra convertida mantém o mesmo significado. |
| **condicional** | Seguro apenas quando uma precondição declarada é atendida. Verifique-a. |
| **manual** | Exige uma decisão humana; não há uma única reescrita correta. |
| **não conversível** | Não existe uma forma equivalente com container query. Use `host.surface` ou mantenha deliberadamente o comportamento baseado no viewport. |

Cada receita abaixo apresenta uma técnica isoladamente. O repositório do Web
Host inclui uma página executável que combina todas elas e é coberta pela suíte
de testes correspondente.

> As receitas que dependem de trabalho ainda não lançado — variantes Tailwind
> `surface-*`, diagnósticos em tempo de build, rolagem mediada pelo host e hit
> testing — são marcadas como **ainda não lançado** e descrevem apenas o que existe
> hoje.

---

## Árvore de decisão: do que trata esta regra?

Antes de converter qualquer regra, classifique sua intenção. Uma conversão
mecanicamente correta ainda estará errada se a regra original não for relativa
à superfície.

```text
Does the rule respond to how much room THIS PAGE has?
├── yes → convert to @container wippy-surface        (recipes 1-8)
├── no, it responds to one COMPONENT's width
│        → give that component its own container      (recipe 22)
├── no, it responds to a user/device PREFERENCE
│        → leave it as @media                         (recipe 13)
└── no, it deliberately tracks the BROWSER WINDOW
         (a true full-window overlay)
         → leave it, and document why
```

Se não for possível determinar a intenção, mantenha a regra e volte a ela mais
tarde. Uma media query não convertida apenas deixa de ser portátil; uma media
query convertida incorretamente falha de forma silenciosa.

---

## 1. `max-width` → `inline-size <=` — **automático**

```css
/* before */ @media (max-width: 640px)                      { .nav { display: none } }
/* after  */ @container wippy-surface (max-width: 640px)    { .nav { display: none } }
```

## 2. `min-width` → `inline-size >=` — **automático**

```css
/* before */ @media (min-width: 640px)                      { .sidebar { display: block } }
/* after  */ @container wippy-surface (min-width: 640px)    { .sidebar { display: block } }
```

## 3. Intervalo de largura limitado — **automático**

```css
/* before */ @media (min-width: 640px) and (max-width: 1024px) { … }
/* after  */ @container wippy-surface (640px <= width <= 1024px) { … }
```

A sintaxe de intervalo é aceita em todas as engines contempladas pelo contrato
de superfície. A forma com `and` também funciona, se for preferível.

## 4. Vários breakpoints, com a ordem da cascata preservada — **automático**

Container queries não alteram a especificidade nem a ordem. Converta cada bloco
e mantenha a mesma ordem no código-fonte:

```css
@container wippy-surface (min-width: 480px)  { .grid { grid-template-columns: repeat(2, 1fr) } }
@container wippy-surface (min-width: 900px)  { .grid { grid-template-columns: repeat(4, 1fr) } }
```

## 5. Queries de altura — **condicional** (somente container sizing)

```css
/* after */ @container wippy-surface (min-height: 500px) { .tall-only { display: block } }
```

Precondição: a página usa **container sizing**. Em content sizing, a altura da
página é determinada pelo próprio conteúdo e, por isso, queries de altura nunca
correspondem. Declare a dependência para que a falha seja explícita, não
silenciosa:

```json
{ "wippy": { "surface": { "contract": 1, "requirements": ["block-size"] } } }
```

## 6. Queries de proporção — **condicional** (somente container sizing)

```css
/* before */ @media (min-aspect-ratio: 16/9)                     { … }
/* after  */ @container wippy-surface (min-aspect-ratio: 16/9)   { … }
```

A mesma precondição da receita 5: a proporção precisa dos dois eixos.

## 7. Queries de orientação — **condicional** (somente container sizing)

`@container wippy-surface (orientation: landscape)` descreve o formato *do seu
painel*, que normalmente é a intenção. Se a intenção realmente for o dispositivo,
trata-se de uma media query — mantenha-a (receita 13).

## 8. Altura, proporção ou orientação em content sizing — **não conversível**

Não há um eixo de bloco a consultar. Reestruture o layout para que ele dependa do
eixo inline. Não simule o eixo com `cqh` — consulte a receita 22.

O próprio app não pode mudar para container sizing: o dimensionamento é definido
pelo local em que o Web Host renderiza o app, não por algo em seu pacote. Se o
layout realmente não funcionar sem o eixo de bloco, declare `requirements: ["block-size"]`
para que um posicionamento em content sizing seja recusado de
forma explícita, em vez de renderizado incorretamente, e faça o app ser renderizado
em um contexto com container sizing (em sua própria rota ou em um painel de
layout). Consulte “Container sizing e content sizing” em
[Portabilidade de superfície](./surface-portability.md).

## 9. Geometria aninhada em media query ambiental — **manual**

```css
/* before */
@media (prefers-color-scheme: dark) and (min-width: 640px) { .panel { … } }

/* after — split: the preference stays, the geometry moves */
@media (prefers-color-scheme: dark) {
  @container wippy-surface (min-width: 640px) { .panel { … } }
}
```

É manual porque a ordem de aninhamento pode alterar quais declarações prevalecem
quando as duas condições antes estavam combinadas em um único preâmbulo. Verifique
novamente o resultado.

## 10. Ramos OR separados por vírgula — **manual**

```css
/* before */ @media (max-width: 480px), (min-width: 1200px) { … }
```

A vírgula representa OR. Dividir a regra em dois blocos `@container` preserva o
OR **apenas se os dois blocos forem idênticos nos demais aspectos e estiverem
adjacentes**; se eles forem aninhados por engano, OR vira AND, que não corresponde
a nada. Duplique as declarações em dois blocos irmãos:

```css
@container wippy-surface (max-width: 480px)  { … }
@container wippy-surface (min-width: 1200px) { … }
```

## 11. `not`, `only` e lógica booleana complexa — **manual**

`only` é um artefato de media type e não tem equivalente em container — remova-o.
`not` inverte a condição inteira nas duas sintaxes, mas a precedência muda quando
`and`/`or` são combinados; use parênteses explícitos em vez de confiar no
agrupamento original.

## 12. `screen` / `print` combinados com geometria — **manual**

Media *types* não têm uma forma de container. Mantenha o tipo como media query e
aninhe a geometria dentro dela (como na receita 9). Em particular, o layout de
impressão normalmente deve continuar totalmente baseado no viewport/na página.

## 13. Preferências continuam como media queries — **não conversível** (e correto assim)

`prefers-color-scheme`, `prefers-contrast`, `prefers-reduced-motion`,
`forced-colors`, `hover`, `pointer`, `any-pointer`. `@container` aceita apenas
recursos de tamanho. Converter essas condições produz uma regra que nunca
corresponde.

## 14. Breakpoints em `em` — **manual**

`@media (min-width: 40em)` resolve `em` em relação ao tamanho de fonte inicial.
`@container wippy-surface (min-width: 40em)` resolve a unidade em relação ao
tamanho de fonte **do container**. Se os tamanhos forem diferentes, o breakpoint
muda silenciosamente. Converta para `px` ou verifique antes o `font-size`
computado do container.

## 15. Breakpoints em `rem` — **manual**

`rem` **não** é relativo à raiz dentro de `@media`. As condições de media query
resolvem `em` e `rem` em relação ao tamanho de fonte *inicial* — o padrão do
navegador, independente de qualquer CSS do autor —, enquanto `@container` as
resolve da forma normal, em relação ao tamanho de fonte computado real da
raiz/do container.

Portanto, os dois já são diferentes assim que o tamanho de fonte da raiz diverge
do padrão do navegador, sem que nada mude em runtime. O reset comum `html {
font-size: 62.5% }` basta para deslocar um breakpoint convertido de 640px para
400px.

Assim, “nada altera o tamanho de fonte da raiz” **não** é uma precondição
suficiente. Converta para `px`, exatamente como para `em` (receita 14), a menos
que seja possível provar que o tamanho de fonte computado da raiz é igual ao
padrão do navegador.

## 16. Limite da scrollbar entre viewport e content-box — **condicional**

`100vw` inclui o espaço da scrollbar clássica. Na **engine de iframe**, a largura
da superfície é a **content box** da caixa de consulta dentro do documento do
app e, portanto, não inclui esse espaço: em uma página com scrollbar no
documento, o valor convertido é menor pela largura da scrollbar, o que geralmente
é a correção desejada (`100vw` causar overflow horizontal é um bug clássico).

A **engine de fragment** mede um wrapper no documento do host que não é estreitado
pela rolagem do conteúdo e, portanto, não aplica essa correção. Mesmo painel,
mesmo conteúdo rolável, larguras diferentes pela largura de uma scrollbar. Assim, a condição
desta receita é *em qual engine o app é executado*, não apenas se o alinhamento
é exato em pixels.

## 17. Regras direcionadas a `html` / `body` — **manual**

Uma container query nunca estiliza o próprio container, e uma regra direcionada
a `html` ou `body` falha nas duas engines — por motivos diferentes:

- **Engine de iframe:** o host envolve o conteúdo do body na caixa de superfície;
  assim, `html` e `body` são *ancestrais* do container de consulta. Uma regra
  `@container` não consegue alcançar um ancestral.
- **Engine de fragment:** a topologia oposta — a caixa de consulta é um wrapper
  do documento do host *acima* do conteúdo —, mas um seletor `body` literal ainda
  falha porque o documento refletido é renomeado para `wf-html` / `wf-body`.

Nos dois casos, a correção é a mesma e funciona de forma segura em ambas as engines:

```css
/* ✗ silently never matches */
@container wippy-surface (min-width: 640px) { body { display: flex } }

/* ✓ move it to your own root inside the surface */
@container wippy-surface (min-width: 640px) { #app { display: flex } }
```

## 18. `<picture><source media>` e `<link media>` — **não conversível**

A seleção de recursos no nível do HTML não tem uma forma equivalente com
container query. Controle-a pelo JS com `host.surface.onChange` ou mova a direção
de arte para o CSS (`background-image` sob uma regra `@container`), onde o
contrato se aplica.

## 19. Geometria em `matchMedia()` → `host.surface` — **automático**

```js
// before
const mq = matchMedia('(min-width: 640px)')
mq.addEventListener('change', render)

// after
import { host } from '@wippy-fe/proxy'

const off = host.surface.onChange(s => render(s.width >= 640))
render(host.surface.snapshot.width >= 640)
// call off() on teardown
```

Mantenha `matchMedia` para queries de preferência — apenas o uso para geometria está errado.

## 20. CSS de runtime, folhas adotadas e CSS-in-JS — **manual**

Prefira emitir regras `@container wippy-surface (...)` e deixar o CSS reagir. Se
calcular pixels em JS, gere o valor novamente a partir de `onChange` — um valor
lido uma única vez de `snapshot` fica congelado e perde a sincronização no
próximo redimensionamento. Nunca emita por conta própria os quatro nomes
reservados `--wippy-surface-*` e nunca os registre com `@property` /
`CSS.registerProperty()` — o registro neutraliza o sinal “eixo de bloco
indisponível” do host; assim, um app em content sizing informa silenciosamente
que usa container sizing. Uma declaração descendente oculta o valor herdado e
desvincula a página da superfície.

## 21. CSS empacotado de terceiros — **manual**

Normalmente não é possível editá-lo. Em ordem de preferência: configure a
biblioteca para aceitar um breakpoint/uma largura fornecida por `host.surface`;
envolva-a em um container próprio e converta as regras; ou fixe a página na engine
de iframe (`wippy.renderEngine: "iframe"`) e aceite o comportamento baseado na
janela. A varredura em tempo de build para localizar esses casos automaticamente
**ainda não foi lançada**.

## 22. Containers aninhados e a armadilha do fallback `cq*` — **manual**

As unidades de container são resolvidas em relação ao container *mais próximo*
que tenha o eixo necessário. Isso tem duas consequências:

```css
.card { container-type: inline-size; }   /* has NO block axis */
.card .thing { block-size: 25cqh; }      /* ✗ silently uses the small viewport */
```

`cqh`/`cqb` não geram erro quando nenhum container com eixo de bloco é encontrado
— elas recorrem ao viewport pequeno e renderizam um número incorreto, porém
plausível. Use `var(--wippy-surface-height, <fallback>)` quando precisar do eixo
de bloco da superfície: a variável é fixada na raiz, portanto um container mais
próximo não consegue interceptá-la, e o fallback fica visível quando ela não
está disponível.

Queries de componente são aditivas, não uma substituição: de dentro de um
container aninhado, `wippy-surface` ainda se refere à área da página.

---

## Unidades de viewport

| Antes | Use | Observações |
| --- | --- | --- |
| `100vw` | `var(--wippy-surface-width)` | content box; consulte a receita 16 |
| `1vw` / `37vw` | `calc(var(--wippy-surface-width-unit) * 37)` ou `37cqw` | a unidade equivale a 1% |
| `100vh` | `var(--wippy-surface-height)` | somente em container sizing |
| `1vh` / `37vh` | `calc(var(--wippy-surface-height-unit) * 37)` | somente em container sizing |
| `vmin` | `min(var(--wippy-surface-width), var(--wippy-surface-height))` | somente em container sizing — precisa dos dois eixos |
| `vmax` | `max(var(--wippy-surface-width), var(--wippy-surface-height))` | somente em container sizing |
| `vi` / `vb` | `cqi` / `cqb` ou as variáveis físicas | lógico; as variáveis de superfície são físicas |
| `sv*` / `lv*` / `dv*` | `var(--wippy-surface-*)` | **não há equivalentes separados.** Essas unidades descrevem estados do chrome do navegador que um painel não possui; a superfície tem um único tamanho |

`sv*`/`lv*` são unidades CSS reais — **não** significam “surface”.

### Cálculos

```css
/* before */ block-size: calc(100vh - 4rem);
/* after  */ block-size: calc(var(--wippy-surface-height, 400px) - 4rem);
```

O fallback é deliberadamente fixo e obviamente inadequado, em vez de `100vh` — consulte “Não esconda um contrato ausente atrás de um fallback” abaixo. Isso é mais importante no eixo de bloco do que no eixo inline: a altura é inválida em **todo** posicionamento com content sizing, não apenas onde o contrato está ausente; portanto, um fallback `100vh` renderiza silenciosamente a altura da janela assim que o app é incorporado pela primeira vez.

`min()`/`max()`/`clamp()` são convertidos sem alteração; substitua as unidades dentro deles.

### Quando `100%` é melhor que um valor de superfície

Se um elemento deve preencher seu **parent**, use `100%` ou `w-full`. Recorra a
`--wippy-surface-width` apenas quando precisar especificamente da área *da página*
— normalmente porque um ancestral é mais estreito e você quer escapar dele. Fixar
na raiz algo que deveria ser relativo ao parent faz o layout ficar correto em uma
profundidade de aninhamento e errado em outra.

### Não esconda um contrato ausente atrás de um fallback

```css
/* ✗ */ inline-size: var(--wippy-surface-width, 100vw);
```

Isso renderiza a largura da janela quando o contrato está ausente — exatamente o
bug que o contrato existe para evitar, agora invisível. Deixe a falha aparecer ou
escolha um fallback fixo e obviamente inadequado (`400px`) para que seja percebido.

---

## Sobreposições

O contrato de superfície **não** captura `position: fixed` — `container-type`
estabelece um contexto de formatação independente sem contenção de layout; por
isso, um container de consulta computa `contain: none` e não ancora nada. Isso
foi verificado no Chromium, Firefox e WebKit. Tanto overlays do PrimeVue quanto
overlays fixos criados manualmente continuam funcionando; portanto, **o
posicionamento não precisa de migração**.

O *dimensionamento* deles precisa. Um overlay destinado a cobrir a superfície
deve usar `inset: 0` — não `100vw`/`100vh`, que medem a janela do navegador e
ultrapassam a área em um host multipainel, nem `var(--wippy-surface-height)`, que
não está disponível em content sizing. Combine `inset: 0` com `position: absolute`
dentro de uma raiz própria do app com `position: relative` se precisar
funcionar nas duas engines; `position: fixed` só é correto na engine de iframe,
pelo motivo apresentado logo abaixo.

O que exige atenção é a engine, não o contrato: na engine Web Fragment,
`position: fixed` é resolvido em relação à **janela do host**, não ao painel.
Consulte [Engines de renderização](../web-host/render-engines.md) e fixe o app com
`wippy.renderEngine: "iframe"` se essa distinção for importante.

O posicionamento de overlays mediado pelo host e os helpers de rolagem de
`host.surface` **ainda não foram lançados**.

---

## Lista de verificação

1. Classifique cada regra (página/componente/preferência/janela deliberada).
2. Converta a geometria relativa à página para `@container wippy-surface`.
3. Substitua unidades de viewport pelas variáveis de superfície.
4. Mova qualquer regra direcionada a `html`/`body` para o elemento raiz próprio.
5. Verifique novamente os breakpoints em `em`.
6. Declare `requirements` se houver dependência do eixo de bloco.
7. Execute a página nas duas engines **e nos dois tipos de dimensionamento** —
   container e content são o que esta migração realmente habilita, e um app usa
   content sizing sempre que está incorporado, em vez de roteado. Verifique o
   modo atual com `host.surface.snapshot.sizing` e condicione o comportamento no
   eixo de bloco a `host.surface.supports('block-size')`.
