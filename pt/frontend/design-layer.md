---
title: "A camada de design"
description: "Como distribuir estilos e componentes frontend entre o tema, um pacote de design compartilhado e cada módulo."
---

# A camada de design

Esta página orienta decisões sobre propriedade de design. Os trechos de CSS e
componentes são padrões parciais que pressupõem um pacote frontend Wippy e um
build já existentes.

Um frontend Wippy pode reunir muitos módulos publicados de forma independente
em uma aplicação. O **tema** alcança todas as superfícies, enquanto cada
**módulo** controla sua apresentação local. Uma **camada de design
compartilhada** cobre o caso mais estreito em que vários módulos dividem um
conceito que o tema não oferece.

## As camadas

| Camada | Alcance | Responsabilidade |
|---|---|---|
| **Tema** | *Todas* as superfícies, inclusive módulos que você não controla | Componentes PrimeVue, tokens semânticos compartilhados e classes documentadas |
| **Camada de design compartilhada** | Apenas os módulos que a adotam | Vocabulário comum sem componente tematizado correspondente |
| **Módulo** | O próprio módulo | O que é realmente específico de uma superfície |

### O tema é universal — e essa é a restrição

O tema estiliza markup que **você não controla**. Qualquer módulo, inclusive um
plugin externo cujo autor nunca viu sua aplicação, renderiza no mesmo host e
recebe o mesmo tema. Essa universalidade é útil, mas impõe duas regras:

**Nada específico de uma aplicação pode entrar no tema**, pois seria imposto a
todos os módulos.

**Um módulo não pode depender de extensões específicas da aplicação no tema.**
O contrato é formado por componentes PrimeVue, tokens semânticos compartilhados
do Wippy e classes documentadas. Presets próprios do PrimeVue também não fazem
parte do contrato: o Wippy executa PrimeVue com `theme: 'none'`.

```css
/* GOOD — shared Wippy semantic tokens, present for every module */
.my-panel {
  color: var(--p-text-color);
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
}

/* BAD — an application-specific token. Your module now only works inside
   one app, and silently loses the declaration anywhere else: an undefined
   custom property makes the declaration invalid at computed-value time, so
   it drops and the element quietly inherits instead. */
.my-panel { background: var(--kx-surface-2); }
```
Essa regra também responde à pergunta “posso colocar nosso vocabulário
compartilhado na facade?”. Somente se ele realmente precisar alcançar markup
arbitrário que você não controla. Se o escopo for o conjunto dos seus módulos,
ele pertence à camada abaixo.

### A base e quando um componente pode optar por não usá-la

PrimeVue e Tailwind, entregues pelo host, são a base recomendada. Um componente
pode optar por não usá-la, mas cada necessidade convencional acrescenta uma
obrigação:

| O componente… | Deve carregar |
|---|---|
| é neutro em apresentação — canvas, SVG ou gráfico sem controles, tokens, utilities nem rolagem | nada: `hostCssKeys: []` |
| usa tokens semânticos ou modo escuro | `themeConfigUrl` |
| pode rolar | `iframeCssUrl` |
| renderiza Markdown | `markdownCssUrl` |
| usa utilities Tailwind para layout ou espaçamento | `primeVueCssUrl` (o Host inclui Tailwind nesse asset) |
| renderiza algo para o qual PrimeVue oferece componente — botão, input, formulário, tabela, dialog, menu, tag, tooltip ou controle de feedback | `primeVueCssUrl` **e** `PrimeVuePlugin` |

Um gráfico em canvas é o exemplo legítimo de opt-out. Ao receber uma toolbar,
deixa de ser neutro: o botão deve ser PrimeVue e traz a integração correspondente.

**As utilities Tailwind chegam por `primeVueCssUrl`.** Não existe uma chave
separada de CSS Tailwind do host. Use utilities para layout e espaçamento quando
elas deixam o componente claro; CSS portável do próprio módulo continua válido
quando expressa melhor o design. `preflightCssUrl` não integra a união de
chaves: se o preflight for indispensável no shadow root, carregue-o de forma
imperativa, o que raramente é necessário.

Na prática, a base já cobre a maior parte das necessidades. A camada
compartilhada é estreita e não deve reconstruir PrimeVue ou Tailwind. Consulte
[Injeção de CSS](./web-host/css-injection.md).

### A camada de design compartilhada

Alguns conceitos se repetem em um conjunto conhecido de módulos sem terem
contrato no tema: resumo de correspondências do domínio, cabeçalho de
superfície, empty state ou escala própria de tags. Eles pertencem à camada
compartilhada.

Essa camada é publicada como **pacote** e materializada em cada consumidor
durante o build. Um alias de caminho não basta, pois consumidores podem viver
em repositórios diferentes. O módulo remoto precisa conseguir obter o pacote e
compilar.

O produtor declara o pacote como **artefato de build**, e cada consumidor o
materializa em sua árvore. Consulte
[Artefatos de build](../guides/artifacts.md) para `node-package`, a
reconciliação feita pelo runtime e o glue que o build ainda precisa fornecer.

### O módulo

Todo o restante, inclusive divergências deliberadas do vocabulário compartilhado.

## Como decidir onde algo deve ficar

Pergunte nesta ordem; o primeiro “sim” vence:

1. **É um valor?** Cor, raio, espaçamento, elevação ou severidade.
   → **Tema.** Leia um token semântico, nunca um literal.
2. **O tema já oferece um componente?** Button, Dialog, Select ou Tag.
   → **Tema.** Use o componente e coloque uma classe nele quando necessário.
3. **Dois ou mais módulos precisam do mesmo conceito sem componente tematizado
   correspondente?** → **Camada de design compartilhada.**
4. Caso contrário → **Módulo.**

## Exemplos práticos

Os exemplos usam o prefixo `kx-` para classes e folhas específicas da
aplicação. As regras valem para qualquer aplicação Wippy.

### Nunca reconstrua um componente tematizado

PrimeVue fornece `Button`. Substituí-lo por `.kx-btn` em um `<button>`
nativo cria uma segunda implementação, sujeita a divergir na interação e no
visual.

**Ruim:** botão nativo com `.kx-btn .kx-btn-primary`.

**Bom:** componente tematizado com uma classe aplicada somente quando
necessário.

```vue
<Button label="Save" class="kx-save" />
```
Quando o componente tematizado não se encaixar perfeitamente, isso não
autoriza reconstruí-lo. Aplique uma classe ao componente e estilize-a na facade
se a mudança for global, ou no módulo se for local.

### A severidade pertence ao tema, não ao módulo

`success`, `danger`, `warn` e `info` são semânticas do tema com escalas
publicadas. Recriá-las com nomes locais produz definições concorrentes.

```css
/* BAD — severity re-derived under a module-local name */
.tone-gn { color: #16a34a; }

/* GOOD — severity from the theme */
.status-dot.success { background: var(--p-success-500); }
```
Um *tone* pode existir na camada compartilhada apenas como cor decorativa de
categoria, nunca como severidade. Se puder significar “isto falhou”, pertence
ao tema.

### Vocabulário compartilhado que não pertence ao tema

```css
/* GOOD — this application-specific card contract and empty-state vocabulary
   recur across modules. PrimeVue's generic Card does not define these domain
   semantics, so the shared layer owns them. */
@import "@kickside/ui-kit/kx-card.css";
@import "@kickside/ui-kit/kx-state.css";
```
### Adotar significa importar *e excluir*

Um `@import` CSS precisa vir antes de qualquer outra regra. A folha
compartilhada entra primeiro; declarações locais posteriores vencem em
especificidade igual. Importar o pacote e manter a cópia local não muda nada.

```css
/* BAD — the import is inert; the local copy still wins */
@import "@kickside/ui-kit/kx-card.css";
.kx-card { border-radius: 14px; border: 1px solid var(--p-content-border-color); }

/* GOOD — import, delete the local copy, keep only a documented delta */
@import "@kickside/ui-kit/kx-card.css";
/* This surface's cards are inline in a dense list, so they lose the lift. */
.kx-card:hover { transform: none; }
```
Mantenha somente o **delta**; nunca repita todo o corpo. Não una duas intenções
sob o mesmo nome. Se a classe significa coisas distintas em dois módulos, são
dois conceitos e precisam de nomes distintos.

### Especificidade em relação ao tema

O CSS do módulo é injetado primeiro no shadow root, e a folha PrimeVue do tema
vem depois. Como ambos são `<style>`, a ordem favorece o tema. Para vencer uma
classe tematizada, a regra do módulo precisa de mais **especificidade**, não de
uma linha posterior no arquivo. `adoptedStyleSheets` carrega o CSS
personalizado da facade, não o tema.

Isso aparece com frequência em classes pass-through aplicadas diretamente ao
elemento tematizado:

```css
/* BAD — this class is applied to PrimeVue's own footer element, so at equal
   specificity the theme wins and the padding never applies. */
.kx-modal-foot { padding: 14px 18px; }

/* GOOD — scoped under the dialog root, so it out-specifies the theme */
.kx-modal > .kx-modal-foot { padding: 14px 18px; }
```
## O que a camada compartilhada pode conter

Ela pode conter tudo o que um conjunto de módulos realmente compartilha e o
tema não controla: vocabulário CSS, tokens derivados, componentes internos,
helpers e harnesses de teste.

**Use unidades semânticas.** Cada unidade deve representar um conceito nomeado,
como `kx-card`, `kx-state` ou `kx-tag`. Prefira pacotes pequenos para que o
consumidor leve apenas o necessário.

**Use nomes específicos.** Evite `common`, `shared`, `misc` e `utils`.
Nomes vagos acumulam conceitos não relacionados e recriam a duplicação que a
camada deveria eliminar.

## Normalizar é uma mudança visual

Consolidar cópias divergentes pode mudar a renderização. Compare definições,
escolha a versão canônica, registre o motivo, mantenha divergências deliberadas
como overrides documentados e inspecione o resultado visualmente. Testes
unitários não detectam layout.

## Conteúdo relacionado

- [Criação de temas](./micro-frontends/theming.md) — catálogo de tokens e
  propagação do tema;
- [Checklist de conformidade](./micro-frontends/compliance-checklist.md) —
  regras por módulo;
- [Artefatos de build](../guides/artifacts.md) — declaração e materialização do
  pacote;
- [Gerenciamento de dependências](../guides/dependency-management.md) —
  declaração e resolução do que um módulo consome.
