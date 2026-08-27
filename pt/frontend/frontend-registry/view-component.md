---
title: "Web Components (view.component)"
description: "Referência para declarar, servir e registrar um elemento personalizado view.component reutilizável no Web Host."
---

# Web Components (view.component)

Uma entrada `view.component` descreve um elemento personalizado reutilizável
que o Web Host pode descobrir, injetar e registrar automaticamente. Ao
contrário de uma página, o componente não tem iframe próprio: ele é uma tag
HTML personalizada que pode aparecer onde uma página ou um template do host a
posicionar.

Para orientações sobre a implementação, consulte
[Web Component](../micro-frontends/web-component.md).

## Campos do frontend (bloco wippy de package.json)

O desenvolvedor frontend define estes campos no bloco `wippy` de
`package.json`. O plugin do Vite os incorpora em `wippy-meta.json` durante o
build, e `wippy/views` os lê dali como valores padrão.

> **O YAML pode substituir `tagName`, `props` e `events` por meio de
> `meta.tag_name`, `meta.props` e `meta.events`.** A configuração de build
> seleciona `wippyComponentPlugin()`. O `type` opcional do pacote é metadado
> validado pelo plugin selecionado quando presente; ele não tem override YAML
> separado.

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `type` | string | `"widget"` no descriptor de runtime | Opcional; quando presente, deve ser `"component"` ou `"widget"`. A configuração de build, e não este campo, escolhe o plugin do Vite |
| `tagName` | string | — | Nome do elemento personalizado. O plugin 0.0.56 exige um nome ASCII em minúsculas que comece por letra, contenha hífen, use apenas letras, dígitos e hífens e não seja um nome reservado de custom element HTML |
| `props` | object | — | JSON Schema dos atributos aceitos pelo componente |
| `events` | object | — | JSON Schema dos eventos DOM personalizados emitidos pelo componente |

### `wippy.type` em `package.json`

Pacotes de web component podem definir `"type": "widget"` ou
`"type": "component"` — nunca `"page"` — no bloco `wippy`. O template de
app usa `"widget"`; o plugin de componente aceita qualquer uma dessas opções
ou a ausência do campo e rejeita metadados de página.

```json
{
  "specification": "wippy-component-1.0",
  "wippy": {
    "tagName": "example-reaction-bar",
    "type": "widget",
    "props": {
      "type": "object",
      "properties": {}
    },
    "events": {
      "type": "object",
      "properties": {}
    }
  }
}
```
Na implantação, `meta.tag_name` no YAML do operador é autoritativo e
substitui o valor empacotado. `wippy.tagName`, gravado em `wippy-meta.json`
a partir de `package.json`, é o fallback quando a entrada YAML omite
`tag_name` (ordem: `meta.tag_name` do YAML → `wippy.tagName` empacotado).
Mantenha os valores sincronizados; em caso de diferença, o YAML vence.

### Schema de props

A chave `wippy.props` de `package.json` contém um objeto JSON Schema que
descreve os atributos aceitos. O plugin do Vite o inclui em
`wippy-meta.json`, e o Web Host o usa ao expor metadados a consumidores como o
renderer de artefatos do chat e o sanitizador de tags. Este último precisa
conhecer os atributos legítimos para não removê-los.

```json
{
  "wippy": {
    "props": {
      "type": "object",
      "properties": {
        "reactions": {
          "type": "array",
          "items": { "type": "string" },
          "default": ["👍", "👎", "❤️", "🎉", "🤔"],
          "description": "Array of emoji reactions to display"
        },
        "allow-multiple": {
          "type": "boolean",
          "default": false,
          "description": "Whether multiple reactions can be active simultaneously"
        }
      }
    }
  }
}
```
Os nomes em `properties` seguem a convenção de atributos HTML (kebab-case).
Os valores `default` do schema também são aplicados em runtime pelo parser de
props do web component quando um atributo está ausente.

### Schema de eventos

A chave `wippy.events` segue a mesma forma de props, mas descreve os eventos
DOM personalizados emitidos pelo componente via `useEvents()`. Cada chave é o
nome de um evento, e o valor é um JSON Schema do payload em `detail`.

```json
{
  "wippy": {
    "events": {
      "type": "object",
      "properties": {
        "reaction": {
          "type": "object",
          "properties": {
            "emoji": { "type": "string" },
            "count": { "type": "number" },
            "active": { "type": "boolean" }
          },
          "description": "Fired when a reaction is toggled"
        }
      }
    }
  }
}
```
O sanitizador de mensagens do chat no Web Host inclui na allowlist os atributos
presentes em `wippy.props.properties` do descriptor projetado. Antes de esse
descriptor chegar ao Host, `meta.props` do registry substitui o valor
`wippy.props` empacotado. Os schemas de eventos documentam eventos
personalizados para ferramentas e consumidores; eles não autorizam atributos
de listener DOM em conteúdo de chat sanitizado.

## Configuração do operador (_index.yaml)

Estes campos ficam no bloco `meta` da entrada de registry em `_index.yaml`.
A maioria expressa política de implantação — roteamento, acesso e entrega — e
não tem superfície correspondente em `package.json` (`announced`, `secure`,
`url`, `auto_register`). `tag_name` e `entry_point` são diferentes:
nascem no frontend em `package.json`, entram em `wippy-meta.json` e as chaves
YAML são apenas overrides opcionais por implantação.

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `tag_name` | string | `wippy.tagName` | Definido como `wippy.tagName` em `package.json` e obrigatório para o plugin; a chave YAML substitui o valor empacotado. Mantenha o override válido no navegador e sincronizado com o nome aceito pelo plugin |
| `announced` | boolean | `false` | Deve ser `true` para aparecer em `/api/public/components/list`; usa `meta.public` como fallback quando definido |
| `auto_register` | boolean | `false` | Com `true`, o Web Host carrega e registra o componente na inicialização |
| `secure` | boolean | `false` | Exige autenticação |
| `url` | string | — | Caminho de montagem estática do bundle compilado |
| `base_path` | string | `""` | Subcaminho opcional acrescentado a `url` para formar a raiz do projeto; a URL do bundle é `<url>/<base_path>/<entry_point>`. Tem o mesmo comportamento de páginas, embora os templates atuais omitam esse campo |
| `entry_point` | string | `wippy.browser` → `index.js` | Definido pelo campo `browser` de nível superior em `package.json` e incorporado em `wippy-meta.json`; a chave YAML substitui o valor empacotado, com fallback em `index.js`. O host injeta este módulo como `<script type="module">` |

Uma entrada mínima:

```yaml
- name: reaction-bar
  kind: registry.entry
  meta:
    type: view.component
    name: reaction-bar
    tag_name: example-reaction-bar
    announced: true
    secure: false
    auto_register: true
    url: /app/wc/reaction-bar
    entry_point: index.js
```
## Os três gates do carregamento automático

Para o Web Host carregar um componente automaticamente, as três condições
precisam ser verdadeiras ao mesmo tempo:

1. **`announced: true`** — `wippy/views` filtra por esta flag no servidor em
   `list_components.lua`. Não existe parâmetro de query que contorne o filtro.
   Com `announced: false`, o componente nunca aparece em
   `/api/public/components/list`.

2. **`auto_register: true`** — `loadGlobalAutoloadWidgets` consulta o endpoint
   com `?auto_register=true`. Componentes sem a flag ficam fora da resposta.

3. **A tag ainda não está registrada** — antes de injetar o script, o host
   verifica `customElements.get(tagName)`. Se a tag já existe, por exemplo
   depois de uma navegação, a injeção é ignorada para evitar uma segunda
   definição.

Se algum gate faltar, o componente fica ausente sem erro visível. Para
verificar, consulte
`/api/public/components/list?auto_register=true`; a tag precisa estar na
resposta.

## Sequência de carregamento automático

Durante a inicialização do Web Host, cada contexto responsável pelo autoload
global executa a sequência abaixo. Ela não se repete a cada montagem de página:

1. `GET /api/public/components/list?auto_register=true` busca todos os
   componentes anunciados e configurados para registro automático.

2. Para cada componente cujo `customElements.get(tagName)` é `undefined`, o
   host acrescenta ao `document.head`:

   ```html
   <script type="module" src="/app/wc/reaction-bar/index.js?declare-tag=example-reaction-bar"></script>
   ```
3. O chunk de entrada chama `define(import.meta.url, ElementClass)`. Os autores
   importam `define` de `@wippy-fe/webcomponent-vue` ou
   `@wippy-fe/webcomponent-core`, que reexportam a função da proxy. Em runtime,
   o import map resolve tudo para a única instância de `@wippy-fe/proxy`.
   `define` lê
   `new URL(import.meta.url).searchParams.get('declare-tag')` e chama
   `customElements.define(tagName, ElementClass)`.

4. Vue — ou outro framework — renderiza `<example-reaction-bar>`. O navegador
   faz o upgrade do elemento, `connectedCallback` é acionado e
   `WippyVueElement` monta o app Vue dentro de um shadow root.

## Quando usar `auto_register: false`

`auto_register: false` exclui o componente da varredura global. Use-o quando:

- o componente é grande e só deve carregar em páginas que o solicitam;
- o registro ocorre no ponto de uso por
  `loadByTagName('example-heavy-chart')`, importado de `@wippy-fe/proxy`;
- o componente é uma peça interna de outro bundle e não uma custom element
  independente.

```ts
import { loadByTagName } from '@wippy-fe/proxy'

await loadByTagName('example-heavy-chart')
```
O registro lazy reduz o peso da carga inicial. Ainda assim, o componente
precisa de `announced: true` para que `loadByTagName()` o resolva pela API:
o endpoint `GET /components/by-tag/{tag}` devolve
`404 "Component is not announced"` quando a flag é `false`.
