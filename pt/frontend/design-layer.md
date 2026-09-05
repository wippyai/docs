---
title: "A camada de design"
description: "Tema, camada de design compartilhada, local ao módulo — o que vai onde quando vários módulos precisam da mesma coisa e o tema não tem um lugar para ela, com exemplos bons e ruins trabalhados."
---

# A camada de design

Um frontend Wippy é composto por muitos módulos publicados de forma
independente renderizando em uma única aplicação. Dois lares são óbvios: o
**tema**, que toda surface consome, e o **módulo**, que é dono de si mesmo. A
lacuna entre eles não é óbvia, e é onde a duplicação se acumula — uma ideia que
vários módulos genuinamente compartilham e para a qual o tema não tem
componente.

Esta página nomeia as três camadas, dá um teste para escolher entre elas e
mostra como cada escolha se parece quando dá certo e quando dá errado.

## As camadas

| Camada | Alcança | É dona de |
|---|---|---|
| **Tema** | *Toda* surface, incluindo módulos dos quais você não é dono | Componentes PrimeVue, os tokens semânticos compartilhados, classes documentadas |
| **Camada de design compartilhada** | Apenas os módulos que optam por ela | Vocabulário que esses módulos compartilham e que não tem componente do tema por trás |
| **Módulo** | Ele mesmo | O que é genuinamente específico de uma surface |

### O tema é universal, e essa é a restrição

O tema estiliza markup **do qual você não é dono**. Qualquer módulo — incluindo
um plugin de terceiros escrito por alguém que nunca viu sua aplicação —
renderiza no mesmo host e é pintado pelo mesmo tema. É isso que torna o tema a
camada universal, e isso vale nos dois sentidos:

**Nada específico da aplicação pode entrar no tema**, porque seria imposto a
todo módulo que nunca pediu por isso.

**Um módulo não pode depender de algo específico da aplicação estar no tema.** O
contrato é *componentes PrimeVue + os tokens semânticos compartilhados do Wippy
+ classes documentadas* — nada que uma aplicação tenha acrescentado por cima.
Note que os próprios presets do PrimeVue também não fazem parte do contrato: o
Wippy roda o PrimeVue com `theme: 'none'`, então são os tokens semânticos do
Wippy dos quais você depende.

```css
/* BOM — tokens semânticos compartilhados do Wippy, presentes para todo módulo */
.my-panel {
  color: var(--p-text-color);
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
}

/* RUIM — um token específico da aplicação. Seu módulo agora só funciona dentro
   de uma aplicação e perde silenciosamente a declaração em qualquer outro
   lugar: uma custom property indefinida torna a declaração inválida no momento
   do computed value, então ela é descartada e o elemento herda em silêncio. */
.my-panel { background: var(--kx-surface-2); }
```

Essa é também a resposta para *"posso colocar nosso vocabulário compartilhado na
facade?"* Apenas se ele precisar genuinamente alcançar markup arbitrário, do
qual ninguém é dono. Se estiver limitado ao *seu* conjunto de módulos, ele não
pertence ao tema — pertence à camada abaixo.

### A espinha dorsal, e quando um componente pode abrir mão dela

PrimeVue e Tailwind, como entregues pelo host, são a espinha dorsal recomendada
para qualquer componente. Um componente **pode** abrir mão dela — mas a exceção
se estreita no momento em que ele renderiza qualquer coisa convencional, e a
escada só vai numa direção:

| O componente… | Então ele precisa carregar |
|---|---|
| é neutro em apresentação — canvas, SVG, um gráfico sem controles, sem tokens, sem utilitários, sem rolagem | nada: `hostCssKeys: []` |
| consome tokens semânticos ou dark mode | `themeConfigUrl` |
| pode rolar | `iframeCssUrl` |
| renderiza markdown | `markdownCssUrl` |
| renderiza qualquer coisa que o **Tailwind** consiga expressar | Tailwind — escreva utilitários, não CSS artesanal |
| renderiza qualquer coisa para a qual o **PrimeVue** entrega um componente — botão, input, formulário, tabela, dialog, menu, tag, tooltip, qualquer controle de feedback | `primeVueCssUrl` **e** `PrimeVuePlugin` |

Um gráfico em um canvas é o caso arquetípico de exceção legítima: ele não tem UI
clássica, então não precisa de nada da espinha dorsal. Dê a esse mesmo gráfico
uma toolbar e ele deixa de ser neutro em apresentação — o botão é um botão
PrimeVue, e toda a integração vem junto.

Note o acoplamento: **os utilitários Tailwind são entregues com
`primeVueCssUrl`.** Não existe uma chave de CSS do host separada para o
Tailwind, então, na prática, um componente que precisa de Tailwind também está
carregando o asset do PrimeVue. (`preflightCssUrl` não faz parte da união de
chaves; se o preflight do Tailwind for genuinamente necessário dentro do shadow
root, carregue-o imperativamente — raramente necessário.)

A consequência prática para esta página: **a maior parte do que um módulo quer
já existe na espinha dorsal.** A camada de design compartilhada é uma faixa
estreita acima dela, não um lugar para refazer o que PrimeVue e Tailwind já
cobrem. Veja [Injeção de CSS](./web-host/css-injection.md) para a mecânica.

### A camada de design compartilhada

Algumas ideias se repetem em um conjunto conhecido de módulos e não têm
componente no tema: um card de conteúdo, uma linha de cabeçalho de surface, o
que uma surface mostra quando não tem nada, os tamanhos em que uma tag vem.
Reais, compartilhadas e sem casa.

Elas são entregues como um **pacote publicado**, materializado em cada consumidor
em tempo de build. Precisa ser um pacote em vez de um alias de caminho, porque
os consumidores vivem em repositórios diferentes — o teste falsificável desta
camada é que um módulo em um *repositório diferente*, sem acesso por caminho ao
produtor, consome o vocabulário e compila.

O módulo produtor declara o pacote como um **artefato de tempo de build** e cada
consumidor o materializa em sua própria árvore. Veja
[Artefatos de Tempo de Build](../guides/artifacts.md) para a declaração, o
formato `node-package`, o que o runtime reconcilia para você e a cola que um
build ainda precisa fornecer por conta própria.

### O módulo

Todo o resto, mais toda divergência deliberada em relação ao vocabulário
compartilhado.

## Decidindo onde algo pertence

Pergunte na ordem. O primeiro sim vence.

1. **É um valor?** Cor, raio, espaçamento, elevação, severidade.
   → **Tema.** Leia um token semântico. Nunca um literal.
2. **O tema já entrega um componente para isso?** Button, Dialog,
   Select, Tag. → **Tema.** Use o componente. Estilize-o colocando uma classe
   *nele* — nunca o reconstrua.
3. **Dois ou mais dos seus módulos precisam desse mesmo conceito, sem nenhum
   componente do tema por trás?** → **Camada de design compartilhada.**
4. Caso contrário → **Módulo.**

A pergunta 2 é a que pega as pessoas, e há uma regra afiada por trás dela.

## Exemplos trabalhados

Os exemplos abaixo vêm do Kickside, uma aplicação Wippy cujo CSS de módulos
tinha 15,4% de duplicação por clone exato antes de ganhar esta camada.

### Nunca reconstrua um componente do tema

O PrimeVue entrega `Button`. Nove módulos do Kickside abriram mão dele e fizeram
`.kx-btn` à mão sobre um `<button>` nativo; outros sete módulos usaram o
componente. Os dois dialetos eram localmente razoáveis — simplesmente não havia
um lugar compartilhado para colocar um botão, então metade da aplicação
inventou um. Medidos um contra o outro, concordavam em font-size e line-height e
em mais nada.

**Ruim:** um elemento `button` nativo carregando `.kx-btn .kx-btn-primary` — uma
segunda implementação de um componente que o tema já entrega. (Escrito aqui como
seletor de propósito: o gate da documentação rejeita controles nativos de
produto em código de exemplo, que é esta mesma regra aplicada uma camada acima.)

**Bom:** o componente do tema, com uma classe nele quando for preciso ajustar.

```vue
<Button label="Save" class="kx-save" />
```

Quando o componente do tema não serve, isso não é licença para reconstruí-lo.
Coloque uma classe no componente e estilize essa classe — na facade se o ajuste
for para toda a aplicação, no módulo se for local. O módulo `knowledge` do
Kickside ainda carrega `.kn-btn` / `.kn-primary` em botões nativos; isso é uma
migração pendente, não um padrão a copiar.

### Severidade é do tema, não sua

Severidade — `success`, `danger`, `warn`, `info` — é semântica do tema, com
rampas publicadas. O Kickside a rederivou **dezesseis vezes em quatro esquemas
de nomenclatura** (`tone-gn`, `t-ok`, `kx-tone-success`, `tone-success`). O mesmo
nome de classe significava três cores diferentes em três módulos, então publicar
qualquer uma das definições teria silenciosamente repintado as outras.

```css
/* RUIM — severidade rederivada sob um nome local ao módulo */
.tone-gn { color: #16a34a; }

/* BOM — severidade vinda do tema */
.status-dot.success { background: var(--p-success-500); }
```

Um *tone* ainda pode existir na camada compartilhada — mas apenas como **cor
decorativa de categoria**, nunca como severidade. Se puder significar "isto
falhou", é severidade e é do tema.

### Vocabulário compartilhado para o qual o tema não tem lugar

```css
/* BOM — o PrimeVue não entrega Card, nem Header de surface, nem EmptyState.
   Isso se repete entre módulos sem nada do tema por trás, então é exatamente
   para isso que a camada compartilhada existe. */
@import "@kickside/ui-kit/kx-card.css";
@import "@kickside/ui-kit/kx-state.css";
```

### Adotar significa importar *e apagar*

Um `@import` de CSS precisa vir antes de qualquer outra regra em uma folha. A
folha compartilhada, portanto, sempre chega **primeiro**, e qualquer coisa que o
módulo declare depois a supera em igualdade de especificidade. Um módulo que
importa o pacote e mantém sua própria cópia não mudou absolutamente nada.

```css
/* RUIM — o import é inerte; a cópia local continua vencendo */
@import "@kickside/ui-kit/kx-card.css";
.kx-card { border-radius: 14px; border: 1px solid var(--p-content-border-color); }

/* BOM — importe, apague a cópia local, mantenha apenas um delta documentado */
@import "@kickside/ui-kit/kx-card.css";
/* Os cards desta surface ficam inline em uma lista densa, então perdem a elevação. */
.kx-card:hover { transform: none; }
```

Mantenha **apenas o delta** — nunca reescreva o corpo inteiro. E nunca junte
duas intenções em um nome: se um nome de classe significa coisas diferentes em
dois módulos, são dois conceitos usando um nome só. Divida o nome; não escolha
um vencedor e repinte o perdedor.

### Especificidade contra o tema

O CSS do módulo é injetado primeiro no shadow root; a folha PrimeVue do tema é
anexada depois. Ambas são elementos `<style>`, então **a ordem no documento
decide e o tema vem em segundo**. Uma regra de módulo que precisa vencer uma
classe de componente do tema precisa de mais *especificidade* — não de uma linha
mais adiante no arquivo. (`adoptedStyleSheets` carrega o CSS customizado da
facade, não o tema, então recorrer a uma adopted sheet também não vence isso.)

Isso morde com mais força em classes pass-through, onde sua classe pousa *em* um
elemento do tema:

```css
/* RUIM — esta classe é aplicada ao próprio elemento de rodapé do PrimeVue, então
   em igualdade de especificidade o tema vence e o padding nunca se aplica. */
.kx-modal-foot { padding: 14px 18px; }

/* BOM — escopado sob a raiz do dialog, então supera o tema em especificidade */
.kx-modal > .kx-modal-foot { padding: 14px 18px; }
```

## O que a camada compartilhada pode conter

Tudo o que um conjunto de módulos genuinamente compartilha e que o tema não
possui: vocabulário CSS, tokens derivados, componentes internos, helpers,
harness de teste. A duplicação é idêntica em natureza — o Kickside tinha
dezenove cópias de um mesmo bootstrap de teste ao lado do seu CSS clonado.

**Entregue em pedaços semânticos.** Cada unidade deve ser um conceito nomeado
sobre o qual um consumidor consiga raciocinar — `kx-card`, `kx-state`,
`kx-tag`. Prefira pacotes mais granulares para que um consumidor leve apenas o
que precisa; um único pacote entregando várias unidades claramente nomeadas é
viável, mas não é o formato a perseguir.

**Nunca um catch-all.** Nada de `common`, nada de `shared`, nada de `misc`, nada
de `utils`. Uma unidade cujo nome não diz o que há dentro dela vai acumular tudo
o que não tinha para onde ir, e você terá reconstruído o problema que esta
camada existe para resolver.

## Normalizar é uma mudança visual

Consolidar cópias que divergiram move pixels. O Kickside tinha um seletor com
**dezenove definições em dezessete corpos distintos**. Faça o diff de cada
corpo, escolha o cânone, registre por que você o escolheu, mantenha a divergência
deliberada como um override documentado — e olhe para o resultado. Testes
unitários não enxergam layout.

## Relacionado

- [Temas](./micro-frontends/theming.md) — o catálogo de tokens e como o
  tema alcança tanto o host quanto os filhos
- [Checklist de conformidade](./micro-frontends/compliance-checklist.md) — as
  regras por módulo contra as quais um frontend é verificado
- [Artefatos de Tempo de Build](../guides/artifacts.md) — declarando o pacote e
  materializando-o em um consumidor
- [Gerenciamento de Dependências](../guides/dependency-management.md) —
  declarando e resolvendo o que um módulo consome
