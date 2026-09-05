# Migração de Surface

Receitas para converter um micro frontend app existente de responsividade
baseada em viewport para o [contrato de surface](./surface-portability.md).

Cada receita é rotulada:

| Rótulo | Significado |
| --- | --- |
| **automática** | Mecânica. A regra convertida significa a mesma coisa. |
| **condicional** | Segura apenas quando a precondição declarada vale. Verifique-a. |
| **manual** | Precisa de decisão humana; não existe uma única reescrita correta. |
| **não convertível** | Não existe forma equivalente em container query. Use `host.surface` ou mantenha o comportamento de viewport deliberadamente. |

Cada receita abaixo é uma técnica isolada. O repositório do Web Host mantém uma
página executável combinando todas elas, executada por sua suíte de testes para
que as receitas não apodreçam virando instruções erradas.

> Receitas que dependem de trabalho ainda não entregue — variantes `surface-*` do
> Tailwind, diagnósticos em tempo de build, rolagem mediada pelo host, hit testing —
> estão marcadas como **ainda não entregue** e descrevem apenas o que existe hoje.

---

## Árvore de decisão: sobre o que é esta regra?

Antes de converter qualquer coisa, classifique a intenção. A maioria das
migrações ruins são conversões corretamente executadas de regras que não
deveriam ter sido convertidas.

```text
A regra responde a quanto espaço ESTA PÁGINA tem?
├── sim → converter para @container wippy-surface     (receitas 1-8)
├── não, ela responde à largura de UM COMPONENTE
│        → dê a esse componente seu próprio container  (receita 22)
├── não, ela responde a uma PREFERÊNCIA do usuário/dispositivo
│        → deixe como @media                           (receita 13)
└── não, ela deliberadamente acompanha a JANELA DO NAVEGADOR
         (um overlay real de janela inteira)
         → deixe como está, e documente o porquê
```

Se você não consegue dizer, deixe como está e revisite depois. Uma media query
não convertida é meramente não portável; uma convertida errado está
silenciosamente quebrada.

---

## 1. `max-width` → `inline-size <=` — **automática**

```css
/* antes */ @media (max-width: 640px)                      { .nav { display: none } }
/* depois */ @container wippy-surface (max-width: 640px)    { .nav { display: none } }
```

## 2. `min-width` → `inline-size >=` — **automática**

```css
/* antes */ @media (min-width: 640px)                      { .sidebar { display: block } }
/* depois */ @container wippy-surface (min-width: 640px)    { .sidebar { display: block } }
```

## 3. Um intervalo de largura delimitado — **automática**

```css
/* antes */ @media (min-width: 640px) and (max-width: 1024px) { … }
/* depois */ @container wippy-surface (640px <= width <= 1024px) { … }
```

A sintaxe de intervalo é suportada em todos os motores que o contrato de surface
tem como alvo. A forma com `and` também funciona, se você preferir.

## 4. Múltiplos breakpoints, ordem de cascata preservada — **automática**

Container queries não mudam especificidade nem ordenação. Converta cada bloco e
mantenha-os na mesma ordem de origem:

```css
@container wippy-surface (min-width: 480px)  { .grid { grid-template-columns: repeat(2, 1fr) } }
@container wippy-surface (min-width: 900px)  { .grid { grid-template-columns: repeat(4, 1fr) } }
```

## 5. Queries de altura — **condicional** (apenas dimensionamento por container)

```css
/* depois */ @container wippy-surface (min-height: 500px) { .tall-only { display: block } }
```

Precondição: a página é **dimensionada por container**. No dimensionamento por
conteúdo, a altura da página é o próprio conteúdo dela, então queries de altura
nunca casam. Declare a dependência para que ela falhe de forma ruidosa em vez de
silenciosa:

```json
{ "wippy": { "surface": { "contract": 1, "requirements": ["block-size"] } } }
```

## 6. Queries de aspect-ratio — **condicional** (apenas dimensionamento por container)

```css
/* antes */ @media (min-aspect-ratio: 16/9)                     { … }
/* depois */ @container wippy-surface (min-aspect-ratio: 16/9)   { … }
```

Mesma precondição da receita 5: aspect ratio precisa dos dois eixos.

## 7. Queries de orientação — **condicional** (apenas dimensionamento por container)

`@container wippy-surface (orientation: landscape)` descreve o formato do *seu
painel*, que geralmente é o que você quis dizer. Se você realmente quis dizer o
dispositivo, isso é uma media query — mantenha-a (receita 13).

## 8. Altura / aspect / orientação no dimensionamento por conteúdo — **não convertível**

Não há eixo de bloco para consultar. Reestruture para que o layout dependa do
eixo inline. Não finja com `cqh` — veja a receita 22.

Você não pode mudar o app para dimensionamento por container por conta própria: o
dimensionamento é definido por onde o Web Host renderiza o app, não por algo no
pacote dele. Se o layout realmente não puder funcionar sem o eixo de bloco,
declare `requirements: ["block-size"]` para que uma colocação dimensionada por
conteúdo seja recusada de imediato em vez de renderizar errado, e faça o app ser
renderizado em um contexto dimensionado por container (sua própria rota ou um
painel de layout). Veja "Container sizing and content sizing" em
[Portabilidade de Surface](./surface-portability.md).

## 9. Geometria aninhada dentro de uma media query ambiental — **manual**

```css
/* antes */
@media (prefers-color-scheme: dark) and (min-width: 640px) { .panel { … } }

/* depois — separe: a preferência fica, a geometria se move */
@media (prefers-color-scheme: dark) {
  @container wippy-surface (min-width: 640px) { .panel { … } }
}
```

Manual porque a ordem de aninhamento pode mudar quais declarações vencem quando
as duas condições antes se combinavam em um único prelúdio. Reverifique o
resultado.

## 10. Ramos OR com vírgula — **manual**

```css
/* antes */ @media (max-width: 480px), (min-width: 1200px) { … }
```

Uma vírgula é OR. Dividi-la em dois blocos `@container` preserva o OR **apenas se
os dois blocos forem, no restante, idênticos e adjacentes**; se você acidentalmente
os aninhar, transformou OR em AND, o que não casa com nada. Duplique as
declarações em dois blocos irmãos:

```css
@container wippy-surface (max-width: 480px)  { … }
@container wippy-surface (min-width: 1200px) { … }
```

## 11. `not`, `only`, booleano complexo — **manual**

`only` é um artefato de media type e não tem equivalente em container — descarte.
`not` inverte a condição inteira nas duas sintaxes, mas a precedência difere assim
que você mistura `and`/`or`; parentetize explicitamente em vez de confiar no
agrupamento original.

## 12. `screen` / `print` combinados com geometria — **manual**

*Tipos* de mídia não têm forma em container. Mantenha o tipo como media query e
aninhe a geometria dentro dele (como na receita 9). Layout de impressão, em
particular, normalmente deve permanecer inteiramente baseado em viewport/página.

## 13. Preferências continuam sendo media queries — **não convertível** (e corretas assim)

`prefers-color-scheme`, `prefers-contrast`, `prefers-reduced-motion`,
`forced-colors`, `hover`, `pointer`, `any-pointer`. `@container` suporta apenas
features de tamanho. Converter essas produz uma regra que nunca casa.

## 14. Breakpoints em `em` — **manual**

`@media (min-width: 40em)` resolve `em` contra o tamanho de fonte inicial.
`@container wippy-surface (min-width: 40em)` resolve contra o tamanho de fonte
**do container**. Se eles diferem, seu breakpoint se move silenciosamente.
Converta para `px`, ou verifique antes o `font-size` computado do container.

## 15. Breakpoints em `rem` — **manual**

`rem` **não** é relativo à raiz dentro de `@media`. Condições de media query
resolvem tanto `em` quanto `rem` contra o tamanho de fonte *inicial* — o padrão do
navegador, independente de qualquer CSS do autor — enquanto `@container` os
resolve da maneira comum, contra o tamanho de fonte computado real da
raiz/container.

Então os dois já são diferentes no momento em que o tamanho de fonte da sua raiz
difere do padrão do navegador, sem nada mudar em tempo de execução. O reset comum
`html { font-size: 62.5% }` é suficiente para mover um breakpoint convertido de
640px para 400px.

"Nada muda o tamanho de fonte da raiz" **não** é, portanto, uma precondição
suficiente. Converta para `px`, exatamente como para `em` (receita 14), a menos
que o tamanho de fonte computado da raiz seja comprovadamente igual ao padrão do
navegador.

## 16. Fronteira entre viewport e content-box da barra de rolagem — **condicional**

`100vw` inclui a calha clássica da barra de rolagem. No **motor de iframe**, a
largura da surface é o **content box** da caixa de consulta dentro do documento
do app, então ela não inclui: em uma página com barra de rolagem de documento, o
valor convertido é mais estreito pela largura da barra, o que geralmente é a
correção que você queria (`100vw` causando overflow horizontal é um bug clássico).

O **motor de fragment** mede um wrapper no documento do host que a rolagem do
conteúdo não estreita, então ele não aplica essa correção. Mesmo painel, mesmo
conteúdo rolável, larguras diferindo por uma barra de rolagem. A condição desta
receita é, portanto, *em qual motor o app roda*, e não apenas se o alinhamento é
exato ao pixel.

## 17. Regras que miram `html` / `body` — **manual**

Uma container query nunca estiliza seu próprio container, e uma regra mirando
`html` ou `body` falha nos dois motores — por razões diferentes:

- **Motor de iframe:** o host envolve o conteúdo do seu body na caixa de surface,
  então `html` e `body` são *ancestrais* do container de consulta. Uma regra
  `@container` não consegue alcançar um ancestral.
- **Motor de fragment:** a topologia oposta — a caixa de consulta é um wrapper do
  documento do host *acima* do seu conteúdo — mas um seletor literal `body` ainda
  falha, porque o documento refletido é renomeado para `wf-html` / `wf-body`.

De qualquer forma, a correção é a mesma, e ela é segura em ambos os motores:

```css
/* ✗ silenciosamente nunca casa */
@container wippy-surface (min-width: 640px) { body { display: flex } }

/* ✓ mova para sua própria raiz dentro da surface */
@container wippy-surface (min-width: 640px) { #app { display: flex } }
```

## 18. `<picture><source media>` e `<link media>` — **não convertível**

Seleção de recursos em nível de HTML não tem forma em container query. Ou
controle isso a partir do JS com `host.surface.onChange`, ou mova a direção de
arte para o CSS (`background-image` sob uma regra `@container`), onde o contrato
se aplica.

## 19. Geometria com `matchMedia()` → `host.surface` — **automática**

```js
// antes
const mq = matchMedia('(min-width: 640px)')
mq.addEventListener('change', render)

// depois
const off = host.surface.onChange(s => render(s.width >= 640))
render(host.surface.snapshot.width >= 640)
// chame off() no teardown
```

Mantenha `matchMedia` para queries de preferência — apenas a geometria é que está
errada.

## 20. CSS em runtime, adopted stylesheets, CSS-in-JS — **manual**

Prefira emitir regras `@container wippy-surface (...)` e deixar o CSS responder.
Se você calcula pixels em JS, regenere a partir de `onChange` — um valor lido uma
única vez do `snapshot` fica congelado e dessincroniza no próximo resize. Nunca
emita você mesmo os quatro nomes reservados `--wippy-surface-*`, e nunca os
registre com `@property` / `CSS.registerProperty()` — o registro anula o sinal do
host de "eixo de bloco indisponível", então um app dimensionado por conteúdo se
reporta silenciosamente como dimensionado por container; uma declaração
descendente sombreia o valor herdado e desprende sua página da surface.

## 21. CSS empacotado de terceiros — **manual**

Normalmente você não pode editá-lo. Em ordem de preferência: configure a
biblioteca para aceitar um breakpoint/largura que você forneça a partir de
`host.surface`; envolva-a em seu próprio container e traduza; ou fixe a página no
motor de iframe (`wippy.renderEngine: "iframe"`) e aceite o comportamento baseado
em janela. A varredura em tempo de build para encontrar esses casos
automaticamente **ainda não foi entregue**.

## 22. Containers aninhados e a armadilha do fallback de `cq*` — **manual**

Unidades de container resolvem contra o container *mais próximo* que tem o eixo de
que precisam. Duas consequências:

```css
.card { container-type: inline-size; }   /* NÃO tem eixo de bloco */
.card .thing { block-size: 25cqh; }      /* ✗ usa silenciosamente o small viewport */
```

`cqh`/`cqb` não geram erro quando nenhum container com eixo de bloco é
encontrado — eles recorrem ao small viewport e renderizam um número errado
plausível. Use `var(--wippy-surface-height, <fallback>)` quando quiser o eixo de
bloco da surface: ele é fixado na raiz, então um container mais próximo não pode
interceptá-lo, e ele cai visivelmente para o fallback quando indisponível.

Queries de componente são aditivas, não um substituto: `wippy-surface` continua se
referindo à área da página mesmo de dentro de um container aninhado.

---

## Unidades de viewport

| Era | Use | Notas |
| --- | --- | --- |
| `100vw` | `var(--wippy-surface-width)` | content box; veja a receita 16 |
| `1vw` / `37vw` | `calc(var(--wippy-surface-width-unit) * 37)` ou `37cqw` | a unidade é 1% |
| `100vh` | `var(--wippy-surface-height)` | apenas dimensionamento por container |
| `1vh` / `37vh` | `calc(var(--wippy-surface-height-unit) * 37)` | apenas dimensionamento por container |
| `vmin` | `min(var(--wippy-surface-width), var(--wippy-surface-height))` | apenas dimensionamento por container — precisa dos dois eixos |
| `vmax` | `max(var(--wippy-surface-width), var(--wippy-surface-height))` | apenas dimensionamento por container |
| `vi` / `vb` | `cqi` / `cqb`, ou as variáveis físicas | lógicas; as variáveis de surface são físicas |
| `sv*` / `lv*` / `dv*` | `var(--wippy-surface-*)` | **sem equivalentes separados.** Elas descrevem estados do chrome do navegador que um painel não tem; a surface tem um único tamanho |

`sv*`/`lv*` são unidades CSS reais — elas **não** significam "surface".

### Cálculos

```css
/* antes */ block-size: calc(100vh - 4rem);
/* depois */ block-size: calc(var(--wippy-surface-height, 400px) - 4rem);
```

O fallback é deliberadamente fixo e obviamente errado em vez de `100vh` — veja "Não esconda um contrato ausente atrás de um fallback" abaixo. Isso importa mais no eixo de bloco do que no inline: a altura é inválida em **toda** colocação dimensionada por conteúdo, não apenas onde o contrato está ausente, então um fallback de `100vh` renderiza silenciosamente a altura da janela na primeira vez que o app é embutido.

`min()`/`max()`/`clamp()` convertem sem mudanças; substitua as unidades dentro deles.

### Quando `100%` é melhor que um valor de surface

Se um elemento deve preencher seu **pai**, use `100%` ou `w-full`. Recorra a
`--wippy-surface-width` apenas quando você precisar especificamente da área *da
página* — tipicamente porque um ancestral é mais estreito e você quer escapar
dele. Fixar na raiz algo que deveria ser relativo ao pai é como um layout acaba
correto em uma profundidade de aninhamento e errado em outra.

### Não esconda um contrato ausente atrás de um fallback

```css
/* ✗ */ inline-size: var(--wippy-surface-width, 100vw);
```

Isso renderiza a largura da janela quando o contrato está ausente — exatamente o
bug que o contrato existe para prevenir, tornado invisível. Deixe falhar
visivelmente, ou escolha um fallback fixo que seja obviamente errado (`400px`)
para que seja notado.

---

## Overlays

O contrato de surface **não** captura `position: fixed` — `container-type`
estabelece um contexto de formatação independente sem containment de layout,
então um container de consulta computa `contain: none` e não ancora nada. Isso é
verificado em Chromium, Firefox e WebKit. Overlays do PrimeVue e overlays fixos
feitos à mão continuam funcionando, então **o posicionamento não precisa de
migração**.

O *dimensionamento* deles precisa. Um overlay que deve cobrir a surface deve usar
`inset: 0` — não `100vw`/`100vh`, que medem a janela do navegador e estouram em
um host multi-painel, e não `var(--wippy-surface-height)`, que é indisponível no
dimensionamento por conteúdo. Combine `inset: 0` com `position: absolute` dentro
de uma raiz `position: relative` do próprio app, se ele precisar funcionar nos
dois motores; `position: fixed` só é correto no motor de iframe, pela razão
logo abaixo.

O que precisa de atenção é o motor, não o contrato: no motor Web Fragment,
`position: fixed` resolve contra a **janela do host**, não contra o seu painel.
Veja [Motores de Renderização](../web-host/render-engines.md) e fixe o app com
`wippy.renderEngine: "iframe"` se isso importar.

Posicionamento de overlay mediado pelo host e helpers de rolagem em
`host.surface` **ainda não foram entregues**.

---

## Checklist

1. Classifique cada regra (página / componente / preferência / janela deliberada).
2. Converta geometria com intenção de página para `@container wippy-surface`.
3. Substitua unidades de viewport pelas variáveis de surface.
4. Mova qualquer regra que mirava `html`/`body` para o seu próprio elemento raiz.
5. Reverifique breakpoints em `em`.
6. Declare `requirements` se você depende do eixo de bloco.
7. Execute a página nos dois motores **e nos dois dimensionamentos** — container e
   conteúdo são o que esta migração realmente aciona, e um app é dimensionado por
   conteúdo sempre que é embutido em vez de roteado. Verifique em qual você está
   com `host.surface.snapshot.sizing`, e condicione o comportamento de eixo de
   bloco a `host.surface.supports('block-size')`.
